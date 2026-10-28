'use server'
/* eslint-disable @typescript-eslint/no-explicit-any -- patrón (supabase as any) del repo */

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getUsuarioActual, puedeGestionar, NO_AUTORIZADO } from '@/lib/supabase/guards'
import { contextoTickets, esPersonalTIN, idsConRecurso } from '@/lib/tickets/acceso-gestion'
import { crearBug, diasAbiertoBug, enlazarTicketABug } from '@/lib/tickets/bugs'
import { codigoBug, codigoTicket, RECURSOS_TICKETS } from '@/lib/tickets/constantes'
import { leerTodo } from '@/lib/tickets/tiempos'
import type { ClasificacionBug, EstadoBug, EstadoTicket, SeveridadBug, TipoDocumentoIGSI } from '@/lib/tickets/types'

type Resultado = { ok: boolean; error?: string }

const CLASIFICACIONES: ClasificacionBug[] = ['BUG', 'DEUDA_TECNICA', 'PARAMETRIZACION', 'INFRAESTRUCTURA']
const SEVERIDADES: SeveridadBug[] = ['BLOQUEANTE', 'ALTA', 'MEDIA', 'BAJA']
const ESTADOS: EstadoBug[] = ['REPORTADO', 'CONFIRMADO', 'PRIORIZADO', 'EN_DESARROLLO', 'EN_PRUEBAS', 'DESPLEGADO']
const DOCUMENTOS: TipoDocumentoIGSI[] = ['SS', 'DO', 'REMESA', 'MANIFIESTO', 'OTRO']

export interface BugTablero {
  id: string
  numero: number
  codigo: string
  titulo: string
  descripcion: string | null
  clasificacion: ClasificacionBug
  severidad: SeveridadBug
  tipo_documento: TipoDocumentoIGSI | null
  modulo: string | null
  estado: EstadoBug
  solucion_provisional: string | null
  responsable_id: string | null
  responsable_nombre: string | null
  requerimiento: { id: string; nombre: string } | null
  fecha_detectado: string
  fecha_desplegado: string | null
  version: string | null
  tickets: number
  dias_abierto: number
}

export interface TicketEnlazadoBug {
  id: string
  numero: number
  codigo: string
  asunto: string
  estado: EstadoTicket
  solicitante: string | null
  fecha_enlace: string
}

export interface DetalleBug extends BugTablero {
  creado_por: string | null
  tickets_enlazados: TicketEnlazadoBug[]
}

export interface DatosBug {
  titulo: string
  descripcion?: string | null
  clasificacion: ClasificacionBug
  severidad: SeveridadBug
  tipo_documento?: TipoDocumentoIGSI | null
  modulo?: string | null
  solucion_provisional?: string | null
  responsable_id?: string | null
  version?: string | null
}

async function exigirBugs(): Promise<string> {
  const actual = await getUsuarioActual()
  if (!actual || !(await puedeGestionar(RECURSOS_TICKETS.MENU_BUGS))) throw new Error(NO_AUTORIZADO)
  return actual.user.id
}

function validar(d: DatosBug): string | null {
  if (!d.titulo?.trim()) return 'Escribe el título del bug'
  if (!CLASIFICACIONES.includes(d.clasificacion)) return 'Clasificación no válida'
  if (!SEVERIDADES.includes(d.severidad)) return 'Severidad no válida'
  if (d.tipo_documento && !DOCUMENTOS.includes(d.tipo_documento)) return 'Documento no válido'
  return null
}

/** Texto seguro para usar dentro de un filtro .or() de PostgREST */
const limpiar = (q: string) => q.replace(/[,()*%\\]/g, ' ').trim().slice(0, 80)

const SELECT_BUG =
  'id, numero, titulo, descripcion, clasificacion, severidad, tipo_documento, modulo, estado, solucion_provisional, responsable_id, requerimiento_id, fecha_detectado, fecha_desplegado, version, created_by, ' +
  'responsable:perfiles!responsable_id(nombre_completo), creador:perfiles!created_by(nombre_completo), requerimiento:requerimientos(id, nombre_desarrollo, identificacion)'

function aTablero(b: any, tickets: number): BugTablero {
  return {
    id: b.id,
    numero: Number(b.numero),
    codigo: codigoBug(Number(b.numero)),
    titulo: b.titulo,
    descripcion: b.descripcion ?? null,
    clasificacion: b.clasificacion,
    severidad: b.severidad,
    tipo_documento: b.tipo_documento ?? null,
    modulo: b.modulo ?? null,
    estado: b.estado,
    solucion_provisional: b.solucion_provisional ?? null,
    responsable_id: b.responsable_id ?? null,
    responsable_nombre: b.responsable?.nombre_completo ?? null,
    requerimiento: b.requerimiento
      ? { id: b.requerimiento.id, nombre: b.requerimiento.nombre_desarrollo || b.requerimiento.identificacion || 'Requerimiento' }
      : null,
    fecha_detectado: b.fecha_detectado,
    fecha_desplegado: b.fecha_desplegado ?? null,
    version: b.version ?? null,
    tickets,
    dias_abierto: diasAbiertoBug(b),
  }
}

