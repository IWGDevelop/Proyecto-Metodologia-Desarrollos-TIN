'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Requerimiento } from '@/lib/supabase/types'

interface FiltrosRequerimientos {
  estado?: string
  prioridad?: number
  alcance?: string
  tipo_solucion?: string
  es_borrador?: boolean
  search?: string
}

export function useRequerimientos(filtros?: FiltrosRequerimientos) {
  const supabase = createClient()

  return useQuery<Requerimiento[]>({
    queryKey: ['requerimientos', filtros],
    queryFn: async () => {
      let query = supabase
        .from('requerimientos')
        .select('*')
        .order('created_at', { ascending: false })

      if (filtros?.estado) query = query.eq('estado', filtros.estado)
      if (filtros?.prioridad) query = query.eq('prioridad', filtros.prioridad)
      if (filtros?.alcance) query = query.eq('alcance', filtros.alcance)
      if (filtros?.tipo_solucion) query = query.eq('tipo_solucion', filtros.tipo_solucion)
      if (filtros?.es_borrador !== undefined) query = query.eq('es_borrador', filtros.es_borrador)
      if (filtros?.search) {
        query = query.or(
          `identificacion.ilike.%${filtros.search}%,nombre_desarrollo.ilike.%${filtros.search}%,numero.ilike.%${filtros.search}%`
        )
      }

      const { data, error } = await query
      if (error) throw error
      return data ?? []
    },
  })
}
