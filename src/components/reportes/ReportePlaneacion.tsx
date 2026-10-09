'use client'

import { useMemo, useState } from 'react'
import { Download, Search, CalendarRange } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { exportarReporte } from '@/lib/exportar'
import { getEstadoCfg, PROCESOS_INTERNOS } from '@/lib/constants'
import { ETAPAS_PLANEACION } from '@/lib/etapas-planeacion'
import { GanttPlaneacion, ICONO_CUMPLIMIENTO } from './GanttPlaneacion'
import type { CumplimientoEtapa, RequerimientoPlaneacion } from '@/actions/reporte-planeacion'

interface Props {
  datos: RequerimientoPlaneacion[]
}

const CON_ALERTA: CumplimientoEtapa[] = ['RETRASADA', 'VENCIDA', 'INICIO_ATRASADO']

function formatDesv(dias: number | null): string {
  if (dias === null) return '—'
  if (dias === 0) return '0d'
  return dias > 0 ? `+${dias}d` : `${dias}d`
}

const promedio = (xs: number[]) => xs.length ? Math.round(xs.reduce((s, x) => s + x, 0) / xs.length) : null

function TextoDesv({ dias }: { dias: number | null }) {
  return (
    <span className={cn(
      'tabular-nums',
      dias === null ? 'text-slate-300' : dias > 0 ? 'font-semibold text-red-600' : 'text-emerald-600'
    )}>
      {formatDesv(dias)}
    </span>
  )
}

function Kpi({ label, valor, detalle, tono }: { label: string; valor: string | number; detalle?: string; tono?: 'alerta' }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={cn('mt-1 text-2xl font-bold tabular-nums', tono === 'alerta' ? 'text-red-600' : 'text-slate-800')}>{valor}</p>
      {detalle && <p className="mt-0.5 text-[11px] text-slate-400">{detalle}</p>}
    </div>
  )
}

