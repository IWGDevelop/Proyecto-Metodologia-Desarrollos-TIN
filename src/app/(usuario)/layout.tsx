import { redirect } from 'next/navigation'
import { getPerfil } from '@/lib/supabase/auth'
import { UserShell } from '@/components/layout/UserShell'

export default async function UsuarioLayout({ children }: { children: React.ReactNode }) {
  const perfil = await getPerfil()
  if (!perfil) redirect('/login')
  return <UserShell perfil={perfil}>{children}</UserShell>
}
