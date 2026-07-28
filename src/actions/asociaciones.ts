'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export interface ReqBasico {
  id: string
  numero: string | null
  identificacion: string
  nombre_desarrollo: string | null
  prioridad: number | null
  sub_prioridad: number | null
  parent_id: string | null
  estado: string
}

export async function asociarRequerimiento(
  childId: string,
  parentId: string
): Promise<{ ok: boolean; error?: string }> {
  if (childId === parentId) return { ok: false, error: 'Un requerimiento no puede ser su propio padre' }

  try {
    const supabase = createAdminClient()

    const { data: parent, error: errP } = await (supabase as any)
      .from('requerimientos')
      .select('id, prioridad, parent_id')
      .eq('id', parentId)
      .single()

    if (errP || !parent) return { ok: false, error: 'Requerimiento padre no encontrado' }

    // Evitar referencia circular: el padre no puede ser un descendiente del hijo
    if (parent.parent_id === childId) return { ok: false, error: 'Referencia circular detectada' }

    // Posición entre hermanos actuales
    const { count } = await (supabase as any)
      .from('requerimientos')
      .select('id', { count: 'exact', head: true })
      .eq('parent_id', parentId)

    const nextPosition = (count ?? 0) + 1

    const { error } = await (supabase as any)
      .from('requerimientos')
      .update({ parent_id: parentId, prioridad: parent.prioridad, sub_prioridad: nextPosition })
      .eq('id', childId)

    if (error) return { ok: false, error: error.message }

    revalidatePath('/admin/requerimientos')
    revalidatePath(`/admin/requerimientos/${childId}`)
    revalidatePath(`/admin/requerimientos/${parentId}`)
    revalidatePath('/admin/reporte-prioridades')

    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e.message }
  }
}

export async function desasociarRequerimiento(
  childId: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = createAdminClient()

    const { data: child } = await (supabase as any)
      .from('requerimientos')
      .select('parent_id')
      .eq('id', childId)
      .single()

    const { error } = await (supabase as any)
      .from('requerimientos')
      .update({ parent_id: null, sub_prioridad: null })
      .eq('id', childId)

    if (error) return { ok: false, error: error.message }

    revalidatePath('/admin/requerimientos')
    revalidatePath(`/admin/requerimientos/${childId}`)
    if (child?.parent_id) revalidatePath(`/admin/requerimientos/${child.parent_id}`)
    revalidatePath('/admin/reporte-prioridades')

    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e.message }
  }
}

export async function getHijosRequerimiento(parentId: string): Promise<ReqBasico[]> {
  const supabase = createAdminClient()
  const { data } = await (supabase as any)
    .from('requerimientos')
    .select('id, numero, identificacion, nombre_desarrollo, prioridad, sub_prioridad, parent_id, estado')
    .eq('parent_id', parentId)
    .order('sub_prioridad', { ascending: true, nullsFirst: false })
  return data ?? []
}

export async function getRequerimientosDisponibles(excludeId: string): Promise<ReqBasico[]> {
  const supabase = createAdminClient()
  const { data } = await (supabase as any)
    .from('requerimientos')
    .select('id, numero, identificacion, nombre_desarrollo, prioridad, sub_prioridad, parent_id, estado')
    .eq('es_borrador', false)
    .neq('id', excludeId)
    .order('nombre_desarrollo', { ascending: true })
  return data ?? []
}
