'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import type { Perfil, RequerimientoDesarrollador } from '@/lib/supabase/types'

export async function getDesarrolladoresReq(requerimientoId: string): Promise<RequerimientoDesarrollador[]> {
  const supabase = createAdminClient()
  const { data, error } = await (supabase as any)
    .from('requerimiento_desarrolladores')
    .select('*, perfil:perfil_id(id, nombre_completo, email, cargo, proceso_interno)')
    .eq('requerimiento_id', requerimientoId)
    .order('asignado_at', { ascending: true })

  if (error) return []
  return data ?? []
}

export async function getDesarrolladoresDisponibles(): Promise<Perfil[]> {
  const supabase = createAdminClient()
  const { data, error } = await (supabase as any)
    .from('perfiles')
    .select('*')
    .eq('activo', true)
    .order('nombre_completo', { ascending: true })

  if (error) return []
  return data ?? []
}

export async function asignarDesarrollador(
  requerimientoId: string,
  perfilId: string,
  asignadoBy?: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = createAdminClient()
    const { error } = await (supabase as any)
      .from('requerimiento_desarrolladores')
      .upsert({
        requerimiento_id: requerimientoId,
        perfil_id: perfilId,
        asignado_by: asignadoBy ?? null,
      }, { onConflict: 'requerimiento_id,perfil_id' })

    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e?.message }
  }
}

export async function desasignarDesarrollador(
  requerimientoId: string,
  perfilId: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = createAdminClient()
    const { error } = await (supabase as any)
      .from('requerimiento_desarrolladores')
      .delete()
      .eq('requerimiento_id', requerimientoId)
      .eq('perfil_id', perfilId)

    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e?.message }
  }
}
