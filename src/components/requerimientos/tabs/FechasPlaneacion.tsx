'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { guardarPlaneacionEtapas, type PlaneacionEtapa } from '@/actions/planeacion-etapas'
import { ETAPAS_PLANEACION, type EjecucionEtapa } from '@/lib/etapas-planeacion'
import { cn } from '@/lib/utils'

interface Props {
  requerimientoId: string
  planeacion: PlaneacionEtapa[]
  ejecucion: Record<string, EjecucionEtapa>
}

function formatFecha(d: string | null): string {
  if (!d) return '—'
  try {
    return new Date(d + 'T12:00:00').toLocaleDateString('es-CO', {
      day: '2-digit', month: 'short', year: 'numeric',
    })
  } catch { return d }
}

/** Días de diferencia entre lo real y lo planeado (positivo = retraso) */
function desviacionDias(planeada: string | null, real: string | null): number | null {
  if (!planeada || !real) return null
  return Math.round((new Date(real + 'T12:00:00').getTime() - new Date(planeada + 'T12:00:00').getTime()) / 86400000)
}

function BadgeDesviacion({ dias }: { dias: number | null }) {
  if (dias === null) return null
  return (
    <span className={cn(
      'rounded px-1.5 py-0.5 text-[10px] font-semibold',
      dias > 0 ? 'bg-red-50 text-red-600' : dias < 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'
    )}>
      {dias === 0 ? 'a tiempo' : dias > 0 ? `+${dias}d` : `${dias}d`}
    </span>
  )
}

export function FechasPlaneacion({ requerimientoId, planeacion, ejecucion }: Props) {
  const [filas, setFilas] = useState<PlaneacionEtapa[]>(() =>
    ETAPAS_PLANEACION.map(e => {
      const p = planeacion.find(x => x.estado === e.estado)
      return { estado: e.estado, fecha_inicio: p?.fecha_inicio ?? null, fecha_fin: p?.fecha_fin ?? null }
    })
  )
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const setCampo = (estado: string, campo: 'fecha_inicio' | 'fecha_fin', valor: string) =>
    setFilas(fs => fs.map(f => f.estado === estado ? { ...f, [campo]: valor || null } : f))

  const handleGuardar = () => {
    startTransition(async () => {
      const res = await guardarPlaneacionEtapas(requerimientoId, filas)
      if (res.ok) {
        toast.success('Planeación guardada')
        router.refresh()
      } else {
        toast.error(res.error ?? 'Error al guardar la planeación')
      }
    })
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">
        Define el inicio y fin planeado de cada etapa. Lo ejecutado se toma del historial de cambios de estado.
      </p>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              <th className="px-4 py-2.5">Etapa</th>
              <th className="px-3 py-2.5">Inicio planeado</th>
              <th className="px-3 py-2.5">Fin planeado</th>
              <th className="px-3 py-2.5">Ejecutado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {ETAPAS_PLANEACION.map(etapa => {
              const fila = filas.find(f => f.estado === etapa.estado)!
              const real = ejecucion[etapa.estado]
              const invertida = !!fila.fecha_inicio && !!fila.fecha_fin && fila.fecha_inicio > fila.fecha_fin
              return (
                <tr key={etapa.estado} className={cn(real?.enCurso && 'bg-blue-50/40')}>
                  <td className="px-4 py-2.5 font-medium text-slate-700">
                    {etapa.label}
                    {real?.enCurso && (
                      <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">Actual</span>
                    )}
                  </td>
                  {(['fecha_inicio', 'fecha_fin'] as const).map(campo => (
                    <td key={campo} className="px-3 py-2">
                      <input
                        type="date"
                        value={fila[campo] ?? ''}
                        onChange={e => setCampo(etapa.estado, campo, e.target.value)}
                        className={cn(
                          'w-full rounded-lg border bg-white px-2.5 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300',
                          invertida ? 'border-red-300' : 'border-slate-200'
                        )}
                      />
                    </td>
                  ))}
                  <td className="px-3 py-2.5 text-xs text-slate-600">
                    {!real ? (
                      <span className="text-slate-400">Sin ejecutar</span>
                    ) : (
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <span>{formatFecha(real.inicio)}</span>
                          <BadgeDesviacion dias={desviacionDias(fila.fecha_inicio, real.inicio)} />
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-400">→</span>
                          <span>{real.enCurso ? 'En curso' : formatFecha(real.fin)}</span>
                          {!real.enCurso && <BadgeDesviacion dias={desviacionDias(fila.fecha_fin, real.fin)} />}
                        </div>
                        {real.veces > 1 && (
                          <p className="text-[10px] text-amber-600">Ingresó {real.veces} veces</p>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleGuardar}
          disabled={isPending}
          className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {isPending ? 'Guardando...' : 'Guardar planeación'}
        </button>
      </div>
    </div>
  )
}
