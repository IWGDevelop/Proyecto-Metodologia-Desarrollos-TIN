'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import type { MetricaRequerimiento, Estado } from '@/lib/supabase/types'

export type KanbanData = Record<Estado, MetricaRequerimiento[]>

export async function fetchKanbanAdmin(): Promise<KanbanData> {
  const base: KanbanData = {
    SIN_GESTION: [], ANALISIS: [], EN_DESARROLLO: [],
    PRUEBAS_USUARIO: [], STAND_BY: [], ENTREGADO: [], CERRADO: [],
  }

  try {
    const supabase = createAdminClient()
    const { data, error } = await (supabase as any)
      .from('v_metricas_requerimientos')
      .select('*')
      .not('estado', 'in', '("CERRADO")')
      .eq('es_borrador', false)
      .order('prioridad', { ascending: true, nullsFirst: false })

    if (error) return base

    for (const r of (data ?? []) as MetricaRequerimiento[]) {
      const estado = r.estado as Estado
      if (estado in base) base[estado].push(r)
    }
  } catch {
    // Return empty base on error
  }

  return base
}
