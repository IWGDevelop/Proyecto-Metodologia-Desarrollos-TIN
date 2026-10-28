// Plantillas HTML de los recordatorios y escalamientos de tickets.
// Mismo estilo que src/lib/email-templates.ts (cabecera TIN-FLOW, cuerpo blanco, pie gris).

const LOGO_INLINE = `<svg width="44" height="44" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="36" height="36" rx="9" fill="#1d4ed8"></rect><path d="M 5 13 C 10 13 10 18 18 18 C 26 18 26 23 31 23" stroke="#ffffff" stroke-width="2.8" stroke-linecap="round" fill="none"></path><path d="M 28 21 L 31 23 L 28 25" stroke="#ffffff" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" fill="none"></path><path d="M 5 23 C 10 23 10 18 18 18 C 26 18 26 13 31 13" stroke="#93c5fd" stroke-width="2.8" stroke-linecap="round" fill="none"></path><path d="M 28 11 L 31 13 L 28 15" stroke="#93c5fd" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" fill="none"></path><circle cx="18" cy="18" r="2.2" fill="white" opacity="0.95"></circle></svg>`

export function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
}

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
                <p style="margin:2px 0 0;color:#64748b;font-size:10px;letter-spacing:.08em;text-transform:uppercase">Interworld Group · Tickets</p>
              </td>
            </tr>
          </table>
        </td></tr>
        <tr><td style="padding:32px">${content}</td></tr>
        <tr><td style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e2e8f0">
          <p style="margin:0;font-size:11px;color:#94a3b8">Este es un mensaje automático — por favor no responda a este correo.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

const boton = (enlace: string | undefined, texto: string) =>
  enlace
    ? `<a href="${esc(enlace)}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:10px 22px;border-radius:8px;font-size:14px;font-weight:bold">${esc(texto)} →</a>`
    : ''

export type TonoAviso = 'info' | 'alerta' | 'vencido'

const TONOS: Record<TonoAviso, { fondo: string; borde: string; texto: string }> = {
  info:    { fondo: '#eff6ff', borde: '#2563eb', texto: '#1e3a8a' },
  alerta:  { fondo: '#fffbeb', borde: '#d97706', texto: '#92400e' },
  vencido: { fondo: '#fef2f2', borde: '#dc2626', texto: '#991b1b' },
}

/** Asunto estándar de los correos de un ticket */
export function asuntoTicket(codigo: string, asunto: string, prefijo?: string) {
  return `TIN-FLOW | ${prefijo ? `${prefijo} · ` : ''}${codigo} ${asunto}`.slice(0, 180)
}

/** Recordatorio o escalamiento sobre un ticket */
export function templateRecordatorioTicket(p: {
  titulo: string
  intro: string
  tono: TonoAviso
  /** Mensaje destacado (p. ej. "El ticket queda marcado como vencido") */
  aviso?: string | null
  codigo: string
  asunto: string
  filas: [string, string][]
  enlace?: string
  textoBoton?: string
}) {
  const t = TONOS[p.tono]
  const filas = p.filas
    .map(([k, v]) => `<tr>
        <td style="padding:7px 12px;font-size:12px;color:#64748b;width:42%;border-bottom:1px solid #f1f5f9">${esc(k)}</td>
        <td style="padding:7px 12px;font-size:13px;color:#1e293b;border-bottom:1px solid #f1f5f9"><strong>${esc(v)}</strong></td>
      </tr>`)
    .join('')
  return shell(`
    <h2 style="margin:0 0 8px;font-size:18px;color:#1e293b">${esc(p.titulo)}</h2>
    <p style="margin:0 0 20px;font-size:14px;color:#64748b">${esc(p.intro)}</p>

    <div style="background:#f8fafc;border-radius:8px;padding:14px 16px;margin-bottom:16px">
      <p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#94a3b8">${esc(p.codigo)}</p>
      <p style="margin:0;font-size:15px;color:#1e293b;font-weight:bold">${esc(p.asunto)}</p>
    </div>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px">${filas}</table>

    ${p.aviso ? `<div style="background:${t.fondo};border-left:3px solid ${t.borde};border-radius:0 8px 8px 0;padding:12px 16px;margin-bottom:24px">
      <p style="margin:0;font-size:13px;color:${t.texto}">${esc(p.aviso)}</p>
    </div>` : ''}

    ${boton(p.enlace, p.textoBoton ?? 'Ver ticket')}
  `)
}

