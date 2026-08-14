'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface PasoFlujo {
  paso_key: string
  completado: boolean
  completado_por: string | null
  completado_at: string | null
  notas: string | null
}

export async function getFlujoProcesoReq(reqId: string): Promise<PasoFlujo[]> {
  const supabase = createAdminClient()
  const { data } = await (supabase as any)
    .from('flujo_proceso')
    .select('paso_key, completado, completado_por, completado_at, notas')
    .eq('requerimiento_id', reqId)
  return data ?? []
}

export async function toggleFlujoPaso(
  reqId: string,
  pasoKey: string,
  completado: boolean,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = createAdminClient()

    let userName = 'Sistema'
    try {
      const clientUser = await createClient()
      const { data: { user } } = await clientUser.auth.getUser()
      userName = user?.email ?? 'Sistema'
    } catch {}

    const { error } = await (supabase as any)
      .from('flujo_proceso')
      .upsert({
        requerimiento_id: reqId,
        paso_key: pasoKey,
        completado,
        completado_por: completado ? userName : null,
        completado_at: completado ? new Date().toISOString() : null,
      }, { onConflict: 'requerimiento_id,paso_key' })

    if (error) return { ok: false, error: error.message }
    revalidatePath(`/admin/requerimientos/${reqId}`)
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e.message }
  }
}

export async function guardarNotasPaso(
  reqId: string,
  pasoKey: string,
  notas: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = createAdminClient()

    const { data: existing } = await (supabase as any)
      .from('flujo_proceso')
      .select('paso_key')
      .eq('requerimiento_id', reqId)
      .eq('paso_key', pasoKey)
      .maybeSingle()

    if (existing) {
      await (supabase as any)
        .from('flujo_proceso')
        .update({ notas: notas || null })
        .eq('requerimiento_id', reqId)
        .eq('paso_key', pasoKey)
    } else {
      await (supabase as any)
        .from('flujo_proceso')
        .insert({ requerimiento_id: reqId, paso_key: pasoKey, notas: notas || null, completado: false })
    }

    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e.message }
  }
}
