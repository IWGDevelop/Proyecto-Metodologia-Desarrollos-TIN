import { redirect } from 'next/navigation'
import { getUser, getPerfil } from '@/lib/supabase/auth'
import { AdminShell } from '@/components/layout/AdminShell'
import { getPermisosUsuario } from '@/actions/roles-permisos'
import type { PermisosMap } from '@/actions/roles-permisos'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser()
  if (!user) redirect('/login')

  const perfil = await getPerfil()

  // If no perfil but user exists, allow access with a dummy admin profile
  const perfilEfectivo = perfil ?? {
    id: user.id,
    email: user.email ?? '',
    nombre_completo: user.email?.split('@')[0] ?? 'Admin',
    cedula: null,
    cargo: null,
    proceso_interno: null,
    empresa: null,
    rol: 'ADMIN_TIN' as const,
    activo: true,
    avatar_url: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  let permisos: PermisosMap = {}

  if (perfilEfectivo.rol === 'ADMIN_TIN') {
    // Full access — no permission checks
  } else if (perfilEfectivo.rol === 'PRESIDENCIA') {
    // Backward compat: PRESIDENCIA always has admin access; fetch permisos for tab/action gating
    permisos = await getPermisosUsuario(perfilEfectivo.rol)
  } else {
    // Any other role (USUARIO, custom) needs at least one menu permission to enter admin
    permisos = await getPermisosUsuario(perfilEfectivo.rol)
    const tieneAccesoAdmin = Object.entries(permisos).some(
      ([recurso, p]) => recurso.startsWith('menu:') && p.puede_ver
    )
    if (!tieneAccesoAdmin) redirect('/mis-requerimientos')
  }

  return <AdminShell perfil={perfilEfectivo} permisos={permisos}>{children}</AdminShell>
}
