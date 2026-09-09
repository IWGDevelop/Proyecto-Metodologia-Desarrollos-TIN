'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import type { DocumentacionTecnica, TipoDocumentoTecnico } from '@/lib/supabase/types'

export async function getDocumentacionTecnica(requerimientoId: string): Promise<DocumentacionTecnica[]> {
  const supabase = createAdminClient()
  const { data, error } = await (supabase as any)
    .from('documentacion_tecnica')
    .select('*')
    .eq('requerimiento_id', requerimientoId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function registrarDocumentoTecnico(
  requerimientoId: string,
  payload: {
    nombre_archivo: string
    url_storage: string
    tipo_archivo: string | null
    tamanio_bytes: number | null
    tipo_documento: TipoDocumentoTecnico
    descripcion?: string | null
    version?: string | null
    subido_por?: string | null
  }
): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await (supabase as any)
    .from('documentacion_tecnica')
    .insert({ requerimiento_id: requerimientoId, ...payload })
  if (error) throw new Error(error.message)
  revalidatePath(`/admin/requerimientos/${requerimientoId}`)
}

export async function eliminarDocumentoTecnico(id: string, requerimientoId: string): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await (supabase as any)
    .from('documentacion_tecnica')
    .delete()
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath(`/admin/requerimientos/${requerimientoId}`)
}
