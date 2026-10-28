'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { ExternalLink, Link2, Pencil, Search, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { CLASIFICACIONES_BUG, ESTADOS_BUG, LABEL_ESTADO_TICKET, SEVERIDADES_BUG } from '@/lib/tickets/constantes'
import {
  buscarRequerimientosParaBug, cambiarEstadoBug, enlazarBugARequerimiento, enlazarTicketAlBug, obtenerDetalleBug,
  type BugTablero, type DetalleBug as Detalle,
} from '@/actions/tickets/bugs'
import type { EstadoBug } from '@/lib/tickets/types'
import { CadenaDocumento } from './CadenaDocumento'
import { COLOR_ESTADO_BUG, PILL_CLASIFICACION, PILL_SEVERIDAD, SELECT_CLASE } from './estilos'

interface Props {
  bug: BugTablero | null
  onClose: () => void
  onEditar: (bug: BugTablero) => void
  onCambio: () => void
}

const fecha = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('es-CO', { timeZone: 'America/Bogota', day: 'numeric', month: 'short', year: 'numeric' }) : '—'

export function DetalleBug({ bug, onClose, onEditar, onCambio }: Props) {
  const [detalle, setDetalle] = useState<Detalle | null>(null)
  const [pendiente, startTransition] = useTransition()
  const [qReq, setQReq] = useState('')
  const [reqs, setReqs] = useState<{ id: string; nombre: string; estado: string | null }[] | null>(null)
  const [numTicket, setNumTicket] = useState('')

  const recargar = async (id: string) => {
    try {
      setDetalle(await obtenerDetalleBug(id))
    } catch {
      toast.error('No se pudo cargar el bug')
    }
  }

  useEffect(() => {
    if (!bug) return
    let vivo = true
    obtenerDetalleBug(bug.id)
      .then(d => { if (vivo) setDetalle(d) })
      .catch(() => toast.error('No se pudo cargar el bug'))
    return () => { vivo = false }
  }, [bug])

  const d = detalle && bug && detalle.id === bug.id ? detalle : null

  const ejecutar = (fn: () => Promise<{ ok: boolean; error?: string }>, exito: string) => {
    if (!bug) return
    startTransition(async () => {
      const r = await fn()
      if (!r.ok) { toast.error(r.error ?? 'No se pudo guardar'); return }
      toast.success(exito)
      await recargar(bug.id)
      onCambio()
    })
  }

  const buscarReq = () => {
    startTransition(async () => {
      try { setReqs(await buscarRequerimientosParaBug(qReq)) } catch { toast.error('No se pudo buscar') }
    })
  }

  return (
    <Sheet open={!!bug} onOpenChange={o => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="pr-6">{bug ? `${bug.codigo} · ${bug.titulo}` : ''}</SheetTitle>
        </SheetHeader>

        {!d ? (
          <p className="px-4 text-sm text-slate-500">Cargando…</p>
        ) : (
          <div className="space-y-5 px-4 pb-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn('rounded px-2 py-0.5 text-xs font-medium', PILL_CLASIFICACION[d.clasificacion])}>
                {CLASIFICACIONES_BUG.find(c => c.value === d.clasificacion)?.label}
              </span>
              <span className={cn('rounded px-2 py-0.5 text-xs font-semibold', PILL_SEVERIDAD[d.severidad])}>
                {SEVERIDADES_BUG.find(s => s.value === d.severidad)?.label}
              </span>
              <CadenaDocumento documento={d.tipo_documento} />
              <Button variant="outline" size="sm" className="ml-auto gap-1" onClick={() => onEditar(d)}>
                <Pencil size={13} /> Editar
              </Button>
            </div>

            {d.descripcion && <p className="whitespace-pre-wrap text-sm text-slate-700">{d.descripcion}</p>}

            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className="text-slate-500">Estado</dt>
              <dd>
                <select
                  aria-label="Estado del bug"
                  className={SELECT_CLASE}
                  value={d.estado}
                  disabled={pendiente}
                  onChange={e => ejecutar(() => cambiarEstadoBug(d.id, e.target.value as EstadoBug), 'Estado actualizado')}
                >
                  {ESTADOS_BUG.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </dd>
              <dt className="text-slate-500">Solución provisional</dt>
              <dd className="text-slate-800">{d.solucion_provisional || 'Ninguna'}</dd>
              <dt className="text-slate-500">Módulo</dt>
              <dd className="text-slate-800">{d.modulo || '—'}</dd>
              <dt className="text-slate-500">Responsable</dt>
              <dd className="text-slate-800">{d.responsable_nombre || 'Sin responsable'}</dd>
              <dt className="text-slate-500">Detectado</dt>
              <dd className="text-slate-800">{fecha(d.fecha_detectado)} · {d.dias_abierto} {d.dias_abierto === 1 ? 'día' : 'días'}{d.estado !== 'DESPLEGADO' ? ' abierto' : ''}</dd>
              <dt className="text-slate-500">Desplegado</dt>
              <dd className="text-slate-800">{fecha(d.fecha_desplegado)}{d.version ? ` · versión ${d.version}` : ''}</dd>
              <dt className="text-slate-500">Reportado por</dt>
              <dd className="text-slate-800">{d.creado_por || '—'}</dd>
            </dl>

            {/* Requerimiento */}
            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-slate-700">Requerimiento de desarrollo</h3>
              {d.requerimiento ? (
                <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                  <Link href={`/admin/requerimientos/${d.requerimiento.id}`} className="flex-1 truncate font-medium text-blue-700 hover:underline">
                    {d.requerimiento.nombre}
                  </Link>
                  <Button
                    variant="ghost" size="icon-sm" aria-label="Quitar requerimiento" disabled={pendiente}
                    onClick={() => ejecutar(() => enlazarBugARequerimiento(d.id, null), 'Requerimiento desvinculado')}
                  >
                    <X size={14} />
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      value={qReq} onChange={e => setQReq(e.target.value)} placeholder="Buscar requerimiento por nombre"
                      onKeyDown={e => { if (e.key === 'Enter') buscarReq() }}
                    />
                    <Button variant="outline" size="icon" onClick={buscarReq} disabled={pendiente} aria-label="Buscar requerimiento">
                      <Search size={14} />
                    </Button>
                  </div>
                  {reqs && (
                    <ul className="max-h-48 divide-y overflow-y-auto rounded-lg border border-slate-200">
                      {reqs.length === 0 && <li className="px-3 py-2 text-sm text-slate-500">Sin resultados</li>}
                      {reqs.map(r => (
                        <li key={r.id}>
                          <button
                            type="button"
                            className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                            disabled={pendiente}
                            onClick={() => { setReqs(null); setQReq(''); ejecutar(() => enlazarBugARequerimiento(d.id, r.id), 'Requerimiento asociado') }}
                          >
                            {r.nombre}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </section>

            {/* Tickets enlazados */}
            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-slate-700">
                Tickets enlazados <span className="font-normal text-slate-500">({d.tickets_enlazados.length})</span>
              </h3>
              <div className="flex gap-2">
                <Input value={numTicket} onChange={e => setNumTicket(e.target.value)} placeholder="TK-0012" aria-label="Número de ticket a enlazar" />
                <Button
                  variant="outline" className="gap-1" disabled={pendiente || !numTicket.trim()}
                  onClick={() => { const n = numTicket; setNumTicket(''); ejecutar(() => enlazarTicketAlBug(d.id, n), 'Ticket enlazado') }}
                >
                  <Link2 size={14} /> Enlazar
                </Button>
              </div>
              {d.tickets_enlazados.length === 0 ? (
                <p className="text-sm text-slate-500">Ningún ticket enlazado.</p>
              ) : (
                <ul className="divide-y rounded-lg border border-slate-200">
                  {d.tickets_enlazados.map(t => (
                    <li key={t.id} className="flex items-start gap-2 px-3 py-2 text-sm">
                      <div className="min-w-0 flex-1">
                        <Link href={`/admin/tickets/${t.id}`} className="inline-flex items-center gap-1 font-medium text-blue-700 hover:underline">
                          {t.codigo} <ExternalLink size={11} />
                        </Link>
                        <p className="truncate text-slate-700">{t.asunto}</p>
                        <p className="text-xs text-slate-500">{t.solicitante ?? '—'} · enlazado el {fecha(t.fecha_enlace)}</p>
                      </div>
                      <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">{LABEL_ESTADO_TICKET[t.estado] ?? t.estado}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <p className="text-xs text-slate-400">
              Estado actual: <span className={cn('rounded px-1.5 py-0.5', COLOR_ESTADO_BUG[d.estado])}>{ESTADOS_BUG.find(s => s.value === d.estado)?.label}</span>
            </p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
