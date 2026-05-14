'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts'
import { Download, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatFecha, cn } from '@/lib/utils'
import { exportarReporte } from '@/lib/exportar'
import { ESTADOS } from '@/lib/constants'
import type { MetricaRequerimiento, Estado } from '@/lib/supabase/types'

interface Props {
  datos: MetricaRequerimiento[]
  isLoading: boolean
}

export function ReporteDesarrollo({ datos, isLoading }: Props) {
  const conDesarrollo = datos.filter(
    r => r.fecha_inicio_desarrollo && r.fecha_estimada_entrega
  )

  const conEntrega = conDesarrollo.filter(r => r.fecha_real_entrega)

  const calcDesvio = (r: MetricaRequerimiento): number | null => {
    if (!r.fecha_real_entrega || !r.fecha_estimada_entrega) return null
    const real = new Date(r.fecha_real_entrega).getTime()
    const estimada = new Date(r.fecha_estimada_entrega).getTime()
    return Math.round((real - estimada) / 86_400_000)
  }

  const entregadosTiempo = conEntrega.filter(r => (calcDesvio(r) ?? 0) <= 0).length
  const pctTiempo = conEntrega.length ? Math.round((entregadosTiempo / conEntrega.length) * 100) : 0
  const desvios = conEntrega.map(r => calcDesvio(r) ?? 0)
  const promedioDesvio = desvios.length ? desvios.reduce((a, b) => a + b, 0) / desvios.length : 0
  const promedioDias = conDesarrollo.length
    ? conDesarrollo.reduce((s, r) => s + (r.dias_desarrollo ?? 0), 0) / conDesarrollo.length
    : 0

  const chartData = conEntrega
    .map(r => {
      const desvio = calcDesvio(r) ?? 0
      return {
        nombre: (r.nombre_desarrollo ?? r.identificacion ?? '').slice(0, 25) + '...',
        desvio,
        cumple: desvio <= 0,
      }
    })
    .sort((a, b) => b.desvio - a.desvio)
    .slice(0, 20)

  const exportar = () => {
    exportarReporte('Tiempos_Desarrollo', conDesarrollo, [
      { titulo: '#',                   ancho: 4,  render: (_: any, i: number) => i + 1 },
      { titulo: 'Nombre',              ancho: 50, render: (r: MetricaRequerimiento) => r.nombre_desarrollo ?? r.identificacion },
      { titulo: 'Responsable',         ancho: 22, render: (r: MetricaRequerimiento) => r.responsable },
      { titulo: 'Inicio desarrollo',   ancho: 18, render: (r: MetricaRequerimiento) => formatFecha(r.fecha_inicio_desarrollo) },
      { titulo: 'Fecha estimada',      ancho: 16, render: (r: MetricaRequerimiento) => formatFecha(r.fecha_estimada_entrega) },
      { titulo: 'Fecha real',          ancho: 16, render: (r: MetricaRequerimiento) => formatFecha(r.fecha_real_entrega) },
      { titulo: 'Días planificados',   ancho: 16, render: (r: MetricaRequerimiento) => r.dias_desarrollo },
      { titulo: 'Desvío (días)',        ancho: 14, render: (r: MetricaRequerimiento) => calcDesvio(r) },
      { titulo: 'Estado',              ancho: 16, render: (r: MetricaRequerimiento) => ESTADOS[r.estado as Estado]?.label },
    ])
  }

  if (isLoading) return <Skeleton className="h-80 w-full rounded-xl" />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock size={18} className="text-indigo-600" />
          <h2 className="text-base font-bold text-slate-800">Tiempos de desarrollo y puntualidad</h2>
        </div>
        <Button variant="outline" size="sm" onClick={exportar} className="gap-1.5 text-xs">
          <Download size={13} /> Exportar Excel
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { label: '% entregados a tiempo', valor: `${pctTiempo}%`,                   color: pctTiempo >= 80 ? 'text-emerald-600' : 'text-red-600' },
          { label: 'Promedio días de desvío', valor: `${promedioDesvio > 0 ? '+' : ''}${promedioDesvio.toFixed(1)} días`, color: promedioDesvio <= 0 ? 'text-emerald-600' : 'text-red-600' },
          { label: 'Promedio días desarrollo', valor: `${promedioDias.toFixed(1)} días`, color: 'text-slate-700' },
        ].map(({ label, valor, color }) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">{label}</p>
            <p className={cn('mt-1 text-lg font-bold', color)}>{valor}</p>
          </div>
        ))}
      </div>

      {chartData.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="mb-3 text-sm font-semibold text-slate-700">Desvío en días por requerimiento entregado</p>
          <p className="mb-2 text-xs text-slate-400">Verde = a tiempo o adelantado · Rojo = con retraso</p>
          <ResponsiveContainer width="100%" height={Math.max(200, chartData.length * 26)}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 40, top: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
              <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis dataKey="nombre" type="category" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} width={140} />
              <Tooltip formatter={(v: unknown) => { const n = Number(v); return [`${n > 0 ? '+' : ''}${n} días`, 'Desvío'] }} />
              <ReferenceLine x={0} stroke="#94a3b8" strokeDasharray="4 4" />
              <Bar dataKey="desvio" radius={4} maxBarSize={20}>
                {chartData.map((d, i) => (
                  <Cell key={i} fill={d.cumple ? '#22c55e' : '#ef4444'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {conDesarrollo.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <p className="border-b border-slate-100 px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Detalle ({conDesarrollo.length})
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50">
                <tr>
                  {['#', 'Nombre', 'Responsable', 'Inicio', 'Estimada', 'Real', 'Días plan.', 'Desvío', 'Estado'].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left font-medium text-slate-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {conDesarrollo.map((r, i) => {
                  const desvio = calcDesvio(r)
                  return (
                    <tr key={r.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                      <td className="px-3 py-2 text-slate-400">{i + 1}</td>
                      <td className="px-3 py-2 max-w-[180px]"><p className="line-clamp-1 font-medium text-slate-700">{r.nombre_desarrollo ?? r.identificacion}</p></td>
                      <td className="px-3 py-2 text-slate-500">{r.responsable ?? '—'}</td>
                      <td className="px-3 py-2 text-slate-500">{formatFecha(r.fecha_inicio_desarrollo)}</td>
                      <td className="px-3 py-2 text-slate-500">{formatFecha(r.fecha_estimada_entrega)}</td>
                      <td className="px-3 py-2 text-slate-500">{formatFecha(r.fecha_real_entrega) ?? '—'}</td>
                      <td className="px-3 py-2 text-slate-600">{r.dias_desarrollo ?? '—'}</td>
                      <td className="px-3 py-2">
                        {desvio !== null
                          ? <span className={cn('font-bold', desvio <= 0 ? 'text-emerald-600' : 'text-red-600')}>
                              {desvio > 0 ? '+' : ''}{desvio}d
                            </span>
                          : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-3 py-2">
                        <span className={cn('rounded-full px-1.5 py-0.5 text-[10px]', ESTADOS[r.estado as Estado]?.bgColor, ESTADOS[r.estado as Estado]?.textColor)}>
                          {ESTADOS[r.estado as Estado]?.label}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
