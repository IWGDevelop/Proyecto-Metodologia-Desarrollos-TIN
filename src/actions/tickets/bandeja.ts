'use server'

import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { NO_AUTORIZADO } from '@/lib/supabase/guards'
import {
  contextoTickets,
  esPersonalTIN,
  idsConRecurso,
  puedeGestionarTicket,
  puedeVerTicketGestion,
} from '@/lib/tickets/acceso-gestion'
import { obtenerConfigTickets } from '@/lib/tickets/config'
import { codigoTicket, ESTADOS_ABIERTOS, ESTADOS_ESPERA, RECURSOS_TICKETS, ZONA_HORARIA } from '@/lib/tickets/constantes'
import type {
  AmbitoCausa,
  EstadoTicket,
  ImpactoTicket,
  PrioridadTicket,
  TicketAdjunto,
  TicketCausa,
  TicketHistorial,
  TicketNovedadIGSI,
  TicketTiempos,
  CanalTicket,
  EstadoBug,
  SeveridadBug,
  ClasificacionBug,
} from '@/lib/tickets/types'

// Consultas de la bandeja y de la vista de gestión de TIN.

export interface FiltrosBandeja {
  /** 'ABIERTOS' (por defecto) = todos los estados abiertos; 'TODOS' = sin filtro */
  estado?: EstadoTicket | 'ABIERTOS' | 'TODOS'
  responsableId?: string
  categoriaId?: string
  prioridad?: PrioridadTicket
  vencidos?: boolean
  sinAsignar?: boolean
  misAsignados?: boolean
  q?: string
}

export interface FilaBandeja {
  id: string
  numero: number
  codigo: string
  asunto: string
  estado: EstadoTicket
  prioridad: PrioridadTicket
  categoria: string
  tipologia: string
  restringida: boolean
  solicitante: string
  area: string | null
  responsableId: string | null
  responsable: string | null
  fechaCreacion: string
  fechaRequerida: string | null
  respuestaVencida: boolean
  solucionVencida: boolean
  /** Horas hábiles consumidas (ticket_tiempos.t_consumido) */
  consumido: number | null
  /** Horas objetivo de la fase actual (respuesta si no hay primera respuesta, si no solución) */
  objetivo: number | null
  fase: 'RESPUESTA' | 'SOLUCION' | null
  /** % de tiempo consumido vs. objetivo de la fase */
  porcentaje: number | null
  vencido: boolean
}

export interface KpisBandeja {
  sinAsignar: number
  enProceso: number
  enEspera: number
  vencidos: number
}

interface FilaTicketDB {
  id: string
  numero: number
  asunto: string
  estado: EstadoTicket
  prioridad: PrioridadTicket
  solicitante_id: string
  responsable_id: string | null
  aprobador_id: string | null
  area: string | null
  fecha_creacion: string
  fecha_requerida: string | null
  fecha_primera_respuesta: string | null
  respuesta_vencida: boolean
  solucion_vencida: boolean
  categoria_id: string
  tipologia: { nombre: string; visibilidad_restringida: boolean } | null
  categoria: { nombre: string } | null
}

type Objetivos = Partial<Record<PrioridadTicket, { respuesta: number; solucion: number }>>

function hoyBogota(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: ZONA_HORARIA })
}

/** Objetivo vigente por prioridad (el más reciente con vigente_desde <= hoy) */
async function objetivosVigentes(supabase: SupabaseClient): Promise<Objetivos> {
  try {
    const { data } = await supabase
      .from('ticket_objetivos_tiempo')
      .select('prioridad, horas_respuesta, horas_solucion, vigente_desde')
      .lte('vigente_desde', hoyBogota())
      .order('vigente_desde', { ascending: false })
    const res: Objetivos = {}
    for (const o of (data ?? []) as { prioridad: PrioridadTicket; horas_respuesta: number; horas_solucion: number }[]) {
      if (!res[o.prioridad]) res[o.prioridad] = { respuesta: Number(o.horas_respuesta), solucion: Number(o.horas_solucion) }
    }
    return res
  } catch {
    return {}
  }
}

