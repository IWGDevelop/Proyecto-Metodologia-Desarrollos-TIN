'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, Layers, AlertTriangle, X } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  getPrioridadesPorProceso,
  asignarPrioridadProcesoConDesplazamiento,
  type PrioridadProcesoOcupada,
} from '@/actions/requerimientos-admin'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

const PROCESO_LABEL: Record<string, string> = {
  FINANCIERO: 'Financiero', OPERACIONES: 'Operaciones', COMERCIAL: 'Comercial',
  CARGA: 'Carga', SISTEMAS_GESTION: 'Sistemas Gestión', SERVICIO_CLIENTE: 'Serv. Cliente',
  COMPRAS: 'Compras', SEGUROS: 'Seguros', DATOS: 'Datos', TI: 'TI',
  GENERAL: 'General', PRICING: 'Pricing', ESTRATEGIA: 'Estrategia',
  MARKETING: 'Marketing', TRAFICO_SEGURIDAD: 'Tráfico y Seguridad',
}

const MAX_POSICION = 30

interface Props {
  requerimientoId: string
  proceso_interno: string | null
  prioridadProcesoActual: number | null
}

export function AsignarPrioridadProcesoBtn({
  requerimientoId,
  proceso_interno,
  prioridadProcesoActual,
}: Props) {
  const router = useRouter()
  const [open, setOpen]             = useState(false)
  const [selPos, setSelPos]         = useState<number | null>(prioridadProcesoActual)
  const [ocupadas, setOcupadas]     = useState<PrioridadProcesoOcupada[]>([])
  const [isPending, startT]         = useTransition()

  if (!proceso_interno) return null

  const labelProceso = PROCESO_LABEL[proceso_interno] ?? proceso_interno
  const sinCambios   = selPos === prioridadProcesoActual
  const ocupadaPor   = (pos: number) => ocupadas.find(o => o.prioridad_proceso === pos)
  const conflicto    = selPos !== null && !!ocupadaPor(selPos)

  const handleOpen = async () => {
    setSelPos(prioridadProcesoActual)
    setOpen(true)
    const data = await getPrioridadesPorProceso(proceso_interno, requerimientoId)
    setOcupadas(data)
  }

  const handleGuardar = () => {
    startT(async () => {
      const res = await asignarPrioridadProcesoConDesplazamiento(
        requerimientoId,
        proceso_interno,
        selPos
      )
      if (res.ok) {
        toast.success(selPos !== null ? `Posición #${selPos} en ${labelProceso} asignada` : 'Posición de proceso removida')
        setOpen(false)
        router.refresh()
      } else {
        toast.error(res.error ?? 'Error al asignar posición')
      }
    })
  }

  // Determina cuántas posiciones mostrar: ocupadas + 3 más (para nuevas entradas)
  const maxPos = Math.max(MAX_POSICION, (ocupadas.length > 0 ? Math.max(...ocupadas.map(o => o.prioridad_proceso)) : 0) + 3)
  const posiciones = Array.from({ length: Math.min(maxPos, MAX_POSICION) }, (_, i) => i + 1)

  return (
    <>
      <button
        onClick={handleOpen}
        className={cn(
          'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors hover:opacity-80',
          prioridadProcesoActual !== null
            ? 'border-violet-300 bg-violet-100 text-violet-700'
            : 'border-dashed border-slate-300 bg-white text-slate-400 hover:border-violet-300 hover:text-violet-600'
        )}
      >
        <Layers size={12} />
        {prioridadProcesoActual !== null
          ? `#${prioridadProcesoActual} ${labelProceso}`
          : `Pos. ${labelProceso}`}
        <ChevronDown size={12} />
      </button>

      <Dialog open={open} onOpenChange={o => !o && setOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers size={16} className="text-violet-600" />
              Prioridad dentro de {labelProceso}
            </DialogTitle>
          </DialogHeader>

          <p className="text-xs text-slate-500">
            Selecciona la posición de este desarrollo dentro del proceso <strong>{labelProceso}</strong>.
            Si la posición ya está ocupada, los demás se desplazarán automáticamente.
          </p>

          {/* Grid de posiciones */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Posición en el proceso</p>
            <div className="grid grid-cols-5 gap-1.5 max-h-56 overflow-y-auto pr-1">
              {posiciones.map(pos => {
                const ocu = ocupadaPor(pos)
                const sel = selPos === pos
                return (
                  <button
                    key={pos}
                    onClick={() => setSelPos(sel ? null : pos)}
                    title={ocu ? `Ocupado por: ${ocu.nombre}` : `Posición #${pos}`}
                    className={cn(
                      'rounded-lg border-2 py-2 text-xs font-bold transition-all relative',
                      sel
                        ? 'border-violet-500 bg-violet-100 text-violet-700 ring-2 ring-violet-200 ring-offset-1'
                        : ocu
                        ? 'border-amber-200 bg-amber-50 text-amber-700 hover:border-amber-300'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-violet-300 hover:bg-violet-50'
                    )}
                  >
                    #{pos}
                    {ocu && !sel && (
                      <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-amber-400" />
                    )}
                  </button>
                )
              })}
            </div>
            <div className="mt-2 flex items-center gap-3 text-[10px] text-slate-400">
              <span className="flex items-center gap-1">
                <span className="inline-block h-2.5 w-2.5 rounded border-2 border-amber-200 bg-amber-50" /> Ocupado
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-2.5 w-2.5 rounded border-2 border-violet-500 bg-violet-100" /> Seleccionado
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-2.5 w-2.5 rounded border-2 border-slate-200 bg-white" /> Libre
              </span>
            </div>
          </div>

          {/* Lista de ocupados */}
          {ocupadas.length > 0 && (
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                Posiciones asignadas en {labelProceso}
              </p>
              <div className="space-y-1 max-h-28 overflow-y-auto">
                {[...ocupadas].sort((a, b) => a.prioridad_proceso - b.prioridad_proceso).map(o => (
                  <div key={o.prioridad_proceso} className="flex items-center gap-2">
                    <span className="shrink-0 rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-bold text-violet-700">
                      #{o.prioridad_proceso}
                    </span>
                    <span className="truncate text-xs text-slate-600">{o.nombre}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Aviso de desplazamiento */}
          {conflicto && selPos !== null && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
              <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-500" />
              <p className="text-xs text-amber-700">
                Posición #{selPos} está ocupada por{' '}
                <span className="font-semibold">"{ocupadaPor(selPos)?.nombre}"</span>.
                Al guardar, los demás se desplazarán hacia abajo automáticamente.
              </p>
            </div>
          )}

          {selPos !== null && (
            <p className="text-center text-xs text-slate-500">
              Posición seleccionada:{' '}
              <span className="font-semibold text-violet-700">#{selPos} en {labelProceso}</span>
            </p>
          )}

          {/* Botón quitar */}
          {prioridadProcesoActual !== null && (
            <button
              onClick={() => setSelPos(null)}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-red-500 mx-auto"
            >
              <X size={11} /> Quitar posición de proceso
            </button>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>Cancelar</Button>
            <Button
              onClick={handleGuardar}
              disabled={isPending || sinCambios}
              className="bg-violet-600 hover:bg-violet-700"
            >
              {isPending ? 'Guardando...' : 'Guardar posición'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
