'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import type { MetricaRequerimiento } from '@/lib/supabase/types'

export interface FiltrosAdmin {
  search?: string
  estados?: string[]
  alcance?: string
  prioridad?: string
  proceso_interno?: string
  tipo_solucion?: string
  es_borrador?: boolean
}

export interface SortAdmin {
  column: string
  direction: 'asc' | 'desc'
}

export interface RequerimientosAdminResult {
  data: MetricaRequerimiento[]
  total: number
  totalFiltrado: number
}

export interface PerfilFiltro {
  email: string
  proceso_interno: string | null
}

function aplicarFiltroUsuario(query: any, perfilFiltro: PerfilFiltro): any {
  const orParts: string[] = [
    `responsable.ilike.%${perfilFiltro.email}%`,
    `partes_interesadas.cs.{${perfilFiltro.email}}`,
  ]
  if (perfilFiltro.proceso_interno) {
    orParts.push(`proceso_interno.eq.${perfilFiltro.proceso_interno}`)
  }
  return query.or(orParts.join(','))
}

const PAGE_SIZE = 20

export async function fetchTodosAdminParaExportar(
  filtros: FiltrosAdmin,
  sort: SortAdmin,
  perfilFiltro?: PerfilFiltro | null
): Promise<MetricaRequerimiento[]> {
  try {
    const supabase = createAdminClient()

    let query = (supabase as any)
      .from('v_metricas_requerimientos')
      .select('*')

    if (filtros.search?.trim()) {
      const q = filtros.search.trim()
      query = query.or(
        `identificacion.ilike.%${q}%,nombre_desarrollo.ilike.%${q}%,descripcion_situacion_actual.ilike.%${q}%`
      )
    }
    if (filtros.estados?.length)            query = query.in('estado', filtros.estados)
    if (filtros.alcance)                    query = query.eq('alcance', filtros.alcance)
    if (filtros.prioridad)                  query = query.eq('prioridad', parseInt(filtros.prioridad))
    if (filtros.proceso_interno)            query = query.eq('proceso_interno', filtros.proceso_interno)
    if (filtros.tipo_solucion)              query = query.eq('tipo_solucion', filtros.tipo_solucion)
    if (filtros.es_borrador !== undefined)  query = query.eq('es_borrador', filtros.es_borrador)
    if (perfilFiltro)                       query = aplicarFiltroUsuario(query, perfilFiltro)

    const col = sort.column === 'identificacion' ? 'nombre_desarrollo' : sort.column
    const isImpacto = ['impacto_economico_total_anual', 'ahorro_anual_cop',
                       'total_beneficios_cualitativos_anual', 'horas_estimadas_desarrollo'].includes(col)
    query = query.order(col, { ascending: sort.direction === 'asc', nullsFirst: isImpacto ? false : sort.direction === 'asc' })

    const { data, error } = await query
    if (error) throw new Error(error.message)
    return (data ?? []) as MetricaRequerimiento[]
  } catch {
    return []
  }
}

export async function fetchRequerimientosAdmin(
  filtros: FiltrosAdmin,
  page: number,
  sort: SortAdmin,
  perfilFiltro?: PerfilFiltro | null
): Promise<RequerimientosAdminResult> {
  try {
    const supabase = createAdminClient()

    // Total sin filtros
    const { count: total } = await (supabase as any)
      .from('requerimientos')
      .select('*', { count: 'exact', head: true })

    // Query principal con filtros
    let query = (supabase as any)
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
    if (perfilFiltro)                  query = aplicarFiltroUsuario(query, perfilFiltro)

    // Ordenamiento — columnas de impacto siempre con nulls al final
    const col = sort.column === 'identificacion' ? 'nombre_desarrollo' : sort.column
    const nullsFirst = sort.direction === 'asc'
    const isImpacto = ['impacto_economico_total_anual', 'ahorro_anual_cop',
                       'total_beneficios_cualitativos_anual', 'horas_estimadas_desarrollo'].includes(col)
    query = query.order(col, { ascending: sort.direction === 'asc', nullsFirst: isImpacto ? false : nullsFirst })

    // Paginación
    const from = (page - 1) * PAGE_SIZE
    query = query.range(from, from + PAGE_SIZE - 1)

    const { data, count: totalFiltrado, error } = await query
    if (error) throw new Error(error.message)

    return {
      data: (data ?? []) as MetricaRequerimiento[],
      total: total ?? 0,
      totalFiltrado: totalFiltrado ?? 0,
    }
  } catch {
    return { data: [], total: 0, totalFiltrado: 0 }
  }
}

export async function getEstadosDistintos(): Promise<string[]> {
  try {
    const supabase = createAdminClient()
    const { data } = await (supabase as any)
      .from('requerimientos')
      .select('estado')
    const set = new Set<string>((data ?? []).map((r: any) => r.estado).filter(Boolean))
    return Array.from(set).sort()
  } catch {
    return []
  }
}

export interface PrioridadOcupada {
  prioridad: number
  sub_prioridad: number | null
  nombre: string
}

export async function getPrioridadesProceso(
  proceso_interno: string,
  excludeId: string
): Promise<PrioridadOcupada[]> {
  const supabase = createAdminClient()
  const { data } = await (supabase as any)
    .from('requerimientos')
    .select('prioridad, sub_prioridad, nombre_desarrollo, identificacion')
    .eq('proceso_interno', proceso_interno)
    .neq('id', excludeId)
    .not('prioridad', 'is', null)

  return (data ?? []).map((r: any) => ({
    prioridad: r.prioridad,
    sub_prioridad: r.sub_prioridad ?? null,
    nombre: r.nombre_desarrollo ?? r.identificacion ?? '',
  }))
}
