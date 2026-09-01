'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { cambiarEstadoCasoUsoIA } from '@/actions/casos-uso-ia'
import { BadgeEstadoCasoIA } from './BadgeEstadoCasoIA'
import type { EstadoCasoUsoIA, NivelRiesgoIA } from '@/lib/supabase/types'

// Transiciones permitidas por estado
const TRANSICIONES: Partial<Record<EstadoCasoUsoIA, EstadoCasoUsoIA[]>> = {
  RECIBIDO:             ['EN_EVALUACION'],
  EN_EVALUACION:        ['AUTORIZADO', 'EN_AJUSTE'],
  EN_AJUSTE:            ['RECIBIDO'],
  AUTORIZADO:           ['HABILITADO'],
  HABILITADO:           ['EN_OPERACION'],
  EN_OPERACION:         ['RENOVACION_PENDIENTE', 'SUSPENDIDO'],
  RENOVACION_PENDIENTE: ['EN_EVALUACION', 'REVOCADO_VENCIDO'],
  SUSPENDIDO:           ['EN_OPERACION', 'REVOCADO_VENCIDO'],
}

const LABEL_BTN: Partial<Record<EstadoCasoUsoIA, string>> = {
  EN_EVALUACION:        'Tomar para evaluación',
  AUTORIZADO:           'Autorizar caso de uso',
  EN_AJUSTE:            'Enviar a ajuste',
  HABILITADO:           'Habilitar herramienta',
  EN_OPERACION:         'Poner en operación',
  RENOVACION_PENDIENTE: 'Marcar renovación pendiente',
  SUSPENDIDO:           'Suspender',
  REVOCADO_VENCIDO:     'Revocar / Marcar vencido',
  RECIBIDO:             'Retornar a Recibido',
}

const COLOR_BTN: Partial<Record<EstadoCasoUsoIA, string>> = {
  AUTORIZADO:       'bg-emerald-600 hover:bg-emerald-700',
  EN_OPERACION:     'bg-green-600 hover:bg-green-700',
  HABILITADO:       'bg-teal-600 hover:bg-teal-700',
  SUSPENDIDO:       'bg-red-600 hover:bg-red-700',
  REVOCADO_VENCIDO: 'bg-slate-600 hover:bg-slate-700',
  EN_AJUSTE:        'bg-amber-600 hover:bg-amber-700',
}

interface Props {
  casoId: string
  estadoActual: EstadoCasoUsoIA
}

export function CambiarEstadoCasoIA({ casoId, estadoActual }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [estadoTarget, setEstadoTarget] = useState<EstadoCasoUsoIA | null>(null)
  const [comentario, setComentario] = useState('')
  const [nivelRiesgo, setNivelRiesgo] = useState<NivelRiesgoIA | ''>('')
  const [observaciones, setObservaciones] = useState('')
  const [fechaAuth, setFechaAuth] = useState('')
  const [fechaVenc, setFechaVenc] = useState('')

  const siguientes = TRANSICIONES[estadoActual] ?? []

  function abrirDialog(estado: EstadoCasoUsoIA) {
    setEstadoTarget(estado)
    setComentario('')
    setNivelRiesgo('')
    setObservaciones('')
    setFechaAuth('')
    setFechaVenc('')
  }

  function cerrar() { setEstadoTarget(null) }

  function confirmar() {
    if (!estadoTarget) return
    startTransition(async () => {
      const res = await cambiarEstadoCasoUsoIA(casoId, estadoTarget, comentario || undefined, {
        nivel_riesgo:       nivelRiesgo || undefined,
        observaciones_ajuste: observaciones || undefined,
        fecha_autorizacion: fechaAuth || undefined,
        fecha_vencimiento:  fechaVenc || undefined,
      })
      if (!res.ok) { toast.error(res.error ?? 'Error al cambiar estado'); return }
      toast.success('Estado actualizado')
      cerrar()
      router.refresh()
    })
  }

  if (siguientes.length === 0) return null

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {siguientes.map(est => (
          <button
            key={est}
            onClick={() => abrirDialog(est)}
            className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors ${COLOR_BTN[est] ?? 'bg-violet-600 hover:bg-violet-700'}`}
          >
            {LABEL_BTN[est] ?? est}
          </button>
        ))}
      </div>

      {/* Modal */}
      {estadoTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-slate-800">Cambiar estado</h3>
            <div className="flex items-center gap-3">
              <BadgeEstadoCasoIA estado={estadoActual} />
              <span className="text-slate-400">→</span>
              <BadgeEstadoCasoIA estado={estadoTarget} />
            </div>

            {estadoTarget === 'EN_EVALUACION' && (
              <div className="space-y-1">
                <Label>Nivel de riesgo (opcional)</Label>
                <select
                  value={nivelRiesgo}
                  onChange={e => setNivelRiesgo(e.target.value as NivelRiesgoIA | '')}
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  <option value="">Por definir</option>
                  {(['BAJO','MEDIO','ALTO','CRITICO'] as NivelRiesgoIA[]).map(n => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
            )}

            {estadoTarget === 'EN_AJUSTE' && (
              <div className="space-y-1">
                <Label>Retroalimentación para el solicitante <span className="text-red-500">*</span></Label>
                <Textarea
                  value={observaciones}
                  onChange={e => setObservaciones(e.target.value)}
                  rows={3}
                  placeholder="Indica qué aspectos debe ajustar el solicitante (alcance, datos, herramienta, controles, responsables)..."
                />
              </div>
            )}

            {estadoTarget === 'AUTORIZADO' && (
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label>Fecha de autorización</Label>
                  <input
                    type="date"
                    value={fechaAuth}
                    onChange={e => setFechaAuth(e.target.value)}
                    className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Fecha de vencimiento (máx. 12 meses)</Label>
                  <input
                    type="date"
                    value={fechaVenc}
                    onChange={e => setFechaVenc(e.target.value)}
                    className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1">
              <Label>Comentario / Observación</Label>
              <Textarea
                value={comentario}
                onChange={e => setComentario(e.target.value)}
                rows={2}
                placeholder="Comentario opcional para el historial..."
              />
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={cerrar} disabled={isPending}>Cancelar</Button>
              <Button
                onClick={confirmar}
                disabled={isPending || (estadoTarget === 'EN_AJUSTE' && !observaciones.trim())}
                className={COLOR_BTN[estadoTarget] ?? 'bg-violet-600 hover:bg-violet-700'}
              >
                {isPending ? 'Guardando...' : 'Confirmar'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
