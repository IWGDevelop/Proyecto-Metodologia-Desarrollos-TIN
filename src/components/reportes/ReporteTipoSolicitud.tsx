'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend,
} from 'recharts'
import { Download, Tag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn, formatCOP } from '@/lib/utils'
import { exportarReporte } from '@/lib/exportar'
import { TIPOS_SOLICITUD } from '@/lib/constants'
import type { MetricaRequerimiento } from '@/lib/supabase/types'

interface Props {
  datos: MetricaRequerimiento[]
  isLoading: boolean
}

const TIPO_COLOR: Record<string, string> = {
  NUEVO_DESARROLLO: '#3b82f6',
  MEJORA:           '#8b5cf6',
  INTEGRACION:      '#06b6d4',
  INFORME:          '#f59e0b',
}

const TIPO_BADGE: Record<string, string> = {
  NUEVO_DESARROLLO: 'bg-blue-100 text-blue-700 border-blue-200',
  MEJORA:           'bg-violet-100 text-violet-700 border-violet-200',
  INTEGRACION:      'bg-cyan-100 text-cyan-700 border-cyan-200',
  INFORME:          'bg-amber-100 text-amber-700 border-amber-200',
}

function tipoLabel(v: string) {
  return TIPOS_SOLICITUD.find(t => t.value === v)?.label ?? v
}

