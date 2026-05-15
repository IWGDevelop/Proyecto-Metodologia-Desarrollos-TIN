'use server'

import { createAdminClient } from '@/lib/supabase/admin'

export interface ConfigSLA {
  prioridad:   number
  label:       string
  dias_limite: number
  descripcion: string | null
}

export interface EstadisticaSLA {
  prioridad:    number
  total:        number
  cumple:       number
  no_cumple:    number
  sin_datos:    number
  pct_cumple:   number
  promedio_dias: number | null
}

export async function getConfigSLA(): Promise<ConfigSLA[]> {
  try {
    const supabase = createAdminClient()
    const { data, error } = await (supabase as any)
      .from('configuracion_sla')
      .select('*')
      .order('prioridad', { ascending: true })
    if (error) return defaultSLA()
    return data?.length ? data : defaultSLA()
  } catch {
    return defaultSLA()
  }
}

function defaultSLA(): ConfigSLA[] {
  return [
    { prioridad: 1, label: 'Crítica',  dias_limite: 5,  descripcion: 'Impacto crítico en la operación' },
    { prioridad: 2, label: 'Alta',     dias_limite: 15, descripcion: 'Alta prioridad de atención' },
    { prioridad: 3, label: 'Media',    dias_limite: 30, descripcion: 'Prioridad media' },
    { prioridad: 4, label: 'Baja',     dias_limite: 60, descripcion: 'Baja urgencia' },
  ]
}

export async function actualizarConfigSLA(
  prioridad: number,
  datos: { dias_limite: number; label?: string; descripcion?: string | null }
): Promise<{ ok: boolean; error?: string }> {
  try {
    if (datos.dias_limite < 1) return { ok: false, error: 'Los días deben ser mayor a 0' }
    const supabase = createAdminClient()
    const { error } = await (supabase as any)
      .from('configuracion_sla')
      .upsert({
        prioridad,
        dias_limite: datos.dias_limite,
        ...(datos.label       !== undefined && { label: datos.label }),
        ...(datos.descripcion !== undefined && { descripcion: datos.descripcion }),
      }, { onConflict: 'prioridad' })
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e.message }
  }
}

export async function getEstadisticasSLA(): Promise<EstadisticaSLA[]> {
  try {
    const supabase = createAdminClient()
    const { data, error } = await (supabase as any)
      .from('v_metricas_requerimientos')
      .select('prioridad, cumple_sla, dias_respuesta_tin')
      .eq('es_borrador', false)
      .not('prioridad', 'is', null)

    if (error || !data) return []

    const map: Record<number, EstadisticaSLA> = {}
    for (const r of data) {
      const p = r.prioridad as number
      if (!map[p]) map[p] = { prioridad: p, total: 0, cumple: 0, no_cumple: 0, sin_datos: 0, pct_cumple: 0, promedio_dias: null }
      map[p].total++
      if (r.cumple_sla === true)  map[p].cumple++
      else if (r.cumple_sla === false) map[p].no_cumple++
      else map[p].sin_datos++
    }

    // Calcular promedios y porcentajes
    for (const p of Object.keys(map).map(Number)) {
      const e = map[p]
      const conDatos = e.cumple + e.no_cumple
      e.pct_cumple = conDatos > 0 ? Math.round((e.cumple / conDatos) * 100) : 0

      const diasRelevantes = data
        .filter((r: any) => r.prioridad === p && r.dias_respuesta_tin !== null)
        .map((r: any) => r.dias_respuesta_tin as number)
      e.promedio_dias = diasRelevantes.length
        ? Math.round(diasRelevantes.reduce((s: number, d: number) => s + d, 0) / diasRelevantes.length)
        : null
    }

    return [1, 2, 3, 4].map(p => map[p]).filter(Boolean)
  } catch {
    return []
  }
}
