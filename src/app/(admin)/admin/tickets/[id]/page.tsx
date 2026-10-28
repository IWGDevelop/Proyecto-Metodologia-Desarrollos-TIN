import Link from 'next/link'
import { notFound } from 'next/navigation'
import { puedeGestionar } from '@/lib/supabase/guards'
import { RECURSOS_TICKETS } from '@/lib/tickets/constantes'
import { obtenerTicketGestion, listarResponsables, listarTipologiasReclasificar } from '@/actions/tickets/bandeja'
import { GestionTicket } from '@/components/tickets/gestion/GestionTicket'

export const dynamic = 'force-dynamic'

export default async function TicketGestionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!(await puedeGestionar(RECURSOS_TICKETS.MENU_BANDEJA))) {
    return (
      <div className="p-6">
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          No tienes permisos para la gestión de tickets. Consulta tu solicitud en{' '}
          <Link href={`/mis-tickets/${id}`} className="font-semibold underline">Mis tickets</Link>.
        </p>
      </div>
    )
  }

  const ticket = await obtenerTicketGestion(id)
  if (!ticket) notFound()

  const [responsables, tipologias] = await Promise.all([
    ticket.permisos.coordinar ? listarResponsables() : Promise.resolve([]),
    ticket.permisos.gestionar ? listarTipologiasReclasificar() : Promise.resolve([]),
  ])

  return (
    <div className="p-6">
      <GestionTicket ticket={ticket} responsables={responsables} tipologias={tipologias} />
    </div>
  )
}
