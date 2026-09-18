'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface TareaSolicitud {
  id: string
  requerimiento_id: string
  descripcion: string
  responsable_email: string | null
  fecha_compromiso: string | null
  completada: boolean
  fecha_cumplimiento: string | null
  motivo_incumplimiento: string | null
  penalizacion_cop: number | null
  created_by: string | null
  created_at: string
}

async function getCurrentUserName(): Promise<string> {
  try {
    const authClient = await createClient()
    const { data: { user } } = await authClient.auth.getUser()
    if (!user?.id) return 'Sistema'
    const supabase = createAdminClient()
    const { data } = await (supabase as any)
      .from('perfiles').select('nombre_completo').eq('id', user.id).single()
    return data?.nombre_completo ?? user.email ?? 'Sistema'
  } catch { return 'Sistema' }
}

export async function getTareasSolicitud(requerimientoId: string): Promise<TareaSolicitud[]> {
  const supabase = createAdminClient()
  const { data, error } = await (supabase as any)
    .from('tareas_solicitud')
    .select('*')
    .eq('requerimiento_id', requerimientoId)
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function crearTareaSolicitud(
  requerimientoId: string,
  payload: {
    descripcion: string
    responsable_email: string | null
    fecha_compromiso: string | null
    penalizacion_cop: number | null
  }
): Promise<{ ok: boolean; error?: string }> {
  try {
    const createdBy = await getCurrentUserName()
    const supabase = createAdminClient()
    const { error } = await (supabase as any)
      .from('tareas_solicitud')
      .insert({ requerimiento_id: requerimientoId, ...payload, created_by: createdBy })
    if (error) return { ok: false, error: error.message }
    revalidatePath(`/admin/requerimientos/${requerimientoId}`)
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e.message }
  }
}

export async function toggleTareaSolicitud(
  id: string,
  requerimientoId: string,
  completada: boolean,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = createAdminClient()
    const update: Record<string, any> = { completada }
    if (completada) {
      update.fecha_cumplimiento = new Date().toISOString().split('T')[0]
    } else {
      update.fecha_cumplimiento = null
    }
    const { error } = await (supabase as any)
      .from('tareas_solicitud').update(update).eq('id', id)
    if (error) return { ok: false, error: error.message }
    revalidatePath(`/admin/requerimientos/${requerimientoId}`)
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e.message }
  }
}

export async function actualizarMotivoYPenalizacionSolicitud(
  id: string,
  requerimientoId: string,
  motivo: string | null,
  penalizacion: number | null,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = createAdminClient()
    const { error } = await (supabase as any)
      .from('tareas_solicitud')
      .update({ motivo_incumplimiento: motivo || null, penalizacion_cop: penalizacion })
      .eq('id', id)
    if (error) return { ok: false, error: error.message }
    revalidatePath(`/admin/requerimientos/${requerimientoId}`)
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e.message }
  }
}

export async function eliminarTareaSolicitud(
  id: string,
  requerimientoId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = createAdminClient()
    const { error } = await (supabase as any).from('tareas_solicitud').delete().eq('id', id)
    if (error) return { ok: false, error: error.message }
    revalidatePath(`/admin/requerimientos/${requerimientoId}`)
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e.message }
  }
}
