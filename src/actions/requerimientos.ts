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
  if (estado === 'EN_DESARROLLO') updates.porcentaje_avance = 0

  const { error } = await supabase
    .from('requerimientos')
    .update(updates as never)
    .eq('id', id)

  if (error) throw new Error(error.message)

  if (observacion) {
    await supabase
      .from('historial_estados')
      .update({ observacion } as never)
      .eq('requerimiento_id', id)
  }

  revalidatePath('/requerimientos')
  revalidatePath(`/requerimientos/${id}`)
  revalidatePath('/kanban')
}

export async function eliminarRequerimiento(id: string) {
  const supabase = await createClient()

  const { error } = await supabase.from('requerimientos').delete().eq('id', id)
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
