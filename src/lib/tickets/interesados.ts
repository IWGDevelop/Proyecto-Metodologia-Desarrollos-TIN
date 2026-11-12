/* eslint-disable @typescript-eslint/no-explicit-any -- patrón (supabase as any) del repo */
import type { SupabaseClient } from '@supabase/supabase-js'
import { registrarEvento } from './historial'

// Partes interesadas de un ticket (tabla ticket_interesados). Son funcionarios que el
// solicitante o TIN involucran en el ticket: lo ven en «Mis tickets de TI», comentan,
// adjuntan y reciben los avisos y correos de sus novedades. No confirman ni reabren:
// eso le corresponde al solicitante. Solo servidor; los permisos los validan las acciones.

/** Máximo de partes interesadas por ticket */
export const MAX_INTERESADOS = 15

export interface Interesado {
  id: string
  nombre_completo: string
  email: string | null
  cargo: string | null
}

/** Si la tabla aún no existe (migración pendiente) las consultas devuelven vacío */
const sinTabla = (error: { message?: string; code?: string } | null) =>
  !!error && (error.code === '42P01' || error.code === 'PGRST205' || /ticket_interesados/.test(error.message ?? ''))

export async function listarInteresados(supabase: SupabaseClient, ticketId: string): Promise<Interesado[]> {
  const { data, error } = await (supabase as any)
    .from('ticket_interesados')
    .select('usuario:perfiles!ticket_interesados_usuario_id_fkey(id, nombre_completo, email, cargo)')
    .eq('ticket_id', ticketId)
    .order('created_at')
  if (error) {
    if (!sinTabla(error)) console.error('[tickets] listarInteresados', error.message)
    return []
  }
  return ((data ?? []) as any[]).map(r => r.usuario).filter(Boolean) as Interesado[]
}

export async function idsInteresados(supabase: SupabaseClient, ticketId: string): Promise<string[]> {
  const { data, error } = await (supabase as any).from('ticket_interesados').select('usuario_id').eq('ticket_id', ticketId)
  if (error) return []
  return ((data ?? []) as { usuario_id: string }[]).map(r => r.usuario_id)
}

export async function esInteresado(supabase: SupabaseClient, ticketId: string, usuarioId: string): Promise<boolean> {
  const { data, error } = await (supabase as any)
    .from('ticket_interesados').select('usuario_id').eq('ticket_id', ticketId).eq('usuario_id', usuarioId).maybeSingle()
  return !error && !!data
}

/** Ids de los tickets en los que el usuario es parte interesada */
export async function ticketsComoInteresado(supabase: SupabaseClient, usuarioId: string): Promise<string[]> {
  const { data, error } = await (supabase as any).from('ticket_interesados').select('ticket_id').eq('usuario_id', usuarioId).limit(500)
  if (error) return []
  return ((data ?? []) as { ticket_id: string }[]).map(r => r.ticket_id)
}

/**
 * Agrega partes interesadas (ignora al solicitante, a los repetidos y a los inactivos).
 * Devuelve los perfiles que quedaron agregados. Registra el evento en el historial.
 */
export async function agregarInteresadosTicket(
  supabase: SupabaseClient,
  ticket: { id: string; solicitante_id: string },
  usuarioIds: string[],
  agregadoPor: string | null,
): Promise<Interesado[]> {
  const pedidos = [...new Set(usuarioIds.filter(id => /^[0-9a-f-]{36}$/i.test(String(id))))].filter(id => id !== ticket.solicitante_id)
  if (!pedidos.length) return []
  const actuales = await idsInteresados(supabase, ticket.id)
  const nuevos = pedidos.filter(id => !actuales.includes(id))
  if (!nuevos.length) return []
  if (actuales.length + nuevos.length > MAX_INTERESADOS) {
    throw new Error(`Un ticket puede tener máximo ${MAX_INTERESADOS} partes interesadas`)
  }
  const { data: perfiles } = await (supabase as any)
    .from('perfiles').select('id, nombre_completo, email, cargo').in('id', nuevos).eq('activo', true)
  const validos = (perfiles ?? []) as Interesado[]
  if (!validos.length) return []

  const { error } = await (supabase as any).from('ticket_interesados').insert(
    validos.map(p => ({ ticket_id: ticket.id, usuario_id: p.id, agregado_por: agregadoPor })),
  )
  if (error) {
    if (sinTabla(error)) throw new Error('Las partes interesadas aún no están habilitadas (falta ejecutar la migración)')
    throw new Error(`No se pudieron agregar las partes interesadas: ${error.message}`)
  }
  await registrarEvento(supabase, {
    ticketId: ticket.id,
    tipo: 'INTERESADO',
    usuarioId: agregadoPor,
    campo: 'interesados',
    valorNuevo: validos.map(p => p.nombre_completo).join(', '),
    comentario: `Se agregó como parte interesada a ${validos.map(p => p.nombre_completo).join(', ')}`,
    visibleUsuario: true,
    metadata: { accion: 'AGREGAR', usuarios: validos.map(p => p.id) },
  })
  return validos
}

/** Quita una parte interesada y lo registra en el historial. false si no estaba. */
export async function quitarInteresadoTicket(
  supabase: SupabaseClient,
  ticketId: string,
  usuarioId: string,
  quitadoPor: string | null,
): Promise<boolean> {
  const { data: perfil } = await (supabase as any).from('perfiles').select('nombre_completo').eq('id', usuarioId).maybeSingle()
  const { data, error } = await (supabase as any)
    .from('ticket_interesados').delete().eq('ticket_id', ticketId).eq('usuario_id', usuarioId).select('usuario_id')
  if (error) throw new Error(`No se pudo quitar la parte interesada: ${error.message}`)
  if (!data?.length) return false
  const nombre = (perfil?.nombre_completo as string | undefined) ?? 'un funcionario'
  await registrarEvento(supabase, {
    ticketId,
    tipo: 'INTERESADO',
    usuarioId: quitadoPor,
    campo: 'interesados',
    valorAnterior: nombre,
    comentario: quitadoPor === usuarioId ? `${nombre} dejó de seguir el ticket` : `Se quitó a ${nombre} de las partes interesadas`,
    visibleUsuario: true,
    metadata: { accion: 'QUITAR', usuarios: [usuarioId] },
  })
  return true
}