async function nombres(supabase: SupabaseClient, ids: (string | null | undefined)[]): Promise<Map<string, string>> {
  const unicos = [...new Set(ids.filter((x): x is string => !!x))]
  if (unicos.length === 0) return new Map()
  const { data } = await supabase.from('perfiles').select('id, nombre_completo').in('id', unicos)
  return new Map((data ?? []).map((p: { id: string; nombre_completo: string }) => [p.id, p.nombre_completo]))
}

function semaforo(
  t: { prioridad: PrioridadTicket; estado: EstadoTicket; fecha_primera_respuesta: string | null; respuesta_vencida: boolean; solucion_vencida: boolean },
  consumido: number | null,
  objetivos: Objetivos,
) {
  const abierto = ESTADOS_ABIERTOS.includes(t.estado)
  const obj = objetivos[t.prioridad]
  let fase: FilaBandeja['fase'] = null
  let objetivo: number | null = null
  let porcentaje: number | null = null
  if (abierto && obj && consumido != null) {
    fase = t.fecha_primera_respuesta ? 'SOLUCION' : 'RESPUESTA'
    objetivo = fase === 'RESPUESTA' ? obj.respuesta : obj.solucion
    porcentaje = objetivo > 0 ? Math.round((consumido / objetivo) * 100) : null
  }
  const vencido = abierto && (t.respuesta_vencida || t.solucion_vencida || (porcentaje != null && porcentaje >= 100))
  return { fase, objetivo, porcentaje, vencido }
}

const SELECT_BANDEJA =
  'id, numero, asunto, estado, prioridad, solicitante_id, responsable_id, aprobador_id, area, fecha_creacion, fecha_requerida, fecha_primera_respuesta, respuesta_vencida, solucion_vencida, categoria_id, tipologia:ticket_tipologias(nombre, visibilidad_restringida), categoria:ticket_categorias(nombre)'

