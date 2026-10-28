'use server'
/* eslint-disable @typescript-eslint/no-explicit-any -- patrón (supabase as any) del repo */

import { createAdminClient } from '@/lib/supabase/admin'
import { getUsuarioActual, puedeGestionar } from '@/lib/supabase/guards'
import { codigoTicket, RECURSOS_TICKETS } from '@/lib/tickets/constantes'

// Avisos dentro de TIN-FLOW (ticket_notificaciones) del usuario actual.

export interface AvisoTicket {
  id: string
  mensaje: string
  leida: boolean
  created_at: string
  ticket_id: string | null
  ticket_codigo: string | null
  /** Enlace al ticket según el rol del usuario; null si el aviso no es de un ticket */
  enlace: string | null
}

export interface AvisosUsuario {
  avisos: AvisoTicket[]
  noLeidas: number
}

type Resultado = { ok: boolean; error?: string }

export async function listarMisAvisos(incluirLeidas = false): Promise<AvisosUsuario> {
  const actual = await getUsuarioActual()
  if (!actual) return { avisos: [], noLeidas: 0 }
  try {
    const supabase = createAdminClient()
    const [atender, coordinar] = await Promise.all([
      puedeGestionar(RECURSOS_TICKETS.ATENDER),
      puedeGestionar(RECURSOS_TICKETS.COORDINAR),
    ])
    const base = atender || coordinar ? '/admin/tickets' : '/mis-tickets'

    let consulta = (supabase as any)
      .from('ticket_notificaciones')
      .select('id, mensaje, leida, created_at, ticket_id, ticket:tickets(numero, solicitante_id)')
      .eq('usuario_id', actual.user.id)
      .order('created_at', { ascending: false })
      .limit(incluirLeidas ? 50 : 30)
    if (!incluirLeidas) consulta = consulta.eq('leida', false)

    const [{ data }, { count }] = await Promise.all([
      consulta,
      (supabase as any)
        .from('ticket_notificaciones')
        .select('id', { count: 'exact', head: true })
        .eq('usuario_id', actual.user.id)
        .eq('leida', false),
    ])

    const avisos: AvisoTicket[] = ((data ?? []) as any[]).map(n => {
      // El solicitante va a su vista aunque sea personal de TIN
      const ruta = n.ticket && n.ticket.solicitante_id === actual.user.id && base === '/admin/tickets' ? '/mis-tickets' : base
      return {
        id: n.id,
        mensaje: n.mensaje,
        leida: n.leida,
        created_at: n.created_at,
        ticket_id: n.ticket_id ?? null,
        ticket_codigo: n.ticket ? codigoTicket(Number(n.ticket.numero)) : null,
        enlace: n.ticket_id ? `${ruta}/${n.ticket_id}` : null,
      }
    })
    return { avisos, noLeidas: count ?? avisos.filter(a => !a.leida).length }
  } catch {
    return { avisos: [], noLeidas: 0 }
  }
}

export async function marcarAvisoLeido(id: string): Promise<Resultado> {
  const actual = await getUsuarioActual()
  if (!actual) return { ok: false, error: 'Sesión no válida' }
  const supabase = createAdminClient()
  const { error } = await (supabase as any)
    .from('ticket_notificaciones')
    .update({ leida: true })
    .eq('id', id)
    .eq('usuario_id', actual.user.id)
  return error ? { ok: false, error: error.message } : { ok: true }
}

export async function marcarTodosAvisosLeidos(): Promise<Resultado> {
  const actual = await getUsuarioActual()
  if (!actual) return { ok: false, error: 'Sesión no válida' }
  const supabase = createAdminClient()
  const { error } = await (supabase as any)
    .from('ticket_notificaciones')
    .update({ leida: true })
    .eq('usuario_id', actual.user.id)
    .eq('leida', false)
  return error ? { ok: false, error: error.message } : { ok: true }
}
