import Link from 'next/link'
import { Plus, Ticket } from 'lucide-react'
import { puedeGestionar } from '@/lib/supabase/guards'
import { contextoTickets, esPersonalTIN } from '@/lib/tickets/acceso-gestion'
import { ESTADOS_TICKET, PRIORIDADES_TICKET, RECURSOS_TICKETS } from '@/lib/tickets/constantes'
import type { EstadoTicket, PrioridadTicket } from '@/lib/tickets/types'
import {
  listarTicketsBandeja, obtenerKpisBandeja, listarResponsables, listarCategoriasBandeja, type FiltrosBandeja,
} from '@/actions/tickets/bandeja'
import { AvisosTickets } from '@/components/tickets/AvisosTickets'
import { BandejaTickets } from '@/components/tickets/gestion/BandejaTickets'

export const dynamic = 'force-dynamic'

type SP = Promise<{ [key: string]: string | string[] | undefined }>

function uno(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v
}

export default async function BandejaTicketsPage({ searchParams }: { searchParams: SP }) {
  const [puedeMenu, ctx] = await Promise.all([puedeGestionar(RECURSOS_TICKETS.MENU_BANDEJA), contextoTickets()])
  if (!puedeMenu || !ctx || !esPersonalTIN(ctx)) {
    return (
      <div className="p-6">
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          No tienes permisos para la bandeja de tickets. Para crear o consultar tus solicitudes ve a{' '}
          <Link href="/mis-tickets" className="font-semibold underline">Mis tickets</Link>.
        </p>
      </div>
    )
  }

  const sp = await searchParams
  const estado = uno(sp.estado)
  const prioridad = uno(sp.prioridad)
  const filtros: FiltrosBandeja = {
    estado: estado === 'TODOS' || ESTADOS_TICKET.some(e => e.value === estado) ? (estado as EstadoTicket | 'TODOS') : 'ABIERTOS',
    responsableId: uno(sp.responsable) || undefined,
    categoriaId: uno(sp.categoria) || undefined,
    prioridad: PRIORIDADES_TICKET.some(p => p.value === prioridad) ? (prioridad as PrioridadTicket) : undefined,
    vencidos: uno(sp.vencidos) === '1',
    sinAsignar: uno(sp.sinAsignar) === '1',
    misAsignados: uno(sp.mios) === '1',
    q: uno(sp.q)?.slice(0, 100) || undefined,
  }

  const [filas, kpis, responsables, categorias] = await Promise.all([
    listarTicketsBandeja(filtros),
    obtenerKpisBandeja(),
    listarResponsables(),
    listarCategoriasBandeja(),
  ])

  return (
    <div className="space-y-5 p-6">
      <AvisosTickets />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-slate-800">
            <Ticket size={20} className="text-blue-600" /> Bandeja de tickets
          </h1>
          <p className="text-sm text-slate-500">
            {ctx.coordinar || ctx.esAdmin
              ? 'Todos los tickets de soporte de TI. Asigna, reasigna y haz seguimiento a los tiempos.'
              : 'Tus tickets asignados y los que aún no tienen responsable.'}
          </p>
        </div>
        <Link
          href="/mis-tickets/nuevo"
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          <Plus size={15} /> Crear ticket
        </Link>
      </div>
      <BandejaTickets
        filas={filas}
        kpis={kpis}
        filtros={filtros}
        responsables={responsables}
        categorias={categorias}
        permisos={{ coordinar: ctx.coordinar || ctx.esAdmin, atender: ctx.atender || ctx.esAdmin, usuarioId: ctx.usuarioId }}
      />
    </div>
  )
}
