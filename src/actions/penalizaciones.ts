'use server'

import { createAdminClient } from '@/lib/supabase/admin'

export type TipoPenalizacion =
  | 'DOCUMENTACION_DESTIEMPO'
  | 'MALA_DEFINICION'
  | 'FALTA_RESPUESTA'
  | 'INFORMACION_INCORRECTA'
  | 'CAMBIO_ALCANCE'
  | 'RETRASO_ENTREGA'
  | 'OTRO'

export interface PenalizacionRequerimiento {
  id: string
  requerimiento_id: string
  tipo: TipoPenalizacion
  descripcion: string | null
  responsables: string[]        // emails
  monto_cop: number
  comentario_admin: string | null
  comentario_usuario: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export async function getPenalizaciones(requerimientoId: string): Promise<PenalizacionRequerimiento[]> {
  try {
    const supabase = createAdminClient()
    const { data, error } = await (supabase as any)
      .from('penalizaciones_requerimiento')
      .select('*')
      .eq('requerimiento_id', requerimientoId)
      .order('created_at', { ascending: false })
    if (error) return []
    return data ?? []
  } catch {
    return []
  }
}

export async function crearPenalizacion(data: {
  requerimiento_id: string
  tipo: TipoPenalizacion
  descripcion?: string | null
  responsables: string[]
  monto_cop: number
  created_by?: string | null
}): Promise<{ ok: boolean; error?: string; penalizacion?: PenalizacionRequerimiento }> {
  try {
    const supabase = createAdminClient()
    const { data: result, error } = await (supabase as any)
      .from('penalizaciones_requerimiento')
      .insert({
        requerimiento_id: data.requerimiento_id,
        tipo:             data.tipo,
        descripcion:      data.descripcion?.trim() || null,
        responsables:     data.responsables,
        monto_cop:        data.monto_cop,
        created_by:       data.created_by ?? null,
      })
      .select()
      .single()
    if (error) return { ok: false, error: error.message }
    return { ok: true, penalizacion: result }
  } catch (e: any) {
    return { ok: false, error: e.message }
  }
}

export async function actualizarPenalizacion(
  id: string,
  data: Partial<{
    tipo: TipoPenalizacion
    descripcion: string | null
    responsables: string[]
    monto_cop: number
  }>
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = createAdminClient()
    const { error } = await (supabase as any)
      .from('penalizaciones_requerimiento')
      .update(data)
      .eq('id', id)
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e?.message }
  }
}

export async function actualizarComentarios(
  id: string,
  data: { comentario_admin?: string | null; comentario_usuario?: string | null }
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = createAdminClient()
    const { error } = await (supabase as any)
      .from('penalizaciones_requerimiento')
      .update(data)
      .eq('id', id)
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e?.message }
  }
}

export async function eliminarPenalizacion(id: string): Promise<{ ok: boolean }> {
  try {
    const supabase = createAdminClient()
    const { error } = await (supabase as any)
      .from('penalizaciones_requerimiento')
      .delete()
      .eq('id', id)
    return { ok: !error }
  } catch {
    return { ok: false }
  }
}
