import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { LABEL_ESTADO_TICKET, TRANSICIONES } from './constantes'
import { registrarEvento, registrarEventos, type EventoTicket } from './historial'
import { recalcularTiemposTicket } from './tiempos'
import type { EstadoTicket } from './types'
import {
  avisar,
  avisarReapertura,
  enviarAcuseCreacion,
  enviarAsignacion,
  enviarCierre,
  enviarPeticionInformacion,
  enviarRespuestaResuelto,
  enviarResultadoAprobacion,
  enviarSolicitudAprobacion,
} from './emails-flujo'

// Motor del flujo de estados (solo servidor, sin validar permisos).
// Lo usan las Server Actions de src/actions/tickets/flujo.ts y el cron de recordatorios.
// Un ticket reabierto conserva su reloj original: nunca se reinicia fecha_creacion.

interface TicketFlujo {
  id: string
  estado: EstadoTicket
  solicitante_id: string
  responsable_id: string | null
  fecha_asignacion: string | null
  fecha_primera_respuesta: string | null
  reaperturas: number
}

/** Recalcula ticket_tiempos sin dejar que un error interrumpa la acción */
export async function recalcularTiemposSeguro(supabase: SupabaseClient, ticketId: string): Promise<void> {
  try {
    await recalcularTiemposTicket(supabase, ticketId)
  } catch (e) {
    console.error('[tickets] No se pudieron recalcular los tiempos del ticket', ticketId, e)
  }
}

/**
 * Registra la primera respuesta si el ticket aún no la tiene (una sola vez).
 * Cuenta como primera respuesta el primer comentario visible de TIN o el primer paso a En proceso.
 * Devuelve true si la registró.
 */
export async function registrarPrimeraRespuestaSiFalta(
  supabase: SupabaseClient,
  ticketId: string,
  usuarioId: string | null,
  origen: 'COMENTARIO' | 'EN_PROCESO' | 'RESPUESTA',
): Promise<boolean> {
  const ahora = new Date().toISOString()
  // Update condicional: solo una petición gana aunque haya dos acciones simultáneas
  const { data, error } = await supabase
    .from('tickets')
    .update({ fecha_primera_respuesta: ahora, updated_at: ahora })
    .eq('id', ticketId)
    .is('fecha_primera_respuesta', null)
    .select('id')
  if (error) throw new Error(error.message)
  if (!data || data.length === 0) return false
  await registrarEvento(supabase, {
    ticketId,
    tipo: 'PRIMERA_RESPUESTA',
    usuarioId,
    campo: 'fecha_primera_respuesta',
    valorNuevo: ahora,
    visibleUsuario: false,
    metadata: { origen },
  })
  return true
}

