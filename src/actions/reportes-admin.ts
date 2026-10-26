'use server'

import { exigirAccesoAdmin } from '@/lib/supabase/guards'
import { createAdminClient } from '@/lib/supabase/admin'
import type { MetricaRequerimiento } from '@/lib/supabase/types'

export async function fetchReportesAdmin(): Promise<MetricaRequerimiento[]> {
  await exigirAccesoAdmin()
  try {
    const supabase = createAdminClient()
    const { data, error } = await (supabase as any)
      .from('v_metricas_requerimientos')
      .select('*')
      .eq('es_borrador', false)
      .order('created_at', { ascending: false })

    if (error) return []
    return (data ?? []) as MetricaRequerimiento[]
  } catch {
    return []
  }
}
