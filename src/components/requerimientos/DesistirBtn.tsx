'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Ban, AlertTriangle } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { cambiarEstado } from '@/actions/requerimientos'
import { toast } from 'sonner'

const ESTADOS_FINALES = ['DESISTIDO', 'CERRADO', 'ENTREGADO']

interface Props {
  requerimientoId: string
  estadoActual: string
}

export function DesistirBtn({ requerimientoId, estadoActual }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [observacion, setObservacion] = useState('')
  const [isPending, startT] = useTransition()

  if (ESTADOS_FINALES.includes(estadoActual)) return null

  const handleConfirmar = () => {
    startT(async () => {
      try {
        await cambiarEstado(requerimientoId, 'DESISTIDO', observacion || undefined)
        toast.success('Solicitud marcada como desistida')
        setOpen(false)
        router.refresh()
      } catch (err: any) {
        toast.error(err?.message ?? 'Error al desistir la solicitud')
      }
    })
  }

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => { setObservacion(''); setOpen(true) }}
        className="gap-1.5 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
      >
        <Ban size={13} /> Desistir solicitud
      </Button>

      <Dialog open={open} onOpenChange={o => !o && setOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Desistir solicitud</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-800">
              <AlertTriangle size={15} className="shrink-0 mt-0.5" />
              <p>
                Al desistir, esta solicitud quedará marcada como <strong>Desistida</strong> y el equipo TIN no continuará su desarrollo. Esta acción no se puede deshacer fácilmente.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="motivo">Motivo del desistimiento (opcional)</Label>
              <Textarea
                id="motivo"
                rows={3}
                placeholder="Explica brevemente por qué desistes de esta solicitud..."
                value={observacion}
                onChange={e => setObservacion(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmar}
              disabled={isPending}
              className="gap-1.5 bg-red-600 hover:bg-red-700"
            >
              <Ban size={13} />
              {isPending ? 'Procesando...' : 'Confirmar desistimiento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
