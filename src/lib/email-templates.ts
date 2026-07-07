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
        <tr><td style="background:#1e3a5f;padding:24px 32px">
          <p style="margin:0;color:#fff;font-size:20px;font-weight:bold">IWG Logistics</p>
          <p style="margin:4px 0 0;color:#93c5fd;font-size:12px;letter-spacing:.05em;text-transform:uppercase">Sistema de Gestión TIN</p>
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
