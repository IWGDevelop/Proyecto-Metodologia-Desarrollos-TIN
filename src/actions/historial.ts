'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { Comentario, Anexo } from '@/lib/supabase/types'

export async function agregarComentario(
  requerimientoId: string,
  comentario: string,
  usuario: string
) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('comentarios')
    .insert({ requerimiento_id: requerimientoId, comentario, usuario } as never)
    .select()
    .single()

  if (error) throw new Error(error.message)
  revalidatePath(`/requerimientos/${requerimientoId}`)
  return data as unknown as Comentario
}

export async function eliminarComentario(id: string, requerimientoId: string) {
  const supabase = await createClient()

  const { error } = await supabase.from('comentarios').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath(`/requerimientos/${requerimientoId}`)
}

export async function registrarAnexo(
  requerimientoId: string,
  payload: {
    nombre_archivo: string
    url_storage: string
    tipo_archivo?: string
    tamanio_bytes?: number
  }
) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('anexos')
    .insert({ requerimiento_id: requerimientoId, ...payload } as never)
    .select()
    .single()

  if (error) throw new Error(error.message)
  revalidatePath(`/requerimientos/${requerimientoId}`)
  return data as unknown as Anexo
}

export async function eliminarAnexo(id: string, requerimientoId: string) {
  const supabase = await createClient()

  const { error } = await supabase.from('anexos').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath(`/requerimientos/${requerimientoId}`)
}
