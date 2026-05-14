import { redirect } from 'next/navigation'
import { getPerfil } from '@/lib/supabase/auth'

export async function AuthGuard({ children }: { children: React.ReactNode }) {
  const perfil = await getPerfil()
  if (!perfil) redirect('/login')
  return <>{children}</>
}
