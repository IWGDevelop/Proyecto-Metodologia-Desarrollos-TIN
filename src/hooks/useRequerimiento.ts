'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Requerimiento, HistorialEstado, Comentario, Anexo } from '@/lib/supabase/types'

export function useRequerimiento(id: string) {
  const supabase = createClient()

  return useQuery<Requerimiento | null>({
    queryKey: ['requerimiento', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('requerimientos')
        .select('*')
        .eq('id', id)
        .single()
      if (error) throw error
      return data
    },
    enabled: !!id,
  })
}

export function useHistorialEstados(requerimientoId: string) {
  const supabase = createClient()

  return useQuery<HistorialEstado[]>({
    queryKey: ['historial', requerimientoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('historial_estados')
        .select('*')
        .eq('requerimiento_id', requerimientoId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
    enabled: !!requerimientoId,
  })
}

export function useComentarios(requerimientoId: string) {
  const supabase = createClient()

  return useQuery<Comentario[]>({
    queryKey: ['comentarios', requerimientoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('comentarios')
        .select('*')
        .eq('requerimiento_id', requerimientoId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
    enabled: !!requerimientoId,
  })
}

export function useAnexos(requerimientoId: string) {
  const supabase = createClient()

  return useQuery<Anexo[]>({
    queryKey: ['anexos', requerimientoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('anexos')
        .select('*')
        .eq('requerimiento_id', requerimientoId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
    enabled: !!requerimientoId,
  })
}
