'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, ArrowDown, Layers, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getEstadoCfg, PRIORIDADES, PROCESOS_INTERNOS } from '@/lib/constants'
import { getCriticidadesProceso, type CriticidadProcesoItem } from '@/actions/criticidad-proceso'

interface Props {
  proceso: string
  value: number | null | undefined
  onChange: (posicion: number) => void
  error?: string
}

function BadgeGeneral({ r }: { r: Pick<CriticidadProcesoItem, 'prioridad' | 'sub_prioridad'> }) {
  if (!r.prioridad) return <span className="rounded-full bg-slate-100 px-1.5 py-px text-[10px] font-semibold text-slate-400">Sin criticidad general</span>
  const cfg = PRIORIDADES[r.prioridad]
  return (
    <span className={cn('rounded-full px-1.5 py-px text-[10px] font-bold', cfg?.bgColor, cfg?.textColor)}>
      P{r.prioridad}{r.sub_prioridad != null ? `.${r.sub_prioridad}` : ''} {cfg?.label}
    </span>
  )
}

/**
 * Lista los requerimientos actuales del proceso con su criticidad y permite ubicar el nuevo
 * en una posición. Si la posición está ocupada, avisa del desplazamiento y del cambio de
 * criticidad general que se aplicará al guardar.
 */
export function SelectorCriticidadProceso({ proceso, value, onChange, error }: Props) {
  const [items, setItems] = useState<CriticidadProcesoItem[] | null>(null)
  const procesoLabel = PROCESOS_INTERNOS.find(p => p.value === proceso)?.label ?? proceso

  useEffect(() => {
    let vigente = true
    setItems(null)
    getCriticidadesProceso(proceso).then(d => { if (vigente) setItems(d) }).catch(() => { if (vigente) setItems([]) })
    return () => { vigente = false }
  }, [proceso])

  const ultimaPosicion = items?.length ? Math.max(...items.map(i => i.prioridad_proceso)) : 0
  const posicionFinal = ultimaPosicion + 1
  const ocupante = value ? items?.find(i => i.prioridad_proceso === value) : undefined
  const desplazados = value ? (items ?? []).filter(i => i.prioridad_proceso >= value).length : 0

  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-medium text-slate-800">
            <Layers size={14} className="text-violet-600" />
            Criticidad en el proceso {procesoLabel} <span className="text-red-500">*</span>
          </p>
          <p className="text-xs text-slate-500">
            Elige la posición de tu requerimiento frente a los demás de tu proceso (#1 es el más crítico).
            No puede haber dos con la misma posición: si eliges una ocupada, los demás bajan un lugar.
          </p>
        </div>
      </div>

      <div className={cn('overflow-hidden rounded-lg border bg-white', error ? 'border-red-300' : 'border-slate-200')}>
        {items === null ? (
          <p className="px-3 py-4 text-center text-xs text-slate-400">Cargando requerimientos del proceso…</p>
        ) : (
          <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto">
            {items.map(item => {
              const seleccionado = value === item.prioridad_proceso
              const estadoCfg = getEstadoCfg(item.estado)
              return (
                <li key={item.id}>
                  {seleccionado && (
                    <div className="flex items-center gap-2 bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-700">
                      <span className="w-8 shrink-0 rounded bg-violet-600 py-0.5 text-center text-[10px] font-bold text-white">#{item.prioridad_proceso}</span>
                      Tu requerimiento nuevo
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => onChange(item.prioridad_proceso)}
                    className={cn(
                      'flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-violet-50/60',
                      value != null && item.prioridad_proceso >= value && 'bg-amber-50/40'
                    )}
                    title={`Ubicar mi requerimiento en la posición #${item.prioridad_proceso}`}
                  >
                    <span className="w-8 shrink-0 rounded bg-slate-100 py-0.5 text-center text-[10px] font-bold text-slate-600">
                      #{value != null && item.prioridad_proceso >= value ? item.prioridad_proceso + 1 : item.prioridad_proceso}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium text-slate-700">
                        {item.numero && <span className="mr-1 font-mono text-[10px] text-slate-400">#{item.numero}</span>}
                        {item.nombre}
                      </span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
                        <BadgeGeneral r={item} />
                        <span className={cn('rounded-full px-1.5 py-px text-[10px] font-medium', estadoCfg.bgColor, estadoCfg.textColor)}>{estadoCfg.label}</span>
                      </span>
                    </span>
                    {value != null && item.prioridad_proceso >= value
                      ? <ArrowDown size={12} className="shrink-0 text-amber-500" />
                      : <span className="shrink-0 text-[10px] text-slate-400">Ubicar aquí</span>}
                  </button>
                </li>
              )
            })}
            <li>
              <button
                type="button"
                onClick={() => onChange(posicionFinal)}
                className={cn(
                  'flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors',
                  value === posicionFinal ? 'bg-violet-50 font-semibold text-violet-700' : 'text-slate-500 hover:bg-violet-50/60'
                )}
              >
                <span className={cn(
                  'w-8 shrink-0 rounded py-0.5 text-center text-[10px] font-bold',
                  value === posicionFinal ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-500'
                )}>
                  #{posicionFinal}
                </span>
                <Plus size={12} />
                {items.length === 0 ? 'Primer requerimiento con criticidad en este proceso' : 'Al final (menos crítico que los actuales)'}
              </button>
            </li>
          </ul>
        )}
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      {ocupante && value && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
          <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-500" />
          <div className="space-y-1">
            <p>
              Tu requerimiento quedará en la posición <strong>#{value}</strong> y {desplazados === 1 ? 'el requerimiento' : `los ${desplazados} requerimientos`} desde
              esa posición {desplazados === 1 ? 'baja' : 'bajan'} un lugar.
            </p>
            {ocupante.prioridad && (
              <p>
                En la criticidad general tomará <strong>P{ocupante.prioridad}{ocupante.sub_prioridad != null ? `.${ocupante.sub_prioridad}` : ''}</strong>,
                la que tenía <strong>“{ocupante.nombre}”</strong>, que pasará al último lugar de P{ocupante.prioridad}.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
