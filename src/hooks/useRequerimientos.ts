'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { fetchRequerimientosAdmin } from '@/actions/requerimientos-admin'
import type { MetricaRequerimiento } from '@/lib/supabase/types'

export const PAGE_SIZE = 20

export interface FiltrosRequerimientos {
  search?: string
  estados?: string[]
  alcance?: string
  prioridad?: string
  proceso_interno?: string
  tipo_solucion?: string
  es_borrador?: boolean
}

export interface SortConfig {
  column: string
  direction: 'asc' | 'desc'
}

export interface RequerimientosResult {
  data: MetricaRequerimiento[]
  total: number
  totalFiltrado: number
}

// Consulta via browser client (para usuarios normales con RLS)
async function fetchRequerimientos(
  filtros: FiltrosRequerimientos,
  page: number,
  sort: SortConfig
): Promise<RequerimientosResult> {
  const supabase = createClient()

  const { count: totalSinFiltro } = await supabase
    .from('requerimientos')
    .select('*', { count: 'exact', head: true })

  let query = supabase
    .from('v_metricas_requerimientos')
    .select('*', { count: 'exact' })

  if (filtros.search?.trim()) {
    const q = filtros.search.trim()
    query = query.or(
      `identificacion.ilike.%${q}%,nombre_desarrollo.ilike.%${q}%,descripcion_situacion_actual.ilike.%${q}%`
    )
  }
  if (filtros.estados?.length)       query = query.in('estado', filtros.estados)
  if (filtros.alcance)               query = query.eq('alcance', filtros.alcance)
  if (filtros.prioridad)             query = query.eq('prioridad', parseInt(filtros.prioridad))
  if (filtros.proceso_interno)       query = query.eq('proceso_interno', filtros.proceso_interno)
  if (filtros.tipo_solucion)         query = query.eq('tipo_solucion', filtros.tipo_solucion)
  if (filtros.es_borrador !== undefined) query = query.eq('es_borrador', filtros.es_borrador)

  const validColumns = ['numero', 'prioridad', 'estado', 'dias_en_estado_actual', 'ahorro_anual_cop', 'created_at']
  const col = validColumns.includes(sort.column) ? sort.column : 'created_at'
  query = query.order(col, { ascending: sort.direction === 'asc', nullsFirst: false })

  const from = (page - 1) * PAGE_SIZE
  query = query.range(from, from + PAGE_SIZE - 1)

  const { data, count, error } = await query
  if (error) throw error

  return {
    data: (data ?? []) as MetricaRequerimiento[],
    total: totalSinFiltro ?? 0,
    totalFiltrado: count ?? 0,
  }
}

export function useRequerimientos(
  filtros: FiltrosRequerimientos,
  page: number = 1,
  sort: SortConfig = { column: 'created_at', direction: 'desc' },
  isAdmin = false
) {
  return useQuery<RequerimientosResult>({
    queryKey: ['requerimientos', filtros, page, sort, isAdmin],
    queryFn: () => isAdmin
      ? fetchRequerimientosAdmin(filtros, page, sort)  // admin client — bypasa RLS
      : fetchRequerimientos(filtros, page, sort),       // browser client — respeta RLS
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  })
}

export function useInvalidateRequerimientos() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: ['requerimientos'] })
}

export async function fetchTodosParaExportar(
  filtros: FiltrosRequerimientos,
  sort: SortConfig,
  isAdmin = false
): Promise<MetricaRequerimiento[]> {
  if (isAdmin) {
    const result = await fetchRequerimientosAdmin(filtros, 1, sort)
    return result.data
  }

  const supabase = createClient()
  let query = supabase.from('v_metricas_requerimientos').select('*')

  if (filtros.search?.trim()) {
    const q = filtros.search.trim()
    query = query.or(
      `identificacion.ilike.%${q}%,nombre_desarrollo.ilike.%${q}%,descripcion_situacion_actual.ilike.%${q}%`
    )
  }
  if (filtros.estados?.length) query = query.in('estado', filtros.estados)
  if (filtros.alcance)         query = query.eq('alcance', filtros.alcance)
  if (filtros.prioridad)       query = query.eq('prioridad', parseInt(filtros.prioridad))
  if (filtros.proceso_interno) query = query.eq('proceso_interno', filtros.proceso_interno)
  if (filtros.tipo_solucion)   query = query.eq('tipo_solucion', filtros.tipo_solucion)
  if (filtros.es_borrador !== undefined) query = query.eq('es_borrador', filtros.es_borrador)

  query = query.order(sort.column, { ascending: sort.direction === 'asc', nullsFirst: false })

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as MetricaRequerimiento[]
}
