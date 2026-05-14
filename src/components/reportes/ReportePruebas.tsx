'use client'

import { AlertTriangle, Download, TestTube } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatFecha, cn } from '@/lib/utils'
import { exportarReporte } from '@/lib/exportar'
import { ESTADOS, PROCESOS_INTERNOS } from '@/lib/constants'
import type { MetricaRequerimiento, Estado } from '@/lib/supabase/types'

interface Props {
  datos: MetricaRequerimiento[]
  isLoading: boolean
}

export function ReportePruebas({ datos, isLoading }: Props) {
  const enPruebas = datos.filter(r => r.inicio_pruebas_usuario)

  const calcDiasPruebas = (r: MetricaRequerimiento): number => {
    if (!r.inicio_pruebas_usuario) return 0
    const fin = r.fin_pruebas_usuario ? new Date(r.fin_pruebas_usuario) : new Date()
    const inicio = new Date(r.inicio_pruebas_usuario)
    return Math.floor((fin.getTime() - inicio.getTime()) / 86_400_000)
  }

  const exceden15 = enPruebas.filter(r =>
    !r.fin_pruebas_usuario && calcDiasPruebas(r) > 15
  )

  const exportar = () => {
    exportarReporte('Pruebas_Usuario', enPruebas, [
      { titulo: '#',             ancho: 4,  render: (_: any, i: number) => i + 1 },
      { titulo: 'Nombre',        ancho: 50, render: (r: MetricaRequerimiento) => r.nombre_desarrollo ?? r.identificacion },
      { titulo: 'Responsable',   ancho: 22, render: (r: MetricaRequerimiento) => r.responsable },
      { titulo: 'Proceso',       ancho: 20, render: (r: MetricaRequerimiento) => r.proceso_interno },
      { titulo: 'Inicio pruebas',ancho: 16, render: (r: MetricaRequerimiento) => formatFecha(r.inicio_pruebas_usuario) },
      { titulo: 'Fin pruebas',   ancho: 16, render: (r: MetricaRequerimiento) => formatFecha(r.fin_pruebas_usuario) },
      { titulo: 'Días pruebas',  ancho: 12, render: (r: MetricaRequerimiento) => calcDiasPruebas(r) },
      { titulo: 'Estado actual', ancho: 18, render: (r: MetricaRequerimiento) => ESTADOS[r.estado as Estado]?.label },
    ])
  }

  if (isLoading) return <Skeleton className="h-72 w-full rounded-xl" />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TestTube size={18} className="text-amber-500" />
          <h2 className="text-base font-bold text-slate-800">Tiempos de pruebas de usuario</h2>
        </div>
        <Button variant="outline" size="sm" onClick={exportar} className="gap-1.5 text-xs">
          <Download size={13} /> Exportar Excel
        </Button>
      </div>

      {exceden15.length > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-red-500" />
          <p className="text-sm font-semibold text-red-700">
            ⚠ {exceden15.length} requerimiento{exceden15.length > 1 ? 's llevan' : ' lleva'} más de 15 días en pruebas sin cerrarse
          </p>
        </div>
      )}

      {enPruebas.length > 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <p className="border-b border-slate-100 px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Requerimientos con pruebas de usuario registradas ({enPruebas.length})
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50">
                <tr>
                  {['#', 'Nombre', 'Responsable', 'Proceso', 'Inicio', 'Fin', 'Días', 'Estado', 'Alerta'].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left font-medium text-slate-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {[...enPruebas]
                  .sort((a, b) => calcDiasPruebas(b) - calcDiasPruebas(a))
                  .map((r, i) => {
                    const dias = calcDiasPruebas(r)
                    const enCurso = !r.fin_pruebas_usuario
                    const alerta = enCurso && dias > 15
                    const procesoLabel = PROCESOS_INTERNOS.find(p => p.value === r.proceso_interno)?.label

                    return (
                      <tr key={r.id} className={cn(i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50', alerta && 'bg-red-50/50')}>
                        <td className="px-3 py-2 text-slate-400">{i + 1}</td>
                        <td className="px-3 py-2 max-w-[200px]"><p className="line-clamp-1 font-medium text-slate-700">{r.nombre_desarrollo ?? r.identificacion}</p></td>
                        <td className="px-3 py-2 text-slate-500">{r.responsable ?? '—'}</td>
                        <td className="px-3 py-2 text-slate-500">{procesoLabel ?? r.proceso_interno ?? '—'}</td>
                        <td className="px-3 py-2 text-slate-500">{formatFecha(r.inicio_pruebas_usuario)}</td>
                        <td className="px-3 py-2 text-slate-500">{r.fin_pruebas_usuario ? formatFecha(r.fin_pruebas_usuario) : <span className="text-slate-300">En curso</span>}</td>
                        <td className="px-3 py-2 font-bold">{dias} días</td>
                        <td className="px-3 py-2">
                          <span className={cn('rounded-full px-1.5 py-0.5 text-[10px]', ESTADOS[r.estado as Estado]?.bgColor, ESTADOS[r.estado as Estado]?.textColor)}>
                            {ESTADOS[r.estado as Estado]?.label}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          {alerta
                            ? <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">+15 días</span>
                            : <span className="text-slate-300">—</span>}
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
          Sin requerimientos con pruebas de usuario registradas
        </p>
      )}
    </div>
  )
}
