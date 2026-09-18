import { getTareasPendientesReunion, getCompromisosFechasPendientes } from '@/actions/pendientes'
import { DashboardPendientes } from '@/components/pendientes/DashboardPendientes'

export const dynamic = 'force-dynamic'

export default async function PendientesPage() {
  const [tareas, compromisos] = await Promise.all([
    getTareasPendientesReunion(),
    getCompromisosFechasPendientes(),
  ])

  return <DashboardPendientes tareas={tareas} compromisos={compromisos} />
}
