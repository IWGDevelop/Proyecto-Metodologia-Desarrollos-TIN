/* eslint-disable @typescript-eslint/no-explicit-any -- patrón (supabase as any) del repo */
import type { SupabaseClient } from '@supabase/supabase-js'
import { codigoTicket } from './constantes'
import type { EstadoTicket } from './types'

// Tickets de soporte relacionados con requerimientos de desarrollo ya entregados o cerrados.
// Solo servidor. Si la columna tickets.requerimiento_id aún no existe (migración sin correr),
// las consultas devuelven vacío en lugar de romper las páginas.

/** Estados del requerimiento desde los que se puede abrir un ticket relacionado */
export const ESTADOS_REQ_PARA_TICKET = ['ENTREGADO', 'CERRADO'] as const

export interface RequerimientoResumen {
  id: string
  numero: string | null
  nombre: string
  estado: string
}

export interface TicketDeRequerimiento {
  id: string
  codigo: string
  asunto: string
  estado: EstadoTicket
  categoria: string
  tipologia: string
  /** Tipología de visibilidad restringida (Auditoría) */
  restringida: boolean
  solicitante_id: string
  solicitante: string | null
  fecha_creacion: string
  fecha_cierre: string | null
}

function aResumen(r: any): RequerimientoResumen {
  return { id: r.id, numero: r.numero ?? null, nombre: r.nombre_desarrollo || r.identificacion || 'Requerimiento', estado: r.estado }
}

export function etiquetaRequerimiento(r: Pick<RequerimientoResumen, 'numero' | 'nombre'>): string {
  return r.numero ? `#${r.numero} · ${r.nombre}` : r.nombre
}

export async function cargarRequerimientoResumen(supabase: SupabaseClient, id: string | null | undefined): Promise<RequerimientoResumen | null> {
  if (!id) return null
  const { data } = await (supabase as any)
    .from('requerimientos').select('id, numero, nombre_desarrollo, identificacion, estado').eq('id', id).maybeSingle()
  return data ? aResumen(data) : null
}

/** Requerimientos entregados o cerrados (no borradores), los más recientes primero */
export async function listarRequerimientosParaTicket(supabase: SupabaseClient): Promise<RequerimientoResumen[]> {
  const { data } = await (supabase as any)
    .from('requerimientos')
    .select('id, numero, nombre_desarrollo, identificacion, estado, fecha_cierre, fecha_real_entrega')
    .in('estado', [...ESTADOS_REQ_PARA_TICKET])
    .eq('es_borrador', false)
    .order('fecha_cierre', { ascending: false, nullsFirst: false })
    .limit(1000)
  return ((data ?? []) as any[]).map(aResumen)
}

/** Valida que el requerimiento exista y esté entregado o cerrado */
export async function validarRequerimientoParaTicket(
  supabase: SupabaseClient,
  id: string,
): Promise<{ ok: true; req: RequerimientoResumen } | { ok: false; error: string }> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, error: 'Requerimiento inválido' }
  const req = await cargarRequerimientoResumen(supabase, id)
  if (!req) return { ok: false, error: 'El requerimiento relacionado no existe' }
  if (!(ESTADOS_REQ_PARA_TICKET as readonly string[]).includes(req.estado)) {
    return { ok: false, error: 'Solo se pueden relacionar requerimientos entregados o cerrados' }
  }
  return { ok: true, req }
}

/** Tickets abiertos sobre un requerimiento (para su detalle y su resumen de actividad) */
export async function ticketsDeRequerimiento(
  supabase: SupabaseClient,
  requerimientoId: string,
  soloSolicitante?: string,
): Promise<TicketDeRequerimiento[]> {
  let q = (supabase as any)
    .from('tickets')
    .select('id, numero, asunto, estado, solicitante_id, fecha_creacion, fecha_cierre, categoria:ticket_categorias(nombre), tipologia:ticket_tipologias(nombre, visibilidad_restringida)')
    .eq('requerimiento_id', requerimientoId)
    .order('fecha_creacion', { ascending: false })
  if (soloSolicitante) q = q.eq('solicitante_id', soloSolicitante)
  const { data, error } = await q
  if (error || !data) return []
  const filas = data as any[]
  const ids = [...new Set(filas.map(f => f.solicitante_id))]
  const { data: perfiles } = ids.length
    ? await (supabase as any).from('perfiles').select('id, nombre_completo').in('id', ids)
    : { data: [] }
  const nombres = new Map(((perfiles ?? []) as any[]).map(p => [p.id, p.nombre_completo]))
  return filas.map(f => ({
    id: f.id,
    codigo: codigoTicket(Number(f.numero)),
    asunto: f.asunto,
    estado: f.estado,
    categoria: f.categoria?.nombre ?? '',
    tipologia: f.tipologia?.nombre ?? '',
    restringida: !!f.tipologia?.visibilidad_restringida,
    solicitante_id: f.solicitante_id,
    solicitante: nombres.get(f.solicitante_id) ?? null,
    fecha_creacion: f.fecha_creacion,
    fecha_cierre: f.fecha_cierre,
  }))
}