export async function listarTicketsBandeja(filtros: FiltrosBandeja = {}): Promise<FilaBandeja[]> {
  const ctx = await contextoTickets()
  if (!ctx || !esPersonalTIN(ctx)) throw new Error(NO_AUTORIZADO)
  const supabase = createAdminClient()
  const veTodo = ctx.esAdmin || ctx.coordinar

  let q = supabase.from('tickets').select(SELECT_BANDEJA).order('fecha_creacion', { ascending: false }).limit(500)
  const estado = filtros.estado ?? 'ABIERTOS'
  if (estado === 'ABIERTOS') q = q.in('estado', ESTADOS_ABIERTOS)
  else if (estado !== 'TODOS') q = q.eq('estado', estado)
  if (!veTodo) q = q.or(`responsable_id.eq.${ctx.usuarioId},responsable_id.is.null`)
  if (filtros.misAsignados) q = q.eq('responsable_id', ctx.usuarioId)
  else if (filtros.sinAsignar) q = q.is('responsable_id', null)
  else if (filtros.responsableId && veTodo) q = q.eq('responsable_id', filtros.responsableId)
  if (filtros.categoriaId) q = q.eq('categoria_id', filtros.categoriaId)
  if (filtros.prioridad) q = q.eq('prioridad', filtros.prioridad)
  const texto = filtros.q?.trim()
  if (texto) {
    const num = Number(texto.replace(/^tk-?/i, ''))
    const limpio = texto.replace(/[%,()]/g, ' ')
    q = Number.isInteger(num) && num > 0
      ? q.or(`numero.eq.${num},asunto.ilike.%${limpio}%`)
      : q.or(`asunto.ilike.%${limpio}%,descripcion.ilike.%${limpio}%`)
  }

  const { data, error } = await q
  if (error) throw new Error(error.message)
  const filas = ((data ?? []) as unknown as FilaTicketDB[])
    .filter(t => puedeVerTicketGestion(ctx, t, !!t.tipologia?.visibilidad_restringida))

  const ids = filas.map(t => t.id)
  const [mapaNombres, objetivos, tiempos] = await Promise.all([
    nombres(supabase, filas.flatMap(t => [t.solicitante_id, t.responsable_id])),
    objetivosVigentes(supabase),
    ids.length
      ? supabase.from('ticket_tiempos').select('ticket_id, t_consumido').in('ticket_id', ids)
      : Promise.resolve({ data: [] as { ticket_id: string; t_consumido: number | null }[] }),
  ])
  const consumidos = new Map<string, number | null>(
    ((tiempos.data ?? []) as { ticket_id: string; t_consumido: number | null }[]).map(x => [x.ticket_id, x.t_consumido == null ? null : Number(x.t_consumido)]),
  )

  let res: FilaBandeja[] = filas.map(t => {
    const consumido = consumidos.get(t.id) ?? null
    const s = semaforo(t, consumido, objetivos)
    return {
      id: t.id,
      numero: t.numero,
      codigo: codigoTicket(t.numero),
      asunto: t.asunto,
      estado: t.estado,
      prioridad: t.prioridad,
      categoria: t.categoria?.nombre ?? '',
      tipologia: t.tipologia?.nombre ?? '',
      restringida: !!t.tipologia?.visibilidad_restringida,
      solicitante: mapaNombres.get(t.solicitante_id) ?? '',
      area: t.area,
      responsableId: t.responsable_id,
      responsable: t.responsable_id ? mapaNombres.get(t.responsable_id) ?? null : null,
      fechaCreacion: t.fecha_creacion,
      fechaRequerida: t.fecha_requerida,
      respuestaVencida: t.respuesta_vencida,
      solucionVencida: t.solucion_vencida,
      consumido,
      ...s,
    }
  })
  if (filtros.vencidos) res = res.filter(r => r.vencido)
  return res
}

/** KPIs rápidos sobre los tickets abiertos que el usuario puede ver */
export async function obtenerKpisBandeja(): Promise<KpisBandeja> {
  const filas = await listarTicketsBandeja({ estado: 'ABIERTOS' })
  return {
    sinAsignar: filas.filter(f => !f.responsableId).length,
    enProceso: filas.filter(f => f.estado === 'EN_PROCESO').length,
    enEspera: filas.filter(f => ESTADOS_ESPERA.includes(f.estado)).length,
    vencidos: filas.filter(f => f.vencido).length,
  }
}

// ── Catálogos para la UI ─────────────────────────────────────────────────────

export interface ResponsableOpcion { id: string; nombre_completo: string; email: string | null }

export async function listarResponsables(): Promise<ResponsableOpcion[]> {
  const ctx = await contextoTickets()
  if (!ctx || !esPersonalTIN(ctx)) return []
  const supabase = createAdminClient()
  const ids = await idsConRecurso(supabase, RECURSOS_TICKETS.ATENDER)
  if (ids.length === 0) return []
  const { data } = await supabase
    .from('perfiles')
    .select('id, nombre_completo, email')
    .in('id', ids)
    .eq('activo', true)
    .order('nombre_completo')
  return (data ?? []) as ResponsableOpcion[]
}

export async function listarCausasActivas(ambito?: AmbitoCausa): Promise<TicketCausa[]> {
  const ctx = await contextoTickets()
  if (!ctx || !esPersonalTIN(ctx)) return []
  const supabase = createAdminClient()
  let q = supabase.from('ticket_causas').select('*').eq('activa', true).order('tipo_causa').order('orden')
  if (ambito) q = q.eq('ambito', ambito)
  const { data } = await q
  return (data ?? []) as TicketCausa[]
}

export interface CategoriaOpcion { id: string; nombre: string }
export interface TipologiaOpcion { id: string; nombre: string; categoria_id: string; categoria: string; visibilidad_restringida: boolean }

