import type { SupabaseClient } from '@supabase/supabase-js'
import type { TipoEventoTicket } from './types'

// Registro en ticket_historial. Solo se usa en el servidor (Server Actions, cron)
// con el cliente de createAdminClient(). La tabla es de solo inserción: un trigger
// rechaza UPDATE y DELETE, así que cada acción sobre un ticket deja aquí su evidencia.

export interface EventoTicket {
  ticketId: string
  tipo: TipoEventoTicket
  /** null = sistema (regla automática o cron) */
  usuarioId: string | null
  campo?: string | null
  valorAnterior?: string | null
  valorNuevo?: string | null
  comentario?: string | null
  /** Comentarios y cambios que el solicitante puede ver en su vista */
  visibleUsuario?: boolean
  metadata?: Record<string, unknown> | null
  /** Por defecto now(); solo para cargas o pruebas */
  fecha?: string
}

function fila(e: EventoTicket) {
  return {
    ticket_id: e.ticketId,
    tipo_evento: e.tipo,
    usuario_id: e.usuarioId,
    campo: e.campo ?? null,
    valor_anterior: e.valorAnterior ?? null,
    valor_nuevo: e.valorNuevo ?? null,
    comentario: e.comentario ?? null,
    visible_usuario: e.visibleUsuario ?? false,
    metadata: e.metadata ?? null,
    ...(e.fecha ? { fecha: e.fecha } : {}),
  }
}

export async function registrarEventos(supabase: SupabaseClient, eventos: EventoTicket[]): Promise<void> {
  if (eventos.length === 0) return
  const { error } = await supabase.from('ticket_historial').insert(eventos.map(fila))
  if (error) throw new Error(`No se pudo registrar el historial del ticket: ${error.message}`)
}

export async function registrarEvento(supabase: SupabaseClient, evento: EventoTicket): Promise<void> {
  await registrarEventos(supabase, [evento])
}
