'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { fetchKanbanAdmin } from '@/actions/kanban-admin'
import type { MetricaRequerimiento, Estado } from '@/lib/supabase/types'

export const COLUMNAS_KANBAN: Estado[] = [
  'SIN_GESTION', 'ANALISIS', 'EN_DESARROLLO',
  'PRUEBAS_USUARIO', 'STAND_BY', 'ENTREGADO',
]

export type KanbanData = Record<Estado, MetricaRequerimiento[]>

async function fetchKanbanBrowser(): Promise<KanbanData> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('v_metricas_requerimientos')
    .select('*')
    .not('estado', 'in', '("CERRADO")')
    .eq('es_borrador', false)
    .order('prioridad', { ascending: true, nullsFirst: false })

  if (error) throw error

  const base: KanbanData = {
    SIN_GESTION: [], ANALISIS: [], EN_DESARROLLO: [],
    PRUEBAS_USUARIO: [], STAND_BY: [], ENTREGADO: [], CERRADO: [],
  }
  for (const r of (data ?? []) as MetricaRequerimiento[]) {
    const estado = r.estado as Estado
    if (estado in base) base[estado].push(r)
  }
  return base
}

export function useKanban(isAdmin = false) {
  const qc = useQueryClient()

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('kanban-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'requerimientos' }, () => {
        qc.invalidateQueries({ queryKey: ['kanban'] })
        toast.info('🔄 Actualización recibida', { duration: 2500 })
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [qc])

  return useQuery<KanbanData>({
    queryKey: ['kanban', isAdmin],
    queryFn: () => isAdmin ? fetchKanbanAdmin() : fetchKanbanBrowser(),
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
}

export function useInvalidateKanban() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: ['kanban'] })
}