export async function aplicarCambioEstado(
  supabase: SupabaseClient,
  p: {
    ticketId: string
    nuevoEstado: EstadoTicket
    usuarioId: string | null
    comentario?: string | null
    visibleUsuario?: boolean
    cierreAutomatico?: boolean
    metadata?: Record<string, unknown>
  },
): Promise<void> {
  const { data, error } = await supabase
    .from('tickets')
    .select('id, estado, solicitante_id, responsable_id, fecha_asignacion, fecha_primera_respuesta, reaperturas')
    .eq('id', p.ticketId)
    .single()
  if (error || !data) throw new Error('Ticket no encontrado')
  const t = data as TicketFlujo
  const anterior = t.estado
  const nuevo = p.nuevoEstado

  if (!TRANSICIONES[anterior]?.includes(nuevo)) {
    throw new Error(`No se puede pasar de "${LABEL_ESTADO_TICKET[anterior]}" a "${LABEL_ESTADO_TICKET[nuevo]}"`)
  }
  if ((nuevo === 'ASIGNADO' || nuevo === 'EN_PROCESO') && !t.responsable_id) {
    throw new Error('El ticket no tiene responsable asignado')
  }

  const ahora = new Date().toISOString()
  const comentario = p.comentario?.trim() || null
  const visible = p.visibleUsuario ?? true
  const esReapertura = nuevo === 'EN_PROCESO' && (anterior === 'RESUELTO' || anterior === 'CERRADO')
  const esTIN = !!p.usuarioId && p.usuarioId !== t.solicitante_id

  const cambios: Record<string, unknown> = { estado: nuevo, updated_at: ahora }
  if (nuevo === 'ASIGNADO' && !t.fecha_asignacion) cambios.fecha_asignacion = ahora
  if (nuevo === 'RESUELTO') cambios.fecha_resuelto = ahora
  if (nuevo === 'CERRADO') {
    cambios.fecha_cierre = ahora
    cambios.cierre_automatico = !!p.cierreAutomatico
  }
  if (esReapertura) {
    cambios.reaperturas = (t.reaperturas ?? 0) + 1
    cambios.fecha_resuelto = null
    cambios.fecha_cierre = null
    cambios.cierre_automatico = false
  }

  // Update condicionado al estado leído: evita pisar un cambio concurrente
  const { data: actualizado, error: errUpd } = await supabase
    .from('tickets')
    .update(cambios)
    .eq('id', t.id)
    .eq('estado', anterior)
    .select('id')
  if (errUpd) throw new Error(errUpd.message)
  if (!actualizado || actualizado.length === 0) throw new Error('El ticket cambió mientras se procesaba. Recarga e intenta de nuevo.')

  const eventos: EventoTicket[] = [{
    ticketId: t.id,
    tipo: 'CAMBIO_ESTADO',
    usuarioId: p.usuarioId,
    campo: 'estado',
    valorAnterior: anterior,
    valorNuevo: nuevo,
    comentario,
    visibleUsuario: visible,
    metadata: { ...(p.metadata ?? {}), ...(p.cierreAutomatico ? { cierre_automatico: true } : {}) },
  }]
  if (esReapertura) {
    eventos.push({
      ticketId: t.id,
      tipo: 'REAPERTURA',
      usuarioId: p.usuarioId,
      comentario,
      visibleUsuario: true,
      valorAnterior: anterior,
      valorNuevo: nuevo,
      metadata: { reapertura: (t.reaperturas ?? 0) + 1 },
    })
  }
  if (nuevo === 'CERRADO') {
    eventos.push({
      ticketId: t.id,
      tipo: 'CIERRE',
      usuarioId: p.usuarioId,
      comentario,
      visibleUsuario: true,
      valorNuevo: p.cierreAutomatico ? 'AUTOMATICO' : 'MANUAL',
      metadata: { cierre_automatico: !!p.cierreAutomatico, estado_anterior: anterior },
    })
  }
  await registrarEventos(supabase, eventos)

  // Primera respuesta: primer paso a En proceso por TIN, o respuesta visible de TIN con el cambio
  if (!t.fecha_primera_respuesta && esTIN && !esReapertura) {
    if (nuevo === 'EN_PROCESO') {
      await registrarPrimeraRespuestaSiFalta(supabase, t.id, p.usuarioId, 'EN_PROCESO')
    } else if (comentario && visible && (nuevo === 'ESPERA_USUARIO' || nuevo === 'RESUELTO' || nuevo === 'ESPERA_PROVEEDOR')) {
      await registrarPrimeraRespuestaSiFalta(supabase, t.id, p.usuarioId, 'RESPUESTA')
    }
  }

  // Correos y avisos (best-effort: las funciones atrapan sus errores)
  // Salida de la espera de aprobación por decisión (no por cierre automático): resultado al solicitante
  const decisionAprobacion = anterior === 'ESPERA_APROBACION' && !p.cierreAutomatico
  if (decisionAprobacion) {
    await enviarResultadoAprobacion(supabase, t.id, nuevo !== 'CERRADO', comentario)
  }
  if (nuevo === 'ESPERA_APROBACION') await enviarSolicitudAprobacion(supabase, t.id)
  if (nuevo === 'ASIGNADO') await enviarAsignacion(supabase, t.id, (p.metadata?.motivo as string | undefined) ?? null)
  if (nuevo === 'ESPERA_USUARIO') await enviarPeticionInformacion(supabase, t.id, visible ? comentario : null)
  if (nuevo === 'RESUELTO') await enviarRespuestaResuelto(supabase, t.id, visible ? comentario : null)
  if (nuevo === 'CERRADO' && !decisionAprobacion) {
    await enviarCierre(supabase, t.id, !!p.cierreAutomatico, visible ? comentario : null)
  }
  if (esReapertura) await avisarReapertura(supabase, t.id, comentario)
  if (anterior === 'ESPERA_USUARIO' && nuevo === 'EN_PROCESO' && p.usuarioId === t.solicitante_id) {
    await avisar(supabase, [t.responsable_id], t.id, 'El solicitante respondió y el ticket volvió a En proceso')
  }

  await recalcularTiemposSeguro(supabase, t.id)
}

/** Avisos al crear un ticket. Nunca lanza error. */
export async function despuesDeCrearTicket(ticketId: string): Promise<void> {
  try {
    const supabase = createAdminClient()
    const { data } = await supabase
      .from('tickets')
      .select('id, estado, responsable_id')
      .eq('id', ticketId)
      .single()
    if (!data) return
    if (data.estado === 'ESPERA_APROBACION') await enviarSolicitudAprobacion(supabase, ticketId)
    if (data.responsable_id) await enviarAsignacion(supabase, ticketId, 'Asignación automática por tipología')
    await enviarAcuseCreacion(supabase, ticketId)
    await recalcularTiemposSeguro(supabase, ticketId)
  } catch (e) {
    console.error('[tickets] Error en avisos de creación del ticket', ticketId, e)
  }
}
