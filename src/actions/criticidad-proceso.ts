'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

/** Requerimiento que ocupa una posición de criticidad dentro de su proceso */
export interface CriticidadProcesoItem {
  id: string
  numero: string | null
  nombre: string
  prioridad_proceso: number
  prioridad: number | null
  sub_prioridad: number | null
  estado: string
}

/** Requerimientos del proceso con su criticidad (posición) asignada, de la más crítica a la menos */
export async function getCriticidadesProceso(proceso: string): Promise<CriticidadProcesoItem[]> {
  const supabase = createAdminClient()
  const { data } = await (supabase as any)
    .from('requerimientos')
    .select('id, numero, nombre_desarrollo, identificacion, prioridad_proceso, prioridad, sub_prioridad, estado')
    .eq('proceso_interno', proceso)
    .eq('es_borrador', false)
    .not('prioridad_proceso', 'is', null)
    .order('prioridad_proceso', { ascending: true })
  return (data ?? []).map((r: any) => ({
    id: r.id,
    numero: r.numero ?? null,
    nombre: r.nombre_desarrollo ?? r.identificacion ?? '—',
    prioridad_proceso: r.prioridad_proceso,
    prioridad: r.prioridad ?? null,
    sub_prioridad: r.sub_prioridad ?? null,
    estado: r.estado,
  }))
}

export interface ResultadoCriticidad {
  ok: boolean
  error?: string
  /** Requerimiento que ocupaba la posición y cedió su criticidad general */
  reemplazado?: { nombre: string; prioridadAnterior: string; prioridadNueva: string }
}

/**
 * Ubica un requerimiento nuevo en la posición `posicion` de criticidad de su proceso:
 *  1. Los requerimientos del proceso desde esa posición bajan una posición (no puede haber dos iguales).
 *  2. Si la posición estaba ocupada, el nuevo toma la criticidad general (P + subprioridad) del que
 *     reemplazó, y ese pasa al último lugar de su mismo grupo (ej. P1 → el último de P1).
 * Si el nuevo ya trae criticidad general (asignada por un administrador), se respeta.
 */
export async function aplicarCriticidadProcesoNuevo(
  reqId: string,
  proceso: string,
  posicion: number,
): Promise<ResultadoCriticidad> {
  try {
    if (!Number.isInteger(posicion) || posicion < 1) return { ok: false, error: 'Posición de criticidad inválida' }
    const supabase = createAdminClient()

    const [{ data: nuevo }, { data: afectados }] = await Promise.all([
      (supabase as any).from('requerimientos').select('id, prioridad').eq('id', reqId).single(),
      (supabase as any)
        .from('requerimientos')
        .select('id, nombre_desarrollo, identificacion, prioridad_proceso, prioridad, sub_prioridad, parent_id')
        .eq('proceso_interno', proceso)
        .gte('prioridad_proceso', posicion)
        .neq('id', reqId)
        .order('prioridad_proceso', { ascending: false }),
    ])
    if (!nuevo) return { ok: false, error: 'Requerimiento no encontrado' }

    const reemplazado = (afectados ?? []).find((r: any) => r.prioridad_proceso === posicion) ?? null

    // 1. Desplazar hacia abajo (de la última posición hacia arriba para no chocar)
    for (const r of afectados ?? []) {
      const { error } = await (supabase as any)
        .from('requerimientos')
        .update({ prioridad_proceso: r.prioridad_proceso + 1 })
        .eq('id', r.id)
      if (error) return { ok: false, error: `Error al desplazar: ${error.message}` }
    }

    const cambiosNuevo: Record<string, any> = { prioridad_proceso: posicion }
    let resumen: ResultadoCriticidad['reemplazado']

    // 2. Intercambio de criticidad general con el requerimiento reemplazado
    if (reemplazado?.prioridad && nuevo.prioridad == null) {
      const p = reemplazado.prioridad as number
      // Último lugar del grupo: entre los requerimientos de la misma prioridad y el mismo padre
      let grupo = (supabase as any)
        .from('requerimientos')
        .select('sub_prioridad')
        .eq('prioridad', p)
        .not('sub_prioridad', 'is', null)
        .order('sub_prioridad', { ascending: false })
        .limit(1)
      grupo = reemplazado.parent_id ? grupo.eq('parent_id', reemplazado.parent_id) : grupo.is('parent_id', null)
      const { data: ultimo } = await grupo.maybeSingle()
      const ultimaSub = (ultimo?.sub_prioridad ?? 0) + 1

      if (reemplazado.parent_id) {
        // Un subrequerimiento ordena dentro de su padre: el nuevo (raíz) entra al final de su grupo P
        const { data: ultimoRaiz } = await (supabase as any)
          .from('requerimientos')
          .select('sub_prioridad')
          .eq('prioridad', p)
          .is('parent_id', null)
          .not('sub_prioridad', 'is', null)
          .order('sub_prioridad', { ascending: false })
          .limit(1)
          .maybeSingle()
        cambiosNuevo.prioridad = p
        cambiosNuevo.sub_prioridad = (ultimoRaiz?.sub_prioridad ?? 0) + 1
      } else {
        const { error: errReemplazado } = await (supabase as any)
          .from('requerimientos')
          .update({ sub_prioridad: ultimaSub })
          .eq('id', reemplazado.id)
        if (errReemplazado) return { ok: false, error: `Error al reasignar la criticidad general: ${errReemplazado.message}` }

        cambiosNuevo.prioridad = p
        cambiosNuevo.sub_prioridad = reemplazado.sub_prioridad
        resumen = {
          nombre: reemplazado.nombre_desarrollo ?? reemplazado.identificacion ?? '—',
          prioridadAnterior: `P${p}${reemplazado.sub_prioridad != null ? `.${reemplazado.sub_prioridad}` : ''}`,
          prioridadNueva: `P${p}.${ultimaSub}`,
        }
      }
    }

    const { error } = await (supabase as any).from('requerimientos').update(cambiosNuevo).eq('id', reqId)
    if (error) return { ok: false, error: error.message }

    revalidatePath('/admin/requerimientos')
    revalidatePath('/admin/reporte-prioridades')
    return { ok: true, reemplazado: resumen }
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'Error al asignar la criticidad' }
  }
}
