'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import type { TareaTecnica } from '@/lib/supabase/types'

export async function getTareas(requerimientoId: string): Promise<TareaTecnica[]> {
  const supabase = createAdminClient()
  const { data, error } = await (supabase as any)
    .from('tareas_tecnicas')
    .select('*, perfil_completada:completada_por(id, nombre_completo, email)')
    .eq('requerimiento_id', requerimientoId)
    .order('orden', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) return []
  return data ?? []
}

export async function crearTarea(data: {
  requerimiento_id: string
  titulo: string
  descripcion?: string
  created_by?: string
}): Promise<{ ok: boolean; error?: string; tarea?: TareaTecnica }> {
  try {
    const supabase = createAdminClient()

    // Get max orden
    const { data: last } = await (supabase as any)
      .from('tareas_tecnicas')
      .select('orden')
      .eq('requerimiento_id', data.requerimiento_id)
      .order('orden', { ascending: false })
      .limit(1)
      .single()

    const orden = (last?.orden ?? -1) + 1

    const { data: tarea, error } = await (supabase as any)
      .from('tareas_tecnicas')
      .insert({ ...data, orden, descripcion: data.descripcion ?? null })
      .select()
      .single()

    if (error) return { ok: false, error: error.message }
    return { ok: true, tarea }
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'Error al crear tarea' }
  }
}

export async function actualizarTarea(id: string, data: Partial<{
  titulo: string
  descripcion: string | null
  orden: number
}>): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = createAdminClient()
    const { error } = await (supabase as any)
      .from('tareas_tecnicas').update(data).eq('id', id)
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e?.message }
  }
}

export async function eliminarTarea(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = createAdminClient()
    const { error } = await (supabase as any)
      .from('tareas_tecnicas').delete().eq('id', id)
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e?.message }
  }
}

export async function toggleTarea(id: string, completada: boolean): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const adminClient = createAdminClient()
    const { error } = await (adminClient as any)
      .from('tareas_tecnicas')
      .update({
        completada,
        completada_por: completada ? (user?.id ?? null) : null,
        completada_at: completada ? new Date().toISOString() : null,
      })
      .eq('id', id)

    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e?.message }
  }
}

export async function actualizarRama(
  requerimientoId: string,
  rama: 'TIN' | 'IA' | null
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = createAdminClient()
    const { error } = await (supabase as any)
      .from('requerimientos')
      .update({ rama })
      .eq('id', requerimientoId)
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e?.message }
  }
}