export function ReportePlaneacion({ datos }: Props) {
  const [busqueda, setBusqueda] = useState('')
  const [proceso, setProceso] = useState('')
  const [soloAlertas, setSoloAlertas] = useState(false)
  const [estadosFiltro, setEstadosFiltro] = useState<Set<string>>(new Set())

  const toggleEstado = (e: string) =>
    setEstadosFiltro(prev => {
      const next = new Set(prev)
      next.has(e) ? next.delete(e) : next.add(e)
      return next
    })

  const estadosDisponibles = useMemo(() => [...new Set(datos.map(r => r.estado))].sort(), [datos])

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return datos.filter(r =>
      (!q || r.nombre.toLowerCase().includes(q) || (r.numero ?? '').toLowerCase().includes(q)) &&
      (!proceso || r.proceso_interno === proceso) &&
      (estadosFiltro.size === 0 || estadosFiltro.has(r.estado)) &&
      (!soloAlertas || r.etapas.some(e => CON_ALERTA.includes(e.cumplimiento)))
    )
  }, [datos, busqueda, proceso, estadosFiltro, soloAlertas])

  const etapasPlaneadas = filtrados.flatMap(r => r.etapas.filter(e => e.cumplimiento !== 'SIN_PLAN'))
  const terminadas = etapasPlaneadas.filter(e => e.cumplimiento === 'A_TIEMPO' || e.cumplimiento === 'RETRASADA')
  const aTiempo = terminadas.filter(e => e.cumplimiento === 'A_TIEMPO').length
  const conAlerta = etapasPlaneadas.filter(e => CON_ALERTA.includes(e.cumplimiento)).length
  const desvPromFin = promedio(terminadas.map(e => e.desvFin).filter((d): d is number => d !== null))

  const resumenEtapas = ETAPAS_PLANEACION.map(etapa => {
    const filas = filtrados.map(r => r.etapas.find(e => e.estado === etapa.estado)!).filter(e => e.cumplimiento !== 'SIN_PLAN')
    const term = filas.filter(e => e.cumplimiento === 'A_TIEMPO' || e.cumplimiento === 'RETRASADA')
    return {
      ...etapa,
      planeadas: filas.length,
      terminadas: term.length,
      aTiempo: filas.filter(e => e.cumplimiento === 'A_TIEMPO').length,
      retrasadas: filas.filter(e => e.cumplimiento === 'RETRASADA').length,
      enAlerta: filas.filter(e => e.cumplimiento === 'VENCIDA' || e.cumplimiento === 'INICIO_ATRASADO').length,
      desvFin: promedio(term.map(e => e.desvFin).filter((d): d is number => d !== null)),
      durPlan: promedio(filas.map(e => e.duracionPlan).filter((d): d is number => d !== null)),
      durReal: promedio(term.map(e => e.duracionReal).filter((d): d is number => d !== null)),
    }
  })

  const exportar = () => {
    const filas = filtrados.flatMap(r => r.etapas
      .filter(e => e.cumplimiento !== 'SIN_PLAN')
      .map(e => ({ req: r, e })))
    exportarReporte('Planeacion_vs_Ejecutado', filas, [
      { titulo: 'N°',               ancho: 8,  render: ({ req }) => req.numero ?? '' },
      { titulo: 'Requerimiento',    ancho: 45, render: ({ req }) => req.nombre },
      { titulo: 'Estado actual',    ancho: 24, render: ({ req }) => getEstadoCfg(req.estado).label },
      { titulo: 'Etapa',            ancho: 28, render: ({ e }) => e.label },
      { titulo: 'Inicio planeado',  ancho: 15, render: ({ e }) => e.planInicio ?? '' },
      { titulo: 'Fin planeado',     ancho: 15, render: ({ e }) => e.planFin ?? '' },
      { titulo: 'Inicio real',      ancho: 15, render: ({ e }) => e.realInicio ?? '' },
      { titulo: 'Fin real',         ancho: 15, render: ({ e }) => e.enCurso ? 'En curso' : e.realFin ?? '' },
      { titulo: 'Desv. inicio (d)', ancho: 14, render: ({ e }) => e.desvInicio ?? '' },
      { titulo: 'Desv. fin (d)',    ancho: 14, render: ({ e }) => e.desvFin ?? '' },
      { titulo: 'Duración plan (d)', ancho: 16, render: ({ e }) => e.duracionPlan ?? '' },
      { titulo: 'Duración real (d)', ancho: 16, render: ({ e }) => e.duracionReal ?? '' },
      { titulo: 'Ingresos a la etapa', ancho: 16, render: ({ e }) => e.veces },
      { titulo: 'Cumplimiento',     ancho: 18, render: ({ e }) => ICONO_CUMPLIMIENTO[e.cumplimiento as CumplimientoEtapa].label },
    ])
  }

  if (datos.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-white py-16 text-center">
        <CalendarRange size={32} className="mx-auto mb-3 text-slate-200" />
        <p className="text-sm font-medium text-slate-500">Aún no hay requerimientos con fechas de planeación</p>
        <p className="mt-1 text-xs text-slate-400">Regístralas en el detalle del requerimiento → Fechas → Fechas de planeación</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-w-52 flex-1 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2">
          <Search size={13} className="shrink-0 text-slate-400" />
          <input
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar requerimiento..."
            className="flex-1 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
          />
        </div>
        <select
          value={proceso}
          onChange={e => setProceso(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
        >
          <option value="">Todos los procesos</option>
          {PROCESOS_INTERNOS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
        <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
          <input type="checkbox" checked={soloAlertas} onChange={e => setSoloAlertas(e.target.checked)} />
          Solo con alertas
        </label>
        <Button variant="outline" size="sm" onClick={exportar} className="gap-1.5 text-xs">
          <Download size={13} /> Exportar Excel
        </Button>
      </div>

      {/* Filtro de estados (chips multi-selección, como en Cronograma) */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-[11px] font-semibold text-slate-400">Estado:</span>
        <button
          onClick={() => setEstadosFiltro(new Set())}
          className={cn(
            'rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors',
            estadosFiltro.size === 0
              ? 'border-slate-400 bg-slate-700 text-white'
              : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
          )}
        >
          Todos
        </button>
        {estadosDisponibles.map(e => {
          const cfg = getEstadoCfg(e)
          const activo = estadosFiltro.has(e)
          return (
            <button
              key={e}
              onClick={() => toggleEstado(e)}
              className={cn(
                'rounded-full border px-3 py-1 text-[11px] font-semibold transition-all',
                activo
                  ? `${cfg.bgColor} ${cfg.textColor} border-transparent shadow-sm`
                  : 'border-slate-200 bg-white text-slate-400 hover:border-slate-300 hover:text-slate-600'
              )}
            >
              {cfg.label}
            </button>
          )
        })}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi label="Requerimientos planeados" valor={filtrados.length} />
        <Kpi label="Etapas terminadas" valor={terminadas.length} detalle={`de ${etapasPlaneadas.length} planeadas`} />
        <Kpi
          label="Cumplimiento a tiempo"
          valor={terminadas.length ? `${Math.round((aTiempo / terminadas.length) * 100)}%` : '—'}
          detalle={`${aTiempo} de ${terminadas.length} terminadas`}
        />
        <Kpi label="Etapas con alerta" valor={conAlerta} detalle="retrasadas, vencidas o sin iniciar" tono={conAlerta > 0 ? 'alerta' : undefined} />
        <Kpi label="Desviación prom. de fin" valor={formatDesv(desvPromFin)} detalle="en etapas terminadas" tono={(desvPromFin ?? 0) > 0 ? 'alerta' : undefined} />
      </div>

      {/* Gantt planeado vs. ejecutado */}
      <GanttPlaneacion requerimientos={filtrados} />

      {/* Resumen por etapa */}
      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-bold text-slate-800">Cumplimiento por etapa</h2>
          <p className="text-xs text-slate-500">Desviación positiva = la etapa terminó después de lo planeado</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                <th className="px-4 py-2.5">Etapa</th>
                <th className="px-3 py-2.5 text-right">Planeadas</th>
                <th className="px-3 py-2.5 text-right">Terminadas</th>
                <th className="px-3 py-2.5 text-right">A tiempo</th>
                <th className="px-3 py-2.5 text-right">Con retraso</th>
                <th className="px-3 py-2.5 text-right">Vencidas / sin iniciar</th>
                <th className="px-3 py-2.5 text-right">Desv. prom. fin</th>
                <th className="px-3 py-2.5 text-right">Duración prom. plan / real</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 tabular-nums">
              {resumenEtapas.map(r => (
                <tr key={r.estado}>
                  <td className="px-4 py-2.5 font-medium text-slate-700">{r.label}</td>
                  <td className="px-3 py-2.5 text-right text-slate-600">{r.planeadas}</td>
                  <td className="px-3 py-2.5 text-right text-slate-600">{r.terminadas}</td>
                  <td className="px-3 py-2.5 text-right text-emerald-700">{r.aTiempo}</td>
                  <td className={cn('px-3 py-2.5 text-right', r.retrasadas ? 'font-semibold text-red-600' : 'text-slate-400')}>{r.retrasadas}</td>
                  <td className={cn('px-3 py-2.5 text-right', r.enAlerta ? 'font-semibold text-orange-600' : 'text-slate-400')}>{r.enAlerta}</td>
                  <td className="px-3 py-2.5 text-right"><TextoDesv dias={r.desvFin} /></td>
                  <td className="px-3 py-2.5 text-right text-slate-600">
                    {r.durPlan ?? '—'}d / {r.durReal ?? '—'}d
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
