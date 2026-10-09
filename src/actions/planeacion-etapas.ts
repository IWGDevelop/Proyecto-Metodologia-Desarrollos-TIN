'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { ETAPAS_PLANEACION, tipoFechaPlaneacion } from '@/lib/etapas-planeacion'

export interface PlaneacionEtapa {
  estado: string
  fecha_inicio: string | null
  fecha_fin: string | null
}

export async function getPlaneacionEtapas(reqId: string): Promise<PlaneacionEtapa[]> {
  const supabase = createAdminClient()
  const { data } = await (supabase as any)
    .from('planeacion_etapas')
    .select('estado, fecha_inicio, fecha_fin')
    .eq('requerimiento_id', reqId)
  return data ?? []
}

export async function guardarPlaneacionEtapas(
  reqId: string,
  planeacion: PlaneacionEtapa[],
): Promise<{ ok: boolean; error?: string }> {
  try {
    const etapasValidas = new Set(ETAPAS_PLANEACION.map(e => e.estado))
    const filas = planeacion.filter(p => etapasValidas.has(p.estado))

    const invertidas = filas.filter(p => p.fecha_inicio && p.fecha_fin && p.fecha_inicio > p.fecha_fin)
    if (invertidas.length > 0) {
      const labels = invertidas.map(p => ETAPAS_PLANEACION.find(e => e.estado === p.estado)?.label)
      return { ok: false, error: `La fecha de inicio es posterior a la de fin en: ${labels.join(', ')}` }
    }

    const supabase = createAdminClient()
    const actuales = await getPlaneacionEtapas(reqId)

    // Detectar cambios para dejar trazabilidad de la re-planeación
    const cambios: { tipo_fecha: string; anterior: string | null; nueva: string | null }[] = []
    for (const p of filas) {
      const previa = actuales.find(a => a.estado === p.estado)
      for (const campo of ['inicio', 'fin'] as const) {
        const anterior = previa?.[`fecha_${campo}`] ?? null
        const nueva = p[`fecha_${campo}`] ?? null
        if (anterior !== nueva) cambios.push({ tipo_fecha: tipoFechaPlaneacion(campo, p.estado), anterior, nueva })
      }
    }
    if (cambios.length === 0) return { ok: true }

    let userName = 'Sistema'
    try {
      const clientUser = await createClient()
      const { data: { user } } = await clientUser.auth.getUser()
      userName = user?.email ?? 'Sistema'
    } catch { /* no session in server action */ }

    const { error: errUpsert } = await (supabase as any)
      .from('planeacion_etapas')
      .upsert(
        filas.map(p => ({
          requerimiento_id: reqId,
          estado:           p.estado,
          fecha_inicio:     p.fecha_inicio || null,
          fecha_fin:        p.fecha_fin || null,
          updated_by:       userName,
          updated_at:       new Date().toISOString(),
        })),
        { onConflict: 'requerimiento_id,estado' },
      )
    if (errUpsert) return { ok: false, error: errUpsert.message }

    const { error: errHist } = await (supabase as any)
      .from('historial_fechas')
      .insert(cambios.map(c => ({
        requerimiento_id: reqId,
        tipo_fecha:       c.tipo_fecha,
        fecha_anterior:   c.anterior,
        fecha_nueva:      c.nueva,
        usuario:          userName,
      })))
    if (errHist) return { ok: false, error: `Error al guardar historial: ${errHist.message}` }

    revalidatePath(`/admin/requerimientos/${reqId}`)
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e.message }
  }
}
