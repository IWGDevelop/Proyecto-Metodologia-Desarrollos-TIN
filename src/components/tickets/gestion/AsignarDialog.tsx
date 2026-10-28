'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { UserPlus } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { asignarTicket } from '@/actions/tickets/flujo'
import type { ResponsableOpcion } from '@/actions/tickets/bandeja'
import { btnPrimario, btnSecundario, inputCls } from './ui'

export function AsignarDialog({
  open, onOpenChange, ticketId, codigo, responsableActualId, responsables, onDone,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  ticketId: string
  codigo: string
  responsableActualId: string | null
  responsables: ResponsableOpcion[]
  onDone: () => void
}) {
  const [responsableId, setResponsableId] = useState('')
  const [motivo, setMotivo] = useState('')
  const [pending, startT] = useTransition()
  const reasignacion = !!responsableActualId

  const guardar = () => {
    if (!responsableId) { toast.error('Selecciona un responsable'); return }
    if (reasignacion && !motivo.trim()) { toast.error('Indica el motivo de la reasignación'); return }
    startT(async () => {
      const res = await asignarTicket(ticketId, responsableId, motivo.trim() || undefined)
      if (!res.ok) { toast.error(res.error ?? 'No se pudo asignar'); return }
      toast.success(reasignacion ? 'Ticket reasignado' : 'Ticket asignado')
      setResponsableId('')
      setMotivo('')
      onOpenChange(false)
      onDone()
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus size={16} className="text-blue-600" />
            {reasignacion ? 'Reasignar' : 'Asignar'} {codigo}
          </DialogTitle>
          <DialogDescription>
            {reasignacion
              ? 'Se registra el responsable anterior y el nuevo, quién hizo el cambio y el motivo.'
              : 'El ticket pasa a Asignado y el responsable recibe un correo.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <label className="block text-xs font-semibold text-slate-600">
            Responsable
            <select value={responsableId} onChange={e => setResponsableId(e.target.value)} className={`${inputCls} mt-1`}>
              <option value="">Selecciona…</option>
              {responsables.filter(r => r.id !== responsableActualId).map(r => (
                <option key={r.id} value={r.id}>{r.nombre_completo}</option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-semibold text-slate-600">
            Motivo {reasignacion ? '' : '(opcional)'}
            <textarea value={motivo} onChange={e => setMotivo(e.target.value)} rows={3} className={`${inputCls} mt-1`} placeholder={reasignacion ? 'Por qué se reasigna' : 'Comentario para el responsable'} />
          </label>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => onOpenChange(false)} className={btnSecundario}>Cancelar</button>
            <button type="button" onClick={guardar} disabled={pending} className={btnPrimario}>
              {pending ? 'Guardando…' : reasignacion ? 'Reasignar' : 'Asignar'}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
