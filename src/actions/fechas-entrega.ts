'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { sendEmail } from '@/lib/email'
import { getEmailsActivos, getConfigParam } from '@/actions/config-email'
import { ETAPAS_FECHA, descripcionTareaEtapa, type TipoEtapaFecha } from '@/lib/etapas-fecha'
import { labelTipoFechaPlaneacion } from '@/lib/etapas-planeacion'

function getAppUrl(): string {
  if (process.env.APP_URL) return process.env.APP_URL
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return ''
}

export interface FechasEntrega {
  fecha_estimada_definicion_usuario: string | null
  fecha_real_definicion_usuario:     string | null
  fecha_estimada_entrega:            string | null
  fecha_real_entrega:                string | null
  fecha_estimada_fin_testing:        string | null
  fecha_real_fin_testing:            string | null
  fecha_estimada_feedback_pruebas:   string | null
  fecha_real_feedback_pruebas:       string | null
  fecha_estimada_ajustes_tecnicos:   string | null
  fecha_real_ajustes_tecnicos:       string | null
  fecha_estimada_salida_vivo:        string | null
  fecha_salida_vivo:                 string | null
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

/** Responsable (email) de la tarea de cada etapa */
export type ResponsablesFechas = Partial<Record<TipoEtapaFecha, string | null>>

const LABEL_FECHA: Record<string, string> = {
  fecha_estimada_definicion_usuario: 'Fecha estimada de definición de usuario',
  fecha_real_definicion_usuario:     'Fecha real de definición de usuario',
  fecha_estimada_entrega:          'Fecha estimada de entrega del desarrollo',
  fecha_real_entrega:              'Fecha real de entrega del desarrollo',
  fecha_estimada_fin_testing:      'Fecha estimada de fin de pruebas Testing',
  fecha_real_fin_testing:          'Fecha real de fin de pruebas Testing',
  fecha_estimada_feedback_pruebas: 'Fecha estimada de feedback de pruebas',
  fecha_real_feedback_pruebas:     'Fecha real de feedback de pruebas',
  fecha_estimada_ajustes_tecnicos: 'Fecha estimada de ajustes técnicos',
  fecha_real_ajustes_tecnicos:     'Fecha real de ajustes técnicos',
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

/** Responsables actuales de las tareas generadas desde el tab Fechas */
export async function getResponsablesFechas(reqId: string): Promise<ResponsablesFechas> {
  const supabase = createAdminClient()
  const { data } = await (supabase as any)
    .from('tareas_solicitud')
    .select('tipo_fecha, responsable_email')
    .eq('requerimiento_id', reqId)
    .not('tipo_fecha', 'is', null)
  const responsables: ResponsablesFechas = {}
  for (const t of data ?? []) responsables[t.tipo_fecha as TipoEtapaFecha] = t.responsable_email ?? null
  return responsables
}

/**
 * Crea o actualiza una tarea (tareas_solicitud) por cada fecha estimada definida.
 * La fecha estimada es la fecha compromiso y la fecha real marca la tarea como cumplida.
 * Devuelve el mensaje de error, o null si todo salió bien.
 */
async function sincronizarTareasFechas(
  reqId: string,
  req: Record<string, any>,
  nuevasFechas: FechasEntrega,
  responsables: ResponsablesFechas,
): Promise<string | null> {
  const supabase = createAdminClient()

  const { data: existentes, error } = await (supabase as any)
    .from('tareas_solicitud')
    .select('id, tipo_fecha, completada')
    .eq('requerimiento_id', reqId)
    .not('tipo_fecha', 'is', null)
  if (error) return error.message

  let createdBy = 'Sistema'
  try {
    const clientUser = await createClient()
    const { data: { user } } = await clientUser.auth.getUser()
    createdBy = user?.email ?? 'Sistema'
  } catch { /* no session in server action */ }

  for (const etapa of ETAPAS_FECHA) {
    const estimada: string | null = nuevasFechas[etapa.estimada as keyof FechasEntrega] ?? null
    const real: string | null = nuevasFechas[etapa.real as keyof FechasEntrega] ?? null
    const realAnterior: string | null = req[etapa.real] ?? null
    const tarea = (existentes ?? []).find((t: any) => t.tipo_fecha === etapa.tipo)

    // Sin fecha estimada no hay compromiso: se quita la tarea si aún no se había cumplido
    if (!estimada) {
      if (tarea && !tarea.completada) {
        const { error: errDel } = await (supabase as any).from('tareas_solicitud').delete().eq('id', tarea.id)
        if (errDel) return errDel.message
      }
      continue
    }

    const datos: Record<string, any> = {
      descripcion:       descripcionTareaEtapa(etapa),
      responsable_email: responsables[etapa.tipo]?.trim() ?? null,
      fecha_compromiso:  estimada,
    }
    if (real) {
      datos.completada = true
      datos.fecha_cumplimiento = real
    } else if (realAnterior) {
      // Se borró la fecha real: la tarea vuelve a quedar pendiente
      datos.completada = false
      datos.fecha_cumplimiento = null
    }

    const { error: errTarea } = tarea
      ? await (supabase as any).from('tareas_solicitud').update(datos).eq('id', tarea.id)
      : await (supabase as any).from('tareas_solicitud').insert({
          requerimiento_id: reqId,
          tipo_fecha:       etapa.tipo,
          created_by:       createdBy,
          ...datos,
        })
    if (errTarea) return errTarea.message
  }

  return null
}

export async function actualizarFechasEntrega(
  reqId: string,
  nuevasFechas: FechasEntrega,
  responsables: ResponsablesFechas = {},
): Promise<{ ok: boolean; error?: string }> {
  try {
    // Toda fecha estimada se convierte en tarea, por lo que exige un responsable
    const sinResponsable = ETAPAS_FECHA.filter(e =>
      nuevasFechas[e.estimada as keyof FechasEntrega] && !responsables[e.tipo]?.trim()
    )
    if (sinResponsable.length > 0) {
      return {
        ok: false,
        error: `Asigna un responsable para: ${sinResponsable.map(e => e.titulo).join(', ')}`,
      }
    }

    const supabase = createAdminClient()

    const columnasFechas = ETAPAS_FECHA.flatMap(e => [e.estimada, e.real]).join(', ')
    const { data: req } = await (supabase as any)
      .from('requerimientos')
      .select(`nombre_desarrollo, identificacion, numero, responsable, partes_interesadas, ${columnasFechas}`)
      .eq('id', reqId)
      .single()

    if (!req) return { ok: false, error: 'Requerimiento no encontrado' }

    const errTareas = await sincronizarTareasFechas(reqId, req, nuevasFechas, responsables)
    if (errTareas) return { ok: false, error: `Error al guardar tareas: ${errTareas}` }

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

    if (cambios.length === 0) {
      revalidatePath(`/admin/requerimientos/${reqId}`)
      return { ok: true }
    }

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
    label_fecha: LABEL_FECHA[r.tipo_fecha] ?? labelTipoFechaPlaneacion(r.tipo_fecha) ?? r.tipo_fecha,
  }))
}
