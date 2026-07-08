'use client'

import { useState, useTransition } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { agregarComentario } from '@/actions/requerimientos'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { formatFechaRelativa } from '@/lib/utils'
import { toast } from 'sonner'
import type { Comentario } from '@/lib/supabase/types'

interface Props { requerimientoId: string }

export function TabComentarios({ requerimientoId }: Props) {
  const [texto, setTexto] = useState('')
  const [isPending, startTransition] = useTransition()
  const qc = useQueryClient()

  const { data: comentarios, isLoading, isError, error } = useQuery<Comentario[]>({
    queryKey: ['comentarios', requerimientoId],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('comentarios').select('*')
        .eq('requerimiento_id', requerimientoId)
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as Comentario[]
    },
    retry: 1,
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!texto.trim()) return
    startTransition(async () => {
      try {
        await agregarComentario(requerimientoId, texto.trim())
        setTexto('')
        qc.invalidateQueries({ queryKey: ['comentarios', requerimientoId] })
        toast.success('Comentario agregado')
      } catch { toast.error('Error al agregar comentario') }
    })
  }

  return (
    <div className="space-y-4">
      {/* Formulario */}
      <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
        <p className="text-sm font-semibold text-slate-700">Agregar comentario</p>
        <div className="space-y-1.5">
          <Label className="text-xs">Comentario</Label>
          <Textarea rows={3} placeholder="Escribe tu comentario..." value={texto} onChange={e => setTexto(e.target.value)} />
        </div>
        <Button type="submit" size="sm" disabled={isPending || !texto.trim()} className="bg-blue-600 hover:bg-blue-700">
          {isPending ? 'Guardando...' : 'Agregar comentario'}
        </Button>
      </form>

      {/* Lista */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        {isLoading ? (
          <div className="space-y-3">{Array.from({length: 3}).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
        ) : isError ? (
          <p className="py-8 text-center text-sm text-red-400">
            Error al cargar comentarios: {(error as Error)?.message ?? 'Error desconocido'}
          </p>
        ) : !comentarios?.length ? (
          <p className="py-8 text-center text-sm text-slate-400">Sin comentarios aún</p>
        ) : (
          <ol className="divide-y divide-slate-100">
            {comentarios.map(c => (
              <li key={c.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[11px] font-bold text-slate-600">
                      {(c.usuario ?? '?').charAt(0).toUpperCase()}
                    </div>
                    <p className="text-sm font-semibold text-slate-700 truncate">{c.usuario ?? 'Usuario'}</p>
                  </div>
                  <span className="shrink-0 text-xs text-slate-400">{formatFechaRelativa(c.created_at)}</span>
                </div>
                <p className="mt-2 ml-9 text-sm text-slate-600 whitespace-pre-wrap">{c.comentario}</p>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  )
}
