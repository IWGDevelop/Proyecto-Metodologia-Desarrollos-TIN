'use server'
/* eslint-disable @typescript-eslint/no-explicit-any -- patrón (supabase as any) del repo */

import { createAdminClient } from '@/lib/supabase/admin'
import { getUsuarioActual, puedeGestionar, NO_AUTORIZADO } from '@/lib/supabase/guards'
import { idsConRecurso } from '@/lib/tickets/acceso-gestion'
import { diasAbiertoBug } from '@/lib/tickets/bugs'
import { codigoBug, codigoTicket, ESTADOS_ABIERTOS, RECURSOS_TICKETS } from '@/lib/tickets/constantes'
import { cargarCalendarioLaboral, fechaLocal } from '@/lib/tickets/horas-habiles'
import { nivelRecordatorio, type NivelRecordatorio } from '@/lib/tickets/semaforo'
import { calcularTiempos, cargarHistorialTiempos, cargarObjetivos, elegirObjetivo, leerTodo } from '@/lib/tickets/tiempos'
import type { EstadoBug, EstadoTicket, PrioridadTicket, SeMideContra, SeveridadBug } from '@/lib/tickets/types'

// Datos del dashboard de tickets (/admin/tickets-dashboard).
// Tickets del periodo con sus tiempos (ticket_tiempos), abiertos con tiempos en vivo
// (calculados desde el historial al momento de la consulta), objetivos vigentes,
// novedades IGSI por tipo de causa y bugs abiertos. Las agregaciones por responsable,
// categoría, etc. se hacen en el cliente sobre estas filas (también se exportan).

export interface FiltrosDashboard {
  /** "YYYY-MM-DD" (fecha local de creación) */
  desde: string
  hasta: string
  responsableId?: string
  categoriaId?: string
  area?: string
}

export interface FilaTicketDashboard {
  id: string
  codigo: string
  asunto: string
  estado: EstadoTicket
  prioridad: PrioridadTicket
  area: string | null
  categoria: string
  tipologia: string
  se_mide_contra: SeMideContra
  responsable_id: string | null
  responsable: string
  fecha_creacion: string
  fecha_requerida: string | null
  t_asignacion: number | null
  t_primera_respuesta: number | null
  t_solucion: number | null
  t_espera_aprobacion: number
  t_espera_usuario: number
  t_espera_proveedor: number
  t_confirmacion: number | null
  t_total: number | null
  t_consumido: number | null
  reaperturas: number
  cumple_respuesta: boolean | null
  cumple_solucion: boolean | null
  dias_vs_fecha_requerida: number | null
  objetivo_respuesta: number | null
  objetivo_solucion: number | null
  respondido: boolean
  /** Solo abiertos: horas hábiles de respuesta consumidas sin responder */
  horas_respuesta: number | null
  nivel: NivelRecordatorio | null
}

export interface ObjetivoDashboard {
  prioridad: PrioridadTicket
  horas_respuesta: number
  horas_solucion: number
  vigente_desde: string
  aprobado: boolean
}

export interface DatosDashboard {
  filtros: FiltrosDashboard
  opciones: {
    responsables: { id: string; nombre: string }[]
    categorias: { id: string; nombre: string }[]
    areas: string[]
  }
  periodo: FilaTicketDashboard[]
  abiertos: FilaTicketDashboard[]
  objetivos: ObjetivoDashboard[]
  objetivosPendientes: boolean
  igsi: {
    total: number
    tecnicas: number
    conceptuales: number
    otras: number
    conceptualesPorArea: { area: string; n: number }[]
    porSubcausa: { tipo: string; subcausa: string; n: number }[]
  }
  bugs: {
    porSeveridad: { severidad: SeveridadBug; abiertos: number; diasPromedio: number | null }[]
    recurrencia: { id: string; codigo: string; titulo: string; estado: EstadoBug; ticketsPeriodo: number; ticketsTotal: number }[]
  }
  generado: string
}

const SEVERIDADES: SeveridadBug[] = ['BLOQUEANTE', 'ALTA', 'MEDIA', 'BAJA']
const SELECT_TICKET =
  'id, numero, asunto, estado, prioridad, area, categoria_id, responsable_id, fecha_creacion, fecha_requerida, fecha_primera_respuesta, ' +
  'categoria:ticket_categorias(nombre), tipologia:ticket_tipologias(nombre, se_mide_contra, visibilidad_restringida, es_novedad_igsi), ' +
  'responsable:perfiles!responsable_id(nombre_completo)'

