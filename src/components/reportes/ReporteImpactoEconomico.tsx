'use client'

'use client'

import { useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, Legend,
} from 'recharts'
import { Download, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCOP, cn } from '@/lib/utils'
import { exportarReporte } from '@/lib/exportar'
import type { MetricaRequerimiento } from '@/lib/supabase/types'

const ALCANCE_COLORES: Record<string, string> = {
  IWF: '#3b82f6',
  ILT: '#22c55e',
  IWG: '#8b5cf6',
}

const TIPO_LABELS: Record<string, string> = {
  DESARROLLO: 'Desarrollo', MEJORA: 'Mejora', INTEGRACION: 'Integración',
  SUPERSET: 'Superset', POR_DEFINIR: 'Por definir',
}

const TooltipCOP = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-md text-xs max-w-xs">
      <p className="mb-1 font-semibold text-slate-700 line-clamp-2">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: {formatCOP(p.value)}
        </p>
      ))}
    </div>
  )
}

interface Props {
  datos: MetricaRequerimiento[]
  isLoading: boolean
}

const ESTADOS_FINALIZADOS = ['ENTREGADO', 'CERRADO']

type Tab = 'estimado' | 'real'

export function ReporteImpactoEconomico({ datos, isLoading }: Props) {
  const [tab, setTab] = useState<Tab>('estimado')

  // Estimado: reqs NO finalizados con impacto calculado
  const conImpactoEst = datos.filter(r =>
    !ESTADOS_FINALIZADOS.includes(r.estado as string) &&
    ((r.ahorro_anual_cop && r.ahorro_anual_cop > 0) ||
     (r.total_beneficios_cualitativos_anual && r.total_beneficios_cualitativos_anual > 0))
  )

  // Real: reqs finalizados con impacto real registrado
  const conImpactoReal = datos.filter(r =>
    ESTADOS_FINALIZADOS.includes(r.estado as string) &&
    (r as any).impacto_economico_total_anual_real !== null
  )

  const conImpacto = tab === 'estimado' ? conImpactoEst : conImpactoReal

  const impactoTotalFn = (r: MetricaRequerimiento) => {
    if (tab === 'real') return (r as any).impacto_economico_total_anual_real ?? 0
    return r.impacto_economico_total_anual ?? ((r.ahorro_anual_cop ?? 0) + (r.total_beneficios_cualitativos_anual ?? 0))
  }

  const ahorroMensualFn = (r: MetricaRequerimiento) =>
    tab === 'real' ? ((r as any).ahorro_mensual_cop_real ?? 0) : (r.ahorro_mensual_cop ?? 0)

  const horasMesFn = (r: MetricaRequerimiento) =>
    tab === 'real' ? ((r as any).horas_ahorradas_mes_real ?? 0) : (r.horas_ahorradas_mes ?? 0)

  const totalMensual         = conImpacto.reduce((s, r) => s + ahorroMensualFn(r), 0)
  const totalAnualHH         = conImpacto.reduce((s, r) => s + (tab === 'real' ? ((r as any).ahorro_anual_cop_real ?? 0) : (r.ahorro_anual_cop ?? 0)), 0)
  const totalCualitativos    = conImpacto.reduce((s, r) => s + (tab === 'real' ? ((r as any).total_beneficios_cualitativos_anual_real ?? 0) : (r.total_beneficios_cualitativos_anual ?? 0)), 0)
  const totalImpacto         = conImpacto.reduce((s, r) => s + impactoTotalFn(r), 0)
  const totalHorasMes        = conImpacto.reduce((s, r) => s + horasMesFn(r), 0)
  const promedioAhorro       = conImpacto.length ? totalImpacto / conImpacto.length : 0

  const top10 = [...conImpacto]
    .sort((a, b) => impactoTotalFn(b) - impactoTotalFn(a))
    .slice(0, 10)
    .map(r => ({
      nombre: (r.nombre_desarrollo ?? r.identificacion ?? '').slice(0, 30) + '...',
      nombreCompleto: r.nombre_desarrollo ?? r.identificacion,
      responsable: r.responsable,
      mensual: ahorroMensualFn(r),
      anual: impactoTotalFn(r),
      cualitativos: tab === 'real' ? ((r as any).total_beneficios_cualitativos_anual_real ?? 0) : (r.total_beneficios_cualitativos_anual ?? 0),
    }))

  // Agrupado por alcance + tipo_solucion
  const porAlcanceTipo = (() => {
    const tipos = [...new Set(conImpacto.map(r => r.tipo_solucion).filter(Boolean))] as string[]
    return tipos.map(tipo => {
      const entry: Record<string, any> = { tipo: TIPO_LABELS[tipo] ?? tipo }
      ;['IWF', 'ILT', 'IWG'].forEach(alc => {
        entry[alc] = conImpacto
          .filter(r => r.tipo_solucion === tipo && r.alcance === alc)
          .reduce((s, r) => s + (r.ahorro_anual_cop ?? 0), 0)
      })
      return entry
    })
  })()

  const exportar = () => {
    exportarReporte('Impacto_Economico', conImpacto, [
      { titulo: '#',                 ancho: 4,  render: (_, i: number) => i + 1 },
      { titulo: 'Nombre',            ancho: 50, render: r => r.nombre_desarrollo ?? r.identificacion },
      { titulo: 'Alcance',           ancho: 8,  render: r => r.alcance },
      { titulo: 'Responsable',       ancho: 22, render: r => r.responsable },
      { titulo: 'Horas/mes',         ancho: 12, render: r => r.horas_ahorradas_mes?.toFixed(1) },
      { titulo: 'Ahorro mensual COP',ancho: 20, render: r => r.ahorro_mensual_cop },
      { titulo: 'Ahorro HH anual',    ancho: 20, render: r => r.ahorro_anual_cop },
      { titulo: 'Cualitativos anual', ancho: 20, render: r => r.total_beneficios_cualitativos_anual ?? 0 },
      { titulo: 'Impacto total anual',ancho: 22, render: r => r.impacto_economico_total_anual ?? (r.ahorro_anual_cop ?? 0) },
    ])
  }

  if (isLoading) return <Skeleton className="h-96 w-full rounded-xl" />

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <TrendingUp size={18} className="text-emerald-600" />
          <h2 className="text-base font-bold text-slate-800">Impacto económico consolidado</h2>
        </div>
        <div className="flex items-center gap-2">
          {/* Tabs Estimado / Real */}
          <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
            {(['estimado', 'real'] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  'rounded-md px-3 py-1 text-xs font-semibold transition-all',
                  tab === t
                    ? t === 'real'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-white text-slate-700 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                )}
              >
                {t === 'estimado' ? '📊 Estimado' : '✅ Real'}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={exportar} className="gap-1.5 text-xs">
            <Download size={13} /> Exportar Excel
          </Button>
        </div>
      </div>

      {/* Aviso contextual */}
      <p className="text-xs text-slate-400">
        {tab === 'estimado'
          ? `📊 Valores estimados — requerimientos en curso o pendientes (${conImpactoEst.length})`
          : `✅ Valores reales — requerimientos finalizados con datos registrados (${conImpactoReal.length})`}
      </p>

      {/* Cards KPI */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Impacto total anual',  valor: formatCOP(totalImpacto),   color: 'text-emerald-700 text-xl font-extrabold', note: totalCualitativos > 0 ? 'HH + cualitativos' : '' },
          { label: 'Ahorro HH anual',      valor: formatCOP(totalAnualHH),   color: 'text-slate-700', note: '' },
          ...(totalCualitativos > 0 ? [{ label: 'Cualitativos anual', valor: formatCOP(totalCualitativos), color: 'text-blue-700', note: '' }] : []),
          { label: 'Horas hombre / mes',   valor: `${totalHorasMes.toFixed(1)} h`, color: 'text-slate-700', note: '' },
          { label: 'Promedio por req.',    valor: formatCOP(promedioAhorro),  color: 'text-slate-700', note: '' },
        ].map(({ label, valor, color, note }) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">{label}</p>
            <p className={cn('mt-1 font-bold', color)}>{valor}</p>
            {note && <p className="text-xs text-slate-400">{note}</p>}
          </div>
        ))}
      </div>

      {/* Gráfica top 10 */}
      {top10.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="mb-3 text-sm font-semibold text-slate-700">Top 10 por ahorro anual COP</p>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={top10} layout="vertical" margin={{ left: 8, right: 60, top: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
              <XAxis type="number" tickFormatter={v => formatCOP(v)} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis dataKey="nombre" type="category" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} width={140} />
              <Tooltip content={({ active, payload }: any) => {
                if (!active || !payload?.length) return null
                const d = payload[0].payload
                return (
                  <div className="rounded-lg border bg-white p-3 shadow-md text-xs">
                    <p className="font-semibold text-slate-700 mb-1 max-w-[200px] line-clamp-2">{d.nombreCompleto}</p>
                    <p className="text-slate-500">Responsable: {d.responsable}</p>
                    <p className="text-slate-600">Mensual: {formatCOP(d.mensual)}</p>
                    <p className="font-bold text-emerald-600">Impacto total: {formatCOP(d.anual)}</p>
                    {d.cualitativos > 0 && <p className="text-blue-600">incl. cualitativos: {formatCOP(d.cualitativos)}</p>}
                  </div>
                )
              }} />
              <Bar dataKey="anual" fill="#22c55e" radius={[0, 4, 4, 0]} maxBarSize={24} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Gráfica apilada alcance + tipo */}
      {porAlcanceTipo.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="mb-3 text-sm font-semibold text-slate-700">Ahorro anual por alcance y tipo de solución</p>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={porAlcanceTipo} margin={{ left: 8, right: 8, top: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="tipo" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={v => `${(v / 1_000_000).toFixed(0)}M`} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip content={<TooltipCOP />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              {['IWF', 'ILT', 'IWG'].map(alc => (
                <Bar key={alc} dataKey={alc} stackId="a" fill={ALCANCE_COLORES[alc]} maxBarSize={48} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Tabla detallada */}
      {conImpacto.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <p className="border-b border-slate-100 px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Detalle por requerimiento ({conImpacto.length})
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50">
                <tr>
                  {['#', 'Nombre', 'Alcance', 'Responsable', 'Horas/mes', 'Ahorro HH mensual', 'Cualitativos anual', 'Impacto total anual'].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left font-medium text-slate-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {[...conImpacto]
                  .sort((a, b) => impactoTotalFn(b) - impactoTotalFn(a))
                  .map((r, i) => (
                    <tr key={r.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                      <td className="px-3 py-2 text-slate-400">{i + 1}</td>
                      <td className="px-3 py-2 max-w-[220px]">
                        <p className="font-medium text-slate-700 line-clamp-1">{r.nombre_desarrollo ?? r.identificacion}</p>
                      </td>
                      <td className="px-3 py-2 text-slate-500">{r.alcance ?? '—'}</td>
                      <td className="px-3 py-2 text-slate-500">{r.responsable ?? '—'}</td>
                      <td className="px-3 py-2 font-medium">{horasMesFn(r).toFixed(1)} h</td>
                      <td className="px-3 py-2 font-medium text-emerald-600">{formatCOP(ahorroMensualFn(r))}</td>
                      <td className="px-3 py-2 font-medium text-blue-600">
                        {(tab === 'real' ? (r as any).total_beneficios_cualitativos_anual_real : r.total_beneficios_cualitativos_anual)
                          ? formatCOP(tab === 'real' ? (r as any).total_beneficios_cualitativos_anual_real : r.total_beneficios_cualitativos_anual)
                          : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-3 py-2 font-bold text-emerald-700">{formatCOP(impactoTotalFn(r))}</td>
                      <td className="px-3 py-2 text-center text-slate-500">
                        {(r.beneficios_cualitativos as any[])?.length ?? 0}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {conImpacto.length === 0 && (
        <p className="rounded-xl border border-slate-200 bg-slate-50 py-12 text-center text-sm text-slate-400">
          Sin requerimientos con impacto económico calculado en el período seleccionado
        </p>
      )}
    </div>
  )
}
