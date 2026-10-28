import type { SupabaseClient } from '@supabase/supabase-js'

// Avisos dentro de TIN-FLOW (tabla ticket_notificaciones, canal APP).
// Solo servidor. Best-effort: un fallo se registra en el log y no interrumpe la acción.

export async function crearNotificacion(
  supabase: SupabaseClient,
  usuarioIds: string[],
  ticketId: string | null,
  mensaje: string,
): Promise<void> {
  const ids = [...new Set(usuarioIds.filter(Boolean))]
  const texto = mensaje.trim()
  if (!ids.length || !texto) return
  try {
    const { error } = await supabase
      .from('ticket_notificaciones')
      .insert(ids.map(usuario_id => ({ usuario_id, ticket_id: ticketId, mensaje: texto.slice(0, 1000) })))
    if (error) console.error('[tickets] no se pudo crear la notificación:', error.message)
  } catch (err) {
    console.error('[tickets] no se pudo crear la notificación:', err)
  }
}