// ── Consultas ────────────────────────────────────────────────────────────────

/** Búsqueda para enlazar un ticket a un bug (personal de TIN o gestores de bugs) */
export async function buscarBugsParaEnlace(q: string): Promise<{ id: string; codigo: string; titulo: string; estado: EstadoBug; severidad: SeveridadBug }[]> {
  try {
    const ctx = await contextoTickets()
    if (!ctx) return []
    if (!esPersonalTIN(ctx) && !(await puedeGestionar(RECURSOS_TICKETS.MENU_BUGS))) return []

    const supabase = createAdminClient()
    let consulta = (supabase as any)
      .from('ticket_bugs')
      .select('id, numero, titulo, estado, severidad')
      .order('numero', { ascending: false })
      .limit(20)
    const texto = limpiar(q ?? '')
    const num = /^(?:b-?)?(\d+)$/i.exec(texto)
    if (num) consulta = consulta.eq('numero', Number(num[1]))
    else if (texto) consulta = consulta.ilike('titulo', `%${texto}%`)
    const { data } = await consulta
    const filas = (data ?? []) as { id: string; numero: number; titulo: string; estado: EstadoBug; severidad: SeveridadBug }[]
    // Primero los que siguen abiertos
    filas.sort((a, b) => Number(a.estado === 'DESPLEGADO') - Number(b.estado === 'DESPLEGADO'))
    return filas.map(b => ({ id: b.id, codigo: codigoBug(Number(b.numero)), titulo: b.titulo, estado: b.estado, severidad: b.severidad }))
  } catch {
    return []
  }
}

export async function listarBugs(): Promise<BugTablero[]> {
  await exigirBugs()
  const supabase = createAdminClient()
  const [bugs, enlaces] = await Promise.all([
    leerTodo<any>((d, h) => (supabase as any).from('ticket_bugs').select(SELECT_BUG).order('numero', { ascending: false }).range(d, h)),
    leerTodo<{ bug_id: string }>((d, h) => (supabase as any).from('ticket_bug_tickets').select('bug_id').range(d, h)),
  ])
  const conteo = new Map<string, number>()
  for (const e of enlaces) conteo.set(e.bug_id, (conteo.get(e.bug_id) ?? 0) + 1)
  return bugs.map(b => aTablero(b, conteo.get(b.id) ?? 0))
}

export async function obtenerDetalleBug(id: string): Promise<DetalleBug | null> {
  await exigirBugs()
  const supabase = createAdminClient()
  const { data: b } = await (supabase as any).from('ticket_bugs').select(SELECT_BUG).eq('id', id).maybeSingle()
  if (!b) return null
  const { data: enlaces } = await (supabase as any)
    .from('ticket_bug_tickets')
    .select('fecha_enlace, ticket:tickets(id, numero, asunto, estado, solicitante:perfiles!solicitante_id(nombre_completo))')
    .eq('bug_id', id)
    .order('fecha_enlace', { ascending: false })
  const tickets_enlazados: TicketEnlazadoBug[] = ((enlaces ?? []) as any[])
    .filter(e => e.ticket)
    .map(e => ({
      id: e.ticket.id,
      numero: Number(e.ticket.numero),
      codigo: codigoTicket(Number(e.ticket.numero)),
      asunto: e.ticket.asunto,
      estado: e.ticket.estado,
      solicitante: e.ticket.solicitante?.nombre_completo ?? null,
      fecha_enlace: e.fecha_enlace,
    }))
  return { ...aTablero(b, tickets_enlazados.length), creado_por: b.creador?.nombre_completo ?? null, tickets_enlazados }
}

/** Personal de TIN que puede ser responsable de un bug */
export async function listarResponsablesBugs(): Promise<{ id: string; nombre: string }[]> {
  await exigirBugs()
  const supabase = createAdminClient()
  const ids = await idsConRecurso(supabase, RECURSOS_TICKETS.ATENDER)
  if (!ids.length) return []
  const { data } = await (supabase as any).from('perfiles').select('id, nombre_completo').in('id', ids).order('nombre_completo')
  return ((data ?? []) as { id: string; nombre_completo: string }[]).map(p => ({ id: p.id, nombre: p.nombre_completo }))
}

/** Requerimientos de TIN-FLOW para asociar al bug (el desarrollo que lo corrige) */
export async function buscarRequerimientosParaBug(q: string): Promise<{ id: string; nombre: string; estado: string | null }[]> {
  await exigirBugs()
  const supabase = createAdminClient()
  const texto = limpiar(q ?? '')
  let consulta = (supabase as any)
    .from('requerimientos')
    .select('id, nombre_desarrollo, identificacion, estado')
    .order('created_at', { ascending: false })
    .limit(15)
  if (texto) consulta = consulta.or(`nombre_desarrollo.ilike.%${texto}%,identificacion.ilike.%${texto}%`)
  const { data } = await consulta
  return ((data ?? []) as any[]).map(r => ({ id: r.id, nombre: r.nombre_desarrollo || r.identificacion || 'Requerimiento', estado: r.estado ?? null }))
}

