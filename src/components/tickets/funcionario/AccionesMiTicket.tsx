'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { CheckCircle2, Loader2, MessageSquare, Paperclip, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { SubirAdjuntos, type AdjuntoNuevo } from '@/components/tickets/SubirAdjuntos'
import { registrarAdjuntos } from '@/actions/tickets/adjuntos'
import { agregarComentarioTicket, confirmarSolucionTicket, reabrirTicket } from '@/actions/tickets/flujo'
import type { EstadoTicket } from '@/lib/tickets/types'

/** Confirmar la solución o reabrir (ticket en RESUELTO) */
export function DecisionResuelto({ ticketId }: { ticketId: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [reabriendo, setReabriendo] = useState(false)
  const [motivo, setMotivo] = useState('')

  const confirmar = () => start(async () => {
    const r = await confirmarSolucionTicket(ticketId)
    if (!r.ok) { toast.error(r.error ?? 'No se pudo confirmar'); return }
    toast.success('¡Gracias! El ticket quedó cerrado')
    router.refresh()
  })

  const reabrir = () => start(async () => {
    if (!motivo.trim()) { toast.error('Cuéntanos por qué no quedó resuelto'); return }
    const r = await reabrirTicket(ticketId, motivo.trim())
    if (!r.ok) { toast.error(r.error ?? 'No se pudo reabrir'); return }
    toast.success('Ticket reabierto; TIN lo retomará')
    setReabriendo(false)
    setMotivo('')
    router.refresh()
  })

  return (
    <div className="space-y-3">
      {!reabriendo ? (
        <div className="flex flex-wrap gap-2">
          <Button onClick={confirmar} disabled={pending} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
            {pending ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            Sí, quedó resuelto
          </Button>
          <Button variant="outline" onClick={() => setReabriendo(true)} disabled={pending} className="gap-1.5">
            <RotateCcw size={14} /> No, reabrir
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <Textarea
            value={motivo}
            onChange={e => setMotivo(e.target.value)}
            rows={3}
            placeholder="¿Qué sigue fallando o qué falta?"
            aria-label="Motivo de la reapertura"
          />
          <div className="flex gap-2">
            <Button onClick={reabrir} disabled={pending} className="gap-1.5">
              {pending ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
              Reabrir ticket
            </Button>
            <Button variant="ghost" onClick={() => setReabriendo(false)} disabled={pending}>Cancelar</Button>
          </div>
        </div>
      )}
    </div>
  )
}

/** Comentar y adjuntar archivos desde la vista del solicitante */
export function ComentarYAdjuntar({ ticketId, estado }: { ticketId: string; estado: EstadoTicket }) {
  const router = useRouter()
  const [texto, setTexto] = useState('')
  const [adjuntos, setAdjuntos] = useState<AdjuntoNuevo[]>([])
  const [mostrarAdjuntos, setMostrarAdjuntos] = useState(estado === 'ESPERA_USUARIO')
  const [pending, start] = useTransition()

  const enviar = () => start(async () => {
    if (!texto.trim() && adjuntos.length === 0) { toast.error('Escribe un comentario o adjunta un archivo'); return }
    const n = adjuntos.length
    if (n > 0) {
      const r = await registrarAdjuntos(ticketId, adjuntos)
      if (!r.ok) { toast.error(r.error ?? 'No se pudieron guardar los adjuntos'); return }
      setAdjuntos([])
    }
    // En espera de usuario, la respuesta (aunque solo sean adjuntos) devuelve el ticket a En proceso
    const comentario = texto.trim() || (estado === 'ESPERA_USUARIO' && n > 0 ? `Adjunté ${n} archivo${n === 1 ? '' : 's'} con lo solicitado.` : '')
    if (comentario) {
      const r = await agregarComentarioTicket(ticketId, comentario, true)
      if (!r.ok) { toast.error(r.error ?? 'No se pudo enviar el comentario'); return }
      setTexto('')
    }
    toast.success(estado === 'ESPERA_USUARIO' ? 'Respuesta enviada a TIN' : 'Enviado')
    router.refresh()
  })

  return (
    <div className="space-y-3">
      <Textarea
        value={texto}
        onChange={e => setTexto(e.target.value)}
        rows={3}
        placeholder={estado === 'ESPERA_USUARIO' ? 'Responde lo que TIN te pidió…' : 'Escribe un comentario para TIN…'}
        aria-label="Comentario"
        disabled={pending}
      />
      {mostrarAdjuntos && (
        <SubirAdjuntos carpeta={ticketId} value={adjuntos} onChange={setAdjuntos} disabled={pending} />
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={enviar} disabled={pending} className="gap-1.5 bg-blue-600 hover:bg-blue-700">
          {pending ? <Loader2 size={14} className="animate-spin" /> : <MessageSquare size={14} />}
          {estado === 'ESPERA_USUARIO' ? 'Enviar respuesta' : 'Enviar'}
        </Button>
        {!mostrarAdjuntos && (
          <Button variant="outline" onClick={() => setMostrarAdjuntos(true)} disabled={pending} className="gap-1.5">
            <Paperclip size={14} /> Adjuntar archivos
          </Button>
        )}
      </div>
    </div>
  )
}
