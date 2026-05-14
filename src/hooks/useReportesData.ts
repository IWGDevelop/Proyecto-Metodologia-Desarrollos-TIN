'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useMemo } from 'react'
import type { MetricaRequerimiento } from '@/lib/supabase/types'

export interface FiltrosReportes {
  preset: 'mes' | 'trimestre' | 'semestre' | 'año' | 'personalizado'
  desde: string
  hasta: string
  alcance: string
  proceso_interno: string
}

export function calcularRango(preset: FiltrosReportes['preset']): { desde: string; hasta: string } {
  const hoy = new Date()
  const hasta = hoy.toISOString().split('T')[0]

  switch (preset) {
    case 'mes':
      return { desde: new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0], hasta }
    case 'trimestre':
      return { desde: new Date(hoy.getFullYear(), hoy.getMonth() - 2, 1).toISOString().split('T')[0], hasta }
    case 'semestre':
      return { desde: new Date(hoy.getFullYear(), hoy.getMonth() - 5, 1).toISOString().split('T')[0], hasta }
    case 'año':
      return { desde: new Date(hoy.getFullYear(), 0, 1).toISOString().split('T')[0], hasta }
    default:
      return { desde: '', hasta }
  }
}

async function fetchTodosRequerimientos(): Promise<MetricaRequerimiento[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('v_metricas_requerimientos')
    .select('*')
    .eq('es_borrador', false)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as MetricaRequerimiento[]
}

export function useReportesData(filtros: FiltrosReportes) {
  const { data: todos = [], isLoading, error } = useQuery<MetricaRequerimiento[]>({
    queryKey: ['reportes-data'],
    queryFn: fetchTodosRequerimientos,
    staleTime: 60_000,
  })

  const filtrados = useMemo(() => {
    return todos.filter(r => {
      const fecha = r.fecha_solicitud ?? r.created_at?.split('T')[0]
      if (filtros.desde && fecha && fecha < filtros.desde) return false
      if (filtros.hasta && fecha && fecha > filtros.hasta) return false
      if (filtros.alcance && r.alcance !== filtros.alcance) return false
      if (filtros.proceso_interno && r.proceso_interno !== filtros.proceso_interno) return false
      return true
    })
  }, [todos, filtros])

  return { datos: filtrados, isLoading, error }
}

export const FILTROS_INIT: FiltrosReportes = {
  preset: 'año',
  ...calcularRango('año'),
  alcance: '',
  proceso_interno: '',
}
