import { redirect } from 'next/navigation'
import { getPerfil } from '@/lib/supabase/auth'
import { SharedShell } from '@/components/layout/SharedShell'

export default async function PerfilLayout({ children }: { children: React.ReactNode }) {
  const perfil = await getPerfil()
  if (!perfil) redirect('/login')
  return <SharedShell perfil={perfil}>{children}</SharedShell>
}
