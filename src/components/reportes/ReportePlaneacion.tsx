'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Download, Search, CheckCircle2, AlertTriangle, Clock, PlayCircle, CircleDashed,
  SkipForward, CalendarX, Minus, ExternalLink, ChevronDown, ChevronRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { exportarReporte } from '@/lib/exportar'
import { getEstadoCfg, PROCESOS_INTERNOS } from '@/lib/constants'
import { ETAPAS_PLANEACION } from '@/lib/etapas-planeacion'
import type { CumplimientoEtapa, EtapaReporte, RequerimientoPlaneacion } from '@/actions/reporte-planeacion'

interface Props {
  datos: RequerimientoPlaneacion[]
}

const CUMPLIMIENTO: Record<CumplimientoEtapa, {
  label: string
  Icon: React.ElementType
  badge: string
  barra: string
}> = {
  A_TIEMPO:        { label: 'A tiempo',        Icon: CheckCircle2,  badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', barra: 'bg-emerald-500' },
  RETRASADA:       { label: 'Con retraso',     Icon: AlertTriangle, badge: 'bg-red-50 text-red-700 border-red-200',             barra: 'bg-red-500' },
  EN_CURSO:        { label: 'En curso',        Icon: PlayCircle,    badge: 'bg-blue-50 text-blue-700 border-blue-200',          barra: 'bg-blue-500' },
  VENCIDA:         { label: 'En curso vencida', Icon: CalendarX,    badge: 'bg-orange-50 text-orange-700 border-orange-200',    barra: 'bg-orange-500' },
  INICIO_ATRASADO: { label: 'Inicio atrasado', Icon: Clock,         badge: 'bg-amber-50 text-amber-700 border-amber-200',       barra: 'bg-amber-500' },
  PENDIENTE:       { label: 'Pendiente',       Icon: CircleDashed,  badge: 'bg-slate-50 text-slate-600 border-slate-200',       barra: 'bg-slate-400' },
  OMITIDA:         { label: 'No ejecutada',    Icon: SkipForward,   badge: 'bg-slate-50 text-slate-500 border-slate-200',       barra: 'bg-slate-300' },
  SIN_PLAN:        { label: 'Sin planear',     Icon: Minus,         badge: 'bg-white text-slate-400 border-slate-200',          barra: 'bg-slate-300' },
}

const CON_ALERTA: CumplimientoEtapa[] = ['RETRASADA', 'VENCIDA', 'INICIO_ATRASADO']

function formatFecha(d: string | null): string {
  if (!d) return '—'
  try {
    return new Date(d + 'T12:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch { return d }
}

function formatDesv(dias: number | null): string {
  if (dias === null) return '—'
  if (dias === 0) return '0d'
  return dias > 0 ? `+${dias}d` : `${dias}d`
}

const promedio = (xs: number[]) => xs.length ? Math.round(xs.reduce((s, x) => s + x, 0) / xs.length) : null

function BadgeCumplimiento({ c }: { c: CumplimientoEtapa }) {
  const cfg = CUMPLIMIENTO[c]
  return (
    <span className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded border px-1.5 py-0.5 text-[10px] font-semibold', cfg.badge)}>
      <cfg.Icon size={10} /> {cfg.label}
    </span>
  )
}

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

/* ── Línea de tiempo planeado vs. ejecutado de un requerimiento ─────────── */
function TimelineRequerimiento({ etapas }: { etapas: EtapaReporte[] }) {
  const hoy = new Date().toISOString().slice(0, 10)
  const fechas = etapas
    .flatMap(e => [e.planInicio, e.planFin, e.realInicio, e.realFin, e.enCurso ? hoy : null])
    .filter((d): d is string => !!d)
    .sort()
  if (fechas.length === 0) return null

  const min = new Date(fechas[0] + 'T12:00:00').getTime()
  const max = Math.max(new Date(fechas[fechas.length - 1] + 'T12:00:00').getTime(), min + 86400000)
  const pos = (d: string) => ((new Date(d + 'T12:00:00').getTime() - min) / (max - min)) * 100
  const hoyPct = pos(hoy)

  const Barra = ({ desde, hasta, clase, titulo }: { desde: string; hasta: string; clase: string; titulo: string }) => {
    const left = pos(desde)
    const width = Math.max(pos(hasta) - left, 0.8)
    return (
      <div
        title={titulo}
        className={cn('absolute h-full rounded-[4px]', clase)}
        style={{ left: `${left}%`, width: `${width}%` }}
      />
    )
  }

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between pl-44 text-[10px] text-slate-400">
        <span>{formatFecha(fechas[0])}</span>
        <span>{formatFecha(fechas[fechas.length - 1])}</span>
      </div>
      {etapas.map(e => {
        const realHasta = e.enCurso ? hoy : e.realFin ?? e.realInicio
        return (
          <div key={e.estado} className="flex items-center gap-2">
            <span className="w-42 shrink-0 truncate text-[11px] text-slate-600" title={e.label}>{e.label}</span>
            <div className="relative h-7 flex-1 rounded bg-slate-50">
              {hoyPct >= 0 && hoyPct <= 100 && (
                <div className="absolute inset-y-0 w-px bg-blue-300" style={{ left: `${hoyPct}%` }} title="Hoy" />
              )}
              {/* Planeado: franja superior */}
              {(e.planInicio || e.planFin) && (
                <div className="absolute inset-x-0 top-1 h-2">
                  <Barra
                    desde={(e.planInicio ?? e.planFin)!}
                    hasta={(e.planFin ?? e.planInicio)!}
                    clase="bg-slate-300"
                    titulo={`Planeado: ${formatFecha(e.planInicio)} → ${formatFecha(e.planFin)}`}
                  />
                </div>
              )}
              {/* Ejecutado: franja inferior */}
              {e.realInicio && realHasta && (
                <div className="absolute inset-x-0 bottom-1 h-2.5">
                  <Barra
                    desde={e.realInicio}
                    hasta={realHasta}
                    clase={CUMPLIMIENTO[e.cumplimiento].barra}
                    titulo={`Ejecutado: ${formatFecha(e.realInicio)} → ${e.enCurso ? 'en curso' : formatFecha(e.realFin)} · ${CUMPLIMIENTO[e.cumplimiento].label}`}
                  />
                </div>
              )}
            </div>
          </div>
        )
      })}
      <div className="flex flex-wrap items-center gap-4 pl-44 pt-1 text-[10px] text-slate-500">
        <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded-sm bg-slate-300" /> Planeado</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-sm bg-emerald-500" /> Ejecutado (color = cumplimiento)</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-px bg-blue-300" /> Hoy</span>
      </div>
    </div>
  )
}

/* ── Fila expandible por requerimiento ─────────────────────────────────── */
function FilaRequerimiento({ req }: { req: RequerimientoPlaneacion }) {
  const [abierto, setAbierto] = useState(false)
  const estadoCfg = getEstadoCfg(req.estado)
  const planeadas = req.etapas.filter(e => e.cumplimiento !== 'SIN_PLAN')
  const alertas = planeadas.filter(e => CON_ALERTA.includes(e.cumplimiento)).length
  const desvTotal = planeadas.reduce((s, e) => s + Math.max(e.desvFin ?? 0, 0), 0)

  return (
    <div className="border-b border-slate-100 last:border-b-0">
      <button
        onClick={() => setAbierto(a => !a)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50"
      >
        {abierto ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-700">
            {req.numero && <span className="mr-1.5 font-mono text-xs text-slate-400">#{req.numero}</span>}
            {req.nombre}
          </p>
          <div className="mt-1 flex flex-wrap gap-1">
            {req.etapas.map(e => (
              <span
                key={e.estado}
                title={`${e.label}: ${CUMPLIMIENTO[e.cumplimiento].label}`}
                className={cn('h-1.5 w-6 rounded-full', e.cumplimiento === 'SIN_PLAN' ? 'bg-slate-100' : CUMPLIMIENTO[e.cumplimiento].barra)}
              />
            ))}
          </div>
        </div>
        <span className={cn('hidden rounded-full px-2.5 py-0.5 text-[11px] font-semibold sm:inline', estadoCfg.bgColor, estadoCfg.textColor)}>
          {estadoCfg.label}
        </span>
        <div className="w-24 text-right text-xs">
          {alertas > 0
            ? <span className="font-semibold text-red-600">{alertas} con alerta</span>
            : <span className="text-emerald-600">Sin alertas</span>}
          {desvTotal > 0 && <p className="text-[10px] text-slate-400">+{desvTotal}d acumulados</p>}
        </div>
      </button>

      {abierto && (
        <div className="space-y-4 bg-slate-50/40 px-4 pb-5 pt-2">
          <div className="overflow-x-auto">
            <TimelineRequerimiento etapas={req.etapas} />
          </div>
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full min-w-[820px] text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  <th className="px-3 py-2">Etapa</th>
                  <th className="px-3 py-2">Planeado</th>
                  <th className="px-3 py-2">Ejecutado</th>
                  <th className="px-3 py-2 text-right">Desv. inicio</th>
                  <th className="px-3 py-2 text-right">Desv. fin</th>
                  <th className="px-3 py-2 text-right">Duración plan / real</th>
                  <th className="px-3 py-2">Cumplimiento</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {req.etapas.map(e => (
                  <tr key={e.estado}>
                    <td className="px-3 py-2 font-medium text-slate-700">
                      {e.label}
                      {e.veces > 1 && <span className="ml-1.5 text-[10px] text-amber-600">({e.veces} ingresos)</span>}
                    </td>
                    <td className="px-3 py-2 text-slate-600">{formatFecha(e.planInicio)} → {formatFecha(e.planFin)}</td>
                    <td className="px-3 py-2 text-slate-600">
                      {e.realInicio ? <>{formatFecha(e.realInicio)} → {e.enCurso ? 'en curso' : formatFecha(e.realFin)}</> : '—'}
                    </td>
                    <td className="px-3 py-2 text-right"><TextoDesv dias={e.desvInicio} /></td>
                    <td className="px-3 py-2 text-right"><TextoDesv dias={e.desvFin} /></td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-600">
                      {e.duracionPlan ?? '—'}d / {e.duracionReal ?? '—'}d
                    </td>
                    <td className="px-3 py-2"><BadgeCumplimiento c={e.cumplimiento} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Link
            href={`/admin/requerimientos/${req.id}`}
            className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
          >
            Ver requerimiento <ExternalLink size={11} />
          </Link>
        </div>
      )}
    </div>
  )
}

export function ReportePlaneacion({ datos }: Props) {
  const [busqueda, setBusqueda] = useState('')
  const [proceso, setProceso] = useState('')
  const [soloAlertas, setSoloAlertas] = useState(false)

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return datos.filter(r =>
      (!q || r.nombre.toLowerCase().includes(q) || (r.numero ?? '').toLowerCase().includes(q)) &&
      (!proceso || r.proceso_interno === proceso) &&
      (!soloAlertas || r.etapas.some(e => CON_ALERTA.includes(e.cumplimiento)))
    )
  }, [datos, busqueda, proceso, soloAlertas])

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
      { titulo: 'Cumplimiento',     ancho: 18, render: ({ e }) => CUMPLIMIENTO[e.cumplimiento as CumplimientoEtapa].label },
    ])
  }

  if (datos.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-white py-16 text-center">
        <p className="text-sm font-medium text-slate-500">Aún no hay requerimientos con fechas de planeación</p>
        <p className="mt-1 text-xs text-slate-400">Regístralas en el detalle del requerimiento → Fechas → Fechas de planeación</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar requerimiento..."
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
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
        <Button variant="outline" size="sm" onClick={exportar} className="ml-auto gap-1.5 text-xs">
          <Download size={13} /> Exportar Excel
        </Button>
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

      {/* Detalle por requerimiento */}
      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
          <div>
            <h2 className="text-sm font-bold text-slate-800">Planeado vs. ejecutado por requerimiento</h2>
            <p className="text-xs text-slate-500">Despliega un requerimiento para ver su línea de tiempo por etapa</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(CUMPLIMIENTO) as CumplimientoEtapa[]).filter(c => c !== 'SIN_PLAN').map(c => (
              <BadgeCumplimiento key={c} c={c} />
            ))}
          </div>
        </div>
        {filtrados.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-400">Ningún requerimiento coincide con los filtros</p>
        ) : (
          filtrados.map(r => <FilaRequerimiento key={r.id} req={r} />)
        )}
      </div>
    </div>
  )
}
