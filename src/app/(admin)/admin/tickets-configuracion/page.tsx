import { redirect } from 'next/navigation'
import { SlidersHorizontal } from 'lucide-react'
import { puedeGestionar } from '@/lib/supabase/guards'
import { RECURSOS_TICKETS } from '@/lib/tickets/constantes'
import { obtenerDatosConfigTickets } from '@/actions/tickets/configuracion'
import { ConfiguracionTickets } from '@/components/tickets/config/ConfiguracionTickets'

export const dynamic = 'force-dynamic'

export default async function TicketsConfiguracionPage() {
  if (!(await puedeGestionar(RECURSOS_TICKETS.MENU_CONFIG))) redirect('/admin/dashboard')

  const datos = await obtenerDatosConfigTickets()
  if (!datos) redirect('/admin/dashboard')

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-2">
        <SlidersHorizontal size={20} className="text-slate-500" />
        <div>
          <h1 className="text-xl font-bold text-slate-800">Configuración de tickets</h1>
          <p className="text-sm text-slate-500">
            Catálogo, formularios, tiempos y reglas del módulo de tickets. Agregar una tipología o un campo es configuración, no desarrollo.
          </p>
        </div>
      </div>
      <ConfiguracionTickets datos={datos} />
    </div>
  )
}
