import { getTareasPendientesReunion, getCompromisosFechasPendientes, getFirmasPendientesVistoBueno } from '@/actions/pendientes'
import { getPerfil } from '@/lib/supabase/auth'
import { DashboardPendientes } from '@/components/pendientes/DashboardPendientes'

export const dynamic = 'force-dynamic'

export default async function PendientesPage() {
  const [tareas, compromisos, firmas, perfil] = await Promise.all([
    getTareasPendientesReunion(),
    getCompromisosFechasPendientes(),
    getFirmasPendientesVistoBueno(),
    getPerfil(),
  ])

  const isAdmin = !perfil || perfil.rol === 'ADMIN_TIN'

  return <DashboardPendientes tareas={tareas} compromisos={compromisos} firmas={firmas} isAdmin={isAdmin} />
}
