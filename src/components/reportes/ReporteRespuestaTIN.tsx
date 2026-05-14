'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts'
import { Download, Timer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatFecha, cn } from '@/lib/utils'
import { exportarReporte } from '@/lib/exportar'
import { PRIORIDADES, SLA_DIAS } from '@/lib/constants'
import type { MetricaRequerimiento } from '@/lib/supabase/types'

const TooltipSLA = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-md text-xs max-w-xs">
      <p className="mb-1 font-semibold text-slate-700 line-clamp-2">{d.nombre}</p>
      <p>Días respuesta: <span className="font-bold">{d.dias}</span></p>
      <p>SLA límite: {d.slaLimite} días</p>
      <p className={d.cumple ? 'text-emerald-600' : 'text-red-600'}>
        {d.cumple ? '✓ Cumple SLA' : '✗ SLA excedido'}
      </p>
    </div>
  )
}

interface Props {
  datos: MetricaRequerimiento[]
  isLoading: boolean
}

export function ReporteRespuestaTIN({ datos, isLoading }: Props) {
  const conTIN = datos.filter(r => r.fecha_envio_tin && r.fecha_inicio_desarrollo)

  const promedioDias = conTIN.length
    ? conTIN.reduce((s, r) => s + (r.dias_respuesta_tin ?? 0), 0) / conTIN.length
    : 0

  const cumpleSLA  = conTIN.filter(r => r.cumple_sla === true).length
  const pctCumple  = conTIN.length ? Math.round((cumpleSLA / conTIN.length) * 100) : 0
  const minDias = conTIN.length ? Math.min(...conTIN.map(r => r.dias_respuesta_tin ?? 0)) : 0
  const maxDias = conTIN.length ? Math.max(...conTIN.map(r => r.dias_respuesta_tin ?? 0)) : 0

  const chartData = conTIN
    .map(r => ({
      nombre: (r.nombre_desarrollo ?? r.identificacion ?? '').slice(0, 25) + '...',
      dias: r.dias_respuesta_tin ?? 0,
      slaLimite: r.prioridad ? SLA_DIAS[r.prioridad] : 30,
      cumple: r.cumple_sla,
      prioridad: r.prioridad,
    }))
    .sort((a, b) => (b.dias - a.dias))
    .slice(0, 20)

  const exportar = () => {
    exportarReporte('Respuesta_TIN', conTIN, [
      { titulo: '#',                  ancho: 4,  render: (_: any, i: number) => i + 1 },
      { titulo: 'Nombre',             ancho: 50, render: (r: MetricaRequerimiento) => r.nombre_desarrollo ?? r.identificacion },
      { titulo: 'Prioridad',          ancho: 10, render: (r: MetricaRequerimiento) => r.prioridad ? `P${r.prioridad}` : '' },
      { titulo: 'Fecha envío TIN',    ancho: 16, render: (r: MetricaRequerimiento) => formatFecha(r.fecha_envio_tin) },
      { titulo: 'Fecha inicio',       ancho: 16, render: (r: MetricaRequerimiento) => formatFecha(r.fecha_inicio_desarrollo) },
      { titulo: 'Días respuesta',     ancho: 14, render: (r: MetricaRequerimiento) => r.dias_respuesta_tin },
      { titulo: 'SLA límite',         ancho: 10, render: (r: MetricaRequerimiento) => r.prioridad ? SLA_DIAS[r.prioridad] : '' },
      { titulo: 'Cumple SLA',         ancho: 12, render: (r: MetricaRequerimiento) => r.cumple_sla ? 'Sí' : 'No' },
      { titulo: 'Responsable',        ancho: 22, render: (r: MetricaRequerimiento) => r.responsable },
    ])
  }

  if (isLoading) return <Skeleton className="h-80 w-full rounded-xl" />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Timer size={18} className="text-blue-600" />
          <h2 className="text-base font-bold text-slate-800">Tiempos de respuesta TIN</h2>
        </div>
        <Button variant="outline" size="sm" onClick={exportar} className="gap-1.5 text-xs">
          <Download size={13} /> Exportar Excel
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Promedio días respuesta', valor: `${promedioDias.toFixed(1)} días` },
          { label: '% cumple SLA',            valor: `${pctCumple}%`, color: pctCumple >= 80 ? 'text-emerald-600' : 'text-red-600' },
          { label: 'Mínimo días',             valor: `${minDias} días` },
          { label: 'Máximo días',             valor: `${maxDias} días` },
        ].map(({ label, valor, color }) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">{label}</p>
            <p className={cn('mt-1 text-lg font-bold text-slate-800', color)}>{valor}</p>
          </div>
        ))}
      </div>

      {/* SLA por prioridad */}
      <div className="grid grid-cols-4 gap-2">
        {[1, 2, 3, 4].map(p => {
          const conP = conTIN.filter(r => r.prioridad === p)
          const cumpleP = conP.filter(r => r.cumple_sla).length
          const pct = conP.length ? Math.round((cumpleP / conP.length) * 100) : 0
          const cfg = PRIORIDADES[p]
          return (
            <div key={p} className={cn('rounded-xl border p-3', cfg.bgColor, cfg.borderColor)}>
              <p className={cn('text-xs font-bold', cfg.textColor)}>P{p} {cfg.label}</p>
              <p className="mt-0.5 text-xs text-slate-500">SLA: {SLA_DIAS[p]} días</p>
              <p className={cn('text-lg font-bold mt-1', pct >= 80 ? 'text-emerald-600' : 'text-red-600')}>
                {pct}%
              </p>
              <p className="text-xs text-slate-400">{cumpleP} de {conP.length}</p>
            </div>
          )
        })}
      </div>

      {/* Gráfica */}
      {chartData.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="mb-3 text-sm font-semibold text-slate-700">Días de respuesta por requerimiento (top 20)</p>
          <ResponsiveContainer width="100%" height={Math.max(200, chartData.length * 28)}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 40, top: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
              <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis dataKey="nombre" type="category" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} width={140} />
              <Tooltip content={<TooltipSLA />} />
              <Bar dataKey="dias" radius={[0, 4, 4, 0]} maxBarSize={20}>
                {chartData.map((d, i) => (
                  <Cell key={i} fill={d.cumple ? '#22c55e' : '#ef4444'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Tabla */}
      {conTIN.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <p className="border-b border-slate-100 px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Detalle ({conTIN.length} requerimientos con TIN registrado)
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50">
                <tr>
                  {['#', 'Nombre', 'P', 'Envío TIN', 'Inicio Dev.', 'Días', 'SLA', 'Cumple', 'Responsable'].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left font-medium text-slate-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {conTIN.map((r, i) => {
                  const sla = r.prioridad ? SLA_DIAS[r.prioridad] : null
                  return (
                    <tr key={r.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                      <td className="px-3 py-2 text-slate-400">{i + 1}</td>
                      <td className="px-3 py-2 max-w-[180px]">
                        <p className="line-clamp-1 font-medium text-slate-700">{r.nombre_desarrollo ?? r.identificacion}</p>
                      </td>
                      <td className="px-3 py-2">
                        {r.prioridad && (
                          <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-bold', PRIORIDADES[r.prioridad].bgColor, PRIORIDADES[r.prioridad].textColor)}>
                            P{r.prioridad}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-slate-500">{formatFecha(r.fecha_envio_tin)}</td>
                      <td className="px-3 py-2 text-slate-500">{formatFecha(r.fecha_inicio_desarrollo)}</td>
                      <td className="px-3 py-2 font-bold">{r.dias_respuesta_tin ?? '—'}</td>
                      <td className="px-3 py-2 text-slate-400">{sla ?? '—'}</td>
                      <td className="px-3 py-2">
                        {r.cumple_sla === true  && <span className="text-emerald-600 font-bold">✓</span>}
                        {r.cumple_sla === false && <span className="text-red-600 font-bold">✗</span>}
                        {r.cumple_sla === null  && <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-3 py-2 text-slate-500">{r.responsable ?? '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {conTIN.length === 0 && (
        <p className="rounded-xl border border-slate-200 bg-slate-50 py-10 text-center text-sm text-slate-400">
          Sin requerimientos con fecha TIN y fecha de inicio registradas
        </p>
      )}
    </div>
  )
}
