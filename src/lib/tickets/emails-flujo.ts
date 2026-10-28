import type { SupabaseClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/email'
import { codigoTicket, LABEL_ESTADO_TICKET, LABEL_PRIORIDAD_TICKET } from './constantes'
import { obtenerConfigTickets } from './config'
import { crearNotificacion } from './notificar'
import type { EstadoTicket, PrioridadTicket } from './types'

// Correos y avisos del flujo de tickets (solo servidor). Todo es best-effort:
// un fallo de correo o de aviso se registra en consola y nunca tumba la acción.

function getAppUrl(): string {
  if (process.env.APP_URL) return process.env.APP_URL
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return ''
}

export function esc(s: string | null | undefined): string {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
}

const LOGO_INLINE = `<svg width="44" height="44" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="36" height="36" rx="9" fill="#1d4ed8"></rect><path d="M 5 13 C 10 13 10 18 18 18 C 26 18 26 23 31 23" stroke="#ffffff" stroke-width="2.8" stroke-linecap="round" fill="none"></path><path d="M 28 21 L 31 23 L 28 25" stroke="#ffffff" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" fill="none"></path><path d="M 5 23 C 10 23 10 18 18 18 C 26 18 26 13 31 13" stroke="#93c5fd" stroke-width="2.8" stroke-linecap="round" fill="none"></path><path d="M 28 11 L 31 13 L 28 15" stroke="#93c5fd" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" fill="none"></path><circle cx="18" cy="18" r="2.2" fill="white" opacity="0.95"></circle></svg>`

function shell(content: string) {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 0">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)">
        <tr><td style="background:#1e3a5f;padding:20px 32px">
          <table cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding-right:12px;vertical-align:middle">${LOGO_INLINE}</td>
              <td style="vertical-align:middle">
                <p style="margin:0;color:#fff;font-size:18px;font-weight:bold;letter-spacing:-.01em">TIN-<span style="color:#38bdf8">FLOW</span></p>
                <p style="margin:2px 0 0;color:#64748b;font-size:10px;letter-spacing:.08em;text-transform:uppercase">Mesa de ayuda TI · Interworld Group</p>
              </td>
            </tr>
          </table>
        </td></tr>
        <tr><td style="padding:32px">${content}</td></tr>
        <tr><td style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e2e8f0">
          <p style="margin:0;font-size:11px;color:#94a3b8">Este es un mensaje automático — por favor no responda a este correo. Para responder, use el enlace del ticket.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function boton(texto: string, href: string, color = '#2563eb') {
  return `<a href="${esc(href)}" style="display:inline-block;background:${color};color:#fff;text-decoration:none;padding:10px 22px;border-radius:8px;font-size:14px;font-weight:bold;margin:0 8px 8px 0">${esc(texto)}</a>`
}

function bloqueTexto(titulo: string, texto: string, color = '#2563eb') {
  return `<div style="background:#f8fafc;border-left:3px solid ${color};border-radius:0 8px 8px 0;padding:14px 16px;margin-bottom:24px">
    <p style="margin:0 0 6px;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#94a3b8">${esc(titulo)}</p>
    <p style="margin:0;font-size:14px;color:#1e293b;white-space:pre-wrap">${esc(texto)}</p>
  </div>`
}

function tablaDatos(filas: [string, string | null | undefined][]) {
  const visibles = filas.filter(([, v]) => v)
  return `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:24px;font-size:14px">
    ${visibles.map(([k, v], i) => `<tr style="background:${i % 2 === 0 ? '#f8fafc' : '#fff'}"><td style="padding:9px 12px;color:#64748b;width:38%">${esc(k)}</td><td style="padding:9px 12px;color:#1e293b">${esc(v)}</td></tr>`).join('')}
  </table>`
}

// ── Datos del ticket para los correos ────────────────────────────────────────

interface PerfilCorreo { id: string; nombre_completo: string; email: string | null }

interface DatosCorreo {
  id: string
  codigo: string
  asunto: string
  descripcion: string
  estado: EstadoTicket
  prioridad: PrioridadTicket
  categoria: string
  tipologia: string
  esNovedadIGSI: boolean
  fechaRequerida: string | null
  solicitante: PerfilCorreo | null
  responsable: PerfilCorreo | null
  aprobador: PerfilCorreo | null
  emailsCoordinador: string[]
  appUrl: string
}

async function cargarDatos(supabase: SupabaseClient, ticketId: string): Promise<DatosCorreo | null> {
  const { data: t } = await supabase
    .from('tickets')
    .select('id, numero, asunto, descripcion, estado, prioridad, fecha_requerida, solicitante_id, responsable_id, aprobador_id, tipologia:ticket_tipologias(nombre, es_novedad_igsi), categoria:ticket_categorias(nombre)')
    .eq('id', ticketId)
    .single()
  if (!t) return null
  const ticket = t as unknown as {
    id: string; numero: number; asunto: string; descripcion: string; estado: EstadoTicket; prioridad: PrioridadTicket
    fecha_requerida: string | null; solicitante_id: string; responsable_id: string | null; aprobador_id: string | null
    tipologia: { nombre: string; es_novedad_igsi: boolean } | null; categoria: { nombre: string } | null
  }
  const ids = [ticket.solicitante_id, ticket.responsable_id, ticket.aprobador_id].filter((x): x is string => !!x)
  const { data: perfiles } = await supabase.from('perfiles').select('id, nombre_completo, email').in('id', ids)
  const mapa = new Map<string, PerfilCorreo>((perfiles ?? []).map((p: PerfilCorreo) => [p.id, p]))
  const config = await obtenerConfigTickets(supabase)
  return {
    id: ticket.id,
    codigo: codigoTicket(ticket.numero),
    asunto: ticket.asunto,
    descripcion: ticket.descripcion,
    estado: ticket.estado,
    prioridad: ticket.prioridad,
    categoria: ticket.categoria?.nombre ?? '',
    tipologia: ticket.tipologia?.nombre ?? '',
    esNovedadIGSI: !!ticket.tipologia?.es_novedad_igsi,
    fechaRequerida: ticket.fecha_requerida,
    solicitante: mapa.get(ticket.solicitante_id) ?? null,
    responsable: ticket.responsable_id ? mapa.get(ticket.responsable_id) ?? null : null,
    aprobador: ticket.aprobador_id ? mapa.get(ticket.aprobador_id) ?? null : null,
    emailsCoordinador: config.emailsCoordinador ?? [],
    appUrl: getAppUrl(),
  }
}

function asunto(d: DatosCorreo, prefijo: string) {
  return `${prefijo} | ${d.codigo} ${d.asunto}`
}

function filasTicket(d: DatosCorreo): [string, string | null | undefined][] {
  return [
    ['Ticket', d.codigo],
    ['Asunto', d.asunto],
    ['Categoría', d.categoria],
    ['Tipología', d.tipologia],
    ['Prioridad', LABEL_PRIORIDAD_TICKET[d.prioridad]],
    ['Estado', LABEL_ESTADO_TICKET[d.estado]],
    ['Fecha requerida', d.fechaRequerida],
  ]
}

async function enviar(to: string | string[] | null | undefined, subject: string, html: string, ticketId: string) {
  const destinos = (Array.isArray(to) ? to : [to]).filter((x): x is string => !!x && x.includes('@'))
  if (destinos.length === 0) return
  try {
    await sendEmail({ to: destinos, subject, html, requerimientoId: `ticket-${ticketId}` })
  } catch (e) {
    console.error('[tickets] No se pudo enviar el correo:', subject, e)
  }
}

/** Aviso dentro de TIN-FLOW; best-effort */
export async function avisar(supabase: SupabaseClient, usuarioIds: (string | null | undefined)[], ticketId: string | null, mensaje: string): Promise<void> {
  const ids = [...new Set(usuarioIds.filter((x): x is string => !!x))]
  if (ids.length === 0) return
  try {
    await crearNotificacion(supabase, ids, ticketId, mensaje)
  } catch (e) {
    console.error('[tickets] No se pudo crear el aviso:', e)
  }
}

async function conDatos(supabase: SupabaseClient, ticketId: string, fn: (d: DatosCorreo) => Promise<void>) {
  try {
    const d = await cargarDatos(supabase, ticketId)
    if (d) await fn(d)
  } catch (e) {
    console.error('[tickets] Error preparando el correo del ticket', ticketId, e)
  }
}

// ── Correos del flujo ────────────────────────────────────────────────────────

/** Acuse de creación al solicitante */
export async function enviarAcuseCreacion(supabase: SupabaseClient, ticketId: string): Promise<void> {
  await conDatos(supabase, ticketId, async d => {
    const enlace = `${d.appUrl}/mis-tickets/${d.id}`
    const espera = d.estado === 'ESPERA_APROBACION'
      ? `<p style="margin:0 0 20px;font-size:14px;color:#92400e;background:#fef3c7;border-radius:8px;padding:10px 14px">Esta solicitud requiere aprobación${d.aprobador ? ` de <strong>${esc(d.aprobador.nombre_completo)}</strong>` : ''}. TIN la atenderá cuando sea aprobada.</p>`
      : ''
    const html = shell(`
      <h2 style="margin:0 0 8px;font-size:18px;color:#1e293b">Recibimos tu ticket</h2>
      <p style="margin:0 0 20px;font-size:14px;color:#64748b">Hola ${esc(d.solicitante?.nombre_completo)}, registramos tu solicitud con el número <strong>${esc(d.codigo)}</strong>.</p>
      ${espera}
      ${tablaDatos(filasTicket(d))}
      ${boton('Ver mi ticket →', enlace)}
    `)
    await enviar(d.solicitante?.email, asunto(d, 'Ticket recibido'), html, d.id)
  })
}

/** Solicitud de aprobación al aprobador (o a los coordinadores si no hay aprobador) */
export async function enviarSolicitudAprobacion(supabase: SupabaseClient, ticketId: string): Promise<void> {
  await conDatos(supabase, ticketId, async d => {
    const enlace = `${d.appUrl}/mis-tickets/aprobaciones?ticket=${d.id}`
    const sinAprobador = !d.aprobador?.email
    const html = shell(`
      <h2 style="margin:0 0 8px;font-size:18px;color:#1e293b">Solicitud pendiente de aprobación</h2>
      <p style="margin:0 0 20px;font-size:14px;color:#64748b">
        <strong>${esc(d.solicitante?.nombre_completo)}</strong> creó un ticket que requiere aprobación${sinAprobador ? '. El solicitante no tiene jefe inmediato registrado, por eso se envía a la Coordinación TIN' : ''}.
      </p>
      ${tablaDatos(filasTicket(d))}
      ${bloqueTexto('Descripción', d.descripcion)}
      ${boton('Aprobar o rechazar →', enlace, '#16a34a')}
    `)
    await enviar(sinAprobador ? d.emailsCoordinador : d.aprobador!.email, asunto(d, 'Aprobación pendiente'), html, d.id)
  })
  try {
    const { data } = await supabase.from('tickets').select('aprobador_id, numero, asunto').eq('id', ticketId).single()
    if (data?.aprobador_id) {
      await avisar(supabase, [data.aprobador_id], ticketId, `Tienes una solicitud por aprobar: ${codigoTicket(data.numero)} ${data.asunto}`)
    }
  } catch { /* best-effort */ }
}

/** Resultado de la aprobación al solicitante */
export async function enviarResultadoAprobacion(supabase: SupabaseClient, ticketId: string, aprobado: boolean, observacion?: string | null): Promise<void> {
  await conDatos(supabase, ticketId, async d => {
    const enlace = `${d.appUrl}/mis-tickets/${d.id}`
    const html = shell(`
      <h2 style="margin:0 0 8px;font-size:18px;color:${aprobado ? '#15803d' : '#b91c1c'}">Solicitud ${aprobado ? 'aprobada' : 'rechazada'}</h2>
      <p style="margin:0 0 20px;font-size:14px;color:#64748b">
        ${aprobado
          ? 'Tu solicitud fue aprobada y pasó a la mesa de ayuda de TIN para su atención.'
          : 'Tu solicitud fue rechazada por el aprobador y quedó cerrada.'}
      </p>
      ${tablaDatos(filasTicket(d))}
      ${observacion ? bloqueTexto('Observación del aprobador', observacion, aprobado ? '#16a34a' : '#dc2626') : ''}
      ${boton('Ver mi ticket →', enlace)}
    `)
    await enviar(d.solicitante?.email, asunto(d, aprobado ? 'Solicitud aprobada' : 'Solicitud rechazada'), html, d.id)
    await avisar(supabase, [d.solicitante?.id], d.id, `${d.codigo}: tu solicitud fue ${aprobado ? 'aprobada' : 'rechazada'}`)
  })
}

/** Asignación al responsable */
export async function enviarAsignacion(supabase: SupabaseClient, ticketId: string, motivo?: string | null): Promise<void> {
  await conDatos(supabase, ticketId, async d => {
    if (!d.responsable) return
    const enlace = `${d.appUrl}/admin/tickets/${d.id}`
    const html = shell(`
      <h2 style="margin:0 0 8px;font-size:18px;color:#1e293b">Te asignaron un ticket</h2>
      <p style="margin:0 0 20px;font-size:14px;color:#64748b">Hola ${esc(d.responsable.nombre_completo)}, ahora eres responsable del ticket <strong>${esc(d.codigo)}</strong>.</p>
      ${tablaDatos([...filasTicket(d), ['Solicitante', d.solicitante?.nombre_completo]])}
      ${bloqueTexto('Descripción', d.descripcion)}
      ${motivo ? bloqueTexto('Motivo de la asignación', motivo, '#64748b') : ''}
      ${boton('Atender ticket →', enlace)}
    `)
    await enviar(d.responsable.email, asunto(d, 'Ticket asignado'), html, d.id)
    await avisar(supabase, [d.responsable.id], d.id, `Te asignaron el ticket ${d.codigo}: ${d.asunto}`)
  })
}

/** Petición de información al solicitante (ESPERA_USUARIO) */
export async function enviarPeticionInformacion(supabase: SupabaseClient, ticketId: string, comentario?: string | null): Promise<void> {
  await conDatos(supabase, ticketId, async d => {
    const enlace = `${d.appUrl}/mis-tickets/${d.id}`
    const html = shell(`
      <h2 style="margin:0 0 8px;font-size:18px;color:#1e293b">Necesitamos información para continuar</h2>
      <p style="margin:0 0 20px;font-size:14px;color:#64748b">Para seguir con tu ticket <strong>${esc(d.codigo)}</strong> necesitamos que respondas lo siguiente. Mientras tanto el ticket queda en espera.</p>
      ${comentario ? bloqueTexto(d.responsable?.nombre_completo ?? 'TIN', comentario, '#d97706') : ''}
      ${tablaDatos(filasTicket(d))}
      ${boton('Responder en el ticket →', enlace, '#d97706')}
    `)
    await enviar(d.solicitante?.email, asunto(d, 'Información requerida'), html, d.id)
    await avisar(supabase, [d.solicitante?.id], d.id, `${d.codigo}: TIN necesita información para continuar`)
  })
}

/** Respuesta de TIN al resolver; en conceptuales explica cómo se debía hacer */
export async function enviarRespuestaResuelto(supabase: SupabaseClient, ticketId: string, respuesta?: string | null): Promise<void> {
  await conDatos(supabase, ticketId, async d => {
    let conceptual = false
    let causa = ''
    try {
      const { data: cierre } = await supabase
        .from('ticket_cierres')
        .select('respuesta, causa:ticket_causas(ambito, tipo_causa, subcausa)')
        .eq('ticket_id', ticketId)
        .maybeSingle()
      const c = (cierre as unknown as { respuesta: string; causa: { ambito: string; tipo_causa: string; subcausa: string } | null } | null)
      if (c?.causa) {
        conceptual = c.causa.tipo_causa.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().startsWith('conceptual')
        causa = `${c.causa.tipo_causa} · ${c.causa.subcausa}`
      }
      if (!respuesta && c?.respuesta) respuesta = c.respuesta
    } catch { /* sin cierre registrado */ }

    const enlace = `${d.appUrl}/mis-tickets/${d.id}`
    const html = shell(`
      <h2 style="margin:0 0 8px;font-size:18px;color:#15803d">Tu ticket fue resuelto</h2>
      <p style="margin:0 0 20px;font-size:14px;color:#64748b">Hola ${esc(d.solicitante?.nombre_completo)}, TIN resolvió el ticket <strong>${esc(d.codigo)}</strong>. Esta es la respuesta:</p>
      ${respuesta ? bloqueTexto(conceptual ? 'Cómo se debía hacer' : 'Respuesta de TIN', respuesta, '#16a34a') : ''}
      ${conceptual ? `<p style="margin:0 0 20px;font-size:13px;color:#475569">La revisión mostró que el sistema funciona correctamente y la novedad se originó en el uso (${esc(causa)}). Te recomendamos seguir el procedimiento descrito arriba para evitar que se repita.</p>` : ''}
      ${tablaDatos(filasTicket(d))}
      <p style="margin:0 0 14px;font-size:14px;color:#1e293b">¿Quedó solucionado? Confirma la solución para cerrar el ticket, o reábrelo si el problema continúa. Si no respondes, el ticket se cerrará automáticamente.</p>
      ${boton('Confirmar solución →', enlace, '#16a34a')}
      ${boton('Reabrir ticket', enlace, '#64748b')}
    `)
    await enviar(d.solicitante?.email, asunto(d, 'Ticket resuelto'), html, d.id)
    await avisar(supabase, [d.solicitante?.id], d.id, `${d.codigo} fue resuelto. Confirma la solución o reábrelo.`)
  })
}

/** Correo de cierre (manual o automático) */
export async function enviarCierre(supabase: SupabaseClient, ticketId: string, automatico: boolean, comentario?: string | null): Promise<void> {
  await conDatos(supabase, ticketId, async d => {
    const enlace = `${d.appUrl}/mis-tickets/${d.id}`
    const html = shell(`
      <h2 style="margin:0 0 8px;font-size:18px;color:#1e293b">Ticket cerrado</h2>
      <p style="margin:0 0 20px;font-size:14px;color:#64748b">
        ${automatico
          ? `El ticket <strong>${esc(d.codigo)}</strong> se cerró automáticamente porque no recibimos respuesta en el plazo establecido.`
          : `El ticket <strong>${esc(d.codigo)}</strong> quedó cerrado.`}
        Si el problema continúa, puedes reabrirlo desde TIN-FLOW.
      </p>
      ${comentario ? bloqueTexto('Comentario', comentario, '#64748b') : ''}
      ${tablaDatos(filasTicket(d))}
      ${boton('Ver mi ticket →', enlace)}
    `)
    await enviar(d.solicitante?.email, asunto(d, automatico ? 'Ticket cerrado automáticamente' : 'Ticket cerrado'), html, d.id)
    await avisar(supabase, [d.solicitante?.id], d.id, `${d.codigo} quedó cerrado${automatico ? ' automáticamente' : ''}`)
    if (d.responsable && d.responsable.id !== d.solicitante?.id) {
      await avisar(supabase, [d.responsable.id], d.id, `${d.codigo} quedó cerrado${automatico ? ' automáticamente' : ''}`)
    }
  })
}

/** Aviso al responsable cuando el ticket se reabre */
export async function avisarReapertura(supabase: SupabaseClient, ticketId: string, motivo?: string | null): Promise<void> {
  await conDatos(supabase, ticketId, async d => {
    if (!d.responsable) return
    const enlace = `${d.appUrl}/admin/tickets/${d.id}`
    const html = shell(`
      <h2 style="margin:0 0 8px;font-size:18px;color:#b45309">Ticket reabierto</h2>
      <p style="margin:0 0 20px;font-size:14px;color:#64748b">El ticket <strong>${esc(d.codigo)}</strong> volvió a En proceso. Conserva su reloj original.</p>
      ${motivo ? bloqueTexto('Motivo', motivo, '#d97706') : ''}
      ${tablaDatos(filasTicket(d))}
      ${boton('Ver ticket →', enlace)}
    `)
    await enviar(d.responsable.email, asunto(d, 'Ticket reabierto'), html, d.id)
    await avisar(supabase, [d.responsable.id], d.id, `${d.codigo} fue reabierto`)
  })
}
