'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, RefreshCw, Clock, Code2, Calendar, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { fetchReporteDesarrolladores } from '@/actions/reporte-desarrolladores'
import { getEstadoCfg } from '@/lib/constants'
import type { DesarrolladorRow, ReqRow } from '@/actions/reporte-desarrolladores'

/* ── Helpers ─────────────────────────────────────────────────────────────── */
function fmtFecha(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('es-CO', {
    weekday: 'short', day: '2-digit', month: 'short',
  })
}

const ALCANCE_BADGE: Record<string, string> = {
  IWF: 'bg-blue-100 text-blue-700 border-blue-300',
  ILT: 'bg-green-100 text-green-700 border-green-300',
  IWG: 'bg-purple-100 text-purple-700 border-purple-300',
}

const CATEGORIA_COLOR: Record<string, string> = {
  DESARROLLO:      'bg-indigo-100 text-indigo-700',
  TESTING:         'bg-amber-100 text-amber-700',
  DOCUMENTAL:      'bg-slate-100 text-slate-600',
  ADMINISTRATIVO:  'bg-pink-100 text-pink-700',
  OTRO:            'bg-gray-100 text-gray-600',
}

/* ── Rangos rápidos ──────────────────────────────────────────────────────── */
type Rango = '7d' | '30d' | 'mes' | 'todo'

function calcRango(r: Rango): { desde?: string; hasta?: string } {
  const hoy = new Date()
  const iso = (d: Date) => d.toISOString().split('T')[0]
  if (r === 'todo') return {}
  if (r === 'mes') {
    const ini = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
    return { desde: iso(ini), hasta: iso(hoy) }
  }
  const dias = r === '7d' ? 7 : 30
  const ini = new Date(hoy)
  ini.setDate(ini.getDate() - dias)
  return { desde: iso(ini), hasta: iso(hoy) }
}

/* ── Fila de horas por día ───────────────────────────────────────────────── */
function TablaHorasDia({ requerimiento }: { requerimiento: ReqRow }) {
  // Fusiona registros de todas las tareas con info de tarea
  const filas = requerimiento.tareas.flatMap(t =>
    t.registros.map(r => ({ ...r, tarea: t.titulo, categoria: t.categoria }))
  ).sort((a, b) => a.fecha.localeCompare(b.fecha))

  if (filas.length === 0) {
    return <p className="px-4 py-3 text-xs italic text-slate-400">Sin registros de horas en este período</p>
  }

  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b border-slate-200 bg-slate-100">
          <th className="py-2 pl-4 text-left font-semibold text-slate-400">Fecha</th>
          <th className="py-2 px-3 text-left font-semibold text-slate-400">Tarea</th>
          <th className="py-2 px-3 text-left font-semibold text-slate-400">Categoría</th>
          <th className="py-2 px-3 text-left font-semibold text-slate-400">Notas</th>
          <th className="py-2 pr-4 text-right font-semibold text-slate-400">Horas</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {filas.map(f => (
          <tr key={f.id} className="hover:bg-white">
            <td className="py-2 pl-4 font-medium text-slate-600 whitespace-nowrap">{fmtFecha(f.fecha)}</td>
            <td className="px-3 py-2 text-slate-700 max-w-[200px] truncate">{f.tarea}</td>
            <td className="px-3 py-2">
              {f.categoria && (
                <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', CATEGORIA_COLOR[f.categoria] ?? 'bg-slate-100 text-slate-600')}>
                  {f.categoria}
                </span>
              )}
            </td>
            <td className="px-3 py-2 text-slate-400 max-w-[180px] truncate">{f.notas ?? '—'}</td>
            <td className="pr-4 py-2 text-right font-bold text-indigo-600">{f.horas} h</td>
          </tr>
        ))}
        {/* Total del requerimiento */}
        <tr className="border-t border-slate-200 bg-slate-50">
          <td colSpan={4} className="py-2 pl-4 text-xs font-semibold text-slate-500">Total</td>
          <td className="pr-4 py-2 text-right text-sm font-extrabold text-indigo-700">{requerimiento.total_horas} h</td>
        </tr>
      </tbody>
    </table>
  )
}

