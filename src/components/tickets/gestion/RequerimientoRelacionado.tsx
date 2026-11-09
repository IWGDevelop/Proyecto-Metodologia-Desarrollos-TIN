'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { ExternalLink, Link2, Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { listarRequerimientosRelacionables } from '@/actions/tickets/bandeja'
import { relacionarRequerimientoTicket } from '@/actions/tickets/flujo'
import { SelectorRequerimiento } from '@/components/tickets/funcionario/SelectorRequerimiento'
import type { RequerimientoResumen } from '@/lib/tickets/requerimientos'
import { btnPrimario, btnSecundario } from './ui'

interface Props {
  ticketId: string
  requerimiento: RequerimientoResumen | null
  puedeEditar: boolean
  onDone: () => void
}

/** Requerimiento de desarrollo sobre el que se abrió el ticket, con opción de relacionarlo o cambiarlo */
export function RequerimientoRelacionado({ ticketId, requerimiento, puedeEditar, onDone }: Props) {
  const [abierto, setAbierto] = useState(false)
  const [lista, setLista] = useState<RequerimientoResumen[] | null>(null)
  const [elegido, setElegido] = useState(requerimiento?.id ?? '')
  const [pending, start] = useTransition()

  const abrir = () => {
    setElegido(requerimiento?.id ?? '')
    setAbierto(true)
    if (!lista) start(async () => setLista(await listarRequerimientosRelacionables()))
  }

  const guardar = () => start(async () => {
    const r = await relacionarRequerimientoTicket(ticketId, elegido || null)
    if (!r.ok) { toast.error(r.error ?? 'No se pudo guardar'); return }
    toast.success(elegido ? 'Requerimiento relacionado' : 'Relación quitada')
    setAbierto(false)
    onDone()
  })

  return (
    <div className="space-y-2">
      {requerimiento ? (
        <Link href={`/admin/requerimientos/${requerimiento.id}`} className="group flex items-start gap-2 text-sm hover:text-violet-700">
          <span className="flex-1">
            {requerimiento.numero && <span className="font-mono text-xs font-semibold text-violet-700">#{requerimiento.numero} </span>}
            {requerimiento.nombre}
            <span className="block text-[11px] text-slate-400">{requerimiento.estado === 'CERRADO' ? 'Cerrado' : requerimiento.estado === 'ENTREGADO' ? 'Entregado' : requerimiento.estado}</span>
          </span>
          <ExternalLink size={13} className="mt-0.5 shrink-0 text-slate-300 group-hover:text-violet-600" />
        </Link>
      ) : (
        <p className="text-sm text-slate-400">Sin requerimiento relacionado</p>
      )}
      {puedeEditar && (
        <button type="button" onClick={abrir} className={btnSecundario}>
          <Link2 size={13} /> {requerimiento ? 'Cambiar' : 'Relacionar requerimiento'}
        </button>
      )}

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Requerimiento relacionado</DialogTitle>
            <DialogDescription>
              Relaciona el ticket con el desarrollo entregado o cerrado al que corresponde. Queda la traza en el historial del
              ticket y en el requerimiento.
            </DialogDescription>
          </DialogHeader>
          {lista === null ? (
            <p className="flex items-center gap-2 py-4 text-sm text-slate-500"><Loader2 size={14} className="animate-spin" /> Cargando requerimientos…</p>
          ) : (
            <SelectorRequerimiento requerimientos={lista} value={elegido} onChange={setElegido} disabled={pending} />
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setAbierto(false)} className={btnSecundario} disabled={pending}>Cancelar</button>
            <button type="button" onClick={guardar} className={btnPrimario} disabled={pending || lista === null || elegido === (requerimiento?.id ?? '')}>
              {pending && lista !== null ? <Loader2 size={14} className="animate-spin" /> : null} Guardar
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
