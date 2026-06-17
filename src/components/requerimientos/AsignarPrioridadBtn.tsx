'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, TrendingUp, AlertTriangle } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { actualizarRequerimiento } from '@/actions/requerimientos'
import { getPrioridadesProceso, type PrioridadOcupada } from '@/actions/requerimientos-admin'
import { PRIORIDADES, SLA_DIAS, formatPrioridad } from '@/lib/constants'
import { formatCOP, cn } from '@/lib/utils'
import { toast } from 'sonner'

const SUB_PRIORIDADES = [1, 2, 3, 4, 5, 6, 7, 8, 9]

interface Props {
  requerimientoId: string
  prioridadActual: number | null
  subPrioridadActual?: number | null
  impactoHH?: number | null
  impactoCualitativos?: number | null
  impactoTotal?: number | null
  proceso_interno?: string | null
}

export function AsignarPrioridadBtn({
  requerimientoId, prioridadActual, subPrioridadActual = null,
  impactoHH, impactoCualitativos, impactoTotal, proceso_interno,
}: Props) {
  const router = useRouter()
  const [open, setOpen]               = useState(false)
  const [selPrioridad, setSelP]       = useState<number | null>(prioridadActual)
  const [selSubPrioridad, setSelSub]  = useState<number | null>(subPrioridadActual)
  const [isPending, startT]           = useTransition()
  const [ocupadas, setOcupadas]       = useState<PrioridadOcupada[]>([])

  const total      = impactoTotal ?? ((impactoHH ?? 0) + (impactoCualitativos ?? 0))
  const cfgActual  = prioridadActual ? PRIORIDADES[prioridadActual] : null
  const sinCambios = selPrioridad === prioridadActual && selSubPrioridad === subPrioridadActual

  const isOcupada = (p: number | null, sp: number | null) =>
    p !== null && ocupadas.some(o => o.prioridad === p && o.sub_prioridad === sp)

  const conflicto = isOcupada(selPrioridad, selSubPrioridad)

  const handleOpen = async () => {
    setSelP(prioridadActual)
    setSelSub(subPrioridadActual)
    setOpen(true)
    if (proceso_interno) {
      const data = await getPrioridadesProceso(proceso_interno, requerimientoId)
      setOcupadas(data)
    }
  }

  const handleSelPrioridad = (p: number) => {
    if (selPrioridad === p) {
      setSelP(null)
      setSelSub(null)
    } else {
      setSelP(p)
      setSelSub(null)
    }
  }

  const handleGuardar = () => {
    if (conflicto) return
    startT(async () => {
      try {
        await actualizarRequerimiento(requerimientoId, {
          prioridad:     selPrioridad,
          sub_prioridad: selSubPrioridad,
        } as any)
        const label = formatPrioridad(selPrioridad, selSubPrioridad)
        toast.success(selPrioridad ? `Prioridad ${label} asignada` : 'Prioridad removida')
        setOpen(false)
        router.refresh()
      } catch (e: any) {
        toast.error(e?.message ?? 'Error al asignar prioridad')
      }
    })
  }

  const getNombreConflicto = () => {
    if (!conflicto) return null
    const o = ocupadas.find(o => o.prioridad === selPrioridad && o.sub_prioridad === selSubPrioridad)
    return o?.nombre ?? null
  }

  return (
    <>
      <button
        onClick={handleOpen}
        className={cn(
          'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors hover:opacity-80',
          cfgActual
            ? cn(cfgActual.bgColor, cfgActual.textColor, cfgActual.borderColor)
            : 'border-dashed border-slate-300 bg-white text-slate-400 hover:border-blue-300 hover:text-blue-600'
        )}
      >
        {cfgActual
          ? `${formatPrioridad(prioridadActual, subPrioridadActual)} ${cfgActual.label}`
          : 'Sin prioridad'}
        <ChevronDown size={12} />
      </button>

      <Dialog open={open} onOpenChange={o => !o && setOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TrendingUp size={16} className="text-emerald-600" />
              Asignar prioridad
            </DialogTitle>
          </DialogHeader>

          {/* Impacto como referencia */}
          {total > 0 && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 space-y-1.5">
              <p className="text-xs font-semibold text-emerald-800">Impacto económico de este requerimiento</p>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-[10px] text-slate-500">HH anual</p>
                  <p className="text-sm font-bold text-emerald-700">{formatCOP(impactoHH)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500">Cualitativos</p>
                  <p className="text-sm font-bold text-blue-700">{formatCOP(impactoCualitativos)}</p>
                </div>
                <div className="rounded-lg bg-emerald-100">
                  <p className="text-[10px] text-slate-500 pt-0.5">Total</p>
                  <p className="text-sm font-extrabold text-emerald-800">{formatCOP(total)}</p>
                </div>
              </div>
            </div>
          )}

          {/* Selector de prioridad principal */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Prioridad principal</p>
            <div className="grid grid-cols-2 gap-2">
              {[1, 2, 3, 4].map(p => {
                const cfg = PRIORIDADES[p]
                const sel = selPrioridad === p
                return (
                  <button
                    key={p}
                    onClick={() => handleSelPrioridad(p)}
                    className={cn(
                      'rounded-xl border-2 p-3 text-left transition-all',
                      sel
                        ? cn(cfg.bgColor, cfg.borderColor, 'ring-2 ring-offset-1')
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    )}
                  >
                    <p className={cn('text-sm font-bold', sel ? cfg.textColor : 'text-slate-600')}>
                      P{p} — {cfg.label}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">SLA: {SLA_DIAS[p]} días hábiles</p>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Selector de sub-prioridad */}
          {selPrioridad && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Sub-prioridad <span className="normal-case font-normal text-slate-400">(opcional)</span>
              </p>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setSelSub(null)}
                  className={cn(
                    'rounded-lg border px-3 py-1.5 text-xs font-medium transition-all',
                    selSubPrioridad === null && selPrioridad !== null
                      ? 'border-slate-400 bg-slate-100 text-slate-700 ring-1 ring-slate-300'
                      : 'border-slate-200 bg-white text-slate-400 hover:border-slate-300',
                    isOcupada(selPrioridad, null) ? 'opacity-50 cursor-not-allowed' : ''
                  )}
                >
                  Sin sub
                  {isOcupada(selPrioridad, null) && <span className="ml-1 text-red-500">✕</span>}
                </button>
                {SUB_PRIORIDADES.map(sp => {
                  const cfg = PRIORIDADES[selPrioridad]
                  const sel = selSubPrioridad === sp
                  const ocupado = isOcupada(selPrioridad, sp)
                  return (
                    <button
                      key={sp}
                      onClick={() => setSelSub(sel ? null : sp)}
                      className={cn(
                        'rounded-lg border-2 px-3 py-1.5 text-xs font-bold transition-all',
                        sel
                          ? cn(cfg.bgColor, cfg.borderColor, cfg.textColor)
                          : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300',
                        ocupado && !sel ? 'opacity-40' : ''
                      )}
                    >
                      {selPrioridad}.{sp}
                      {ocupado && !sel && <span className="ml-0.5 text-red-400">✕</span>}
                    </button>
                  )
                })}
              </div>

              {selPrioridad && (
                <p className="mt-2 text-xs text-slate-400">
                  Prioridad seleccionada:{' '}
                  <span className="font-semibold text-slate-600">
                    {formatPrioridad(selPrioridad, selSubPrioridad)}
                    {' — '}{PRIORIDADES[selPrioridad].label}
                  </span>
                </p>
              )}
            </div>
          )}

          {/* Advertencia de conflicto */}
          {conflicto && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
              <AlertTriangle size={14} className="mt-0.5 shrink-0 text-red-500" />
              <p className="text-xs text-red-700">
                Esta prioridad ya está asignada a otro requerimiento del mismo proceso
                {getNombreConflicto() && (
                  <span className="block font-semibold mt-0.5">"{getNombreConflicto()}"</span>
                )}
              </p>
            </div>
          )}

          {!selPrioridad && (
            <p className="text-xs text-slate-400 text-center">
              Selecciona una prioridad principal, o deja sin seleccionar para quitar la prioridad.
            </p>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>Cancelar</Button>
            <Button
              onClick={handleGuardar}
              disabled={isPending || sinCambios || conflicto}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isPending ? 'Guardando...' : 'Guardar prioridad'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
