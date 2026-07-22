'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getPerfil } from '@/lib/supabase/auth'
import { sendEmail } from '@/lib/email'
import { subjectReq, templateNuevaReunion } from '@/lib/email-templates'
import { getEmailsActivos } from '@/actions/config-email'
import type { Reunion, TareaReunion, AnexoReunion } from '@/lib/supabase/types'

function getAppUrl(): string {
  if (process.env.APP_URL) return process.env.APP_URL
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return ''
}

export async function getReuniones(requerimientoId: string): Promise<Reunion[]> {
  try {
    const supabase = createAdminClient()
    const { data, error } = await (supabase as any)
      .from('reuniones')
      .select('*, tareas_reunion(*, anexos_tarea_reunion(*)), anexos_reunion(*)')
      .eq('requerimiento_id', requerimientoId)
      .order('fecha_reunion', { ascending: false })
    if (error) return []
    return (data ?? []).map((r: any) => ({
      ...r,
      tareas: (r.tareas_reunion ?? [])
        .sort((a: TareaReunion, b: TareaReunion) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        )
        .map((t: any) => ({ ...t, anexos: t.anexos_tarea_reunion ?? [] })),
      anexos: (r.anexos_reunion ?? [])
        .sort((a: AnexoReunion, b: AnexoReunion) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        ),
    }))
  } catch {
    return []
  }
}

export async function crearReunion(
  requerimientoId: string,
  datos: { titulo: string; fecha_reunion: string; url_video?: string; notas?: string },
  tareas: { descripcion: string; responsable_email?: string; fecha_inicio?: string; fecha_compromiso?: string }[]
): Promise<{ ok: boolean; error?: string }> {
  try {
    const perfil = await getPerfil()
    const supabase = createAdminClient()

    const { data: reunion, error: errR } = await (supabase as any)
      .from('reuniones')
      .insert({
        requerimiento_id: requerimientoId,
        titulo: datos.titulo,
        fecha_reunion: datos.fecha_reunion,
        url_video: datos.url_video || null,
        notas: datos.notas || null,
        created_by: perfil?.email ?? null,
      })
      .select()
      .single()

    if (errR) return { ok: false, error: errR.message }

    if (tareas.length > 0) {
      const { error: errT } = await (supabase as any)
        .from('tareas_reunion')
        .insert(tareas.map(t => ({
          reunion_id: reunion.id,
          descripcion: t.descripcion,
          responsable_email: t.responsable_email || null,
          fecha_inicio: t.fecha_inicio || null,
          fecha_compromiso: t.fecha_compromiso || null,
        })))
      if (errT) return { ok: false, error: errT.message }
    }

    // Notificación por correo (sin bloquear)
    const { data: req } = await (supabase as any)
      .from('requerimientos')
      .select('nombre_desarrollo, identificacion')
      .eq('id', requerimientoId)
      .single()

    if (req) {
      const emailsResponsables = [...new Set(
        tareas.map(t => t.responsable_email).filter(Boolean) as string[]
      )]
      getEmailsActivos().then(destinatarios => {
        const todos = [...new Set([...destinatarios, ...emailsResponsables])]
        if (todos.length === 0) return
        const appUrl = getAppUrl()
        return sendEmail({
          to: todos,
          subject: subjectReq(req.identificacion ?? '', req.nombre_desarrollo ?? ''),
          html: templateNuevaReunion({
            nombreDesarrollo: req.nombre_desarrollo ?? req.identificacion ?? '—',
            tituloReunion:    datos.titulo,
            fechaReunion:     datos.fecha_reunion,
            tareas,
            enlace: appUrl ? `${appUrl}/admin/requerimientos/${requerimientoId}` : undefined,
          }),
          requerimientoId,
        })
      }).catch(err => console.error('[email] Error al notificar reunión:', err))
    }

    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e.message }
  }
}

export async function actualizarReunion(
  reunionId: string,
  datos: { titulo?: string; fecha_reunion?: string; url_video?: string | null; notas?: string | null }
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = createAdminClient()
    const { error } = await (supabase as any)
      .from('reuniones')
      .update({
        ...(datos.titulo !== undefined && { titulo: datos.titulo }),
        ...(datos.fecha_reunion !== undefined && { fecha_reunion: datos.fecha_reunion }),
        ...(datos.url_video !== undefined && { url_video: datos.url_video || null }),
        ...(datos.notas !== undefined && { notas: datos.notas || null }),
      })
      .eq('id', reunionId)
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e.message }
  }
}

export async function agregarTareaReunion(
  reunionId: string,
  tarea: { descripcion: string; responsable_email?: string; fecha_inicio?: string; fecha_compromiso?: string }
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = createAdminClient()
    const { error } = await (supabase as any)
      .from('tareas_reunion')
      .insert({
        reunion_id: reunionId,
        descripcion: tarea.descripcion,
        responsable_email: tarea.responsable_email || null,
        fecha_inicio: tarea.fecha_inicio || null,
        fecha_compromiso: tarea.fecha_compromiso || null,
      })
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e.message }
  }
}

