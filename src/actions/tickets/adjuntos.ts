'use server'
/* eslint-disable @typescript-eslint/no-explicit-any -- patrón (supabase as any) del repo */

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { NO_AUTORIZADO } from '@/lib/supabase/guards'
import { registrarEventos } from '@/lib/tickets/historial'
import { accesoTickets, filasAdjuntos, puedeVerTicket } from '@/lib/tickets/solicitante'
import type { AdjuntoNuevo } from '@/components/tickets/SubirAdjuntos'

/** Registra adjuntos ya subidos a Firebase. Solicitante, responsable, coordinador o admin. */
export async function registrarAdjuntos(ticketId: string, adjuntos: AdjuntoNuevo[]): Promise<{ ok: boolean; error?: string }> {
  try {
    const acceso = await accesoTickets()
    if (!acceso) return { ok: false, error: 'Debes iniciar sesión' }
    if (!ticketId || !Array.isArray(adjuntos) || adjuntos.length === 0) {
      return { ok: false, error: 'No hay adjuntos para registrar' }
    }

    const supabase = createAdminClient()
    const { data: ticket } = await (supabase as any)
      .from('tickets')
      .select('id, solicitante_id, responsable_id, estado, tipologia:ticket_tipologias(visibilidad_restringida)')
      .eq('id', ticketId)
      .maybeSingle()
    if (!ticket) return { ok: false, error: 'Ticket no encontrado' }
    if (!puedeVerTicket(acceso, ticket, !!ticket.tipologia?.visibilidad_restringida)) {
      return { ok: false, error: NO_AUTORIZADO }
    }
    if (ticket.estado === 'CERRADO') return { ok: false, error: 'El ticket está cerrado; reábrelo para agregar adjuntos' }

    const res = filasAdjuntos(ticketId, adjuntos, acceso.usuarioId)
    if (!res.ok) return { ok: false, error: res.error }

    const { error } = await (supabase as any).from('ticket_adjuntos').insert(res.filas)
    if (error) return { ok: false, error: error.message }

    await registrarEventos(supabase, res.filas.map(f => ({
      ticketId,
      tipo: 'ADJUNTO' as const,
      usuarioId: acceso.usuarioId,
      valorNuevo: String(f.nombre_archivo),
      visibleUsuario: true,
      metadata: { url: f.url, tipo_archivo: f.tipo_archivo, tamano: f.tamano },
    })))
    await (supabase as any).from('tickets').update({ updated_at: new Date().toISOString() }).eq('id', ticketId)

    revalidatePath(`/mis-tickets/${ticketId}`)
    revalidatePath(`/admin/tickets/${ticketId}`)
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'Error al registrar los adjuntos' }
  }
}
