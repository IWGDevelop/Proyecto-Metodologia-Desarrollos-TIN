'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { Requerimiento } from '@/lib/supabase/types'

export async function crearRequerimiento(
  data: Partial<Omit<Requerimiento, 'id' | 'created_at' | 'updated_at'>>
) {
  const supabase = await createClient()
  const { data: result, error } = await supabase
    .from('requerimientos')
    .insert({ identificacion: '', ...data } as never)
    .select()
    .single()
  if (error) throw new Error(error.message)
  revalidatePath('/requerimientos')
  revalidatePath('/dashboard')
  return result as unknown as Requerimiento
}

export async function actualizarRequerimiento(
  id: string,
  data: Partial<Omit<Requerimiento, 'id' | 'created_at' | 'updated_at'>>
) {
  const supabase = await createClient()
  const { data: result, error } = await supabase
    .from('requerimientos')
    .update(data as never)
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(error.message)
  revalidatePath('/requerimientos')
  revalidatePath(`/requerimientos/${id}`)
  revalidatePath('/dashboard')
  return result as unknown as Requerimiento
}

export async function cambiarEstado(
  id: string,
  estado: Requerimiento['estado'],
  observacion?: string
) {
  const supabase = await createClient()

  const updates: Record<string, unknown> = { estado }
  if (estado === 'ENTREGADO' || estado === 'CERRADO') {
    updates.porcentaje_avance = 100
  }
  if (estado === 'EN_DESARROLLO' && !updates.fecha_inicio_desarrollo) {
    updates.fecha_inicio_desarrollo = new Date().toISOString().split('T')[0]
  }
  if (estado === 'CERRADO') {
    updates.fecha_cierre = new Date().toISOString().split('T')[0]
  }

  const { error } = await supabase
    .from('requerimientos')
    .update(updates as never)
    .eq('id', id)

  if (error) throw new Error(error.message)

  // Si hay observacion, actualizamos el historial que acaba de crear el trigger
  if (observacion?.trim()) {
    const { data: ultimo } = await supabase
      .from('historial_estados')
      .select('id')
      .eq('requerimiento_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (ultimo) {
      await supabase
        .from('historial_estados')
        .update({ observacion: observacion.trim() } as never)
        .eq('id', ultimo.id)
    }
  }

  revalidatePath('/requerimientos')
  revalidatePath(`/requerimientos/${id}`)
  revalidatePath('/kanban')
  revalidatePath('/dashboard')
}

// Soft delete: cierra el requerimiento en lugar de eliminarlo
export async function eliminarRequerimiento(id: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('requerimientos')
    .update({ estado: 'CERRADO', fecha_cierre: new Date().toISOString().split('T')[0] } as never)
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/requerimientos')
  revalidatePath('/dashboard')
}

export async function publicarRequerimiento(id: string) {
  return actualizarRequerimiento(id, {
    es_borrador: false,
    fecha_envio_solicitud: new Date().toISOString(),
  })
}
