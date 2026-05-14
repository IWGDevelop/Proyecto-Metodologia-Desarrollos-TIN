import { redirect } from 'next/navigation'
import { getPerfil } from '@/lib/supabase/auth'

export default async function HomePage() {
  const perfil = await getPerfil()
  if (!perfil) redirect('/login')
  if (perfil.rol === 'ADMIN_TIN') redirect('/admin/dashboard')
  redirect('/mis-requerimientos')
}
