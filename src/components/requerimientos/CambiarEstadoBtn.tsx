'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, AlertTriangle } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { getEstadosKanban } from '@/actions/estados-kanban'
import { cambiarEstado } from '@/actions/requerimientos'
import { guardarImpactoReal } from '@/actions/impacto-real'
import { COLOR_PALETTE } from '@/lib/constants'
import { toast } from 'sonner'
import { cn, formatCOP } from '@/lib/utils'
import type { EstadoKanban } from '@/lib/supabase/types'

const ESTADOS_FINALIZADOS = ['ENTREGADO', 'CERRADO']

const FECHA_LABEL: Record<string, string> = {
  EN_DESARROLLO: 'Fecha de inicio de desarrollo',
  ENTREGADO:     'Fecha de entrega',
  CERRADO:       'Fecha de cierre',
}

interface Props {
  requerimientoId: string
  estadoActual: string
  /** valores estimados para pre-llenar el impacto real */
  horasEstimadas?: number | null
  valorHoraEstimado?: number | null
}

export function CambiarEstadoBtn({
  requerimientoId, estadoActual, horasEstimadas, valorHoraEstimado,
}: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [estadoDestino, setEstadoDestino] = useState<EstadoKanban | null>(null)
  const [observacion, setObservacion] = useState('')
  const [isPending, startT] = useTransition()

  const hoyISO = () => new Date().toISOString().split('T')[0]
  const [fechaTransicion, setFechaTransicion] = useState(hoyISO)

  // Impacto real quick-fill
  const [showImpacto, setShowImpacto] = useState(false)
  const [horasMes, setHorasMes]       = useState<number>(horasEstimadas ?? 0)
  const [valorHora, setValorHora]     = useState<number>(valorHoraEstimado ?? 0)

  const { data: estados = [] } = useQuery<EstadoKanban[]>({
    queryKey: ['estados-kanban'],
    queryFn: getEstadosKanban,
    staleTime: 120_000,
  })

  const estadosDisponibles = estados.filter(e => e.activo && e.nombre !== estadoActual)
  const cfgActual = estados.find(e => e.nombre === estadoActual)
  const coloresActual = COLOR_PALETTE[cfgActual?.color_key ?? 'slate'] ?? COLOR_PALETTE['slate']

  const abrirDialog = (e: EstadoKanban) => {
    setEstadoDestino(e)
    setObservacion('')
    setShowImpacto(false)
    setHorasMes(horasEstimadas ?? 0)
    setValorHora(valorHoraEstimado ?? 0)
    setFechaTransicion(hoyISO())
    setOpen(true)
  }

  const handleConfirmar = () => {
    if (!estadoDestino) return
    if (estadoDestino.nombre === 'STAND_BY' && !observacion.trim()) {
      toast.error('El motivo del stand by es obligatorio')
      return
    }

    startT(async () => {
      try {
        await cambiarEstado(
          requerimientoId, estadoDestino.nombre, observacion || undefined,
          estadoDestino.nombre in FECHA_LABEL ? fechaTransicion : undefined
        )

        if (ESTADOS_FINALIZADOS.includes(estadoDestino.nombre) && showImpacto && horasMes > 0) {
          const ahorroMensual = Math.round(horasMes * valorHora)
          const ahorroAnual   = ahorroMensual * 12
          await guardarImpactoReal(requerimientoId, {
            horas_ahorradas_mes_real: horasMes,
            ahorro_mensual_cop_real:  ahorroMensual,
            ahorro_anual_cop_real:    ahorroAnual,
            beneficios_cualitativos_real: [],
            total_beneficios_cualitativos_anual_real: null,
            impacto_economico_total_anual_real: ahorroAnual,
          })
        }

        toast.success(`Estado cambiado a ${estadoDestino.label}`)
        setOpen(false)
        router.refresh()
      } catch (err: any) {
        toast.error(err?.message ?? 'Error al cambiar estado')
      }
    })
  }

  const ahorroAnual = Math.round(horasMes * valorHora) * 12

  return (
    <>
      {/* Dropdown trigger */}
      <div className="relative group">
        <button className={cn(
          'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors hover:opacity-80',
          coloresActual.bg, coloresActual.text, coloresActual.border
        )}>
          {cfgActual?.icono} {cfgActual?.label ?? estadoActual}
          <ChevronDown size={12} />
        </button>

        {/* Dropdown */}
        <div className="absolute left-0 top-full z-50 mt-1 hidden min-w-[220px] rounded-xl border border-slate-200 bg-white py-1 shadow-lg group-hover:block group-focus-within:block">
          <p className="px-3 py-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">Cambiar estado a</p>
          {estadosDisponibles.map(e => {
            const col = COLOR_PALETTE[e.color_key] ?? COLOR_PALETTE['slate']
            return (
              <button
                key={e.nombre}
                onClick={() => abrirDialog(e)}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-sm hover:bg-slate-50 text-left"
              >
                <span>{e.icono}</span>
                <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', col.bg, col.text)}>
                  {e.label}
                </span>
                {ESTADOS_FINALIZADOS.includes(e.nombre) && (
                  <span className="ml-auto text-xs text-emerald-600 font-medium">Finaliza</span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Dialog de confirmación */}
      <Dialog open={open} onOpenChange={o => !o && setOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cambiar estado</DialogTitle>
          </DialogHeader>

          {estadoDestino && (
            <div className="space-y-4">
              {/* De → A */}
              <div className="flex items-center gap-2 flex-wrap text-sm">
                {cfgActual && (() => {
                  const col = COLOR_PALETTE[cfgActual.color_key] ?? COLOR_PALETTE['slate']
                  return (
                    <span className={cn('rounded-full px-2.5 py-1 text-xs font-medium', col.bg, col.text)}>
                      {cfgActual.icono} {cfgActual.label}
                    </span>
                  )
                })()}
                <span className="text-slate-400">→</span>
                {(() => {
                  const col = COLOR_PALETTE[estadoDestino.color_key] ?? COLOR_PALETTE['slate']
                  return (
                    <span className={cn('rounded-full px-2.5 py-1 text-xs font-semibold', col.bg, col.text)}>
                      {estadoDestino.icono} {estadoDestino.label}
                    </span>
                  )
                })()}
              </div>

              {/* Fecha de transición */}
              {estadoDestino.nombre in FECHA_LABEL && (
                <div className="space-y-1.5">
                  <Label className="text-sm">
                    {FECHA_LABEL[estadoDestino.nombre]} <span className="text-red-500">*</span>
                  </Label>
                  <input
                    type="date"
                    value={fechaTransicion}
                    onChange={e => setFechaTransicion(e.target.value)}
                    max={hoyISO()}
                    className="w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-blue-400"
                  />
                </div>
              )}

              {/* Observación */}
              <div className="space-y-1.5">
                <Label className="text-sm">
                  {estadoDestino.nombre === 'STAND_BY'
                    ? <span>Motivo del stand by <span className="text-red-500">*</span></span>
                    : 'Observación (opcional)'}
                </Label>
                <Textarea
                  rows={3}
                  placeholder={estadoDestino.nombre === 'STAND_BY'
                    ? 'Describe el motivo por el que entra en stand by...'
                    : 'Agrega una observación al cambio de estado...'}
                  value={observacion}
                  onChange={e => setObservacion(e.target.value)}
                />
              </div>

              {/* Impacto real al finalizar */}
              {ESTADOS_FINALIZADOS.includes(estadoDestino.nombre) && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-emerald-800">
                      📊 Registrar impacto real (opcional)
                    </p>
                    <button
                      onClick={() => setShowImpacto(v => !v)}
                      className="text-xs text-emerald-600 hover:underline"
                    >
                      {showImpacto ? 'Ocultar' : 'Completar ahora'}
                    </button>
                  </div>
                  {!showImpacto ? (
                    <p className="text-xs text-emerald-700">
                      Puedes registrar las horas y ahorros reales ahora o después desde el detalle → pestaña <strong>Impacto Real</strong>.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-xs text-slate-500">
                            Horas ahorradas/mes
                            {horasEstimadas && <span className="ml-1 text-slate-400">(est. {horasEstimadas} h)</span>}
                          </label>
                          <input
                            type="number" min={0} step={0.5}
                            value={horasMes}
                            onChange={e => setHorasMes(parseFloat(e.target.value) || 0)}
                            className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-emerald-400"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-slate-500">Valor hora hombre (COP)</label>
                          <input
                            type="number" min={0} step={1000}
                            value={valorHora}
                            onChange={e => setValorHora(parseFloat(e.target.value) || 0)}
                            className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-emerald-400"
                          />
                        </div>
                      </div>
                      {horasMes > 0 && valorHora > 0 && (
                        <p className="rounded-lg bg-emerald-100 px-3 py-2 text-xs text-emerald-800">
                          Ahorro anual real: <strong>{formatCOP(ahorroAnual)}</strong>
                          <br />
                          <span className="text-emerald-600">Los beneficios cualitativos se completan desde el detalle</span>
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Aviso CERRADO */}
              {estadoDestino.nombre === 'CERRADO' && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                  El estado <strong>Cerrado</strong> es definitivo y el requerimiento no aparecerá en el Kanban activo.
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmar}
              disabled={
                isPending ||
                (estadoDestino?.nombre === 'STAND_BY' && !observacion.trim())
              }
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isPending ? 'Guardando...' : 'Confirmar cambio'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