export async function listarCategoriasBandeja(): Promise<CategoriaOpcion[]> {
  const ctx = await contextoTickets()
  if (!ctx || !esPersonalTIN(ctx)) return []
  const supabase = createAdminClient()
  const { data } = await supabase.from('ticket_categorias').select('id, nombre').order('orden').order('nombre')
  return (data ?? []) as CategoriaOpcion[]
}

export async function listarTipologiasReclasificar(): Promise<TipologiaOpcion[]> {
  const ctx = await contextoTickets()
  if (!ctx || !esPersonalTIN(ctx)) return []
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('ticket_tipologias')
    .select('id, nombre, categoria_id, visibilidad_restringida, orden, categoria:ticket_categorias(nombre, orden, activa)')
    .eq('activa', true)
    .order('orden')
  type Fila = { id: string; nombre: string; categoria_id: string; visibilidad_restringida: boolean; categoria: { nombre: string; orden: number; activa: boolean } | null }
  return ((data ?? []) as unknown as Fila[])
    .filter(t => t.categoria?.activa !== false)
    .filter(t => !t.visibilidad_restringida || ctx.restringidas)
    .sort((a, b) => (a.categoria?.orden ?? 0) - (b.categoria?.orden ?? 0) || (a.categoria?.nombre ?? '').localeCompare(b.categoria?.nombre ?? ''))
    .map(t => ({ id: t.id, nombre: t.nombre, categoria_id: t.categoria_id, categoria: t.categoria?.nombre ?? '', visibilidad_restringida: t.visibilidad_restringida }))
}

// ── Detalle de gestión ───────────────────────────────────────────────────────

export interface PersonaResumen { id: string; nombre_completo: string; email: string | null }

export interface TicketGestion {
  id: string
  numero: number
  codigo: string
  asunto: string
  descripcion: string
  estado: EstadoTicket
  prioridad: PrioridadTicket
  impacto: ImpactoTicket
  canal: CanalTicket
  area: string | null
  sede: string | null
  fechaCreacion: string
  fechaRequerida: string | null
  fechaAsignacion: string | null
  fechaPrimeraRespuesta: string | null
  fechaResuelto: string | null
  fechaCierre: string | null
  cierreAutomatico: boolean
  reaperturas: number
  respuestaVencida: boolean
  solucionVencida: boolean
  categoria: { id: string; nombre: string }
  tipologia: { id: string; nombre: string; esNovedadIGSI: boolean; restringida: boolean; tipoGestion: string; seMideContra: string }
  solicitante: (PersonaResumen & { cargo: string | null; proceso_interno: string | null; sede: string | null; jefe: string | null }) | null
  responsable: PersonaResumen | null
  aprobador: PersonaResumen | null
  padre: { id: string; codigo: string; asunto: string; estado: EstadoTicket } | null
  hijos: { id: string; codigo: string; asunto: string; estado: EstadoTicket }[]
  bugs: { id: string; codigo: string; titulo: string; estado: EstadoBug; severidad: SeveridadBug; clasificacion: ClasificacionBug }[]
  campos: { etiqueta: string; valor: string; tipo: string }[]
  novedad: TicketNovedadIGSI | null
  adjuntos: (TicketAdjunto & { autor: string | null })[]
  historial: (TicketHistorial & { autor: string | null })[]
  cierre: { respuesta: string; tipo_causa: string; subcausa: string; requiere_capacitacion: boolean; requiere_ajuste: boolean; fecha: string; cerrado_por: string | null } | null
  tiempos: TicketTiempos | null
  objetivo: { respuesta: number; solucion: number } | null
  causas: TicketCausa[]
  conceptuales30d: number
  umbralCapacitacion: number
  permisos: {
    gestionar: boolean
    coordinar: boolean
    atender: boolean
    esResponsable: boolean
    esSolicitante: boolean
    puedeAprobar: boolean
    usuarioId: string
  }
}

