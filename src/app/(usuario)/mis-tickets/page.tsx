import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Plus, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AvisosTickets } from '@/components/tickets/AvisosTickets'
import { MisTicketsLista } from '@/components/tickets/funcionario/MisTicketsLista'
import { listarMisTickets } from '@/actions/tickets/mis-tickets'
import { accesoTickets } from '@/lib/tickets/solicitante'

export const dynamic = 'force-dynamic'

export default async function MisTicketsPage({ searchParams }: { searchParams: Promise<{ estado?: string }> }) {
  const acceso = await accesoTickets()
  if (!acceso) redirect('/login')
  const [{ estado }, tickets] = await Promise.all([searchParams, listarMisTickets({ estado: 'TODOS' })])
  const puedePlantillas = acceso.esAdmin || acceso.atender || acceso.coordinar

  return (
    <div className="space-y-6 p-6">
      <div className="rounded-xl bg-gradient-to-br from-blue-600 to-blue-800 p-6 text-white">
        <h1 className="text-xl font-bold">Mis tickets de TI</h1>
        <p className="mt-2 text-sm text-blue-100">
          Reporta aquí cualquier novedad o solicitud para TIN. Clasifícala y adjunta la información completa desde el
          primer reporte; así se atiende más rápido.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/mis-tickets/nuevo">
            <Button className="gap-1.5 bg-white text-blue-700 hover:bg-blue-50">
              <Plus size={15} /> Nuevo ticket
            </Button>
          </Link>
          {puedePlantillas && (
            <Link href="/mis-tickets/plantilla">
              <Button variant="outline" className="gap-1.5 border-white/40 bg-transparent text-white hover:bg-white/10">
                <Users size={15} /> Plantilla de ingreso/retiro
              </Button>
            </Link>
          )}
        </div>
      </div>

      <AvisosTickets />

      <MisTicketsLista tickets={tickets} estadoInicial={estado} />
    </div>
  )
}
