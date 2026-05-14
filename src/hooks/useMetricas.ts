'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { MetricaRequerimiento, ImpactoEconomico, TopImpacto } from '@/lib/supabase/types'

export function useMetricasRequerimientos() {
  const supabase = createClient()

  return useQuery<MetricaRequerimiento[]>({
    queryKey: ['metricas-requerimientos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_metricas_requerimientos')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as MetricaRequerimiento[]
    },
  })
}

export function useImpactoEconomico() {
  const supabase = createClient()

  return useQuery<ImpactoEconomico[]>({
    queryKey: ['impacto-economico'],
    queryFn: async () => {
      const { data, error } = await supabase.from('v_impacto_economico').select('*')
      if (error) throw error
      return (data ?? []) as ImpactoEconomico[]
    },
  })
}

export function useTopImpacto() {
  const supabase = createClient()

  return useQuery<TopImpacto[]>({
    queryKey: ['top-impacto'],
    queryFn: async () => {
      const { data, error } = await supabase.from('v_top_impacto').select('*')
      if (error) throw error
      return (data ?? []) as TopImpacto[]
    },
  })
}