export function ReporteTipoSolicitud({ datos, isLoading }: Props) {
  if (isLoading) return <Skeleton className="h-80 w-full rounded-xl" />

  const activos = datos.filter(r => !r.es_borrador)

  // Agrupar por tipo_solicitud
  const grupos = new Map<string, { cantidad: number; horas: number; impacto: number }>()
  for (const r of activos) {
    const k = r.tipo_solicitud ?? 'SIN_TIPO'
    const prev = grupos.get(k) ?? { cantidad: 0, horas: 0, impacto: 0 }
    grupos.set(k, {
      cantidad: prev.cantidad + 1,
      horas:    prev.horas + ((r as any).horas_estimadas_desarrollo ?? 0),
      impacto:  prev.impacto + ((r as any).impacto_economico_total_anual ?? 0),
    })
  }

  const tiposConocidos = TIPOS_SOLICITUD.map(t => ({
    tipo:     t.value,
    label:    t.label,
    cantidad: grupos.get(t.value)?.cantidad ?? 0,
    horas:    grupos.get(t.value)?.horas ?? 0,
    impacto:  grupos.get(t.value)?.impacto ?? 0,
    color:    TIPO_COLOR[t.value] ?? '#94a3b8',
  })).filter(t => t.cantidad > 0)

  const sinTipo = grupos.get('SIN_TIPO')?.cantidad ?? 0
  const total = activos.length

  const exportar = () => {
    exportarReporte('Tipo_Solicitud', activos, [
      { titulo: '#',             ancho: 4,  render: (_: any, i: number) => i + 1 },
      { titulo: 'Nombre',        ancho: 50, render: (r: MetricaRequerimiento) => r.nombre_desarrollo ?? r.identificacion },
      { titulo: 'Tipo solicitud',ancho: 20, render: (r: MetricaRequerimiento) => tipoLabel(r.tipo_solicitud ?? '') },
      { titulo: 'Estado',        ancho: 18, render: (r: MetricaRequerimiento) => r.estado },
      { titulo: 'Alcance',       ancho: 8,  render: (r: MetricaRequerimiento) => r.alcance },
      { titulo: 'Proceso',       ancho: 20, render: (r: MetricaRequerimiento) => (r as any).proceso_interno ?? '' },
      { titulo: 'Horas est.',    ancho: 12, render: (r: MetricaRequerimiento) => (r as any).horas_estimadas_desarrollo ?? '' },
      { titulo: 'Impacto anual', ancho: 20, render: (r: MetricaRequerimiento) => (r as any).impacto_economico_total_anual ?? '' },
    ])
  }

  return (
    <div className="space-y-4">
      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Tag size={18} className="text-blue-600" />
          <h2 className="text-base font-bold text-slate-800">Distribución por tipo de solicitud</h2>
        </div>
        <Button variant="outline" size="sm" onClick={exportar} className="gap-1.5 text-xs">
          <Download size={13} /> Exportar Excel
        </Button>
      </div>

      {/* KPI cards por tipo */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiposConocidos.map(t => (
          <div key={t.tipo} className="rounded-xl border border-slate-200 bg-white p-4">
            <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium mb-2', TIPO_BADGE[t.tipo] ?? 'bg-slate-100 text-slate-600 border-slate-200')}>
              {t.label}
            </span>
            <p className="text-2xl font-extrabold text-slate-800">{t.cantidad}</p>
            <p className="text-xs text-slate-400">
              {total > 0 ? Math.round((t.cantidad / total) * 100) : 0}% del total
            </p>
            {t.horas > 0 && (
              <p className="mt-1 text-xs font-semibold text-indigo-600">{t.horas.toLocaleString('es-CO')} h estimadas</p>
            )}
            {t.impacto > 0 && (
              <p className="text-xs font-semibold text-emerald-600">{formatCOP(t.impacto)}/año</p>
            )}
          </div>
        ))}
        {sinTipo > 0 && (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4">
            <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs font-medium text-slate-500 mb-2">
              Sin clasificar
            </span>
            <p className="text-2xl font-extrabold text-slate-400">{sinTipo}</p>
            <p className="text-xs text-slate-400">sin tipo asignado</p>
          </div>
        )}
      </div>

      {tiposConocidos.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Gráfico de barras — cantidad */}
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="mb-3 text-sm font-semibold text-slate-700">Cantidad de requerimientos por tipo</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={tiposConocidos} margin={{ left: 0, right: 16, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip formatter={(v: unknown) => [`${Number(v)}`, 'Requerimientos']} />
                <Bar dataKey="cantidad" radius={[6, 6, 0, 0]} maxBarSize={48}>
                  {tiposConocidos.map((t, i) => (
                    <Cell key={i} fill={t.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Gráfico de torta */}
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="mb-3 text-sm font-semibold text-slate-700">Proporción por tipo</p>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={tiposConocidos}
                  dataKey="cantidad"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  outerRadius={70}
                  label={({ label, percent }) => `${label} ${Math.round((percent ?? 0) * 100)}%`}
                  labelLine={false}
                >
                  {tiposConocidos.map((t, i) => (
                    <Cell key={i} fill={t.color} />
                  ))}
                </Pie>
                <Legend
                  formatter={(value) => <span className="text-xs text-slate-600">{value}</span>}
                />
                <Tooltip formatter={(v: unknown) => [`${Number(v)}`, 'Requerimientos']} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Gráfico horas estimadas */}
          {tiposConocidos.some(t => t.horas > 0) && (
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="mb-3 text-sm font-semibold text-slate-700">Horas de desarrollo estimadas por tipo</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={tiposConocidos.filter(t => t.horas > 0)} margin={{ left: 0, right: 16, top: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v: unknown) => [`${Number(v).toLocaleString('es-CO')} h`, 'Horas estimadas']} />
                  <Bar dataKey="horas" radius={[6, 6, 0, 0]} maxBarSize={48}>
                    {tiposConocidos.filter(t => t.horas > 0).map((t, i) => (
                      <Cell key={i} fill={t.color} fillOpacity={0.8} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Gráfico impacto económico */}
          {tiposConocidos.some(t => t.impacto > 0) && (
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="mb-3 text-sm font-semibold text-slate-700">Impacto económico anual por tipo</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={tiposConocidos.filter(t => t.impacto > 0)} margin={{ left: 0, right: 16, top: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false}
                    tickFormatter={(v) => `$${(v / 1_000_000).toFixed(0)}M`} />
                  <Tooltip formatter={(v: unknown) => [formatCOP(Number(v)), 'Impacto anual']} />
                  <Bar dataKey="impacto" radius={[6, 6, 0, 0]} maxBarSize={48}>
                    {tiposConocidos.filter(t => t.impacto > 0).map((t, i) => (
                      <Cell key={i} fill={t.color} fillOpacity={0.75} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Tabla detalle */}
      {tiposConocidos.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <p className="border-b border-slate-100 px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Resumen por tipo
          </p>
          <table className="w-full text-xs">
            <thead className="bg-slate-50">
              <tr>
                {['Tipo', 'Requerimientos', '% del total', 'Horas estimadas', 'Impacto anual'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left font-medium text-slate-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {tiposConocidos.map(t => (
                <tr key={t.tipo}>
                  <td className="px-4 py-2.5">
                    <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium', TIPO_BADGE[t.tipo] ?? 'bg-slate-100 text-slate-600 border-slate-200')}>
                      {t.label}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 font-bold text-slate-700">{t.cantidad}</td>
                  <td className="px-4 py-2.5 text-slate-500">{total > 0 ? Math.round((t.cantidad / total) * 100) : 0}%</td>
                  <td className="px-4 py-2.5 font-semibold text-indigo-600">
                    {t.horas > 0 ? `${t.horas.toLocaleString('es-CO')} h` : '—'}
                  </td>
                  <td className="px-4 py-2.5 font-semibold text-emerald-600">
                    {t.impacto > 0 ? formatCOP(t.impacto) : '—'}
                  </td>
                </tr>
              ))}
              {sinTipo > 0 && (
                <tr className="bg-slate-50/50">
                  <td className="px-4 py-2.5 text-slate-400 italic">Sin clasificar</td>
                  <td className="px-4 py-2.5 text-slate-400">{sinTipo}</td>
                  <td className="px-4 py-2.5 text-slate-400">{total > 0 ? Math.round((sinTipo / total) * 100) : 0}%</td>
                  <td className="px-4 py-2.5 text-slate-300">—</td>
                  <td className="px-4 py-2.5 text-slate-300">—</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {activos.length === 0 && (
        <div className="rounded-xl border border-slate-200 bg-white py-12 text-center text-sm text-slate-400">
          Sin datos en el período seleccionado
        </div>
      )}
    </div>
  )
}