/* ── Card de requerimiento ───────────────────────────────────────────────── */
function ReqCard({ req, isOpen, onToggle }: { req: ReqRow; isOpen: boolean; onToggle: () => void }) {
  const cfg = getEstadoCfg(req.estado)
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 bg-white px-4 py-3 text-left hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <ChevronDown size={14} className={cn('shrink-0 text-slate-400 transition-transform', isOpen && 'rotate-180')} />
          <span className="truncate text-sm font-medium text-slate-700">{req.nombre}</span>
          <span className="shrink-0 text-[10px] text-slate-400">{req.identificacion}</span>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {req.alcance && (
            <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-bold', ALCANCE_BADGE[req.alcance] ?? 'bg-slate-100 text-slate-600 border-slate-200')}>
              {req.alcance}
            </span>
          )}
          <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', cfg.bgColor, cfg.textColor)}>
            {cfg.label}
          </span>
          <span className="text-xs font-bold text-indigo-600">{req.total_horas} h</span>
        </div>
      </button>
      {isOpen && (
        <div className="border-t border-slate-100 bg-slate-50">
          <TablaHorasDia requerimiento={req} />
        </div>
      )}
    </div>
  )
}

/* ── Card de desarrollador ───────────────────────────────────────────────── */
function DevCard({ dev }: { dev: DesarrolladorRow }) {
  const [open, setOpen] = useState(false)
  const [openReqs, setOpenReqs] = useState<Set<string>>(new Set())

  const toggleReq = (id: string) => setOpenReqs(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  const reqActivos = dev.requerimientos.filter(r => !['CERRADO', 'DESISTIDO'].includes(r.estado))
  const reqOtros   = dev.requerimientos.filter(r =>  ['CERRADO', 'DESISTIDO'].includes(r.estado))

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* Cabecera del desarrollador */}
      <button
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-extrabold text-indigo-700">
            {dev.nombre.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-bold text-slate-800">{dev.nombre}</p>
            {dev.cargo && <p className="text-xs text-slate-400">{dev.cargo}</p>}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-lg font-extrabold text-indigo-600">{dev.total_horas} h</p>
            <p className="text-[11px] text-slate-400">total registradas</p>
          </div>
          <div className="text-right">
            <p className="text-base font-bold text-slate-700">{dev.requerimientos.length}</p>
            <p className="text-[11px] text-slate-400">desarrollos</p>
          </div>
          <ChevronDown size={16} className={cn('text-slate-400 transition-transform', open && 'rotate-180')} />
        </div>
      </button>

      {/* Detalle expandido */}
      {open && (
        <div className="border-t border-slate-100">
          {/* Mini resumen de horas por día */}
          {dev.horas_por_dia.length > 0 && (
            <div className="flex flex-wrap gap-1.5 border-b border-slate-100 bg-slate-50 px-5 py-3">
              {dev.horas_por_dia.map(h => (
                <div key={h.fecha} className="rounded-lg border border-indigo-100 bg-indigo-50 px-2.5 py-1 text-center">
                  <p className="text-[10px] text-indigo-400">{fmtFecha(h.fecha)}</p>
                  <p className="text-xs font-extrabold text-indigo-700">{h.horas} h</p>
                </div>
              ))}
            </div>
          )}

          {/* Lista de requerimientos activos */}
          <div className="space-y-2 p-4">
            {reqActivos.length === 0 && reqOtros.length === 0 && (
              <p className="text-xs italic text-slate-400">Sin desarrollos con horas registradas en este período</p>
            )}
            {reqActivos.map(r => (
              <ReqCard key={r.id} req={r} isOpen={openReqs.has(r.id)} onToggle={() => toggleReq(r.id)} />
            ))}
            {reqOtros.length > 0 && (
              <details className="mt-1">
                <summary className="cursor-pointer text-xs text-slate-400 hover:text-slate-600 select-none">
                  {reqOtros.length} desarrollo{reqOtros.length !== 1 ? 's' : ''} cerrado/desistido
                </summary>
                <div className="mt-2 space-y-2">
                  {reqOtros.map(r => (
                    <ReqCard key={r.id} req={r} isOpen={openReqs.has(r.id)} onToggle={() => toggleReq(r.id)} />
                  ))}
                </div>
              </details>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Página principal ────────────────────────────────────────────────────── */
export default function ReporteDesarrolladoresPage() {
  const [rango, setRango] = useState<Rango>('30d')
  const filtro = useMemo(() => calcRango(rango), [rango])

  const { data = [], isLoading, isFetching, refetch, dataUpdatedAt } = useQuery({
    queryKey: ['reporte-desarrolladores', filtro],
    queryFn: () => fetchReporteDesarrolladores(filtro.desde, filtro.hasta),
    staleTime: 60_000,
  })

  const totalHoras = data.reduce((s, d) => s + d.total_horas, 0)
  const totalDevs  = data.length
  const totalReqs  = data.reduce((s, d) => s + d.requerimientos.length, 0)

  const generadoEn = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleDateString('es-CO', { day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' })
    : '—'

  const RANGOS: { key: Rango; label: string }[] = [
    { key: '7d',   label: 'Últimos 7 días' },
    { key: '30d',  label: 'Últimos 30 días' },
    { key: 'mes',  label: 'Este mes' },
    { key: 'todo', label: 'Todo' },
  ]

  return (
    <div className="space-y-6 p-6">
      {/* ── Encabezado ── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800">Reporte de desarrolladores</h1>
          <p className="mt-0.5 text-sm text-slate-400">
            Carga de trabajo y horas registradas por desarrollador · {generadoEn}
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw size={13} className={cn('text-slate-500', isFetching && 'animate-spin')} />
          <span className="text-xs font-medium text-slate-500">Actualizar</span>
        </button>
      </div>

      {/* ── Filtro de rango ── */}
      <div className="flex flex-wrap items-center gap-2">
        <Calendar size={14} className="text-slate-400" />
        {RANGOS.map(r => (
          <button
            key={r.key}
            onClick={() => setRango(r.key)}
            className={cn(
              'rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors',
              rango === r.key
                ? 'border-indigo-400 bg-indigo-50 text-indigo-700'
                : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
            )}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* ── KPIs ── */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Desarrolladores', valor: totalDevs,  icon: User,  color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { label: 'Desarrollos',     valor: totalReqs,  icon: Code2, color: 'text-violet-600', bg: 'bg-violet-50' },
          { label: 'Horas totales',   valor: `${totalHoras} h`, icon: Clock, color: 'text-emerald-600', bg: 'bg-emerald-50' },
        ].map(k => (
          <div key={k.label} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className={cn('rounded-xl p-2.5', k.bg)}>
              <k.icon size={18} className={k.color} />
            </div>
            <div>
              <p className={cn('text-2xl font-extrabold', k.color)}>{k.valor}</p>
              <p className="text-xs text-slate-400">{k.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Lista de desarrolladores ── */}
      {isLoading ? (
        <div className="flex h-48 items-center justify-center gap-3 text-slate-400">
          <RefreshCw size={18} className="animate-spin" />
          <span className="text-sm">Cargando reporte...</span>
        </div>
      ) : data.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white py-20 text-center shadow-sm">
          <Code2 size={36} className="mx-auto mb-3 text-slate-200" />
          <p className="text-sm font-semibold text-slate-500">Sin horas registradas en el período seleccionado</p>
          <button onClick={() => setRango('todo')} className="mt-3 text-xs text-indigo-600 hover:underline">
            Ver todo el historial
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {data.map(dev => <DevCard key={dev.perfil_id} dev={dev} />)}
        </div>
      )}
    </div>
  )
}
