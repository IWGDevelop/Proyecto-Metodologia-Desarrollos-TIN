'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ListTodo, CheckCircle2, Clock, AlertCircle,
  ChevronDown, ChevronUp, Download,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { exportarReporte } from '@/lib/exportar'
import { getTareasOverview } from '@/actions/tareas-overview'
import type { TareaOverview } from '@/actions/tareas-overview'

function formatFecha(str: string | null) {
  if (!str) return '—'
  return new Date(str + 'T12:00:00').toLocaleDateString('es-CO', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

function diasRestantes(fecha: string | null): number | null {
  if (!fecha) return null
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const comp = new Date(fecha + 'T12:00:00')
  return Math.round((comp.getTime() - hoy.getTime()) / 86400000)
}

function BadgeDias({ dias }: { dias: number | null }) {
  if (dias === null) return <span className="text-slate-300 text-xs">Sin fecha</span>
  if (dias < 0)
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">
        <AlertCircle size={10} /> {Math.abs(dias)}d vencida
      </span>
    )
  if (dias === 0)
    return <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-bold text-orange-700">Hoy</span>
  if (dias <= 3)
    return <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">{dias}d</span>
  return <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{dias}d</span>
}

/* ── Grupo de tareas por requerimiento ───────────────────────────────────── */
function GrupoRequerimiento({ nombre, tareas }: { nombre: string; tareas: TareaOverview[] }) {
  const [expanded, setExpanded] = useState(true)
  const vencidas = tareas.filter(t => {
    const dias = diasRestantes(t.fecha_compromiso)
    return dias !== null && dias < 0
  }).length

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <button
        onClick={() => setExpanded(e => !e)}
        className="flex w-full items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/70 px-4 py-3 text-left hover:bg-slate-50"
      >
        <div className="flex items-center gap-2 min-w-0">
          <p className="text-sm font-semibold text-slate-700 truncate">{nombre}</p>
          <span className="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-700">
            {tareas.length}
          </span>
          {vencidas > 0 && (
            <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-600">
              {vencidas} vencida{vencidas !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        {expanded
          ? <ChevronUp size={14} className="shrink-0 text-slate-400" />
          : <ChevronDown size={14} className="shrink-0 text-slate-400" />}
      </button>

      {expanded && (
        <div className="divide-y divide-slate-50">
          {tareas.map(t => {
            const dias = diasRestantes(t.fecha_compromiso)
            return (
              <div key={t.id} className="flex items-start gap-3 px-4 py-3">
                <div className="mt-0.5 shrink-0 rounded-full border-2 border-slate-200 h-4 w-4" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-700">{t.descripcion}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    {t.reunion_titulo && (
                      <span className="text-xs text-slate-400">{t.reunion_titulo}</span>
                    )}
                    {t.responsable_email && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">
                        {t.responsable_email.split('@')[0]}
                      </span>
                    )}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <BadgeDias dias={dias} />
                  {t.fecha_compromiso && (
                    <p className="mt-0.5 text-[10px] text-slate-400">{formatFecha(t.fecha_compromiso)}</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ── Componente principal ────────────────────────────────────────────────── */
export function ReporteTareasAbiertas() {
  const [tab, setTab] = useState<'abiertas' | 'recientes'>('abiertas')

  const { data, isLoading } = useQuery({
    queryKey: ['tareas-overview'],
    queryFn: getTareasOverview,
    staleTime: 60_000,
  })

  const abiertas  = data?.abiertas  ?? []
  const recientes = data?.recientes ?? []

  const vencidasTotal  = abiertas.filter(t => (diasRestantes(t.fecha_compromiso) ?? 1) < 0).length
  const sinFechaTotal  = abiertas.filter(t => !t.fecha_compromiso).length
  const urgentesTotal  = abiertas.filter(t => { const d = diasRestantes(t.fecha_compromiso); return d !== null && d >= 0 && d <= 3 }).length

  // Agrupar abiertas por requerimiento
  const gruposAbiertas = (() => {
    const mapa = new Map<string, { nombre: string; tareas: TareaOverview[] }>()
    abiertas.forEach(t => {
      const key = t.requerimiento_id ?? 'sin_req'
      const nombre = t.requerimiento_nombre ?? 'Sin requerimiento'
      if (!mapa.has(key)) mapa.set(key, { nombre, tareas: [] })
      mapa.get(key)!.tareas.push(t)
    })
    return [...mapa.values()].sort((a, b) => {
      const vA = a.tareas.filter(t => (diasRestantes(t.fecha_compromiso) ?? 1) < 0).length
      const vB = b.tareas.filter(t => (diasRestantes(t.fecha_compromiso) ?? 1) < 0).length
      return vB - vA || b.tareas.length - a.tareas.length
    })
  })()

  const exportarAbiertas = () => {
    exportarReporte('Tareas_Abiertas', abiertas, [
      { titulo: 'Requerimiento',  ancho: 45, render: (t: TareaOverview) => t.requerimiento_nombre ?? '' },
      { titulo: 'Reunión',        ancho: 30, render: (t: TareaOverview) => t.reunion_titulo ?? '' },
      { titulo: 'Tarea',          ancho: 50, render: (t: TareaOverview) => t.descripcion },
      { titulo: 'Responsable',    ancho: 30, render: (t: TareaOverview) => t.responsable_email ?? '' },
      { titulo: 'F. inicio',      ancho: 14, render: (t: TareaOverview) => formatFecha(t.fecha_inicio) },
      { titulo: 'F. compromiso',  ancho: 14, render: (t: TareaOverview) => formatFecha(t.fecha_compromiso) },
    ])
  }

  const exportarRecientes = () => {
    exportarReporte('Tareas_Respondidas_Recientes', recientes, [
      { titulo: 'Requerimiento',  ancho: 45, render: (t: TareaOverview) => t.requerimiento_nombre ?? '' },
      { titulo: 'Reunión',        ancho: 30, render: (t: TareaOverview) => t.reunion_titulo ?? '' },
      { titulo: 'Tarea',          ancho: 50, render: (t: TareaOverview) => t.descripcion },
      { titulo: 'Responsable',    ancho: 30, render: (t: TareaOverview) => t.responsable_email ?? '' },
      { titulo: 'Compromiso',     ancho: 14, render: (t: TareaOverview) => formatFecha(t.fecha_compromiso) },
      { titulo: 'Cumplió',        ancho: 14, render: (t: TareaOverview) => formatFecha(t.fecha_cumplimiento) },
    ])
  }

  if (isLoading) return <Skeleton className="h-96 w-full rounded-xl" />

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <ListTodo size={18} className="text-blue-600" />
          <h2 className="text-base font-bold text-slate-800">Panel de tareas de reunión</h2>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={tab === 'abiertas' ? exportarAbiertas : exportarRecientes}
          className="gap-1.5 text-xs"
        >
          <Download size={13} /> Exportar Excel
        </Button>
      </div>

      {/* KPIs (solo abiertas) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3">
          <div className="flex items-center gap-1.5 text-xs font-medium text-blue-500 mb-1">
            <ListTodo size={11} /> Abiertas
          </div>
          <p className="text-2xl font-bold text-blue-700">{abiertas.length}</p>
        </div>
        <div className="rounded-xl border border-red-100 bg-red-50/60 px-4 py-3">
          <div className="flex items-center gap-1.5 text-xs font-medium text-red-400 mb-1">
            <AlertCircle size={11} /> Vencidas
          </div>
          <p className="text-2xl font-bold text-red-600">{vencidasTotal}</p>
        </div>
        <div className="rounded-xl border border-amber-100 bg-amber-50/60 px-4 py-3">
          <div className="flex items-center gap-1.5 text-xs font-medium text-amber-500 mb-1">
            <Clock size={11} /> Próximas (≤3d)
          </div>
          <p className="text-2xl font-bold text-amber-600">{urgentesTotal}</p>
        </div>
        <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 px-4 py-3">
          <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-500 mb-1">
            <CheckCircle2 size={11} /> Respondidas (14d)
          </div>
          <p className="text-2xl font-bold text-emerald-600">{recientes.length}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1 w-fit">
        <button
          onClick={() => setTab('abiertas')}
          className={cn(
            'rounded-md px-4 py-1.5 text-xs font-semibold transition-colors',
            tab === 'abiertas'
              ? 'bg-white text-blue-700 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          )}
        >
          Abiertas y pendientes
          {abiertas.length > 0 && (
            <span className="ml-1.5 rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-600">
              {abiertas.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab('recientes')}
          className={cn(
            'rounded-md px-4 py-1.5 text-xs font-semibold transition-colors',
            tab === 'recientes'
              ? 'bg-white text-emerald-700 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          )}
        >
          Respondidas recientemente
          {recientes.length > 0 && (
            <span className="ml-1.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600">
              {recientes.length}
            </span>
          )}
        </button>
      </div>

      {/* Panel: Abiertas */}
      {tab === 'abiertas' && (
        <>
          {abiertas.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 py-12 text-center">
              <CheckCircle2 size={30} className="mx-auto mb-2 text-slate-200" />
              <p className="text-sm font-semibold text-slate-500">No hay tareas abiertas</p>
              <p className="text-xs text-slate-400 mt-1">Todas las tareas de reunión están completadas.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sinFechaTotal > 0 && (
                <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <span className="text-xs text-slate-400">
                    {sinFechaTotal} tarea{sinFechaTotal !== 1 ? 's' : ''} sin fecha de compromiso
                  </span>
                </div>
              )}
              {gruposAbiertas.map(g => (
                <GrupoRequerimiento key={g.nombre} nombre={g.nombre} tareas={g.tareas} />
              ))}
            </div>
          )}
        </>
      )}

      {/* Panel: Respondidas recientes */}
      {tab === 'recientes' && (
        <>
          {recientes.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 py-12 text-center">
              <ListTodo size={30} className="mx-auto mb-2 text-slate-200" />
              <p className="text-sm font-semibold text-slate-500">Sin tareas respondidas en los últimos 14 días</p>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <p className="border-b border-slate-100 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Respondidas en los últimos 14 días ({recientes.length})
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50">
                    <tr>
                      {['Tarea', 'Reunión', 'Requerimiento', 'Responsable', 'Compromiso', 'Cumplió'].map(h => (
                        <th key={h} className="px-3 py-2.5 text-left font-medium text-slate-400 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {recientes.map((t, i) => (
                      <tr key={t.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}>
                        <td className="px-3 py-2.5 max-w-[220px]">
                          <p className="line-clamp-2 text-slate-700">{t.descripcion}</p>
                        </td>
                        <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">{t.reunion_titulo ?? '—'}</td>
                        <td className="px-3 py-2.5 max-w-[160px]">
                          <p className="truncate text-slate-500">{t.requerimiento_nombre ?? '—'}</p>
                        </td>
                        <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">
                          {t.responsable_email ? t.responsable_email.split('@')[0] : '—'}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap text-slate-500">
                          {formatFecha(t.fecha_compromiso)}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <span className="font-medium text-emerald-700">{formatFecha(t.fecha_cumplimiento)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
