'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { fetchKanbanAdmin } from '@/actions/kanban-admin'
import { getEstadosKanban } from '@/actions/estados-kanban'
import type { MetricaRequerimiento, EstadoKanban } from '@/lib/supabase/types'

export type KanbanData = Record<string, MetricaRequerimiento[]>

async function fetchKanbanBrowser(): Promise<KanbanData> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('v_metricas_requerimientos')
    .select('*')
    .eq('es_borrador', false)
    .order('prioridad', { ascending: true, nullsFirst: false })

  if (error) throw error

  const result: KanbanData = {}
  for (const r of (data ?? []) as MetricaRequerimiento[]) {
    const estado = r.estado as string
    if (!result[estado]) result[estado] = []
    result[estado].push(r)
  }
  return result
}

export function useEstadosKanban() {
  return useQuery<EstadoKanban[]>({
    queryKey: ['estados-kanban'],
    queryFn: getEstadosKanban,
    staleTime: 120_000,
  })
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