export async function guardarRespuestaTarea(
  id: string,
  respuesta: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = createAdminClient()
    // Auto-set fecha_cumplimiento on first evidence (only if not already set)
    if (respuesta.trim()) {
      const hoy = new Date().toISOString().split('T')[0]
      await (supabase as any)
        .from('tareas_reunion')
        .update({ fecha_cumplimiento: hoy })
        .eq('id', id)
        .is('fecha_cumplimiento', null)
    }
    const { error } = await (supabase as any)
      .from('tareas_reunion')
      .update({ respuesta: respuesta.trim() || null })
      .eq('id', id)
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e.message }
  }
}

export async function registrarAnexoTarea(
  tareaId: string,
  payload: { nombre_archivo: string; url_storage: string; tipo_archivo?: string; tamanio_bytes?: number }
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = createAdminClient()
    const { error } = await (supabase as any)
      .from('anexos_tarea_reunion')
      .insert({ tarea_reunion_id: tareaId, ...payload })
    if (error) return { ok: false, error: error.message }
    // Auto-set fecha_cumplimiento on first evidence (only if not already set)
    const hoy = new Date().toISOString().split('T')[0]
    await (supabase as any)
      .from('tareas_reunion')
      .update({ fecha_cumplimiento: hoy })
      .eq('id', tareaId)
      .is('fecha_cumplimiento', null)
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e.message }
  }
}

export async function actualizarMotivoYPenalizacion(
  id: string,
  data: {
    motivo_incumplimiento?: string | null
    penalizacion_cop?: number | null
    fecha_cumplimiento?: string | null
  }
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = createAdminClient()
    const { error } = await (supabase as any)
      .from('tareas_reunion')
      .update(data)
      .eq('id', id)
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e?.message }
  }
}

export async function eliminarAnexoTarea(id: string): Promise<{ ok: boolean }> {
  try {
    const supabase = createAdminClient()
    const { error } = await (supabase as any)
      .from('anexos_tarea_reunion')
      .delete()
      .eq('id', id)
    return { ok: !error }
  } catch {
    return { ok: false }
  }
}

export async function toggleTareaReunion(
  id: string,
  completada: boolean
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = createAdminClient()

    if (completada) {
      const [{ data: tarea }, { data: anexos }] = await Promise.all([
        (supabase as any).from('tareas_reunion').select('respuesta').eq('id', id).single(),
        (supabase as any).from('anexos_tarea_reunion').select('id').eq('tarea_reunion_id', id),
      ])
      const tieneRespuesta = tarea?.respuesta?.trim()
      const tieneAnexos   = anexos && anexos.length > 0
      if (!tieneRespuesta && !tieneAnexos) {
        return { ok: false, error: 'Debes agregar una respuesta o al menos un anexo antes de marcar como completada' }
      }
    }

    const { error } = await (supabase as any)
      .from('tareas_reunion')
      .update({ completada })
      .eq('id', id)
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e.message }
  }
}

export async function eliminarTareaReunion(id: string): Promise<{ ok: boolean }> {
  try {
    const supabase = createAdminClient()
    const { error } = await (supabase as any)
      .from('tareas_reunion')
      .delete()
      .eq('id', id)
    return { ok: !error }
  } catch {
    return { ok: false }
  }
}

export async function eliminarReunion(id: string): Promise<{ ok: boolean }> {
  try {
    const supabase = createAdminClient()
    const { error } = await (supabase as any)
      .from('reuniones')
      .delete()
      .eq('id', id)
    return { ok: !error }
  } catch {
    return { ok: false }
  }
}

export async function registrarAnexoReunion(
  reunionId: string,
  datos: { titulo: string; nombre_archivo: string; url_storage: string; tipo_archivo?: string; tamanio_bytes?: number }
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = createAdminClient()
    const { error } = await (supabase as any)
      .from('anexos_reunion')
      .insert({
        reunion_id:    reunionId,
        titulo:        datos.titulo.trim(),
        nombre_archivo: datos.nombre_archivo,
        url_storage:   datos.url_storage,
        tipo_archivo:  datos.tipo_archivo ?? null,
        tamanio_bytes: datos.tamanio_bytes ?? null,
      })
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e.message }
  }
}

export async function eliminarAnexoReunion(id: string): Promise<{ ok: boolean }> {
  try {
    const supabase = createAdminClient()
    const { error } = await (supabase as any)
      .from('anexos_reunion')
      .delete()
      .eq('id', id)
    return { ok: !error }
  } catch {
    return { ok: false }
  }
}
