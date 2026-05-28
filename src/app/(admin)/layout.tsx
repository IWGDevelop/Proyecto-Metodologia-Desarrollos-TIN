import { redirect } from 'next/navigation'
import { getUser, getPerfil } from '@/lib/supabase/auth'
import { AdminShell } from '@/components/layout/AdminShell'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser()
  if (!user) redirect('/login')

  const perfil = await getPerfil()

  // Profile missing (table not set up yet) — show shell anyway so admin can work
  const ROLES_CON_ACCESO: string[] = ['ADMIN_TIN', 'PRESIDENCIA']
  if (perfil && !ROLES_CON_ACCESO.includes(perfil.rol)) redirect('/mis-requerimientos')

  // If no perfil but user exists, allow access with a dummy profile
  const perfilEfectivo = perfil ?? {
    id: user.id,
    email: user.email ?? '',
    nombre_completo: user.email?.split('@')[0] ?? 'Admin',
    cargo: null,
    proceso_interno: null,
    empresa: null,
    rol: 'ADMIN_TIN' as const,
    activo: true,
    avatar_url: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  return <AdminShell perfil={perfilEfectivo}>{children}</AdminShell>
}
