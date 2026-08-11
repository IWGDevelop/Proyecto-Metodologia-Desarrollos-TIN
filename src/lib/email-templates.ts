/** Asunto estándar por requerimiento — todos los correos del mismo req usan este subject para que el cliente de correo los agrupe en un solo hilo */
export function subjectReq(_identificacion: string, nombreDesarrollo: string) {
  return `TIN-FLOW | ${nombreDesarrollo}`
}

const LOGO_INLINE = `<svg width="44" height="44" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="36" height="36" rx="9" fill="#1d4ed8"></rect><path d="M 5 13 C 10 13 10 18 18 18 C 26 18 26 23 31 23" stroke="#ffffff" stroke-width="2.8" stroke-linecap="round" fill="none"></path><path d="M 28 21 L 31 23 L 28 25" stroke="#ffffff" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" fill="none"></path><path d="M 5 23 C 10 23 10 18 18 18 C 26 18 26 13 31 13" stroke="#93c5fd" stroke-width="2.8" stroke-linecap="round" fill="none"></path><path d="M 28 11 L 31 13 L 28 15" stroke="#93c5fd" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" fill="none"></path><circle cx="18" cy="18" r="2.2" fill="white" opacity="0.95"></circle></svg>`

/** Returns an HTML string wrapped in the shared email shell */
function shell(content: string) {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 0">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)">
        <!-- Header -->
        <tr><td style="background:#1e3a5f;padding:20px 32px">
          <table cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding-right:12px;vertical-align:middle">${LOGO_INLINE}</td>
              <td style="vertical-align:middle">
                <p style="margin:0;color:#fff;font-size:18px;font-weight:bold;letter-spacing:-.01em">TIN-<span style="color:#38bdf8">FLOW</span></p>
                <p style="margin:2px 0 0;color:#64748b;font-size:10px;letter-spacing:.08em;text-transform:uppercase">Interworld Group</p>
              </td>
            </tr>
          </table>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:32px">${content}</td></tr>
        <!-- Footer -->
        <tr><td style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e2e8f0">
          <p style="margin:0;font-size:11px;color:#94a3b8">Este es un mensaje automático — por favor no responda a este correo.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

export function templateCambioEstado({
  nombreDesarrollo,
  identificacion,
  estadoAnterior,
  estadoNuevo,
  observacion,
  enlace,
}: {
  nombreDesarrollo: string
  identificacion: string
  estadoAnterior: string
  estadoNuevo: string
  observacion?: string
  enlace?: string
}) {
  return shell(`
    <h2 style="margin:0 0 8px;font-size:18px;color:#1e293b">Actualización de estado</h2>
    <p style="margin:0 0 24px;font-size:14px;color:#64748b">El desarrollo <strong>${nombreDesarrollo}</strong> ha cambiado de estado.</p>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px">
      <tr>
        <td style="padding:12px 16px;background:#f1f5f9;border-radius:8px 0 0 8px;font-size:13px;color:#64748b;width:50%">
          <p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#94a3b8">Estado anterior</p>
          <strong style="color:#475569">${estadoAnterior}</strong>
        </td>
        <td style="padding:12px 16px;background:#dbeafe;border-radius:0 8px 8px 0;font-size:13px;color:#1d4ed8;width:50%">
          <p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#93c5fd">Nuevo estado</p>
          <strong>${estadoNuevo}</strong>
        </td>
      </tr>
    </table>

    <p style="margin:0 0 6px;font-size:14px;color:#1e293b"></p>
    ${observacion ? `<p style="margin:0 0 24px;font-size:14px;color:#475569"><strong>Observación:</strong> ${observacion}</p>` : '<p style="margin-bottom:24px"></p>'}

    ${enlace ? `<a href="${enlace}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:10px 22px;border-radius:8px;font-size:14px;font-weight:bold">Ver desarrollo →</a>` : ''}
  `)
}

export function templateNuevoComentario({
  nombreDesarrollo,
  identificacion,
  comentario,
  usuario,
  enlace,
}: {
  nombreDesarrollo: string
  identificacion: string
  comentario: string
  usuario: string
  enlace?: string
}) {
  return shell(`
    <h2 style="margin:0 0 8px;font-size:18px;color:#1e293b">Nuevo comentario</h2>
    <p style="margin:0 0 24px;font-size:14px;color:#64748b">Se agregó un comentario en <strong>${nombreDesarrollo}</strong>.</p>

    <div style="background:#f8fafc;border-left:3px solid #2563eb;border-radius:0 8px 8px 0;padding:14px 16px;margin-bottom:24px">
      <p style="margin:0 0 6px;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#94a3b8">${usuario}</p>
      <p style="margin:0;font-size:14px;color:#1e293b;white-space:pre-wrap">${comentario}</p>
    </div>

    ${enlace ? `<a href="${enlace}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:10px 22px;border-radius:8px;font-size:14px;font-weight:bold">Ver desarrollo →</a>` : ''}
  `)
}

export function templateNuevaReunion({
  nombreDesarrollo,
  tituloReunion,
  fechaReunion,
  tareas,
  enlace,
}: {
  nombreDesarrollo: string
  tituloReunion: string
  fechaReunion: string
  tareas: { descripcion: string; responsable_email?: string | null; fecha_compromiso?: string | null }[]
  enlace?: string
}) {
  const fecha = new Date(fechaReunion).toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  const tareasHtml = tareas.length > 0
    ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;border-collapse:collapse">
        ${tareas.map((t, i) => `
          <tr style="background:${i % 2 === 0 ? '#f8fafc' : '#fff'}">
            <td style="padding:10px 12px;font-size:13px;color:#1e293b;border-bottom:1px solid #e2e8f0">
              ${t.descripcion}
              ${t.responsable_email ? `<span style="display:block;font-size:11px;color:#94a3b8;margin-top:2px">${t.responsable_email}</span>` : ''}
              ${t.fecha_compromiso ? `<span style="display:block;font-size:11px;color:#94a3b8">Compromiso: ${t.fecha_compromiso}</span>` : ''}
            </td>
          </tr>`).join('')}
      </table>`
    : ''

  return shell(`
    <h2 style="margin:0 0 8px;font-size:18px;color:#1e293b">Nueva reunión registrada</h2>
    <p style="margin:0 0 24px;font-size:14px;color:#64748b">Se agendó una reunión para el desarrollo <strong>${nombreDesarrollo}</strong>.</p>

    <table width="100%" cellpadding="8" cellspacing="0" style="border-collapse:collapse;margin-bottom:24px;font-size:14px">
      <tr style="background:#f8fafc"><td style="padding:10px 12px;color:#64748b;width:40%">Reunión</td><td style="padding:10px 12px;color:#1e293b;font-weight:bold">${tituloReunion}</td></tr>
      <tr><td style="padding:10px 12px;color:#64748b">Fecha</td><td style="padding:10px 12px;color:#1e293b">${fecha}</td></tr>
    </table>

    ${tareas.length > 0 ? `<p style="margin:0 0 12px;font-size:13px;font-weight:bold;color:#1e293b">Compromisos (${tareas.length})</p>${tareasHtml}` : ''}

    ${enlace ? `<a href="${enlace}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:10px 22px;border-radius:8px;font-size:14px;font-weight:bold">Ver desarrollo →</a>` : ''}
  `)
}

export function templateNuevaTarea({
  nombreDesarrollo,
  tituloTarea,
  fechaCompromiso,
  enlace,
}: {
  nombreDesarrollo: string
  tituloTarea: string
  fechaCompromiso?: string | null
  enlace?: string
}) {
  return shell(`
    <h2 style="margin:0 0 8px;font-size:18px;color:#1e293b">Nueva tarea de desarrollo</h2>
    <p style="margin:0 0 24px;font-size:14px;color:#64748b">Se registró una tarea técnica en el desarrollo <strong>${nombreDesarrollo}</strong>.</p>

    <table width="100%" cellpadding="8" cellspacing="0" style="border-collapse:collapse;margin-bottom:24px;font-size:14px">
      <tr style="background:#f8fafc"><td style="padding:10px 12px;color:#64748b;width:40%">Tarea</td><td style="padding:10px 12px;color:#1e293b;font-weight:bold">${tituloTarea}</td></tr>
      ${fechaCompromiso ? `<tr><td style="padding:10px 12px;color:#64748b">Fecha compromiso</td><td style="padding:10px 12px;color:#1e293b">${fechaCompromiso}</td></tr>` : ''}
    </table>

    ${enlace ? `<a href="${enlace}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:10px 22px;border-radius:8px;font-size:14px;font-weight:bold">Ver desarrollo →</a>` : ''}
  `)
}

export function templateTareaVenceHoy({
  nombreDesarrollo,
  descripcionTarea,
  fechaCompromiso,
  enlace,
}: {
  nombreDesarrollo: string
  descripcionTarea: string
  fechaCompromiso: string
  enlace?: string
}) {
  return shell(`
    <h2 style="margin:0 0 8px;font-size:18px;color:#d97706">⏰ Tarea vence hoy</h2>
    <p style="margin:0 0 24px;font-size:14px;color:#64748b">Una tarea del desarrollo <strong>${nombreDesarrollo}</strong> vence <strong>hoy (${fechaCompromiso})</strong>.</p>

    <div style="background:#fffbeb;border-left:3px solid #f59e0b;border-radius:0 8px 8px 0;padding:14px 16px;margin-bottom:24px">
      <p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#b45309">Tarea pendiente</p>
      <p style="margin:0;font-size:14px;color:#1e293b;font-weight:bold">${descripcionTarea}</p>
    </div>

    ${enlace ? `<a href="${enlace}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:10px 22px;border-radius:8px;font-size:14px;font-weight:bold">Ver desarrollo →</a>` : ''}
  `)
}

export function templateTareaVencida({
  nombreDesarrollo,
  descripcionTarea,
  fechaCompromiso,
  enlace,
}: {
  nombreDesarrollo: string
  descripcionTarea: string
  fechaCompromiso: string
  enlace?: string
}) {
  return shell(`
    <h2 style="margin:0 0 8px;font-size:18px;color:#dc2626">🚨 Tarea vencida</h2>
    <p style="margin:0 0 24px;font-size:14px;color:#64748b">Una tarea del desarrollo <strong>${nombreDesarrollo}</strong> no fue completada antes de su fecha límite <strong>${fechaCompromiso}</strong>.</p>

    <div style="background:#fef2f2;border-left:3px solid #ef4444;border-radius:0 8px 8px 0;padding:14px 16px;margin-bottom:24px">
      <p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#b91c1c">Tarea vencida</p>
      <p style="margin:0;font-size:14px;color:#1e293b;font-weight:bold">${descripcionTarea}</p>
    </div>

    ${enlace ? `<a href="${enlace}" style="display:inline-block;background:#dc2626;color:#fff;text-decoration:none;padding:10px 22px;border-radius:8px;font-size:14px;font-weight:bold">Ver desarrollo →</a>` : ''}
  `)
}

export function templateAsignacionDesarrollador({
  nombreDesarrollador,
  nombreDesarrollo,
  identificacion,
  numero,
  enlace,
}: {
  nombreDesarrollador: string
  nombreDesarrollo: string
  identificacion: string
  numero?: number | null
  enlace?: string
}) {
  return shell(`
    <h2 style="margin:0 0 8px;font-size:18px;color:#1e293b">Se te asignó un desarrollo</h2>
    <p style="margin:0 0 24px;font-size:14px;color:#64748b">
      Hola <strong>${nombreDesarrollador}</strong>, has sido asignado como desarrollador del siguiente requerimiento:
    </p>

    <table width="100%" cellpadding="8" cellspacing="0" style="border-collapse:collapse;margin-bottom:24px;font-size:14px">
      ${numero ? `<tr style="background:#f8fafc"><td style="padding:10px 12px;color:#64748b;width:40%">Número</td><td style="padding:10px 12px;color:#1e293b;font-weight:bold">#${numero}</td></tr>` : ''}
      <tr ${numero ? '' : 'style="background:#f8fafc"'}><td style="padding:10px 12px;color:#64748b;width:40%">Identificación</td><td style="padding:10px 12px;color:#1e293b">${identificacion}</td></tr>
      <tr style="background:#f8fafc"><td style="padding:10px 12px;color:#64748b">Nombre</td><td style="padding:10px 12px;color:#1e293b;font-weight:bold">${nombreDesarrollo}</td></tr>
    </table>

    ${enlace ? `<a href="${enlace}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:10px 22px;border-radius:8px;font-size:14px;font-weight:bold">Ver desarrollo →</a>` : ''}
  `)
}

export function templateRecordatorioTarea({
  nombreDesarrollo,
  tituloReunion,
  descripcionTarea,
  responsableEmail,
  fechaCompromiso,
  enlace,
}: {
  nombreDesarrollo: string
  tituloReunion: string
  descripcionTarea: string
  responsableEmail?: string | null
  fechaCompromiso?: string | null
  enlace?: string
}) {
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
  const fechaDate = fechaCompromiso ? new Date(fechaCompromiso + 'T12:00:00') : null
  const vencida = fechaDate ? fechaDate < hoy : false
  const diasRetraso = vencida && fechaDate
    ? Math.ceil((hoy.getTime() - fechaDate.getTime()) / 86400000)
    : 0
  const fechaStr = fechaDate
    ? fechaDate.toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })
    : null

  const headerColor = vencida ? '#dc2626' : '#d97706'
  const bannerBg    = vencida ? '#fef2f2' : '#fffbeb'
  const bannerBorder = vencida ? '#ef4444' : '#f59e0b'
  const bannerLabel  = vencida ? '#991b1b' : '#92400e'
  const titulo = vencida ? '🚨 Recordatorio: tarea vencida' : '⏰ Recordatorio: tarea pendiente'
  const btnColor = vencida ? '#dc2626' : '#2563eb'

  return shell(`
    <h2 style="margin:0 0 8px;font-size:18px;color:${headerColor}">${titulo}</h2>
    <p style="margin:0 0 24px;font-size:14px;color:#64748b">
      Tienes una tarea pendiente en el desarrollo <strong>${nombreDesarrollo}</strong>${tituloReunion ? `, reunión <strong>${tituloReunion}</strong>` : ''}.
    </p>

    <div style="background:${bannerBg};border-left:3px solid ${bannerBorder};border-radius:0 8px 8px 0;padding:14px 16px;margin-bottom:24px">
      <p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:${bannerLabel}">Tarea pendiente</p>
      <p style="margin:0;font-size:14px;color:#1e293b;font-weight:bold">${descripcionTarea}</p>
      ${responsableEmail ? `<p style="margin:6px 0 0;font-size:12px;color:#64748b">👤 Responsable: <strong>${responsableEmail}</strong></p>` : ''}
      ${fechaStr ? `<p style="margin:6px 0 0;font-size:12px;color:${bannerLabel}">
        ${vencida
          ? `Venció el ${fechaStr} · ${diasRetraso} día${diasRetraso !== 1 ? 's' : ''} de retraso`
          : `Fecha compromiso: ${fechaStr}`}
      </p>` : ''}
    </div>

    <p style="margin:0 0 20px;font-size:14px;color:#475569">
      Por favor, ingresa al sistema para registrar la evidencia o respuesta de esta tarea.
    </p>

    ${enlace ? `<a href="${enlace}" style="display:inline-block;background:${btnColor};color:#fff;text-decoration:none;padding:10px 22px;border-radius:8px;font-size:14px;font-weight:bold">Ver desarrollo →</a>` : ''}
  `)
}

export function templateNuevoRequerimiento({
  nombreDesarrollo,
  identificacion,
  solicitante,
  enlace,
}: {
  nombreDesarrollo: string
  identificacion: string
  solicitante?: string
  enlace?: string
}) {
  return shell(`
    <h2 style="margin:0 0 8px;font-size:18px;color:#1e293b">Nuevo requerimiento recibido</h2>
    <p style="margin:0 0 24px;font-size:14px;color:#64748b">Se ha registrado un nuevo desarrollo en el sistema.</p>

    <table width="100%" cellpadding="8" cellspacing="0" style="border-collapse:collapse;margin-bottom:24px;font-size:14px">
      <tr style="background:#f8fafc"><td style="padding:10px 12px;color:#64748b;width:40%">Identificación</td><td style="padding:10px 12px;color:#1e293b;font-weight:bold">${identificacion}</td></tr>
      <tr><td style="padding:10px 12px;color:#64748b">Nombre</td><td style="padding:10px 12px;color:#1e293b">${nombreDesarrollo}</td></tr>
      ${solicitante ? `<tr style="background:#f8fafc"><td style="padding:10px 12px;color:#64748b">Solicitante</td><td style="padding:10px 12px;color:#1e293b">${solicitante}</td></tr>` : ''}
    </table>

    ${enlace ? `<a href="${enlace}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:10px 22px;border-radius:8px;font-size:14px;font-weight:bold">Ver desarrollo →</a>` : ''}
  `)
}
