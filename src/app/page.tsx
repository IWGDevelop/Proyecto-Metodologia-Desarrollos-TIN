import { redirect } from 'next/navigation'
import { getUser, getPerfil } from '@/lib/supabase/auth'

export default async function HomePage() {
  const user = await getUser()

  // Not authenticated — middleware should have caught this, but just in case
  if (!user) redirect('/login')

  // Authenticated but profile may not exist yet (table not created)
  const perfil = await getPerfil()

  if (perfil?.rol === 'ADMIN_TIN') redirect('/admin/dashboard')
  if (perfil?.rol === 'USUARIO') redirect('/mis-requerimientos')

  // Fallback: authenticated but no profile yet → go to admin dashboard
  redirect('/admin/dashboard')
}
