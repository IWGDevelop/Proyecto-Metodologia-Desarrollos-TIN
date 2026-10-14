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
  /** Días de retraso que generó en el requerimiento */
  dias_impacto?: number | null
  comentario_admin: string | null
  comentario_usuario: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

const AVISO_SIN_DIAS =
  'Se guardó sin los días de impacto: falta ejecutar la migración supabase/migration_penalizaciones_dias.sql en Supabase'

/** La columna dias_impacto aún no existe en la base (migración pendiente) */
function faltaColumnaDias(error: { message?: string } | null): boolean {
  return !!error?.message?.includes('dias_impacto')
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
  dias_impacto?: number | null
  created_by?: string | null
}): Promise<{ ok: boolean; error?: string; aviso?: string; penalizacion?: PenalizacionRequerimiento }> {
  try {
    const supabase = createAdminClient()
    const base = {
      requerimiento_id: data.requerimiento_id,
      tipo:             data.tipo,
      descripcion:      data.descripcion?.trim() || null,
      responsables:     data.responsables,
      monto_cop:        data.monto_cop,
      created_by:       data.created_by ?? null,
    }
    const insertar = (fila: Record<string, unknown>) =>
      (supabase as any).from('penalizaciones_requerimiento').insert(fila).select().single()

    const conDias = data.dias_impacto != null
    let { data: result, error } = await insertar(conDias ? { ...base, dias_impacto: data.dias_impacto } : base)
    // Migración pendiente: se guarda la penalización sin los días y se avisa
    if (conDias && faltaColumnaDias(error)) {
      ({ data: result, error } = await insertar(base))
      if (!error) return { ok: true, aviso: AVISO_SIN_DIAS, penalizacion: result }
    }
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
    dias_impacto: number | null
  }>
): Promise<{ ok: boolean; error?: string; aviso?: string }> {
  try {
    const supabase = createAdminClient()
    const actualizar = (cambios: Record<string, unknown>) =>
      (supabase as any).from('penalizaciones_requerimiento').update(cambios).eq('id', id)

    let { error } = await actualizar(data)
    // Migración pendiente: se guardan los demás cambios sin los días y se avisa
    if ('dias_impacto' in data && faltaColumnaDias(error)) {
      const { dias_impacto: _omitido, ...resto } = data
      ;({ error } = await actualizar(resto))
      if (!error) return { ok: true, aviso: AVISO_SIN_DIAS }
    }
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
