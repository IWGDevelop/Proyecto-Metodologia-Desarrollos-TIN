'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { Download, BarChart2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCOP, cn } from '@/lib/utils'
import { exportarReporte } from '@/lib/exportar'
import { ESTADOS, PROCESOS_INTERNOS } from '@/lib/constants'
import type { MetricaRequerimiento, Estado } from '@/lib/supabase/types'

const ESTADO_COLORS: Record<string, string> = {
  SIN_GESTION:          '#94a3b8',
  ANALISIS:             '#3b82f6',
  EN_DEFINICION_USUARIO:'#a855f7',
  EN_DESARROLLO:        '#6366f1',
  PRUEBAS_USUARIO:      '#f59e0b',
  STAND_BY:             '#f97316',
  ENTREGADO:            '#22c55e',
  CERRADO:              '#6b7280',
}

const ESTADOS_KANBAN: string[] = [
  'SIN_GESTION', 'ANALISIS', 'EN_DEFINICION_USUARIO',
  'EN_DESARROLLO', 'PRUEBAS_USUARIO', 'STAND_BY', 'ENTREGADO',
]

interface Props {
  datos: MetricaRequerimiento[]
  isLoading: boolean
}

export function ReporteProductividad({ datos, isLoading }: Props) {
  const procesos = PROCESOS_INTERNOS.filter(p =>
    datos.some(r => r.proceso_interno === p.value)
  )

  const chartData = procesos.map(p => {
    const enProceso = datos.filter(r => r.proceso_interno === p.value)
    const entry: Record<string, any> = { proceso: p.label }
    ESTADOS_KANBAN.forEach(e => {
      entry[e] = enProceso.filter(r => r.estado === e).length
    })
    entry._total = enProceso.length
    return entry
  })

  const tablaData = procesos.map(p => {
    const enProceso = datos.filter(r => r.proceso_interno === p.value)
    const entregados = enProceso.filter(r => r.estado === 'ENTREGADO' || r.estado === 'CERRADO').length
    const ahorroTotal = enProceso.reduce((s, r) => s + (r.ahorro_anual_cop ?? 0), 0)
    return {
      proceso: p.label,
      total: enProceso.length,
      enDesarrollo: enProceso.filter(r => r.estado === 'EN_DESARROLLO').length,
      enPruebas: enProceso.filter(r => r.estado === 'PRUEBAS_USUARIO').length,
      standBy: enProceso.filter(r => r.estado === 'STAND_BY').length,
      entregados,
      pctCompletados: enProceso.length ? Math.round((entregados / enProceso.length) * 100) : 0,
      ahorroTotal,
    }
  }).sort((a, b) => b.total - a.total)

  const exportar = () => {
    exportarReporte('Productividad_Area', tablaData, [
      { titulo: 'Proceso',            ancho: 22, render: (r: typeof tablaData[0]) => r.proceso },
      { titulo: 'Total',              ancho: 8,  render: (r: typeof tablaData[0]) => r.total },
      { titulo: 'En desarrollo',      ancho: 14, render: (r: typeof tablaData[0]) => r.enDesarrollo },
      { titulo: 'En pruebas',         ancho: 12, render: (r: typeof tablaData[0]) => r.enPruebas },
      { titulo: 'Stand by',           ancho: 10, render: (r: typeof tablaData[0]) => r.standBy },
      { titulo: 'Entregados',         ancho: 12, render: (r: typeof tablaData[0]) => r.entregados },
      { titulo: '% completados',      ancho: 14, render: (r: typeof tablaData[0]) => `${r.pctCompletados}%` },
      { titulo: 'Ahorro total COP',   ancho: 20, render: (r: typeof tablaData[0]) => r.ahorroTotal },
    ])
  }

  if (isLoading) return <Skeleton className="h-80 w-full rounded-xl" />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart2 size={18} className="text-violet-600" />
          <h2 className="text-base font-bold text-slate-800">Productividad por área</h2>
        </div>
        <Button variant="outline" size="sm" onClick={exportar} className="gap-1.5 text-xs">
          <Download size={13} /> Exportar Excel
        </Button>
      </div>

      {/* Gráfica apilada horizontal */}
      {chartData.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="mb-3 text-sm font-semibold text-slate-700">Distribución por estado y proceso</p>
          <ResponsiveContainer width="100%" height={Math.max(240, chartData.length * 40)}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 8, top: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
              <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis dataKey="proceso" type="category" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} width={110} />
              <Tooltip
                formatter={(value: unknown, name: unknown) => [String(value), ESTADOS[name as Estado]?.label ?? String(name)]}
                contentStyle={{ fontSize: 11 }}
              />
              <Legend
                formatter={name => ESTADOS[name as Estado]?.label ?? name}
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: 10 }}
              />
              {ESTADOS_KANBAN.map(estado => (
                <Bar
                  key={estado}
                  dataKey={estado}
                  stackId="a"
                  fill={ESTADO_COLORS[estado] ?? '#94a3b8'}
                  maxBarSize={32}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Tabla resumen */}
      {tablaData.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <p className="border-b border-slate-100 px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Resumen por área
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50">
                <tr>
                  {['Proceso', 'Total', 'En desarrollo', 'En pruebas', 'Stand by', 'Entregados', '% completado', 'Ahorro anual'].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left font-medium text-slate-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {tablaData.map((r, i) => (
                  <tr key={r.proceso} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                    <td className="px-3 py-2.5 font-medium text-slate-700">{r.proceso}</td>
                    <td className="px-3 py-2.5 font-bold text-slate-800">{r.total}</td>
                    <td className="px-3 py-2.5 text-indigo-600 font-medium">{r.enDesarrollo}</td>
                    <td className="px-3 py-2.5 text-amber-600 font-medium">{r.enPruebas}</td>
                    <td className="px-3 py-2.5 text-orange-600 font-medium">{r.standBy}</td>
                    <td className="px-3 py-2.5 text-emerald-600 font-medium">{r.entregados}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <div className="h-1.5 w-16 rounded-full bg-slate-200">
                          <div
                            className={cn('h-1.5 rounded-full', r.pctCompletados >= 70 ? 'bg-emerald-500' : 'bg-amber-400')}
                            style={{ width: `${r.pctCompletados}%` }}
                          />
                        </div>
                        <span className="font-medium">{r.pctCompletados}%</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 font-semibold text-emerald-600">
                      {r.ahorroTotal > 0 ? formatCOP(r.ahorroTotal) : <span className="text-slate-300">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {chartData.length === 0 && (
        <p className="rounded-xl border border-slate-200 bg-slate-50 py-10 text-center text-sm text-slate-400">
          Sin requerimientos con proceso interno registrado
        </p>
      )}
    </div>
  )
}
