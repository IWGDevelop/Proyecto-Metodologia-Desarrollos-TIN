/** Asunto estándar por requerimiento — todos los correos del mismo req usan este subject para que el cliente de correo los agrupe en un solo hilo */
export function subjectReq(identificacion: string, nombreDesarrollo: string) {
  return `TIN-FLOW | [${identificacion}] ${nombreDesarrollo}`
}

const LOGO_SVG = `<svg width="44" height="44" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="if-bg" x1="0" y1="0" x2="36" y2="36" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="#1d4ed8"></stop><stop offset="100%" stop-color="#0ea5e9"></stop></linearGradient><linearGradient id="if-stroke1" x1="4" y1="11" x2="32" y2="25" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="#ffffff" stop-opacity="1"></stop><stop offset="100%" stop-color="#bae6fd" stop-opacity="0.9"></stop></linearGradient><linearGradient id="if-stroke2" x1="4" y1="25" x2="32" y2="11" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="#93c5fd" stop-opacity="0.7"></stop><stop offset="100%" stop-color="#ffffff" stop-opacity="0.95"></stop></linearGradient></defs><rect width="36" height="36" rx="9" fill="url(#if-bg)"></rect><path d="M 5 13 C 10 13 10 18 18 18 C 26 18 26 23 31 23" stroke="url(#if-stroke1)" stroke-width="2.8" stroke-linecap="round" fill="none"></path><path d="M 28 21 L 31 23 L 28 25" stroke="url(#if-stroke1)" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" fill="none"></path><path d="M 5 23 C 10 23 10 18 18 18 C 26 18 26 13 31 13" stroke="url(#if-stroke2)" stroke-width="2.8" stroke-linecap="round" fill="none"></path><path d="M 28 11 L 31 13 L 28 15" stroke="url(#if-stroke2)" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" fill="none"></path><circle cx="18" cy="18" r="2.2" fill="white" opacity="0.95"></circle></svg>`

const LOGO_URI = `data:image/svg+xml;base64,${Buffer.from(LOGO_SVG).toString('base64')}`

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
              <td style="padding-right:12px;vertical-align:middle">
                <img src="${LOGO_URI}" width="44" height="44" alt="TIN-FLOW" style="display:block;border:0" />
              </td>
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
    <p style="margin:0 0 24px;font-size:14px;color:#64748b">El requerimiento <strong>${identificacion}</strong> ha cambiado de estado.</p>

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

    <p style="margin:0 0 6px;font-size:14px;color:#1e293b"><strong>Desarrollo:</strong> ${nombreDesarrollo}</p>
    ${observacion ? `<p style="margin:0 0 24px;font-size:14px;color:#475569"><strong>Observación:</strong> ${observacion}</p>` : '<p style="margin-bottom:24px"></p>'}

    ${enlace ? `<a href="${enlace}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:10px 22px;border-radius:8px;font-size:14px;font-weight:bold">Ver desarrollo →</a>` : ''}
  `)
}

export function templateNuevoComentario({
  nombreDesarrollo,
  identificacion,
  comentario,
  usuario,
}: {
  nombreDesarrollo: string
  identificacion: string
  comentario: string
  usuario: string
}) {
  return shell(`
    <h2 style="margin:0 0 8px;font-size:18px;color:#1e293b">Nuevo comentario</h2>
    <p style="margin:0 0 24px;font-size:14px;color:#64748b">Se agregó un comentario en <strong>${identificacion} — ${nombreDesarrollo}</strong>.</p>

    <div style="background:#f8fafc;border-left:3px solid #2563eb;border-radius:0 8px 8px 0;padding:14px 16px;margin-bottom:24px">
      <p style="margin:0 0 6px;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#94a3b8">${usuario}</p>
      <p style="margin:0;font-size:14px;color:#1e293b;white-space:pre-wrap">${comentario}</p>
    </div>
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
