import { getPerfil } from '@/lib/supabase/auth'
import { createClient } from '@/lib/supabase/server'
import { NotificacionesClient } from '@/components/usuario/NotificacionesClient'

export const dynamic = 'force-dynamic'

export default async function NotificacionesPage() {
  const perfil = await getPerfil()
  if (!perfil) return null

  const supabase = await createClient()
  let notificaciones: any[] = []

  try {
    const { data } = await (supabase as any)
      .from('notificaciones')
      .select('*')
      .eq('usuario_id', perfil.id)
      .order('created_at', { ascending: false })
      .limit(50)
    notificaciones = data ?? []
  } catch {
    // Table may not exist yet
  }

  return (
    <div className="space-y-5 p-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Notificaciones</h1>
        <p className="text-sm text-slate-500">Actualizaciones sobre tus solicitudes</p>
      </div>
      <NotificacionesClient notificaciones={notificaciones} usuarioId={perfil.id} />
    </div>
  )
}
