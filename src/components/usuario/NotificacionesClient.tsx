'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatFechaRelativa } from '@/lib/utils'
import { Bell, CheckCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Notificacion } from '@/lib/supabase/types'

interface Props {
  notificaciones: Notificacion[]
  usuarioId: string
}

export function NotificacionesClient({ notificaciones: initial, usuarioId }: Props) {
  const router = useRouter()
  const [list, setList] = useState<Notificacion[]>(initial)

  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel('notificaciones-list')
      .on('postgres_changes' as any, {
        event: 'INSERT',
        schema: 'public',
        table: 'notificaciones',
        filter: `usuario_id=eq.${usuarioId}`,
      }, (payload: any) => {
        setList(prev => [payload.new as Notificacion, ...prev])
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [usuarioId])

  const marcarLeida = async (id: string) => {
    const supabase = createClient()
    try {
      await (supabase as any).from('notificaciones').update({ leida: true }).eq('id', id)
      setList(prev => prev.map(n => n.id === id ? { ...n, leida: true } : n))
    } catch { /* ignore */ }
  }

  const marcarTodasLeidas = async () => {
    const supabase = createClient()
    try {
      await (supabase as any)
        .from('notificaciones')
        .update({ leida: true })
        .eq('usuario_id', usuarioId)
        .eq('leida', false)
      setList(prev => prev.map(n => ({ ...n, leida: true })))
    } catch { /* ignore */ }
  }

  const noLeidas = list.filter(n => !n.leida).length

  return (
    <div className="space-y-4">
      {noLeidas > 0 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-500">{noLeidas} sin leer</span>
          <Button size="sm" variant="outline" onClick={marcarTodasLeidas} className="gap-1.5 text-xs">
            <CheckCheck size={13} /> Marcar todas como leídas
          </Button>
        </div>
      )}

      {list.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white py-16 text-center">
          <Bell size={32} className="mx-auto mb-3 text-slate-200" />
          <p className="text-sm text-slate-400">No tienes notificaciones</p>
          <p className="text-xs text-slate-300 mt-1">Te avisaremos cuando cambien tus solicitudes</p>
        </div>
      ) : (
        <div className="space-y-2">
          {list.map(n => (
            <div
              key={n.id}
              className={`rounded-xl border p-4 transition-colors cursor-pointer ${
                n.leida
                  ? 'border-slate-100 bg-white'
                  : 'border-blue-100 bg-blue-50'
              }`}
              onClick={() => {
                if (!n.leida) marcarLeida(n.id)
                if (n.requerimiento_id) router.push(`/mis-requerimientos/${n.requerimiento_id}`)
              }}
            >
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${n.leida ? 'bg-slate-200' : 'bg-blue-500'}`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${n.leida ? 'text-slate-600' : 'font-medium text-slate-800'}`}>
                    {n.mensaje}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400">{formatFechaRelativa(n.created_at)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