// ── Mutaciones ───────────────────────────────────────────────────────────────

function refrescar() {
  revalidatePath('/admin/tickets-bugs')
  revalidatePath('/admin/tickets-dashboard')
}

export async function registrarBug(datos: DatosBug): Promise<Resultado & { id?: string; codigo?: string }> {
  try {
    const usuarioId = await exigirBugs()
    const err = validar(datos)
    if (err) return { ok: false, error: err }
    const supabase = createAdminClient()
    const creado = await crearBug(supabase, {
      titulo: datos.titulo,
      descripcion: datos.descripcion ?? undefined,
      clasificacion: datos.clasificacion,
      severidad: datos.severidad,
      tipo_documento: datos.tipo_documento ?? null,
      modulo: datos.modulo ?? null,
      solucion_provisional: datos.solucion_provisional ?? null,
    }, usuarioId)
    if (datos.responsable_id || datos.version) {
      await (supabase as any).from('ticket_bugs')
        .update({ responsable_id: datos.responsable_id || null, version: datos.version?.trim() || null })
        .eq('id', creado.id)
    }
    refrescar()
    return { ok: true, id: creado.id, codigo: codigoBug(creado.numero) }
  } catch (e) {
    return { ok: false, error: (e as Error).message ?? 'No se pudo crear el bug' }
  }
}

export async function editarBug(id: string, datos: DatosBug): Promise<Resultado> {
  try {
    await exigirBugs()
    const err = validar(datos)
    if (err) return { ok: false, error: err }
    const supabase = createAdminClient()
    const { error } = await (supabase as any)
      .from('ticket_bugs')
      .update({
        titulo: datos.titulo.trim(),
        descripcion: datos.descripcion?.trim() || null,
        clasificacion: datos.clasificacion,
        severidad: datos.severidad,
        tipo_documento: datos.tipo_documento || null,
        modulo: datos.modulo?.trim() || null,
        solucion_provisional: datos.solucion_provisional?.trim() || null,
        responsable_id: datos.responsable_id || null,
        version: datos.version?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
    if (error) return { ok: false, error: error.message }
    refrescar()
    return { ok: true }
  } catch (e) {
    return { ok: false, error: (e as Error).message ?? 'No se pudo guardar el bug' }
  }
}

/** Mueve el bug en el tablero. Al pasar a Desplegado fija fecha_desplegado; al salir de él, la limpia. */
export async function cambiarEstadoBug(id: string, estado: EstadoBug): Promise<Resultado> {
  try {
    await exigirBugs()
    if (!ESTADOS.includes(estado)) return { ok: false, error: 'Estado no válido' }
    const supabase = createAdminClient()
    const ahora = new Date().toISOString()
    const cambios: Record<string, unknown> = { estado, updated_at: ahora }
    cambios.fecha_desplegado = estado === 'DESPLEGADO' ? ahora : null
    const { error } = await (supabase as any).from('ticket_bugs').update(cambios).eq('id', id)
    if (error) return { ok: false, error: error.message }
    refrescar()
    return { ok: true }
  } catch (e) {
    return { ok: false, error: (e as Error).message ?? 'No se pudo cambiar el estado' }
  }
}

/** Asocia (o quita, con null) el requerimiento de TIN-FLOW que corrige el bug */
export async function enlazarBugARequerimiento(bugId: string, requerimientoId: string | null): Promise<Resultado> {
  try {
    await exigirBugs()
    const supabase = createAdminClient()
    if (requerimientoId) {
      const { data: req } = await (supabase as any).from('requerimientos').select('id').eq('id', requerimientoId).maybeSingle()
      if (!req) return { ok: false, error: 'Requerimiento no encontrado' }
    }
    const { error } = await (supabase as any)
      .from('ticket_bugs')
      .update({ requerimiento_id: requerimientoId, updated_at: new Date().toISOString() })
      .eq('id', bugId)
    if (error) return { ok: false, error: error.message }
    refrescar()
    return { ok: true }
  } catch (e) {
    return { ok: false, error: (e as Error).message ?? 'No se pudo asociar el requerimiento' }
  }
}

/** Enlaza un ticket existente (por su número, ej. TK-0012 o 12) al bug */
export async function enlazarTicketAlBug(bugId: string, numeroTicket: string): Promise<Resultado> {
  try {
    const usuarioId = await exigirBugs()
    const m = /(\d+)\s*$/.exec(numeroTicket.trim())
    if (!m) return { ok: false, error: 'Escribe el número del ticket (ej. TK-0012)' }
    const supabase = createAdminClient()
    const { data: t } = await (supabase as any).from('tickets').select('id').eq('numero', Number(m[1])).maybeSingle()
    if (!t) return { ok: false, error: 'No existe un ticket con ese número' }
    await enlazarTicketABug(supabase, t.id, bugId, usuarioId)
    refrescar()
    return { ok: true }
  } catch (e) {
    return { ok: false, error: (e as Error).message ?? 'No se pudo enlazar el ticket' }
  }
}
