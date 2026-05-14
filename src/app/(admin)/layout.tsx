import { redirect } from 'next/navigation'
import { getPerfil } from '@/lib/supabase/auth'
import { AdminShell } from '@/components/layout/AdminShell'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const perfil = await getPerfil()

  if (!perfil) redirect('/login')
  if (perfil.rol !== 'ADMIN_TIN') redirect('/mis-requerimientos')

  return <AdminShell perfil={perfil}>{children}</AdminShell>
}