function sinAcentos(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

/** Novedades IGSI cerradas como conceptuales del funcionario en los últimos 30 días */
async function conceptualesRecientes(supabase: SupabaseClient, solicitanteId: string): Promise<number> {
  try {
    const desde = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()
    const { data: tks } = await supabase.from('tickets').select('id').eq('solicitante_id', solicitanteId)
    const ids = (tks ?? []).map((x: { id: string }) => x.id)
    if (ids.length === 0) return 0
    const { data } = await supabase
      .from('ticket_cierres')
      .select('ticket_id, fecha, causa:ticket_causas(ambito, tipo_causa)')
      .in('ticket_id', ids)
      .gte('fecha', desde)
    type F = { causa: { ambito: string; tipo_causa: string } | null }
    return ((data ?? []) as unknown as F[]).filter(c => c.causa?.ambito === 'IGSI' && sinAcentos(c.causa.tipo_causa).startsWith('conceptual')).length
  } catch {
    return 0
  }
}

export async function obtenerTicketGestion(id: string): Promise<TicketGestion | null> {
  const ctx = await contextoTickets()
  if (!ctx || !esPersonalTIN(ctx) || !id) return null
  const supabase = createAdminClient()

  const { data: t } = await supabase
    .from('tickets')
    .select('*, tipologia:ticket_tipologias(id, nombre, es_novedad_igsi, visibilidad_restringida, tipo_gestion, se_mide_contra), categoria:ticket_categorias(id, nombre)')
    .eq('id', id)
    .maybeSingle()
  if (!t) return null
  const ticket = t as Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
  const restringida = !!ticket.tipologia?.visibilidad_restringida
  if (!puedeVerTicketGestion(ctx, ticket as { solicitante_id: string; responsable_id: string | null; aprobador_id: string | null }, restringida)) return null

  const [
    { data: solicitante },
    { data: padre },
    { data: hijos },
    { data: enlacesBug },
    { data: valores },
    { data: novedad },
    { data: adjuntos },
    { data: historial },
    { data: cierre },
    { data: tiempos },
    objetivos,
    config,
    causas,
  ] = await Promise.all([
    supabase.from('perfiles').select('id, nombre_completo, email, cargo, proceso_interno, sede, jefe_id').eq('id', ticket.solicitante_id).maybeSingle(),
    ticket.ticket_padre_id
      ? supabase.from('tickets').select('id, numero, asunto, estado').eq('id', ticket.ticket_padre_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from('tickets').select('id, numero, asunto, estado').eq('ticket_padre_id', id).order('numero'),
    supabase.from('ticket_bug_tickets').select('bug:ticket_bugs(id, numero, titulo, estado, severidad, clasificacion)').eq('ticket_id', id),
    supabase.from('ticket_valores_campo').select('valor, campo:ticket_campos_tipologia(etiqueta, tipo_dato, orden)').eq('ticket_id', id),
    supabase.from('ticket_novedades_igsi').select('*').eq('ticket_id', id).maybeSingle(),
    supabase.from('ticket_adjuntos').select('*').eq('ticket_id', id).order('fecha'),
    supabase.from('ticket_historial').select('*').eq('ticket_id', id).order('fecha').order('id'),
    supabase.from('ticket_cierres').select('respuesta, requiere_capacitacion, requiere_ajuste, fecha, cerrado_por, causa:ticket_causas(tipo_causa, subcausa)').eq('ticket_id', id).maybeSingle(),
    supabase.from('ticket_tiempos').select('*').eq('ticket_id', id).maybeSingle(),
    objetivosVigentes(supabase),
    obtenerConfigTickets(supabase),
    supabase.from('ticket_causas').select('*').eq('activa', true).eq('ambito', ticket.tipologia?.es_novedad_igsi ? 'IGSI' : 'GENERAL').order('tipo_causa').order('orden'),
  ])

  type ValorCampo = { valor: string | null; campo: { etiqueta: string; tipo_dato: string; orden: number } | null }
  const valoresTyped = ((valores ?? []) as unknown as ValorCampo[]).filter(v => v.campo)
  const idsUsuarioCampo = valoresTyped.filter(v => v.campo!.tipo_dato === 'USUARIO' && v.valor).map(v => v.valor as string)

  const historialRows = (historial ?? []) as TicketHistorial[]
  const adjuntosRows = (adjuntos ?? []) as TicketAdjunto[]
  const sol = solicitante as { id: string; nombre_completo: string; email: string | null; cargo: string | null; proceso_interno: string | null; sede: string | null; jefe_id: string | null } | null
  const cierreTyped = cierre as unknown as { respuesta: string; requiere_capacitacion: boolean; requiere_ajuste: boolean; fecha: string; cerrado_por: string | null; causa: { tipo_causa: string; subcausa: string } | null } | null

  const mapa = await nombres(supabase, [
    ticket.responsable_id, ticket.aprobador_id, sol?.jefe_id, cierreTyped?.cerrado_por,
    ...historialRows.map(h => h.usuario_id), ...adjuntosRows.map(a => a.cargado_por), ...idsUsuarioCampo,
  ])
  const { data: correos } = await supabase.from('perfiles').select('id, email').in('id', [ticket.responsable_id, ticket.aprobador_id].filter(Boolean))
  const email = new Map((correos ?? []).map((p: { id: string; email: string | null }) => [p.id, p.email]))
  const persona = (pid: string | null): PersonaResumen | null =>
    pid ? { id: pid, nombre_completo: mapa.get(pid) ?? 'Usuario', email: email.get(pid) ?? null } : null

  const esSolicitante = ticket.solicitante_id === ctx.usuarioId
  const acceso = { solicitante_id: ticket.solicitante_id as string, responsable_id: ticket.responsable_id as string | null }
  const gestionar = puedeGestionarTicket(ctx, acceso)
  const puedeAprobar = ticket.estado === 'ESPERA_APROBACION' && (ticket.aprobador_id === ctx.usuarioId || ctx.coordinar || ctx.esAdmin)

  type BugRow = { bug: { id: string; numero: number; titulo: string; estado: EstadoBug; severidad: SeveridadBug; clasificacion: ClasificacionBug } | null }
  const bugs = ((enlacesBug ?? []) as unknown as BugRow[])
    .filter(b => b.bug)
    .map(b => ({ ...b.bug!, codigo: `B-${String(b.bug!.numero).padStart(3, '0')}` }))

  const formatearValor = (v: ValorCampo): string => {
    const tipo = v.campo!.tipo_dato
    if (v.valor == null || v.valor === '') return '—'
    if (tipo === 'CASILLA') return v.valor === 'true' ? 'Sí' : v.valor === 'false' ? 'No' : v.valor
    if (tipo === 'USUARIO') return mapa.get(v.valor) ?? v.valor
    return v.valor
  }

  return {
    id: ticket.id,
    numero: ticket.numero,
    codigo: codigoTicket(ticket.numero),
    asunto: ticket.asunto,
    descripcion: ticket.descripcion,
    estado: ticket.estado,
    prioridad: ticket.prioridad,
    impacto: ticket.impacto,
    canal: ticket.canal,
    area: ticket.area,
    sede: ticket.sede,
    fechaCreacion: ticket.fecha_creacion,
    fechaRequerida: ticket.fecha_requerida,
    fechaAsignacion: ticket.fecha_asignacion,
    fechaPrimeraRespuesta: ticket.fecha_primera_respuesta,
    fechaResuelto: ticket.fecha_resuelto,
    fechaCierre: ticket.fecha_cierre,
    cierreAutomatico: ticket.cierre_automatico,
    reaperturas: ticket.reaperturas,
    respuestaVencida: ticket.respuesta_vencida,
    solucionVencida: ticket.solucion_vencida,
    categoria: { id: ticket.categoria?.id ?? ticket.categoria_id, nombre: ticket.categoria?.nombre ?? '' },
    tipologia: {
      id: ticket.tipologia?.id ?? ticket.tipologia_id,
      nombre: ticket.tipologia?.nombre ?? '',
      esNovedadIGSI: !!ticket.tipologia?.es_novedad_igsi,
      restringida,
      tipoGestion: ticket.tipologia?.tipo_gestion ?? '',
      seMideContra: ticket.tipologia?.se_mide_contra ?? '',
    },
    solicitante: sol
      ? { id: sol.id, nombre_completo: sol.nombre_completo, email: sol.email, cargo: sol.cargo, proceso_interno: sol.proceso_interno, sede: sol.sede, jefe: sol.jefe_id ? mapa.get(sol.jefe_id) ?? null : null }
      : null,
    responsable: persona(ticket.responsable_id),
    aprobador: persona(ticket.aprobador_id),
    padre: padre ? { id: padre.id, codigo: codigoTicket(padre.numero), asunto: padre.asunto, estado: padre.estado } : null,
    hijos: ((hijos ?? []) as { id: string; numero: number; asunto: string; estado: EstadoTicket }[]).map(h => ({ id: h.id, codigo: codigoTicket(h.numero), asunto: h.asunto, estado: h.estado })),
    bugs,
    campos: valoresTyped
      .sort((a, b) => a.campo!.orden - b.campo!.orden)
      .map(v => ({ etiqueta: v.campo!.etiqueta, valor: formatearValor(v), tipo: v.campo!.tipo_dato })),
    novedad: (novedad as TicketNovedadIGSI | null) ?? null,
    adjuntos: adjuntosRows.map(a => ({ ...a, autor: a.cargado_por ? mapa.get(a.cargado_por) ?? null : null })),
    historial: historialRows.map(h => ({ ...h, autor: h.usuario_id ? mapa.get(h.usuario_id) ?? null : null })),
    cierre: cierreTyped
      ? {
          respuesta: cierreTyped.respuesta,
          tipo_causa: cierreTyped.causa?.tipo_causa ?? '',
          subcausa: cierreTyped.causa?.subcausa ?? '',
          requiere_capacitacion: cierreTyped.requiere_capacitacion,
          requiere_ajuste: cierreTyped.requiere_ajuste,
          fecha: cierreTyped.fecha,
          cerrado_por: cierreTyped.cerrado_por ? mapa.get(cierreTyped.cerrado_por) ?? null : null,
        }
      : null,
    tiempos: (tiempos as TicketTiempos | null) ?? null,
    objetivo: objetivos[ticket.prioridad as PrioridadTicket] ?? null,
    causas: (causas.data ?? []) as TicketCausa[],
    conceptuales30d: await conceptualesRecientes(supabase, ticket.solicitante_id),
    umbralCapacitacion: config.umbralCapacitacion,
    permisos: {
      gestionar,
      coordinar: ctx.coordinar || ctx.esAdmin,
      atender: ctx.atender || ctx.esAdmin,
      esResponsable: ticket.responsable_id === ctx.usuarioId,
      esSolicitante,
      puedeAprobar,
      usuarioId: ctx.usuarioId,
    },
  }
}

// ── Aprobaciones ─────────────────────────────────────────────────────────────

export interface AprobacionPendiente {
  id: string
  codigo: string
  asunto: string
  descripcion: string
  prioridad: PrioridadTicket
  categoria: string
  tipologia: string
  fechaCreacion: string
  fechaRequerida: string | null
  solicitante: string
  area: string | null
  sede: string | null
  aprobador: string | null
  soyAprobador: boolean
  campos: { etiqueta: string; valor: string }[]
  adjuntos: { nombre_archivo: string; url: string }[]
}

export async function listarAprobacionesPendientes(): Promise<AprobacionPendiente[]> {
  const ctx = await contextoTickets()
  if (!ctx) return []
  const supabase = createAdminClient()
  const veTodo = ctx.coordinar || ctx.esAdmin

  let q = supabase
    .from('tickets')
    .select('id, numero, asunto, descripcion, prioridad, fecha_creacion, fecha_requerida, solicitante_id, responsable_id, aprobador_id, area, sede, tipologia:ticket_tipologias(nombre, visibilidad_restringida), categoria:ticket_categorias(nombre)')
    .eq('estado', 'ESPERA_APROBACION')
    .order('fecha_creacion', { ascending: true })
    .limit(300)
  if (!veTodo) q = q.eq('aprobador_id', ctx.usuarioId)
  const { data } = await q
  type Fila = {
    id: string; numero: number; asunto: string; descripcion: string; prioridad: PrioridadTicket; fecha_creacion: string; fecha_requerida: string | null
    solicitante_id: string; responsable_id: string | null; aprobador_id: string | null; area: string | null; sede: string | null
    tipologia: { nombre: string; visibilidad_restringida: boolean } | null; categoria: { nombre: string } | null
  }
  const filas = ((data ?? []) as unknown as Fila[]).filter(t =>
    t.aprobador_id === ctx.usuarioId || ctx.esAdmin || !t.tipologia?.visibilidad_restringida || ctx.restringidas,
  )
  if (filas.length === 0) return []

  const ids = filas.map(f => f.id)
  const [{ data: valores }, { data: adjuntos }] = await Promise.all([
    supabase.from('ticket_valores_campo').select('ticket_id, valor, campo:ticket_campos_tipologia(etiqueta, orden, tipo_dato)').in('ticket_id', ids),
    supabase.from('ticket_adjuntos').select('ticket_id, nombre_archivo, url').in('ticket_id', ids),
  ])
  type V = { ticket_id: string; valor: string | null; campo: { etiqueta: string; orden: number; tipo_dato: string } | null }
  const vals = (valores ?? []) as unknown as V[]
  const mapa = await nombres(supabase, [
    ...filas.flatMap(f => [f.solicitante_id, f.aprobador_id]),
    ...vals.filter(v => v.campo?.tipo_dato === 'USUARIO').map(v => v.valor),
  ])
  const valorVisible = (v: V): string =>
    v.campo!.tipo_dato === 'CASILLA' ? (v.valor === 'true' ? 'Sí' : 'No')
      : v.campo!.tipo_dato === 'USUARIO' ? mapa.get(v.valor as string) ?? (v.valor as string)
        : (v.valor as string)
  const adjs = (adjuntos ?? []) as { ticket_id: string; nombre_archivo: string; url: string }[]

  return filas.map(f => ({
    id: f.id,
    codigo: codigoTicket(f.numero),
    asunto: f.asunto,
    descripcion: f.descripcion,
    prioridad: f.prioridad,
    categoria: f.categoria?.nombre ?? '',
    tipologia: f.tipologia?.nombre ?? '',
    fechaCreacion: f.fecha_creacion,
    fechaRequerida: f.fecha_requerida,
    solicitante: mapa.get(f.solicitante_id) ?? '',
    area: f.area,
    sede: f.sede,
    aprobador: f.aprobador_id ? mapa.get(f.aprobador_id) ?? null : null,
    soyAprobador: f.aprobador_id === ctx.usuarioId,
    campos: vals
      .filter(v => v.ticket_id === f.id && v.campo && v.valor)
      .sort((a, b) => a.campo!.orden - b.campo!.orden)
      .map(v => ({ etiqueta: v.campo!.etiqueta, valor: valorVisible(v) })),
    adjuntos: adjs.filter(a => a.ticket_id === f.id).map(a => ({ nombre_archivo: a.nombre_archivo, url: a.url })),
  }))
}
