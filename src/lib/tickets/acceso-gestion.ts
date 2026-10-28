import type { SupabaseClient } from '@supabase/supabase-js'
import { getUsuarioActual, puedeGestionar } from '@/lib/supabase/guards'
import { RECURSOS_TICKETS } from './constantes'

// Contexto de permisos del módulo Tickets para el usuario actual (solo servidor).
// Lo usan las Server Actions de gestión (flujo y bandeja) y las páginas de /admin/tickets.

export interface ContextoTickets {
  usuarioId: string
  esAdmin: boolean
  /** Puede ser responsable y gestionar los tickets que tiene asignados */
  atender: boolean
  /** Ve todos los tickets, asigna y reasigna */
  coordinar: boolean
  /** Ve tipologías de visibilidad restringida */
  restringidas: boolean
}

export async function contextoTickets(): Promise<ContextoTickets | null> {
  const actual = await getUsuarioActual()
  if (!actual) return null
  const esAdmin = !actual.rol || actual.rol === 'ADMIN_TIN'
  const [atender, coordinar, restringidas] = await Promise.all([
    puedeGestionar(RECURSOS_TICKETS.ATENDER),
    puedeGestionar(RECURSOS_TICKETS.COORDINAR),
    puedeGestionar(RECURSOS_TICKETS.RESTRINGIDAS),
  ])
  return { usuarioId: actual.user.id, esAdmin, atender: atender || esAdmin, coordinar: coordinar || esAdmin, restringidas: restringidas || esAdmin }
}

/** Es personal de TIN para el módulo (puede entrar a la bandeja) */
export function esPersonalTIN(ctx: ContextoTickets): boolean {
  return ctx.esAdmin || ctx.atender || ctx.coordinar
}

export interface TicketAcceso {
  solicitante_id: string
  responsable_id: string | null
  aprobador_id?: string | null
}

/** Visibilidad de un ticket para el personal de TIN (bandeja y vista de gestión) */
export function puedeVerTicketGestion(ctx: ContextoTickets, t: TicketAcceso, restringida: boolean): boolean {
  if (ctx.esAdmin) return true
  if (t.solicitante_id === ctx.usuarioId || t.responsable_id === ctx.usuarioId) return true
  if (t.aprobador_id && t.aprobador_id === ctx.usuarioId) return true
  if (restringida && !ctx.restringidas) return false
  if (ctx.coordinar) return true
  if (ctx.atender) return t.responsable_id === null
  return false
}

/** Puede cambiar estado, comentar como TIN, resolver, cambiar prioridad, reclasificar */
export function puedeGestionarTicket(ctx: ContextoTickets, t: TicketAcceso): boolean {
  if (ctx.esAdmin || ctx.coordinar) return true
  return ctx.atender && t.responsable_id === ctx.usuarioId
}

/** Ids de perfiles activos que pueden ser responsables (ADMIN_TIN o rol con tickets:atender) */
export async function idsConRecurso(supabase: SupabaseClient, recurso: string): Promise<string[]> {
  const { data: permisos } = await supabase
    .from('permisos_rol')
    .select('rol_id')
    .eq('recurso', recurso)
    .eq('puede_ver', true)
  const rolIds = (permisos ?? []).map((p: { rol_id: string }) => p.rol_id)
  let roles: string[] = ['ADMIN_TIN']
  if (rolIds.length > 0) {
    const { data } = await supabase.from('roles_personalizados').select('nombre').in('id', rolIds)
    roles = [...new Set([...roles, ...(data ?? []).map((r: { nombre: string }) => r.nombre)])]
  }
  const { data: perfiles } = await supabase
    .from('perfiles')
    .select('id')
    .eq('activo', true)
    .in('rol', roles)
  return (perfiles ?? []).map((p: { id: string }) => p.id)
}
