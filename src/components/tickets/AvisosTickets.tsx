'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { Bell, Check, CheckCheck, ChevronDown, ChevronUp } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  listarMisAvisos, marcarAvisoLeido, marcarTodosAvisosLeidos, type AvisoTicket,
} from '@/actions/tickets/notificaciones'

function hace(iso: string): string {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (min < 1) return 'ahora'
  if (min < 60) return `hace ${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `hace ${h} h`
  const d = Math.round(h / 24)
  return d === 1 ? 'ayer' : `hace ${d} días`
}

/** Avisos de tickets del usuario actual (canal APP de los recordatorios y del flujo) */
export function AvisosTickets() {
  const [avisos, setAvisos] = useState<AvisoTicket[]>([])
  const [noLeidas, setNoLeidas] = useState(0)
  const [verLeidas, setVerLeidas] = useState(false)
  const [abierto, setAbierto] = useState(true)
  const [cargado, setCargado] = useState(false)
  const [pendiente, startTransition] = useTransition()

  const cargar = useCallback(async (leidas: boolean) => {
    const r = await listarMisAvisos(leidas)
    setAvisos(r.avisos)
    setNoLeidas(r.noLeidas)
    setCargado(true)
  }, [])

  useEffect(() => {
    let vivo = true
    listarMisAvisos(verLeidas).then(r => {
      if (!vivo) return
      setAvisos(r.avisos)
      setNoLeidas(r.noLeidas)
      setCargado(true)
    })
    return () => { vivo = false }
  }, [verLeidas])

  const marcar = (id: string) => {
    startTransition(async () => {
      const r = await marcarAvisoLeido(id)
      if (!r.ok) { toast.error(r.error ?? 'No se pudo marcar el aviso'); return }
      await cargar(verLeidas)
    })
  }

  const marcarTodos = () => {
    startTransition(async () => {
      const r = await marcarTodosAvisosLeidos()
      if (!r.ok) { toast.error(r.error ?? 'No se pudieron marcar los avisos'); return }
      await cargar(verLeidas)
    })
  }

  // Sin avisos pendientes y sin pedir el historial: no ocupa espacio
  if (!cargado || (noLeidas === 0 && !verLeidas)) return null

  return (
    <section className="rounded-xl border border-amber-200 bg-amber-50/60" aria-label="Avisos de tickets">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        <button
          type="button"
          onClick={() => setAbierto(a => !a)}
          className="flex items-center gap-2 text-sm font-semibold text-amber-900"
          aria-expanded={abierto}
        >
          <Bell size={16} className="text-amber-600" />
          Avisos de tickets
          {noLeidas > 0 && (
            <span className="rounded-full bg-amber-500 px-2 py-0.5 text-xs font-bold text-white">{noLeidas}</span>
          )}
          {abierto ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => setVerLeidas(v => !v)} disabled={pendiente}>
            {verLeidas ? 'Solo sin leer' : 'Ver leídos'}
          </Button>
          {noLeidas > 0 && (
            <Button variant="outline" size="sm" onClick={marcarTodos} disabled={pendiente} className="gap-1">
              <CheckCheck size={14} /> Marcar todos como leídos
            </Button>
          )}
        </div>
      </div>

      {abierto && (
        <ul className="max-h-72 divide-y divide-amber-100 overflow-y-auto border-t border-amber-100">
          {avisos.length === 0 && (
            <li className="px-4 py-3 text-sm text-slate-500">No tienes avisos.</li>
          )}
          {avisos.map(a => (
            <li key={a.id} className={cn('flex items-start gap-3 px-4 py-2.5', a.leida && 'opacity-60')}>
              <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', a.leida ? 'bg-slate-300' : 'bg-amber-500')} />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-slate-800">{a.mensaje}</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {a.ticket_codigo && a.enlace ? (
                    <Link href={a.enlace} className="font-medium text-blue-700 hover:underline" onClick={() => !a.leida && marcar(a.id)}>
                      {a.ticket_codigo}
                    </Link>
                  ) : null}
                  {a.ticket_codigo ? ' · ' : ''}
                  {hace(a.created_at)}
                </p>
              </div>
              {!a.leida && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => marcar(a.id)}
                  disabled={pendiente}
                  aria-label="Marcar como leído"
                  title="Marcar como leído"
                >
                  <Check size={14} />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
