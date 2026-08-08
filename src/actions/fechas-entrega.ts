'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { sendEmail } from '@/lib/email'
import { getEmailsActivos, getConfigParam } from '@/actions/config-email'

function getAppUrl(): string {
  if (process.env.APP_URL) return process.env.APP_URL
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return ''
}

export interface FechasEntrega {
  fecha_estimada_entrega:          string | null
  fecha_real_entrega:              string | null
  fecha_estimada_feedback_pruebas: string | null
  fecha_real_feedback_pruebas:     string | null
  fecha_estimada_salida_vivo:      string | null
  fecha_salida_vivo:               string | null
}

export interface HistorialFecha {
  id: string
  tipo_fecha: string
  label_fecha: string
  fecha_anterior: string | null
  fecha_nueva: string | null
  usuario: string | null
  created_at: string
}

const LABEL_FECHA: Record<string, string> = {
  fecha_estimada_entrega:          'Fecha estimada de entrega del desarrollo',
  fecha_real_entrega:              'Fecha real de entrega del desarrollo',
  fecha_estimada_feedback_pruebas: 'Fecha estimada de feedback de pruebas',
  fecha_real_feedback_pruebas:     'Fecha real de feedback de pruebas',
  fecha_estimada_salida_vivo:      'Fecha estimada de salida en vivo',
  fecha_salida_vivo:               'Fecha real de salida en vivo',
}

function formatFecha(d: string | null): string {
  if (!d) return '—'
  try {
    return new Date(d + 'T12:00:00').toLocaleDateString('es-CO', {
      day: '2-digit', month: 'long', year: 'numeric',
    })
  } catch {
    return d
  }
}

export async function actualizarFechasEntrega(
  reqId: string,
  nuevasFechas: FechasEntrega
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = createAdminClient()

    const { data: req } = await (supabase as any)
      .from('requerimientos')
      .select(`
        nombre_desarrollo, identificacion, numero,
        responsable, partes_interesadas,
        fecha_estimada_entrega, fecha_real_entrega,
        fecha_estimada_feedback_pruebas, fecha_real_feedback_pruebas,
        fecha_estimada_salida_vivo, fecha_salida_vivo
      `)
      .eq('id', reqId)
      .single()

    if (!req) return { ok: false, error: 'Requerimiento no encontrado' }

    // Detectar qué campos cambiaron
    const campos = Object.keys(nuevasFechas) as (keyof FechasEntrega)[]
    const cambios: { campo: string; anterior: string | null; nueva: string | null }[] = []

    for (const campo of campos) {
      const anterior = (req[campo] as string | null) ?? null
      const nueva = nuevasFechas[campo] ?? null
      if (anterior !== nueva) {
        cambios.push({ campo, anterior, nueva })
      }
    }

    if (cambios.length === 0) return { ok: true }

    // Obtener usuario actual
    let userName = 'Sistema'
    try {
      const clientUser = await createClient()
      const { data: { user } } = await clientUser.auth.getUser()
      userName = user?.email ?? 'Sistema'
    } catch { /* no session in server action */ }

    // Insertar historial
    const { error: errHist } = await (supabase as any)
      .from('historial_fechas')
      .insert(cambios.map(c => ({
        requerimiento_id: reqId,
        tipo_fecha:       c.campo,
        fecha_anterior:   c.anterior,
        fecha_nueva:      c.nueva,
        usuario:          userName,
      })))

    if (errHist) return { ok: false, error: `Error al guardar historial: ${errHist.message}` }

    // Actualizar fechas en requerimientos
    const { error: errUpdate } = await (supabase as any)
      .from('requerimientos')
      .update(nuevasFechas)
      .eq('id', reqId)

    if (errUpdate) return { ok: false, error: errUpdate.message }

    revalidatePath('/admin/requerimientos')
    revalidatePath(`/admin/requerimientos/${reqId}`)
    revalidatePath('/admin/reporte-presidencial')

    // Enviar correo (sin bloquear)
    const nombre = req.nombre_desarrollo ?? req.identificacion ?? req.numero ?? reqId
    const appUrl = getAppUrl()
    const url = appUrl ? `${appUrl}/admin/requerimientos/${reqId}` : ''

    Promise.all([
      getEmailsActivos(),
      getConfigParam('notif_partes_interesadas'),
    ]).then(([globales, notifPI]) => {
      const partesInteresadas: string[] = notifPI === 'true'
        ? (req.partes_interesadas ?? []) : []
      const emailResponsable: string[] = req.responsable ? [req.responsable] : []
      const destinatarios = [...new Set([...globales, ...partesInteresadas, ...emailResponsable])]
      if (destinatarios.length === 0) return

      const filasHtml = cambios.map(c => `
        <tr>
          <td style="padding:8px 14px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#475569;">
            ${LABEL_FECHA[c.campo] ?? c.campo}
          </td>
          <td style="padding:8px 14px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#94a3b8;">
            ${formatFecha(c.anterior)}
          </td>
          <td style="padding:8px 14px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#0f172a;font-weight:600;">
            ${formatFecha(c.nueva)}
          </td>
        </tr>
      `).join('')

      const html = `
        <div style="font-family:sans-serif;max-width:620px;margin:0 auto;color:#1e293b;">
          <div style="background:#2563eb;padding:20px 28px;border-radius:12px 12px 0 0;">
            <h2 style="margin:0;color:#fff;font-size:18px;">Actualización de fechas</h2>
            <p style="margin:4px 0 0;color:#bfdbfe;font-size:13px;">${nombre}</p>
          </div>
          <div style="border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;padding:20px 28px;">
            <p style="color:#475569;font-size:14px;margin-top:0;">
              Se actualizaron las siguientes fechas:
            </p>
            <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;font-size:13px;">
              <thead>
                <tr style="background:#f8fafc;">
                  <th style="padding:8px 14px;text-align:left;color:#94a3b8;font-weight:600;font-size:11px;text-transform:uppercase;">Campo</th>
                  <th style="padding:8px 14px;text-align:left;color:#94a3b8;font-weight:600;font-size:11px;text-transform:uppercase;">Anterior</th>
                  <th style="padding:8px 14px;text-align:left;color:#94a3b8;font-weight:600;font-size:11px;text-transform:uppercase;">Nueva</th>
                </tr>
              </thead>
              <tbody>${filasHtml}</tbody>
            </table>
            ${url ? `<a href="${url}" style="display:inline-block;margin-top:20px;background:#2563eb;color:#fff;text-decoration:none;padding:10px 22px;border-radius:8px;font-size:13px;font-weight:600;">Ver requerimiento →</a>` : ''}
          </div>
        </div>
      `

      return sendEmail({
        to: destinatarios,
        subject: `Fechas actualizadas · ${nombre}`,
        html,
        requerimientoId: reqId,
      })
    }).catch(err => console.error('[email] Error al enviar notificación de fechas:', err))

    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e.message }
  }
}

export async function getHistorialFechas(reqId: string): Promise<HistorialFecha[]> {
  const supabase = createAdminClient()
  const { data } = await (supabase as any)
    .from('historial_fechas')
    .select('*')
    .eq('requerimiento_id', reqId)
    .order('created_at', { ascending: false })
  return (data ?? []).map((r: any) => ({
    ...r,
    label_fecha: LABEL_FECHA[r.tipo_fecha] ?? r.tipo_fecha,
  }))
}
