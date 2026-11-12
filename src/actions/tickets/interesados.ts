'use server'
/* eslint-disable @typescript-eslint/no-explicit-any -- patrón (supabase as any) del repo */

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { NO_AUTORIZADO } from '@/lib/supabase/guards'
import { contextoTickets, puedeGestionarTicket, puedeVerTicketGestion } from '@/lib/tickets/acceso-gestion'
import { enviarInteresadosAgregados } from '@/lib/tickets/emails-flujo'
import { agregarInteresadosTicket, quitarInteresadoTicket } from '@/lib/tickets/interesados'

// Partes interesadas de un ticket: las agrega o quita el solicitante o TIN; cada
// interesado puede retirarse a sí mismo.

type Resultado = { ok: boolean; error?: string }

export interface FuncionarioOpcion {
  id: string
  nombre_completo: string
  cargo: string | null
  proceso_interno: string | null
}

/** Funcionarios activos que coinciden con el texto (nombre o correo), para el buscador */
export async function buscarFuncionarios(q: string): Promise<FuncionarioOpcion[]> {
  const ctx = await contextoTickets()
  if (!ctx) return []
  // Sin caracteres que rompan el filtro .or() de PostgREST ni comodines
  const texto = String(q ?? '').replace(/[\\%_,()*:"]/g, ' ').trim().slice(0, 60)
  if (texto.length < 2) return []
  const patron = `*${texto.replace(/\s+/g, '*')}*`
  const { data } = await (createAdminClient() as any)
    .from('perfiles')
    .select('id, nombre_completo, cargo, proceso_interno')
    .eq('activo', true)
    .or(`nombre_completo.ilike.${patron},email.ilike.${patron}`)
    .neq('id', ctx.usuarioId)
    .order('nombre_completo')
    .limit(15)
  return (data ?? []) as FuncionarioOpcion[]
}

async function cargar(ticketId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(String(ticketId ?? ''))) return null
  const { data } = await (createAdminClient() as any)
    .from('tickets')
    .select('id, numero, estado, solicitante_id, responsable_id, aprobador_id, tipologia:ticket_tipologias(visibilidad_restringida)')
    .eq('id', ticketId)
    .maybeSingle()
  return data as {
    id: string; numero: number; estado: string; solicitante_id: string; responsable_id: string | null
    aprobador_id: string | null; tipologia: { visibilidad_restringida: boolean } | null
  } | null
}

function refrescar(ticketId: string) {
  revalidatePath(`/mis-tickets/${ticketId}`)
  revalidatePath(`/admin/tickets/${ticketId}`)
  revalidatePath('/mis-tickets')
}

export async function agregarInteresados(ticketId: string, usuarioIds: string[]): Promise<Resultado & { agregados?: number }> {
  try {
    const ctx = await contextoTickets()
    if (!ctx) return { ok: false, error: NO_AUTORIZADO }
    const t = await cargar(ticketId)
    if (!t) return { ok: false, error: 'Ticket no encontrado' }
    const gestiona = puedeVerTicketGestion(ctx, t, !!t.tipologia?.visibilidad_restringida) && puedeGestionarTicket(ctx, t)
    if (t.solicitante_id !== ctx.usuarioId && !gestiona) return { ok: false, error: 'Solo el solicitante o TIN pueden involucrar a otros funcionarios' }
    if (t.estado === 'CERRADO') return { ok: false, error: 'El ticket está cerrado' }
    if (!Array.isArray(usuarioIds) || !usuarioIds.length) return { ok: false, error: 'Elige al menos un funcionario' }

    const supabase = createAdminClient()
    const agregados = await agregarInteresadosTicket(supabase, t, usuarioIds, ctx.usuarioId)
    if (agregados.length) await enviarInteresadosAgregados(supabase, t.id, agregados.map(p => p.id), ctx.usuarioId)
    refrescar(t.id)
    return { ok: true, agregados: agregados.length }
  } catch (e) {
    return { ok: false, error: (e as Error).message ?? 'No se pudieron agregar las partes interesadas' }
  }
}

export async function quitarInteresado(ticketId: string, usuarioId: string): Promise<Resultado> {
  try {
    const ctx = await contextoTickets()
    if (!ctx) return { ok: false, error: NO_AUTORIZADO }
    const t = await cargar(ticketId)
    if (!t) return { ok: false, error: 'Ticket no encontrado' }
    const gestiona = puedeVerTicketGestion(ctx, t, !!t.tipologia?.visibilidad_restringida) && puedeGestionarTicket(ctx, t)
    const esUnoMismo = usuarioId === ctx.usuarioId
    if (t.solicitante_id !== ctx.usuarioId && !gestiona && !esUnoMismo) return { ok: false, error: NO_AUTORIZADO }

    const quitado = await quitarInteresadoTicket(createAdminClient(), t.id, usuarioId, ctx.usuarioId)
    if (!quitado) return { ok: false, error: 'Ese funcionario no estaba en el ticket' }
    refrescar(t.id)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: (e as Error).message ?? 'No se pudo quitar la parte interesada' }
  }
}
