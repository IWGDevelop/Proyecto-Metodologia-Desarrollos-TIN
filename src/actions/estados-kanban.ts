'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import type { EstadoKanban } from '@/lib/supabase/types'
import { ESTADOS_POR_DEFECTO, type EstadoCatalogo } from '@/lib/estados'

export async function getEstadosKanban(): Promise<EstadoKanban[]> {
  try {
    const supabase = createAdminClient()
    const { data, error } = await (supabase as any)
      .from('estados_kanban')
      .select('*')
      .order('orden', { ascending: true })
    if (error) return []
    return data ?? []
  } catch {
    return []
  }
}

/** Nombres configurados de los estados; si la tabla no responde, los nombres fijos del código */
export async function getCatalogoEstados(): Promise<EstadoCatalogo[]> {
  const estados = await getEstadosKanban()
  if (!estados.length) return ESTADOS_POR_DEFECTO
  return estados.map(({ nombre, label, activo, es_final, orden }) => ({ nombre, label, activo, es_final, orden }))
}

function refrescar() {
  // El catálogo se carga en el layout raíz: se invalidan todas las páginas
  revalidatePath('/', 'layout')
}

export async function crearEstadoKanban(payload: {
  label: string
  nombre: string
  color_key: string
  icono: string
  es_final: boolean
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = createAdminClient()
    const { data: ultimo } = await (supabase as any)
      .from('estados_kanban')
      .select('orden')
      .order('orden', { ascending: false })
      .limit(1)
      .single()
    const orden = ((ultimo?.orden ?? 0) as number) + 10

    const { error } = await (supabase as any)
      .from('estados_kanban')
      .insert({ ...payload, orden, activo: true })
    if (error) return { ok: false, error: error.message }
    refrescar()
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e.message }
  }
}

export async function actualizarEstadoKanban(
  id: string,
  payload: Partial<Pick<EstadoKanban, 'label' | 'color_key' | 'icono' | 'activo' | 'es_final'>>
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = createAdminClient()
    const { error } = await (supabase as any)
      .from('estados_kanban')
      .update(payload)
      .eq('id', id)
    if (error) return { ok: false, error: error.message }
    refrescar()
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e.message }
  }
}

export async function reordenarEstadoKanban(
  id: string,
  direccion: 'up' | 'down'
): Promise<{ ok: boolean }> {
  try {
    const supabase = createAdminClient()
    const { data: todos } = await (supabase as any)
      .from('estados_kanban')
      .select('id, orden')
      .order('orden', { ascending: true })

    if (!todos) return { ok: false }

    const idx = (todos as { id: string; orden: number }[]).findIndex((e: any) => e.id === id)
    const swapIdx = direccion === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= todos.length) return { ok: true }

    const a = todos[idx]
    const b = todos[swapIdx]

    await Promise.all([
      (supabase as any).from('estados_kanban').update({ orden: b.orden }).eq('id', a.id),
      (supabase as any).from('estados_kanban').update({ orden: a.orden }).eq('id', b.id),
    ])
    refrescar()
    return { ok: true }
  } catch {
    return { ok: false }
  }
}

export async function eliminarEstadoKanban(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = createAdminClient()
    const { error } = await (supabase as any)
      .from('estados_kanban')
      .delete()
      .eq('id', id)
    if (error) return { ok: false, error: error.message }
    refrescar()
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e.message }
  }
}
