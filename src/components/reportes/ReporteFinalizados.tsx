'use client'

import { useState, useMemo, useEffect } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { CheckCircle2, Download } from 'lucide-react'
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

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

function getAñoActual() {
  return new Date().getFullYear()
}

export function ReporteFinalizados({ datos, isLoading }: Props) {
  const añosDisponibles = useMemo(() => {
    const set = new Set<number>()
    datos.forEach(r => {
      const fecha = r.fecha_real_entrega ?? r.fecha_salida_vivo
      if (fecha) set.add(new Date(fecha + 'T12:00:00').getFullYear())
    })
    const actual = getAñoActual()
    for (let y = actual - 2; y <= actual + 1; y++) set.add(y)
    return [...set].sort((a, b) => b - a)
  }, [datos])

  const añoConMasDatos = useMemo(() => {
    const conteo: Record<number, number> = {}
    datos.forEach(r => {
      const fecha = r.fecha_real_entrega ?? r.fecha_salida_vivo
      if (fecha) {
        const y = new Date(fecha + 'T12:00:00').getFullYear()
        conteo[y] = (conteo[y] ?? 0) + 1
      }
    })
    const entradas = Object.entries(conteo)
    if (!entradas.length) return getAñoActual()
    return Number(entradas.sort((a, b) => Number(b[1]) - Number(a[1]))[0][0])
  }, [datos])

  const [año, setAño] = useState(getAñoActual())

  useEffect(() => {
    if (!isLoading) setAño(añoConMasDatos)
  }, [añoConMasDatos, isLoading])

  const finalizados = useMemo(() => {
    return datos
      .filter(r => {
        const fecha = r.fecha_real_entrega ?? r.fecha_salida_vivo
        if (!fecha) return false
        return new Date(fecha + 'T12:00:00').getFullYear() === año
      })
      .sort((a, b) => {
        const fa = a.fecha_real_entrega ?? a.fecha_salida_vivo ?? ''
        const fb = b.fecha_real_entrega ?? b.fecha_salida_vivo ?? ''
        return fb.localeCompare(fa)
      })
  }, [datos, año])

  const porMes = useMemo(() => {
    const mapa: Record<number, number> = {}
    finalizados.forEach(r => {
      const fecha = r.fecha_real_entrega ?? r.fecha_salida_vivo!
      const mes = new Date(fecha + 'T12:00:00').getMonth()
      mapa[mes] = (mapa[mes] ?? 0) + 1
    })
    return MESES.map((label, i) => ({ label, mes: i + 1, cantidad: mapa[i] ?? 0 }))
  }, [finalizados])

  const promedioDias = useMemo(() => {
    const conDias = finalizados.filter(r => r.dias_desarrollo != null && r.dias_desarrollo > 0)
    if (!conDias.length) return null
    return Math.round(conDias.reduce((s, r) => s + (r.dias_desarrollo ?? 0), 0) / conDias.length)
  }, [finalizados])

  const exportar = () => {
    exportarReporte(`Finalizados_${año}`, finalizados, [
      { titulo: '#',              ancho: 4,  render: (_: any, i: number) => i + 1 },
      { titulo: 'Nombre',         ancho: 50, render: (r: MetricaRequerimiento) => r.nombre_desarrollo ?? r.identificacion },
      { titulo: 'Alcance',        ancho: 8,  render: (r: MetricaRequerimiento) => r.alcance ?? '—' },
      { titulo: 'Proceso',        ancho: 22, render: (r: MetricaRequerimiento) => r.proceso_interno ?? '—' },
      { titulo: 'Tipo solución',  ancho: 18, render: (r: MetricaRequerimiento) => r.tipo_solucion ?? '—' },
      { titulo: 'Responsable',    ancho: 22, render: (r: MetricaRequerimiento) => r.responsable ?? '—' },
      { titulo: 'Inicio dev.',    ancho: 16, render: (r: MetricaRequerimiento) => formatFecha(r.fecha_inicio_desarrollo) },
      { titulo: 'Fecha entrega',  ancho: 16, render: (r: MetricaRequerimiento) => formatFecha(r.fecha_real_entrega ?? r.fecha_salida_vivo) },
      { titulo: 'Días desarrollo',ancho: 15, render: (r: MetricaRequerimiento) => r.dias_desarrollo ?? '—' },
    ])
  }

  if (isLoading) return <Skeleton className="h-80 w-full rounded-xl" />

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <CheckCircle2 size={18} className="text-emerald-600" />
          <h2 className="text-base font-bold text-slate-800">Desarrollos finalizados por fecha</h2>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1">
            <span className="text-xs text-slate-500">Año:</span>
            <select
              value={año}
              onChange={e => setAño(Number(e.target.value))}
              className="border-none bg-transparent text-xs font-medium text-slate-700 outline-none"
            >
              {añosDisponibles.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          {finalizados.length > 0 && (
            <Button variant="outline" size="sm" onClick={exportar} className="gap-1.5 text-xs">
              <Download size={13} /> Exportar Excel
            </Button>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 px-4 py-3">
          <p className="text-xs text-emerald-600 font-medium mb-1">Finalizados en {año}</p>
          <p className="text-2xl font-bold text-emerald-700">{finalizados.length}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          <p className="text-xs text-slate-500 font-medium mb-1">Promedio días desarrollo</p>
          <p className="text-2xl font-bold text-slate-700">{promedioDias != null ? `${promedioDias}d` : '—'}</p>
        </div>
        <div className="rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3">
          <p className="text-xs text-blue-600 font-medium mb-1">Mes más productivo</p>
          <p className="text-2xl font-bold text-blue-700">
            {porMes.reduce((max, m) => m.cantidad > max.cantidad ? m : max, porMes[0]).cantidad > 0
              ? porMes.reduce((max, m) => m.cantidad > max.cantidad ? m : max, porMes[0]).label
              : '—'}
          </p>
        </div>
      </div>

      {/* Gráfica por mes */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="mb-4 text-sm font-semibold text-slate-700">Entregas por mes — {año}</p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={porMes} margin={{ left: 0, right: 16, top: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              formatter={(v: unknown) => [`${Number(v)}`, 'Finalizados']}
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
            />
            <Bar dataKey="cantidad" radius={[4, 4, 0, 0]} maxBarSize={40}>
              {porMes.map((entry, i) => (
                <Cell
                  key={i}
                  fill={entry.cantidad > 0 ? '#10b981' : '#e2e8f0'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Tabla de detalle */}
      {finalizados.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 py-12 text-center">
          <CheckCircle2 size={30} className="mx-auto mb-2 text-slate-200" />
          <p className="text-sm font-semibold text-slate-500">Sin desarrollos finalizados en {año}</p>
          <p className="text-xs text-slate-400 mt-1">Cambia el año o verifica que los registros tengan fecha de entrega.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <p className="border-b border-slate-100 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Detalle ({finalizados.length})
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50">
                <tr>
                  {['#', 'Nombre', 'Alcance', 'Proceso', 'Responsable', 'Inicio dev.', 'Fecha entrega', 'Días dev.', 'Estado'].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left font-medium text-slate-400 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {finalizados.map((r, i) => {
                  const fechaEntrega = r.fecha_real_entrega ?? r.fecha_salida_vivo
                  const cfg = ESTADOS[r.estado as Estado]
                  return (
                    <tr key={r.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}>
                      <td className="px-3 py-2.5 text-slate-400">{i + 1}</td>
                      <td className="px-3 py-2.5 max-w-[200px]">
                        <p className="line-clamp-1 font-medium text-slate-700">{r.nombre_desarrollo ?? r.identificacion}</p>
                      </td>
                      <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">{r.alcance ?? '—'}</td>
                      <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">{r.proceso_interno ?? '—'}</td>
                      <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">{r.responsable ?? '—'}</td>
                      <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">{formatFecha(r.fecha_inicio_desarrollo)}</td>
                      <td className="px-3 py-2.5 font-medium text-emerald-700 whitespace-nowrap">{formatFecha(fechaEntrega)}</td>
                      <td className="px-3 py-2.5 text-center">
                        {r.dias_desarrollo != null
                          ? <span className="font-semibold text-slate-600">{r.dias_desarrollo}d</span>
                          : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-3 py-2.5">
                        {cfg
                          ? <span className={cn('rounded-full px-1.5 py-0.5 text-[10px]', cfg.bgColor, cfg.textColor)}>{cfg.label}</span>
                          : <span className="text-slate-400">{r.estado}</span>}
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