const normal = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const esFecha = (s: string | undefined) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s)

function sumarDia(fecha: string): string {
  const [y, m, d] = fecha.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10)
}

export async function obtenerDashboardTickets(entrada: Partial<FiltrosDashboard> = {}): Promise<DatosDashboard> {
  const actual = await getUsuarioActual()
  if (!actual || !(await puedeGestionar(RECURSOS_TICKETS.MENU_DASHBOARD))) throw new Error(NO_AUTORIZADO)
  const verRestringidas = await puedeGestionar(RECURSOS_TICKETS.RESTRINGIDAS)

  const ahora = new Date()
  const hoy = fechaLocal(ahora)
  const hace30 = fechaLocal(new Date(ahora.getTime() - 29 * 86_400_000))
  const filtros: FiltrosDashboard = {
    desde: esFecha(entrada.desde) ? entrada.desde! : hace30,
    hasta: esFecha(entrada.hasta) ? entrada.hasta! : hoy,
    responsableId: entrada.responsableId || undefined,
    categoriaId: entrada.categoriaId || undefined,
    area: entrada.area || undefined,
  }
  if (filtros.hasta < filtros.desde) [filtros.desde, filtros.hasta] = [filtros.hasta, filtros.desde]

  const supabase = createAdminClient()
  const sb = supabase as any

  const filtrar = (q: any) => {
    if (filtros.responsableId === 'SIN') q = q.is('responsable_id', null)
    else if (filtros.responsableId) q = q.eq('responsable_id', filtros.responsableId)
    if (filtros.categoriaId) q = q.eq('categoria_id', filtros.categoriaId)
    if (filtros.area) q = q.eq('area', filtros.area)
    return q
  }

  const [cal, objetivosTodos, filasPeriodo, filasAbiertos, categorias, idsResp, areasData] = await Promise.all([
    cargarCalendarioLaboral(supabase),
    cargarObjetivos(supabase),
    leerTodo<any>((d, h) =>
      filtrar(sb.from('tickets').select(SELECT_TICKET))
        .gte('fecha_creacion', `${filtros.desde}T00:00:00-05:00`)
        .lt('fecha_creacion', `${sumarDia(filtros.hasta)}T00:00:00-05:00`)
        .order('numero', { ascending: true })
        .range(d, h),
    ),
    leerTodo<any>((d, h) =>
      filtrar(sb.from('tickets').select(SELECT_TICKET)).in('estado', ESTADOS_ABIERTOS).order('numero', { ascending: true }).range(d, h),
    ),
    sb.from('ticket_categorias').select('id, nombre').order('orden').then((r: any) => (r.data ?? []) as { id: string; nombre: string }[]),
    idsConRecurso(supabase, RECURSOS_TICKETS.ATENDER),
    leerTodo<{ area: string | null }>((d, h) => sb.from('tickets').select('area').not('area', 'is', null).range(d, h)),
  ])

  // Tiempos guardados de los tickets del periodo
  const tiemposGuardados = new Map<string, any>()
  const idsPeriodo = filasPeriodo.map(t => t.id as string)
  for (let i = 0; i < idsPeriodo.length; i += 200) {
    const { data } = await sb.from('ticket_tiempos').select('*').in('ticket_id', idsPeriodo.slice(i, i + 200))
    for (const r of data ?? []) tiemposGuardados.set(r.ticket_id, r)
  }

  // Abiertos: tiempos en vivo desde el historial
  const historial = await cargarHistorialTiempos(supabase, filasAbiertos.map(t => t.id as string))

  const { data: reglasData } = await sb
    .from('ticket_reglas_recordatorio')
    .select('disparador, porcentaje, nombre')
    .eq('activa', true)
    .in('disparador', ['RESPUESTA', 'SOLUCION'])
  const reglas = ((reglasData ?? []) as { disparador: string; porcentaje: number | null; nombre: string }[])
    .map(r => ({ ...r, porcentaje: r.porcentaje == null ? null : Number(r.porcentaje) }))

  const base = (t: any) => {
    const restringida = !!t.tipologia?.visibilidad_restringida && !verRestringidas
    const obj = elegirObjetivo(objetivosTodos, t.prioridad, t.fecha_creacion)
    return {
      id: t.id as string,
      codigo: codigoTicket(Number(t.numero)),
      asunto: restringida ? 'Ticket de visibilidad restringida' : (t.asunto as string),
      estado: t.estado as EstadoTicket,
      prioridad: t.prioridad as PrioridadTicket,
      area: (t.area as string | null) ?? null,
      categoria: t.categoria?.nombre ?? '—',
      tipologia: t.tipologia?.nombre ?? '—',
      se_mide_contra: (t.tipologia?.se_mide_contra ?? 'SLA') as SeMideContra,
      responsable_id: (t.responsable_id as string | null) ?? null,
      responsable: t.responsable?.nombre_completo ?? 'Sin asignar',
      fecha_creacion: t.fecha_creacion as string,
      fecha_requerida: (t.fecha_requerida as string | null) ?? null,
      objetivo_respuesta: obj?.horas_respuesta ?? null,
      objetivo_solucion: obj?.horas_solucion ?? null,
    }
  }
  const num = (v: unknown) => (v == null ? null : Number(v))

  const periodo: FilaTicketDashboard[] = filasPeriodo.map(t => {
    const g = tiemposGuardados.get(t.id)
    return {
      ...base(t),
      t_asignacion: num(g?.t_asignacion),
      t_primera_respuesta: num(g?.t_primera_respuesta),
      t_solucion: num(g?.t_solucion),
      t_espera_aprobacion: Number(g?.t_espera_aprobacion ?? 0),
      t_espera_usuario: Number(g?.t_espera_usuario ?? 0),
      t_espera_proveedor: Number(g?.t_espera_proveedor ?? 0),
      t_confirmacion: num(g?.t_confirmacion),
      t_total: num(g?.t_total),
      t_consumido: num(g?.t_consumido),
      reaperturas: Number(g?.reaperturas ?? 0),
      cumple_respuesta: g?.cumple_respuesta ?? null,
      cumple_solucion: g?.cumple_solucion ?? null,
      dias_vs_fecha_requerida: num(g?.dias_vs_fecha_requerida),
      respondido: g?.t_primera_respuesta != null || !!t.fecha_primera_respuesta,
      horas_respuesta: null,
      nivel: null,
    }
  })

  const abiertos: FilaTicketDashboard[] = filasAbiertos.map(t => {
    const b = base(t)
    const obj = elegirObjetivo(objetivosTodos, t.prioridad, t.fecha_creacion)
    const r = calcularTiempos(
      {
        fecha_creacion: t.fecha_creacion,
        estado: t.estado,
        prioridad: t.prioridad,
        fecha_requerida: t.fecha_requerida,
        fecha_primera_respuesta: t.fecha_primera_respuesta,
        se_mide_contra: b.se_mide_contra,
      },
      historial.get(t.id) ?? [],
      obj,
      cal,
      ahora,
    )
    const { detalle, ...fila } = r
    return {
      ...b,
      ...fila,
      respondido: detalle.respondido,
      horas_respuesta: detalle.horasRespuestaConsumidas,
      nivel: nivelRecordatorio(
        { respondido: detalle.respondido, horasRespuesta: detalle.horasRespuestaConsumidas, horasConsumidas: r.t_consumido ?? 0 },
        obj,
        reglas,
      ),
    }
  })

  // Novedades IGSI cerradas del periodo, por tipo de causa
  const idsIgsi = filasPeriodo.filter(t => t.tipologia?.es_novedad_igsi).map(t => t.id as string)
  const areaDe = new Map(filasPeriodo.map(t => [t.id as string, (t.area as string | null) ?? 'Sin área']))
  const igsi = { total: 0, tecnicas: 0, conceptuales: 0, otras: 0, conceptualesPorArea: [] as { area: string; n: number }[], porSubcausa: [] as { tipo: string; subcausa: string; n: number }[] }
  const porArea = new Map<string, number>()
  const porSub = new Map<string, { tipo: string; subcausa: string; n: number }>()
  for (let i = 0; i < idsIgsi.length; i += 200) {
    const { data } = await sb.from('ticket_cierres').select('ticket_id, causa:ticket_causas(tipo_causa, subcausa)').in('ticket_id', idsIgsi.slice(i, i + 200))
    for (const c of (data ?? []) as any[]) {
      const tipo = String(c.causa?.tipo_causa ?? '')
      igsi.total++
      if (normal(tipo).startsWith('tecn')) igsi.tecnicas++
      else if (normal(tipo).startsWith('concep')) {
        igsi.conceptuales++
        const a = areaDe.get(c.ticket_id) ?? 'Sin área'
        porArea.set(a, (porArea.get(a) ?? 0) + 1)
      } else igsi.otras++
      const k = `${tipo}|${c.causa?.subcausa ?? ''}`
      const prev = porSub.get(k) ?? { tipo, subcausa: c.causa?.subcausa ?? '—', n: 0 }
      prev.n++
      porSub.set(k, prev)
    }
  }
  igsi.conceptualesPorArea = [...porArea].map(([area, n]) => ({ area, n })).sort((a, b) => b.n - a.n)
  igsi.porSubcausa = [...porSub.values()].sort((a, b) => b.n - a.n)

  // Bugs
  const [bugsAll, enlaces] = await Promise.all([
    leerTodo<any>((d, h) => sb.from('ticket_bugs').select('id, numero, titulo, estado, severidad, fecha_detectado, fecha_desplegado').range(d, h)),
    leerTodo<{ bug_id: string; fecha_enlace: string }>((d, h) => sb.from('ticket_bug_tickets').select('bug_id, fecha_enlace').range(d, h)),
  ])
  const abiertosBugs = bugsAll.filter(b => b.estado !== 'DESPLEGADO')
  const porSeveridad = SEVERIDADES.map(s => {
    const xs = abiertosBugs.filter(b => b.severidad === s)
    return {
      severidad: s,
      abiertos: xs.length,
      diasPromedio: xs.length ? Math.round(xs.reduce((a, b) => a + diasAbiertoBug(b, ahora), 0) / xs.length) : null,
    }
  })
  const desdeIso = new Date(`${filtros.desde}T00:00:00-05:00`).getTime()
  const hastaIso = new Date(`${sumarDia(filtros.hasta)}T00:00:00-05:00`).getTime()
  const total = new Map<string, number>()
  const enPeriodo = new Map<string, number>()
  for (const e of enlaces) {
    total.set(e.bug_id, (total.get(e.bug_id) ?? 0) + 1)
    const f = new Date(e.fecha_enlace).getTime()
    if (f >= desdeIso && f < hastaIso) enPeriodo.set(e.bug_id, (enPeriodo.get(e.bug_id) ?? 0) + 1)
  }
  const recurrencia = bugsAll
    .map(b => ({
      id: b.id as string,
      codigo: codigoBug(Number(b.numero)),
      titulo: b.titulo as string,
      estado: b.estado as EstadoBug,
      ticketsPeriodo: enPeriodo.get(b.id) ?? 0,
      ticketsTotal: total.get(b.id) ?? 0,
    }))
    .filter(b => b.ticketsTotal > 0)
    .sort((a, b) => b.ticketsPeriodo - a.ticketsPeriodo || b.ticketsTotal - a.ticketsTotal)
    .slice(0, 10)

  // Opciones de filtros
  const { data: perfilesResp } = idsResp.length
    ? await sb.from('perfiles').select('id, nombre_completo').in('id', idsResp).order('nombre_completo')
    : { data: [] }
  const responsables = ((perfilesResp ?? []) as { id: string; nombre_completo: string }[]).map(p => ({ id: p.id, nombre: p.nombre_completo }))
  // Responsables que tienen tickets aunque ya no tengan el permiso
  for (const t of [...periodo, ...abiertos]) {
    if (t.responsable_id && !responsables.some(r => r.id === t.responsable_id)) responsables.push({ id: t.responsable_id, nombre: t.responsable })
  }
  const areas = [...new Set(areasData.map(a => a.area).filter((a): a is string => !!a))].sort()

  // Objetivos vigentes hoy
  const objetivos: ObjetivoDashboard[] = (['CRITICA', 'ALTA', 'MEDIA', 'BAJA'] as PrioridadTicket[])
    .map(p => elegirObjetivo(objetivosTodos, p, ahora))
    .filter((o): o is NonNullable<typeof o> => !!o)
    .map(o => ({ prioridad: o.prioridad, horas_respuesta: o.horas_respuesta, horas_solucion: o.horas_solucion, vigente_desde: o.vigente_desde, aprobado: o.aprobado }))

  return {
    filtros,
    opciones: { responsables, categorias, areas },
    periodo,
    abiertos,
    objetivos,
    objetivosPendientes: objetivos.length < 4 || objetivos.some(o => !o.aprobado),
    igsi,
    bugs: { porSeveridad, recurrencia },
    generado: ahora.toISOString(),
  }
}
