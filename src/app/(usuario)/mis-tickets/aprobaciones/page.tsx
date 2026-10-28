import { CheckSquare } from 'lucide-react'
import { listarAprobacionesPendientes } from '@/actions/tickets/bandeja'
import { AprobacionesTickets } from '@/components/tickets/gestion/AprobacionesTickets'

export const dynamic = 'force-dynamic'

export default async function AprobacionesTicketsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const sp = await searchParams
  const ticket = Array.isArray(sp.ticket) ? sp.ticket[0] : sp.ticket
  const aprobaciones = await listarAprobacionesPendientes()

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-slate-800">
          <CheckSquare size={20} className="text-emerald-600" /> Aprobar tickets
        </h1>
        <p className="text-sm text-slate-500">
          Solicitudes de TI que requieren tu aprobación. Al aprobar, pasan a la mesa de ayuda de TIN; al rechazar, se cierran y el solicitante recibe el motivo.
        </p>
      </div>
      <AprobacionesTickets aprobaciones={aprobaciones} resaltar={ticket} />
    </div>
  )
}
