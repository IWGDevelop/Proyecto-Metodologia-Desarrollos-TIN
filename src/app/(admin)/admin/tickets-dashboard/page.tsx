import { Gauge } from 'lucide-react'
import { puedeGestionar } from '@/lib/supabase/guards'
import { RECURSOS_TICKETS } from '@/lib/tickets/constantes'
import { obtenerDashboardTickets } from '@/actions/tickets/dashboard'
import { DashboardTickets } from '@/components/tickets/medicion/DashboardTickets'

export const dynamic = 'force-dynamic'

export default async function TicketsDashboardPage() {
  if (!(await puedeGestionar(RECURSOS_TICKETS.MENU_DASHBOARD))) {
    return (
      <div className="p-6">
        <p className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600">
          No tienes permiso para ver el dashboard de tickets.
        </p>
      </div>
    )
  }

  const datos = await obtenerDashboardTickets()

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-slate-800">
          <Gauge size={20} className="text-blue-600" />
          Dashboard de tickets
        </h1>
        <p className="text-sm text-slate-500">
          Indicadores de atención de TIN medidos en horas hábiles desde el historial de cada ticket, descontando las esperas.
        </p>
      </div>
      <DashboardTickets inicial={datos} />
    </div>
  )
}
