'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import type { Comentario, Anexo } from '@/lib/supabase/types'

export async function getAnexos(requerimientoId: string): Promise<Anexo[]> {
  try {
    const supabase = createAdminClient()
    const { data, error } = await (supabase as any)
      .from('anexos')
      .select('*')
      .eq('requerimiento_id', requerimientoId)
      .order('created_at', { ascending: false })
    if (error) return []
    return data ?? []
  } catch {
    return []
  }
}

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
  const supabase = createAdminClient()

  const { data, error } = await (supabase as any)
    .from('anexos')
    .insert({ requerimiento_id: requerimientoId, ...payload })
    .select()
    .single()

  if (error) throw new Error(error.message)
  revalidatePath(`/admin/requerimientos/${requerimientoId}`)
  return data as Anexo
}

export async function eliminarAnexo(id: string, requerimientoId: string) {
  const supabase = createAdminClient()

  const { error } = await (supabase as any).from('anexos').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath(`/admin/requerimientos/${requerimientoId}`)
}
