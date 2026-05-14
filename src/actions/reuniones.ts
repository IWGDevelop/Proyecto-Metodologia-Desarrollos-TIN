'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getPerfil } from '@/lib/supabase/auth'
import type { Reunion, TareaReunion } from '@/lib/supabase/types'

export async function getReuniones(requerimientoId: string): Promise<Reunion[]> {
  try {
    const supabase = createAdminClient()
    const { data, error } = await (supabase as any)
      .from('reuniones')
      .select('*, tareas_reunion(*)')
      .eq('requerimiento_id', requerimientoId)
      .order('fecha_reunion', { ascending: false })
    if (error) return []
    return (data ?? []).map((r: any) => ({
      ...r,
      tareas: (r.tareas_reunion ?? []).sort(
        (a: TareaReunion, b: TareaReunion) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      ),
    }))
  } catch {
    return []
  }
}

export async function crearReunion(
  requerimientoId: string,
  datos: {
    titulo: string
    fecha_reunion: string
    url_video?: string
    notas?: string
  },
  tareas: {
    descripcion: string
    responsable_email?: string
    fecha_compromiso?: string
  }[]
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
        .insert(
          tareas.map(t => ({
            reunion_id: reunion.id,
            descripcion: t.descripcion,
            responsable_email: t.responsable_email || null,
            fecha_compromiso: t.fecha_compromiso || null,
          }))
        )
      if (errT) return { ok: false, error: errT.message }
    }

    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e.message }
  }
}

export async function agregarTareaReunion(
  reunionId: string,
  tarea: {
    descripcion: string
    responsable_email?: string
    fecha_compromiso?: string
  }
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = createAdminClient()
    const { error } = await (supabase as any)
      .from('tareas_reunion')
      .insert({
        reunion_id: reunionId,
        descripcion: tarea.descripcion,
        responsable_email: tarea.responsable_email || null,
        fecha_compromiso: tarea.fecha_compromiso || null,
      })
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e.message }
  }
}

export async function toggleTareaReunion(
  id: string,
  completada: boolean
): Promise<{ ok: boolean }> {
  try {
    const supabase = createAdminClient()
    const { error } = await (supabase as any)
      .from('tareas_reunion')
      .update({ completada })
      .eq('id', id)
    return { ok: !error }
  } catch {
    return { ok: false }
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
