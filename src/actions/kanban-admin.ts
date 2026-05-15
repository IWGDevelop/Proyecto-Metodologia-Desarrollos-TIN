'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import type { MetricaRequerimiento } from '@/lib/supabase/types'

export type KanbanData = Record<string, MetricaRequerimiento[]>

export async function fetchKanbanAdmin(): Promise<KanbanData> {
  try {
    const supabase = createAdminClient()
    const { data, error } = await (supabase as any)
      .from('v_metricas_requerimientos')
      .select('*')
      .eq('es_borrador', false)
      .order('prioridad', { ascending: true, nullsFirst: false })

    if (error) return {}

    const result: KanbanData = {}
    for (const r of (data ?? []) as MetricaRequerimiento[]) {
      const estado = r.estado as string
      if (!result[estado]) result[estado] = []
      result[estado].push(r)
    }
    return result
  } catch {
    return {}
  }
}
