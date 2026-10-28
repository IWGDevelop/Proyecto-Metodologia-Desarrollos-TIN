'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { CalendarClock, CheckCircle2, FileText, Loader2, ShieldCheck, ShieldX, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useProcesos } from '@/context/ProcesosContext'
import { decidirAprobacionTicket } from '@/actions/tickets/flujo'
import type { AprobacionPendiente } from '@/actions/tickets/bandeja'
import { PrioridadBadge, btnPrimario, formatFechaCorta, formatFechaHora, inputCls } from './ui'

function TarjetaAprobacion({ a, resaltada, onDone }: { a: AprobacionPendiente; resaltada: boolean; onDone: () => void }) {
  const { label: labelArea } = useProcesos()
  const [observacion, setObservacion] = useState('')
  const [pending, startT] = useTransition()
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    if (resaltada) ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [resaltada])

  const decidir = (aprobado: boolean) => {
    if (!aprobado && !observacion.trim()) { toast.error('Indica el motivo del rechazo'); return }
    startT(async () => {
      const res = await decidirAprobacionTicket(a.id, aprobado, observacion.trim() || undefined)
      if (!res.ok) { toast.error(res.error ?? 'No se pudo registrar la decisión'); return }
      toast.success(aprobado ? `${a.codigo} aprobado` : `${a.codigo} rechazado`)
      onDone()
    })
  }

  return (
    <article
      ref={ref}
      id={`ticket-${a.id}`}
      className={cn('rounded-xl border bg-white p-4 transition-shadow', resaltada ? 'border-blue-400 shadow-md ring-2 ring-blue-100' : 'border-slate-200')}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs font-bold text-blue-700">{a.codigo}</span>
            <PrioridadBadge prioridad={a.prioridad} />
            {!a.soyAprobador && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                {a.aprobador ? `Aprobador: ${a.aprobador}` : 'Sin aprobador asignado'}
              </span>
            )}
          </div>
          <h3 className="mt-1 font-semibold text-slate-800">{a.asunto}</h3>
          <p className="text-xs text-slate-500">{a.categoria} · {a.tipologia}</p>
        </div>
        <div className="text-right text-xs text-slate-500">
          <p className="flex items-center justify-end gap-1"><User size={12} /> {a.solicitante}</p>
          {(a.area || a.sede) && <p className="text-slate-400">{[labelArea(a.area), a.sede].filter(Boolean).join(' · ')}</p>}
          <p className="text-slate-400">{formatFechaHora(a.fechaCreacion)}</p>
        </div>
      </div>

      <p className="mt-3 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{a.descripcion}</p>

      {(a.campos.length > 0 || a.fechaRequerida) && (
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          {a.fechaRequerida && (
            <div><dt className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-slate-400"><CalendarClock size={11} /> Fecha requerida</dt><dd className="text-slate-800">{formatFechaCorta(a.fechaRequerida)}</dd></div>
          )}
          {a.campos.map((c, i) => (
            <div key={i}><dt className="text-[11px] uppercase tracking-wide text-slate-400">{c.etiqueta}</dt><dd className="whitespace-pre-wrap text-slate-800">{c.valor}</dd></div>
          ))}
        </dl>
      )}

      {a.adjuntos.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {a.adjuntos.map((f, i) => (
            <a key={i} href={f.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50">
              <FileText size={12} /> {f.nombre_archivo}
            </a>
          ))}
        </div>
      )}

      <div className="mt-4 space-y-2 border-t border-slate-100 pt-3">
        <textarea
          value={observacion}
          onChange={e => setObservacion(e.target.value)}
          rows={2}
          placeholder="Observación (obligatoria si rechazas)"
          className={inputCls}
        />
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" onClick={() => decidir(false)} disabled={pending} className={cn(btnPrimario, 'bg-red-600 hover:bg-red-700')}>
            {pending ? <Loader2 size={14} className="animate-spin" /> : <ShieldX size={14} />} Rechazar
          </button>
          <button type="button" onClick={() => decidir(true)} disabled={pending} className={cn(btnPrimario, 'bg-emerald-600 hover:bg-emerald-700')}>
            {pending ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />} Aprobar
          </button>
        </div>
      </div>
    </article>
  )
}

export function AprobacionesTickets({ aprobaciones, resaltar }: { aprobaciones: AprobacionPendiente[]; resaltar?: string }) {
  const router = useRouter()
  if (aprobaciones.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
        <CheckCircle2 size={28} className="text-emerald-500" />
        <p className="font-semibold text-slate-700">No tienes solicitudes pendientes de aprobación</p>
        <p className="text-sm text-slate-500">
          {resaltar ? 'El ticket del enlace ya fue decidido o no está asignado a ti para aprobar.' : 'Cuando alguien de tu equipo pida algo que requiera tu aprobación, aparecerá aquí.'}
        </p>
      </div>
    )
  }
  return (
    <div className="space-y-4">
      {resaltar && !aprobaciones.some(a => a.id === resaltar) && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          El ticket del enlace ya fue decidido o no está pendiente de tu aprobación.
        </p>
      )}
      {aprobaciones.map(a => (
        <TarjetaAprobacion key={a.id} a={a} resaltada={a.id === resaltar} onDone={() => router.refresh()} />
      ))}
    </div>
  )
}
