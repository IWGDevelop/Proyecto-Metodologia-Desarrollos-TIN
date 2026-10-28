import type { SupabaseClient } from '@supabase/supabase-js'
import { codigoBug } from './constantes'
import { registrarEvento } from './historial'
import type { ClasificacionBug, SeveridadBug, TipoDocumentoIGSI } from './types'

// Bugs y deuda técnica de IGSI (solo servidor, sin validar permisos: lo hacen las
// Server Actions que lo llaman).

export async function crearBug(
  supabase: SupabaseClient,
  datos: {
    titulo: string
    descripcion?: string
    clasificacion: ClasificacionBug
    severidad: SeveridadBug
    tipo_documento?: TipoDocumentoIGSI | null
    modulo?: string | null
    solucion_provisional?: string | null
  },
  usuarioId: string,
): Promise<{ id: string; numero: number }> {
  const titulo = datos.titulo.trim()
  if (!titulo) throw new Error('El bug necesita un título')
  const { data, error } = await supabase
    .from('ticket_bugs')
    .insert({
      titulo,
      descripcion: datos.descripcion?.trim() || null,
      clasificacion: datos.clasificacion,
      severidad: datos.severidad,
      tipo_documento: datos.tipo_documento ?? null,
      modulo: datos.modulo?.trim() || null,
      solucion_provisional: datos.solucion_provisional?.trim() || null,
      created_by: usuarioId,
    })
    .select('id, numero')
    .single()
  if (error || !data) throw new Error(`No se pudo crear el bug: ${error?.message ?? 'sin respuesta'}`)
  return { id: data.id as string, numero: Number(data.numero) }
}

/** Enlaza un ticket a un bug (si no estaba enlazado) y registra ENLACE_BUG en el historial */
export async function enlazarTicketABug(
  supabase: SupabaseClient,
  ticketId: string,
  bugId: string,
  usuarioId: string | null,
): Promise<void> {
  const { data: existente } = await supabase
    .from('ticket_bug_tickets')
    .select('ticket_id')
    .eq('ticket_id', ticketId)
    .eq('bug_id', bugId)
    .maybeSingle()
  if (existente) return

  const { data: bug, error: errBug } = await supabase
    .from('ticket_bugs')
    .select('numero, titulo, severidad, estado')
    .eq('id', bugId)
    .single()
  if (errBug || !bug) throw new Error('Bug no encontrado')

  const { error } = await supabase.from('ticket_bug_tickets').insert({ ticket_id: ticketId, bug_id: bugId })
  if (error) {
    if ((error as { code?: string }).code === '23505') return // enlazado en paralelo
    throw new Error(`No se pudo enlazar el bug: ${error.message}`)
  }

  await registrarEvento(supabase, {
    ticketId,
    tipo: 'ENLACE_BUG',
    usuarioId,
    campo: 'bug',
    valorNuevo: codigoBug(Number(bug.numero)),
    comentario: `Enlazado a ${codigoBug(Number(bug.numero))}: ${bug.titulo}`,
    visibleUsuario: false,
    metadata: { bug_id: bugId, severidad: bug.severidad, estado_bug: bug.estado },
  })
}

/** Días calendario desde la detección hasta el despliegue (o hasta hoy si sigue abierto) */
export function diasAbiertoBug(b: { fecha_detectado: string; fecha_desplegado: string | null }, ahora: Date = new Date()): number {
  const fin = b.fecha_desplegado ? new Date(b.fecha_desplegado) : ahora
  return Math.max(0, Math.floor((fin.getTime() - new Date(b.fecha_detectado).getTime()) / 86_400_000))
}
