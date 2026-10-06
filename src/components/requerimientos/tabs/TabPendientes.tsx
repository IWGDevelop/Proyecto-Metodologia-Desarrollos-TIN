'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarClock, CheckCircle2, Circle, Lock, MessageSquare, Users } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  getTareasConsolidadasRequerimiento, type TareaConsolidadaReq,
} from '@/actions/pendientes-requerimiento'
import { toggleTareaReunion } from '@/actions/reuniones'
import { toggleTareaSolicitud } from '@/actions/tareas-solicitud'

interface Props {
  requerimientoId: string
  initialData?: TareaConsolidadaReq[]
}

type Filtro = 'PENDIENTES' | 'COMPLETADAS' | 'TODAS'

function fmtFecha(iso: string | null) {
  if (!iso) return '—'
  // Las fechas tipo `date` (YYYY-MM-DD) se interpretan en hora local para no correr un día
  const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T00:00:00`) : new Date(iso)
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

function diasRestantes(fecha: string | null) {
  if (!fecha) return null
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
  const f = new Date(`${fecha.slice(0, 10)}T00:00:00`)
  return Math.round((f.getTime() - hoy.getTime()) / 86_400_000)
}

function BadgeCompromiso({ tarea }: { tarea: TareaConsolidadaReq }) {
  if (!tarea.fecha_compromiso) return null
  const dias = diasRestantes(tarea.fecha_compromiso)
  const vencida = !tarea.completada && dias != null && dias < 0
  const proxima = !tarea.completada && dias != null && dias >= 0 && dias <= 3
  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
      vencida ? 'bg-red-100 text-red-700' : proxima ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600',
    )}>
      <CalendarClock size={11} />
      {fmtFecha(tarea.fecha_compromiso)}
      {vencida && ` · Vencida hace ${Math.abs(dias!)} d`}
      {proxima && (dias === 0 ? ' · Vence hoy' : ` · ${dias} d`)}
    </span>
  )
}

export function TabPendientes({ requerimientoId, initialData }: Props) {
  const qc = useQueryClient()
  const router = useRouter()
  const [filtro, setFiltro] = useState<Filtro>('PENDIENTES')
  const [enProceso, setEnProceso] = useState<string | null>(null)

  const { data: tareas = [], isLoading } = useQuery<TareaConsolidadaReq[]>({
    queryKey: ['pendientes-req', requerimientoId],
    queryFn: () => getTareasConsolidadasRequerimiento(requerimientoId),
    initialData,
  })

  const pendientes = tareas.filter(t => !t.completada)
  const vencidas = pendientes.filter(t => (diasRestantes(t.fecha_compromiso) ?? 0) < 0)
  const visibles = tareas.filter(t =>
    filtro === 'TODAS' ? true : filtro === 'PENDIENTES' ? !t.completada : t.completada
  )

  async function toggle(t: TareaConsolidadaReq) {
    if (t.origen === 'REUNION' && !t.completada && !t.tiene_evidencia) {
      toast.error('Esta tarea de reunión requiere una respuesta o un anexo. Regístralo en la pestaña Reuniones.')
      return
    }
    setEnProceso(t.id)
    const res = t.origen === 'REUNION'
      ? await toggleTareaReunion(t.id, !t.completada)
      : await toggleTareaSolicitud(t.id, requerimientoId, !t.completada)
    setEnProceso(null)
    if (!res.ok) { toast.error(res.error ?? 'No se pudo actualizar la tarea'); return }
    toast.success(t.completada ? 'Tarea reabierta' : 'Tarea completada')
    qc.invalidateQueries({ queryKey: ['pendientes-req', requerimientoId] })
    qc.invalidateQueries({ queryKey: ['reuniones', requerimientoId] })
    qc.invalidateQueries({ queryKey: ['tareas-solicitud', requerimientoId] })
    router.refresh() // actualiza el contador del menú lateral
  }

  return (
    <div className="space-y-4">
      {/* Resumen */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { label: 'Pendientes', valor: pendientes.length, cls: 'text-blue-700' },
          { label: 'Vencidas', valor: vencidas.length, cls: vencidas.length ? 'text-red-600' : 'text-slate-700' },
          { label: 'Completadas', valor: tareas.length - pendientes.length, cls: 'text-emerald-600' },
        ].map(k => (
          <div key={k.label} className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{k.label}</p>
            <p className={cn('text-2xl font-bold', k.cls)}>{k.valor}</p>
          </div>
        ))}
      </div>

      {/* Filtro */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
          {(['PENDIENTES', 'COMPLETADAS', 'TODAS'] as Filtro[]).map(f => (
            <button
              key={f}
              type="button"
              onClick={() => setFiltro(f)}
              className={cn(
                'rounded-md px-3 py-1 text-xs font-medium transition-colors',
                filtro === f ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700',
              )}
            >
              {f === 'PENDIENTES' ? 'Pendientes' : f === 'COMPLETADAS' ? 'Completadas' : 'Todas'}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-400">Orden cronológico según la fecha en que surgió cada tarea</p>
      </div>

      {/* Línea de tiempo */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        {isLoading ? (
          <p className="py-8 text-center text-sm text-slate-400">Cargando tareas...</p>
        ) : visibles.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">
            {filtro === 'PENDIENTES' ? 'No hay tareas pendientes 🎉' : 'No hay tareas para mostrar'}
          </p>
        ) : (
          <ol className="relative space-y-4 border-l border-slate-200 pl-5">
            {visibles.map(t => {
              const esReunion = t.origen === 'REUNION'
              const bloqueada = esReunion && !t.completada && !t.tiene_evidencia
              return (
                <li key={`${t.origen}-${t.id}`} className="relative">
                  <span className={cn(
                    'absolute -left-[27px] top-1 flex h-3 w-3 rounded-full border-2 border-white',
                    t.completada ? 'bg-emerald-400' : esReunion ? 'bg-violet-400' : 'bg-blue-400',
                  )} />
                  <p className="text-[11px] font-medium text-slate-400">{fmtFecha(t.fecha_origen)}</p>
                  <div className="mt-1 flex items-start gap-3 rounded-lg border border-slate-100 p-3 hover:bg-slate-50">
                    <button
                      type="button"
                      onClick={() => toggle(t)}
                      disabled={enProceso === t.id}
                      title={bloqueada ? 'Requiere respuesta o anexo en la pestaña Reuniones' : t.completada ? 'Reabrir' : 'Marcar como completada'}
                      className="mt-0.5 shrink-0 text-slate-400 hover:text-emerald-600 disabled:opacity-50"
                    >
                      {t.completada
                        ? <CheckCircle2 size={18} className="text-emerald-500" />
                        : bloqueada ? <Lock size={16} /> : <Circle size={18} />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className={cn('text-sm text-slate-800', t.completada && 'text-slate-400 line-through')}>
                        {t.descripcion}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <span className={cn(
                          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
                          esReunion ? 'bg-violet-100 text-violet-700' : 'bg-blue-100 text-blue-700',
                        )}>
                          {esReunion ? <Users size={11} /> : <MessageSquare size={11} />}
                          {esReunion ? `Reunión${t.contexto ? `: ${t.contexto}` : ''}` : 'Comentarios'}
                        </span>
                        {t.responsable_email && (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                            {t.nombre_responsable ?? t.responsable_email}
                          </span>
                        )}
                        <BadgeCompromiso tarea={t} />
                        {t.completada && t.fecha_cumplimiento && (
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700">
                            Cumplida {fmtFecha(t.fecha_cumplimiento)}
                          </span>
                        )}
                        {!esReunion && t.contexto && (
                          <span className="text-[11px] text-slate-400">Registrada por {t.contexto}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </div>
    </div>
  )
}