export interface TicketResumenDiario {
  codigo: string
  asunto: string
  estado: string
  prioridad: string
  /** Horas hábiles consumidas */
  horas: number | null
  /** % del objetivo consumido (respuesta si no se ha respondido, si no solución) */
  porcentaje: number | null
  clase: 'ok' | 'alerta' | 'vencido'
  responsable?: string
  enlace?: string
}

const COLOR_CLASE = { ok: '#16a34a', alerta: '#d97706', vencido: '#dc2626' }

/** Resumen diario de tickets abiertos, ordenados por tiempo consumido */
export function templateResumenDiarioTickets(p: {
  nombre: string
  fecha: string
  tickets: TicketResumenDiario[]
  conResponsable?: boolean
  enlaceBandeja?: string
}) {
  const vencidos = p.tickets.filter(t => t.clase === 'vencido').length
  const alerta = p.tickets.filter(t => t.clase === 'alerta').length
  const filas = p.tickets
    .map(t => `<tr>
      <td style="padding:8px 10px;border-bottom:1px solid #f1f5f9;font-size:12px;vertical-align:top">
        <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${COLOR_CLASE[t.clase]};margin-right:6px"></span>
        ${t.enlace ? `<a href="${esc(t.enlace)}" style="color:#1d4ed8;text-decoration:none;font-weight:bold">${esc(t.codigo)}</a>` : `<strong>${esc(t.codigo)}</strong>`}
        <div style="color:#475569;margin-top:2px">${esc(t.asunto)}</div>
        ${p.conResponsable && t.responsable ? `<div style="color:#94a3b8;margin-top:2px">${esc(t.responsable)}</div>` : ''}
      </td>
      <td style="padding:8px 10px;border-bottom:1px solid #f1f5f9;font-size:12px;color:#475569;vertical-align:top">${esc(t.estado)}<br><span style="color:#94a3b8">${esc(t.prioridad)}</span></td>
      <td style="padding:8px 10px;border-bottom:1px solid #f1f5f9;font-size:12px;color:#1e293b;text-align:right;vertical-align:top;white-space:nowrap">
        ${t.horas == null ? '—' : `${t.horas.toFixed(1)} h`}<br>
        <span style="color:${COLOR_CLASE[t.clase]};font-weight:bold">${t.porcentaje == null ? '' : `${Math.round(t.porcentaje)}%`}</span>
      </td>
    </tr>`)
    .join('')
  return shell(`
    <h2 style="margin:0 0 8px;font-size:18px;color:#1e293b">Resumen diario de tickets</h2>
    <p style="margin:0 0 20px;font-size:14px;color:#64748b">Hola ${esc(p.nombre)}, estos son los tickets abiertos al ${esc(p.fecha)}, ordenados por tiempo consumido.</p>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px">
      <tr>
        <td style="padding:12px 16px;background:#f1f5f9;border-radius:8px 0 0 8px;width:33%">
          <p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;color:#94a3b8">Abiertos</p>
          <strong style="font-size:20px;color:#1e293b">${p.tickets.length}</strong>
        </td>
        <td style="padding:12px 16px;background:#fffbeb;width:33%">
          <p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;color:#b45309">Con recordatorio</p>
          <strong style="font-size:20px;color:#92400e">${alerta}</strong>
        </td>
        <td style="padding:12px 16px;background:#fef2f2;border-radius:0 8px 8px 0;width:33%">
          <p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;color:#b91c1c">Vencidos</p>
          <strong style="font-size:20px;color:#991b1b">${vencidos}</strong>
        </td>
      </tr>
    </table>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;border:1px solid #e2e8f0;border-radius:8px">
      <tr style="background:#f8fafc">
        <th align="left" style="padding:8px 10px;font-size:11px;color:#64748b;text-transform:uppercase">Ticket</th>
        <th align="left" style="padding:8px 10px;font-size:11px;color:#64748b;text-transform:uppercase">Estado</th>
        <th align="right" style="padding:8px 10px;font-size:11px;color:#64748b;text-transform:uppercase">Consumido</th>
      </tr>
      ${filas}
    </table>

    ${boton(p.enlaceBandeja, 'Ir a la bandeja')}
  `)
}
