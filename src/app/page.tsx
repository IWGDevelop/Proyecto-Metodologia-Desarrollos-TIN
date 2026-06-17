import { redirect } from 'next/navigation'
import { getUser, getPerfil } from '@/lib/supabase/auth'
import { getPermisosUsuario } from '@/actions/roles-permisos'

export default async function HomePage() {
  const user = await getUser()

  if (!user) redirect('/login')

  const perfil = await getPerfil()

  if (!perfil) redirect('/admin/requerimientos')

  if (perfil.rol === 'ADMIN_TIN' || perfil.rol === 'PRESIDENCIA') {
    redirect('/admin/requerimientos')
  }

  // For USUARIO (and any custom role): check if they have admin menu permissions
  const permisos = await getPermisosUsuario(perfil.rol)
  const tieneAccesoAdmin = Object.entries(permisos).some(
    ([recurso, p]) => recurso.startsWith('menu:') && p.puede_ver
  )

  if (tieneAccesoAdmin) redirect('/admin/requerimientos')

  redirect('/mis-requerimientos')
}
