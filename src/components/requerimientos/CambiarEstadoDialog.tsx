'use client'

import { useState, useTransition } from 'react'
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { ESTADOS, getEstadoCfg } from '@/lib/constants'
import { cambiarEstado } from '@/actions/requerimientos'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import type { Estado } from '@/lib/supabase/types'

const hoyISO = () => new Date().toISOString().split('T')[0]

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  requerimientoId: string
  estadoActual: Estado
  onSuccess?: () => void
}

export function CambiarEstadoDialog({
  open, onOpenChange, requerimientoId, estadoActual, onSuccess,
}: Props) {
  const [nuevoEstado, setNuevoEstado] = useState<Estado>(estadoActual)
  const [observacion, setObservacion] = useState('')
  const [fechaEntregado, setFechaEntregado] = useState(hoyISO)
  const [isPending, startTransition] = useTransition()

  const handleSubmit = () => {
    if (nuevoEstado === estadoActual) {
      toast.error('El estado seleccionado es igual al actual')
      return
    }
    startTransition(async () => {
      try {
        await cambiarEstado(
          requerimientoId, nuevoEstado, observacion,
          nuevoEstado === 'ENTREGADO' ? fechaEntregado : undefined
        )
        toast.success(`Estado cambiado a "${getEstadoCfg(nuevoEstado).label}"`)
        onOpenChange(false)
        setObservacion('')
        setFechaEntregado(hoyISO())
        onSuccess?.()
      } catch (err) {
        toast.error('Error al cambiar estado')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cambiar estado</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-500">Estado actual</Label>
            <div className={cn(
              'inline-flex rounded-full px-3 py-1 text-xs font-medium',
              getEstadoCfg(estadoActual).bgColor,
              getEstadoCfg(estadoActual).textColor
            )}>
              {getEstadoCfg(estadoActual).label}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="nuevo-estado">Nuevo estado</Label>
            <Select value={nuevoEstado} onValueChange={v => setNuevoEstado(v as Estado)}>
              <SelectTrigger id="nuevo-estado">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(ESTADOS) as [Estado, typeof ESTADOS[Estado]][]).map(([key, cfg]) => (
                  <SelectItem key={key} value={key}>
                    <span className={cn('rounded-full px-2 py-0.5 text-xs', cfg.bgColor, cfg.textColor)}>
                      {cfg.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {nuevoEstado === 'ENTREGADO' && (
            <div className="space-y-1.5">
              <Label htmlFor="fecha-entregado">
                Fecha de entrega <span className="text-red-500">*</span>
              </Label>
              <Input
                id="fecha-entregado"
                type="date"
                value={fechaEntregado}
                onChange={e => setFechaEntregado(e.target.value)}
                max={hoyISO()}
                className="text-sm"
              />
              <p className="text-[11px] text-slate-400">Se usa para el informe de entregas por mes</p>
            </div>
          )}

          {nuevoEstado === 'STAND_BY' && (
            <div className="space-y-1.5">
              <Label htmlFor="observacion">
                Motivo del stand by <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="observacion"
                placeholder="Describe el motivo del stand by..."
                value={observacion}
                onChange={e => setObservacion(e.target.value)}
                rows={3}
              />
            </div>
          )}

          {nuevoEstado !== 'STAND_BY' && (
            <div className="space-y-1.5">
              <Label htmlFor="observacion">Observación (opcional)</Label>
              <Textarea
                id="observacion"
                placeholder="Agrega una observación al cambio de estado..."
                value={observacion}
                onChange={e => setObservacion(e.target.value)}
                rows={3}
              />
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending || (nuevoEstado === 'STAND_BY' && !observacion.trim())}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isPending ? 'Guardando...' : 'Confirmar cambio'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
