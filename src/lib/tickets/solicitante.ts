import type { SupabaseClient } from '@supabase/supabase-js'
import { getUsuarioActual, puedeGestionar } from '@/lib/supabase/guards'
import { ADJUNTOS_ACEPTADOS, ADJUNTO_TAMANO_MAX, RECURSOS_TICKETS, ZONA_HORARIA } from './constantes'

// Utilidades de servidor de la vista del funcionario (área B).
// Sin 'use server': solo las importan Server Actions y páginas de servidor.

export interface AccesoTickets {
  usuarioId: string
  esAdmin: boolean
  atender: boolean
  coordinar: boolean
  restringidas: boolean
}

/** Usuario actual y sus permisos del módulo. null si no hay sesión. */
export async function accesoTickets(): Promise<AccesoTickets | null> {
  const actual = await getUsuarioActual()
  if (!actual) return null
  // Sin perfil se trata como ADMIN_TIN, igual que guards.ts y acceso-gestion.ts
  const esAdmin = !actual.rol || actual.rol === 'ADMIN_TIN'
  const [atender, coordinar, restringidas] = await Promise.all([
    puedeGestionar(RECURSOS_TICKETS.ATENDER),
    puedeGestionar(RECURSOS_TICKETS.COORDINAR),
    puedeGestionar(RECURSOS_TICKETS.RESTRINGIDAS),
  ])
  return { usuarioId: actual.user.id, esAdmin, atender, coordinar, restringidas }
}

/**
 * ¿Puede el usuario ver/actuar sobre el ticket? Solicitante, responsable, ADMIN_TIN,
 * o coordinador (este último solo en tipologías restringidas si tiene tickets:restringidas).
 */
export function puedeVerTicket(
  acceso: AccesoTickets,
  t: { solicitante_id: string; responsable_id: string | null; aprobador_id?: string | null },
  restringida: boolean,
): boolean {
  if (acceso.esAdmin) return true
  if (t.solicitante_id === acceso.usuarioId || t.responsable_id === acceso.usuarioId) return true
  if (acceso.coordinar && (!restringida || acceso.restringidas)) return true
  return false
}

/** Fecha de hoy (YYYY-MM-DD) en la zona horaria del módulo */
export function hoyISO(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: ZONA_HORARIA })
}

export interface AdjuntoEntrada {
  nombre_archivo: string
  tipo_archivo: string
  tamano: number
  url: string
  ruta: string
  es_imagen: boolean
}

/** Valida los adjuntos que llegan del cliente y los convierte en filas de ticket_adjuntos */
export function filasAdjuntos(
  ticketId: string,
  adjuntos: AdjuntoEntrada[],
  usuarioId: string,
): { ok: true; filas: Record<string, unknown>[] } | { ok: false; error: string } {
  if (!Array.isArray(adjuntos)) return { ok: false, error: 'Adjuntos inválidos' }
  if (adjuntos.length > 30) return { ok: false, error: 'Máximo 30 adjuntos por envío' }
  const filas: Record<string, unknown>[] = []
  for (const a of adjuntos) {
    const nombre = String(a?.nombre_archivo ?? '').trim()
    const tipo = String(a?.tipo_archivo ?? '')
    const url = String(a?.url ?? '')
    const ruta = String(a?.ruta ?? '')
    const tamano = Number(a?.tamano ?? 0)
    if (!nombre || !url.startsWith('https://') || !ruta.startsWith('tickets/')) {
      return { ok: false, error: `Adjunto inválido: ${nombre || 'sin nombre'}` }
    }
    if (!ADJUNTOS_ACEPTADOS.includes(tipo)) return { ok: false, error: `Tipo de archivo no admitido: ${nombre}` }
    if (!Number.isFinite(tamano) || tamano < 0 || tamano > ADJUNTO_TAMANO_MAX) {
      return { ok: false, error: `El archivo ${nombre} supera el tamaño permitido` }
    }
    filas.push({
      ticket_id: ticketId,
      nombre_archivo: nombre.slice(0, 255),
      tipo_archivo: tipo,
      tamano,
      url,
      ruta,
      es_imagen: tipo.startsWith('image/'),
      cargado_por: usuarioId,
    })
  }
  return { ok: true, filas }
}

/** Nombres de perfiles por id */
export async function nombresPerfiles(supabase: SupabaseClient, ids: (string | null | undefined)[]): Promise<Map<string, string>> {
  const unicos = [...new Set(ids.filter((x): x is string => !!x))]
  if (unicos.length === 0) return new Map()
  const { data } = await supabase.from('perfiles').select('id, nombre_completo').in('id', unicos)
  return new Map((data ?? []).map((p: { id: string; nombre_completo: string }) => [p.id, p.nombre_completo]))
}
