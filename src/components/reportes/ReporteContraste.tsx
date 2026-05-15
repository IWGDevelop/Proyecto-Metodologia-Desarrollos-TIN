'use client'

import { Download, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { formatCOP, cn } from '@/lib/utils'
import { exportarReporte } from '@/lib/exportar'
import type { MetricaRequerimiento } from '@/lib/supabase/types'

const ESTADOS_FINALIZADOS = ['ENTREGADO', 'CERRADO']

interface Props {
  datos: MetricaRequerimiento[]
  isLoading: boolean
}

function DeltaBadge({ estimado, real }: { estimado: number; real: number }) {
  const delta = real - estimado
  const pct   = estimado > 0 ? ((delta / estimado) * 100).toFixed(1) : null
  if (Math.abs(delta) < 1) return <span className="text-xs text-slate-400">Sin cambio</span>
  const positivo = delta > 0
  return (
    <span className={cn(
      'inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold',
      positivo ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
    )}>
      {positivo ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
      {positivo ? '+' : ''}{pct ? `${pct}%` : formatCOP(Math.abs(delta))}
    </span>
  )
}

export function ReporteContraste({ datos, isLoading }: Props) {
  const finalizados = datos.filter(r => ESTADOS_FINALIZADOS.includes(r.estado as string))
  const conReal     = finalizados.filter(r => r.impacto_economico_total_anual_real !== null)
  const sinReal     = finalizados.filter(r => r.impacto_economico_total_anual_real === null)

  const num = (v: number | null | undefined) => v ?? 0

  // Totales estimado vs real
  const totEstimadoAnual = conReal.reduce((s, r) => s + num(r.impacto_economico_total_anual) + num(r.ahorro_anual_cop), 0)
  const totRealAnual     = conReal.reduce((s, r) => s + num(r.impacto_economico_total_anual_real), 0)
  const totHorasEst      = conReal.reduce((s, r) => s + num(r.horas_ahorradas_mes), 0)
  const totHorasReal     = conReal.reduce((s, r) => s + num(r.horas_ahorradas_mes_real), 0)

  const exportar = () => {
    exportarReporte('Contraste_Estimado_Real', conReal, [
      { titulo: 'Nombre',                ancho: 45, render: r => r.nombre_desarrollo ?? r.identificacion },
      { titulo: 'Alcance',               ancho: 8,  render: r => r.alcance },
      { titulo: 'Estado',                ancho: 14, render: r => r.estado },
      { titulo: 'HH/mes Estimado',       ancho: 14, render: r => r.horas_ahorradas_mes?.toFixed(1) ?? 0 },
      { titulo: 'HH/mes Real',           ancho: 14, render: r => (r as any).horas_ahorradas_mes_real?.toFixed(1) ?? 0 },
      { titulo: 'Impacto anual Estimado',ancho: 22, render: r => num(r.impacto_economico_total_anual) || num(r.ahorro_anual_cop) },
      { titulo: 'Impacto anual Real',    ancho: 22, render: r => (r as any).impacto_economico_total_anual_real ?? 0 },
      { titulo: 'Diferencia',            ancho: 20, render: r => num((r as any).impacto_economico_total_anual_real) - (num(r.impacto_economico_total_anual) || num(r.ahorro_anual_cop)) },
    ])
  }

  if (isLoading) return <Skeleton className="h-64 w-full rounded-xl" />

  if (finalizados.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white py-10 text-center">
        <p className="text-sm text-slate-400">Sin requerimientos finalizados (Entregado / Cerrado) en el período</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-slate-800">
          Contraste Estimado vs Real
          <span className="ml-2 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-normal text-slate-500">
            {conReal.length} con datos reales · {sinReal.length} pendientes
          </span>
        </h2>
        {conReal.length > 0 && (
          <Button variant="outline" size="sm" onClick={exportar} className="gap-1.5 text-xs">
            <Download size={13} /> Exportar Excel
          </Button>
        )}
      </div>

      {/* KPI comparativo */}
      {conReal.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Horas/mes estimadas', val: `${totHorasEst.toFixed(1)} h`, sub: '' },
            { label: 'Horas/mes reales',    val: `${totHorasReal.toFixed(1)} h`, sub: '', highlight: true },
            { label: 'Impacto anual estimado', val: formatCOP(totEstimadoAnual), sub: '' },
            { label: 'Impacto anual real',  val: formatCOP(totRealAnual), sub: '', highlight: true },
          ].map(({ label, val, highlight }) => (
            <div key={label} className={cn(
              'rounded-xl border p-4',
              highlight ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white'
            )}>
              <p className="text-xs text-slate-500">{label}</p>
              <p className={cn('mt-1 text-lg font-bold', highlight ? 'text-emerald-700' : 'text-slate-700')}>{val}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabla comparativa */}
      {conReal.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <p className="border-b border-slate-100 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Detalle estimado vs real por requerimiento
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50">
                <tr>
                  {[
                    'Requerimiento', 'Alcance',
                    'HH/mes Est.', 'HH/mes Real',
                    'Impacto Anual Est.', 'Impacto Anual Real', 'Diferencia',
                  ].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left font-medium text-slate-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {conReal.map(r => {
                  const impEst  = num(r.impacto_economico_total_anual) || num(r.ahorro_anual_cop)
                  const impReal = num((r as any).impacto_economico_total_anual_real)
                  const delta   = impReal - impEst
                  return (
                    <tr key={r.id} className="hover:bg-slate-50/50">
                      <td className="px-3 py-2.5 max-w-[220px]">
                        <p className="font-medium text-slate-700 line-clamp-1">
                          {r.nombre_desarrollo ?? r.identificacion}
                        </p>
                      </td>
                      <td className="px-3 py-2.5 text-slate-500">{r.alcance ?? '—'}</td>
                      <td className="px-3 py-2.5 text-slate-600">
                        {num(r.horas_ahorradas_mes).toFixed(1)} h
                      </td>
                      <td className="px-3 py-2.5 font-medium text-emerald-700">
                        {num((r as any).horas_ahorradas_mes_real).toFixed(1)} h
                      </td>
                      <td className="px-3 py-2.5 text-slate-600">{formatCOP(impEst)}</td>
                      <td className="px-3 py-2.5 font-bold text-emerald-700">{formatCOP(impReal)}</td>
                      <td className="px-3 py-2.5">
                        <DeltaBadge estimado={impEst} real={impReal} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot className="bg-slate-50 font-semibold">
                <tr>
                  <td colSpan={2} className="px-3 py-2.5 text-slate-600">Totales</td>
                  <td className="px-3 py-2.5 text-slate-600">{totHorasEst.toFixed(1)} h</td>
                  <td className="px-3 py-2.5 text-emerald-700">{totHorasReal.toFixed(1)} h</td>
                  <td className="px-3 py-2.5 text-slate-600">{formatCOP(totEstimadoAnual)}</td>
                  <td className="px-3 py-2.5 text-emerald-700">{formatCOP(totRealAnual)}</td>
                  <td className="px-3 py-2.5">
                    <DeltaBadge estimado={totEstimadoAnual} real={totRealAnual} />
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Pendientes sin datos reales */}
      {sinReal.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="mb-2 text-xs font-semibold text-amber-800">
            {sinReal.length} requerimiento{sinReal.length > 1 ? 's' : ''} finalizado{sinReal.length > 1 ? 's' : ''} sin impacto real registrado
          </p>
          <ul className="space-y-1">
            {sinReal.map(r => (
              <li key={r.id} className="text-xs text-amber-700">
                • {r.nombre_desarrollo ?? r.identificacion}
                <span className="ml-1 text-amber-500">({r.estado})</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-amber-600">
            Regístralos desde el detalle de cada requerimiento → pestaña <strong>Impacto Real</strong>
          </p>
        </div>
      )}
    </div>
  )
}
