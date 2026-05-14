'use client'

import { AlertCircle, Download, PauseCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatFecha, cn } from '@/lib/utils'
import { exportarReporte } from '@/lib/exportar'
import { PRIORIDADES, PROCESOS_INTERNOS } from '@/lib/constants'
import { useRouter } from 'next/navigation'
import type { MetricaRequerimiento } from '@/lib/supabase/types'

interface Props {
  datos: MetricaRequerimiento[]
  isLoading: boolean
}

export function ReporteStandBy({ datos, isLoading }: Props) {
  const router = useRouter()
  const standBy = datos
    .filter(r => r.estado === 'STAND_BY')
    .sort((a, b) => (b.dias_en_estado_actual ?? 0) - (a.dias_en_estado_actual ?? 0))

  const sinMotivo = standBy.filter(r => !r.motivo_stand_by?.trim())

  const exportar = () => {
    exportarReporte('Stand_By', standBy, [
      { titulo: '#',               ancho: 4,  render: (_: any, i: number) => i + 1 },
      { titulo: 'Nombre',          ancho: 50, render: (r: MetricaRequerimiento) => r.nombre_desarrollo ?? r.identificacion },
      { titulo: 'Prioridad',       ancho: 10, render: (r: MetricaRequerimiento) => r.prioridad ? `P${r.prioridad}` : '' },
      { titulo: 'Proceso',         ancho: 20, render: (r: MetricaRequerimiento) => r.proceso_interno },
      { titulo: 'Responsable',     ancho: 22, render: (r: MetricaRequerimiento) => r.responsable },
      { titulo: 'Días en stand by',ancho: 16, render: (r: MetricaRequerimiento) => r.dias_en_estado_actual },
      { titulo: 'Motivo',          ancho: 50, render: (r: MetricaRequerimiento) => r.motivo_stand_by ?? 'Sin motivo registrado' },
    ])
  }

  if (isLoading) return <Skeleton className="h-72 w-full rounded-xl" />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PauseCircle size={18} className="text-orange-500" />
          <h2 className="text-base font-bold text-slate-800">Análisis de Stand By</h2>
        </div>
        <Button variant="outline" size="sm" onClick={exportar} className="gap-1.5 text-xs">
          <Download size={13} /> Exportar Excel
        </Button>
      </div>

      {sinMotivo.length > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-orange-200 bg-orange-50 p-4">
          <AlertCircle size={18} className="mt-0.5 shrink-0 text-orange-500" />
          <p className="text-sm font-semibold text-orange-700">
            {sinMotivo.length} requerimiento{sinMotivo.length > 1 ? 's' : ''} en stand by sin motivo registrado
          </p>
        </div>
      )}

      {standBy.length > 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <p className="border-b border-slate-100 px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Requerimientos en stand by ({standBy.length}) · Ordenado por días DESC
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50">
                <tr>
                  {['#', 'Nombre', 'P', 'Proceso', 'Responsable', 'Días', 'Motivo', ''].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left font-medium text-slate-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {standBy.map((r, i) => {
                  const sinMotivoItem = !r.motivo_stand_by?.trim()
                  const procesoLabel = PROCESOS_INTERNOS.find(p => p.value === r.proceso_interno)?.label
                  const prioridadCfg = r.prioridad ? PRIORIDADES[r.prioridad] : null

                  return (
                    <tr key={r.id} className={cn(i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50', sinMotivoItem && 'bg-orange-50/40')}>
                      <td className="px-3 py-2 text-slate-400">{i + 1}</td>
                      <td className="px-3 py-2 max-w-[200px]"><p className="line-clamp-1 font-medium text-slate-700">{r.nombre_desarrollo ?? r.identificacion}</p></td>
                      <td className="px-3 py-2">
                        {prioridadCfg && (
                          <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-bold', prioridadCfg.bgColor, prioridadCfg.textColor)}>
                            P{r.prioridad}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-slate-500">{procesoLabel ?? r.proceso_interno ?? '—'}</td>
                      <td className="px-3 py-2 text-slate-500">{r.responsable ?? '—'}</td>
                      <td className="px-3 py-2">
                        <span className={cn('font-bold tabular-nums', (r.dias_en_estado_actual ?? 0) > 30 ? 'text-red-600' : 'text-orange-600')}>
                          {r.dias_en_estado_actual ?? 0}d
                        </span>
                      </td>
                      <td className="px-3 py-2 max-w-[200px]">
                        {sinMotivoItem
                          ? <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">Sin motivo</span>
                          : <p className="line-clamp-1 text-slate-600">{r.motivo_stand_by}</p>}
                      </td>
                      <td className="px-2 py-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 px-2 text-[10px]"
                          onClick={() => router.push(`/requerimientos/${r.id}`)}
                        >
                          Gestionar
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <p className="rounded-xl border border-slate-200 bg-slate-50 py-10 text-center text-sm text-slate-400">
          Sin requerimientos en stand by en el período seleccionado
        </p>
      )}
    </div>
  )
}
