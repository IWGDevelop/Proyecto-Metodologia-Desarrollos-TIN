import { Bug } from 'lucide-react'
import { puedeGestionar } from '@/lib/supabase/guards'
import { RECURSOS_TICKETS } from '@/lib/tickets/constantes'
import { listarBugs, listarResponsablesBugs } from '@/actions/tickets/bugs'
import { TableroBugs } from '@/components/tickets/medicion/TableroBugs'

export const dynamic = 'force-dynamic'

export default async function TicketsBugsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  if (!(await puedeGestionar(RECURSOS_TICKETS.MENU_BUGS))) {
    return (
      <div className="p-6">
        <p className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600">
          No tienes permiso para ver el tablero de bugs de IGSI.
        </p>
      </div>
    )
  }

  const [bugs, responsables, sp] = await Promise.all([listarBugs(), listarResponsablesBugs(), searchParams])
  const bug = Array.isArray(sp.bug) ? sp.bug[0] : sp.bug

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-slate-800">
          <Bug size={20} className="text-blue-600" />
          Bugs y deuda técnica de IGSI
        </h1>
        <p className="text-sm text-slate-500">
          Cada bug agrupa los tickets que causa. Arrastra las tarjetas para cambiar su estado; al pasar a Desplegado se
          registra la fecha de despliegue.
        </p>
      </div>
      <TableroBugs bugsIniciales={bugs} responsables={responsables} bugAbiertoInicial={bug ?? null} />
    </div>
  )
}
