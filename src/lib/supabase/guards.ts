import { cache } from 'react'
import { createClient } from './server'
import { createAdminClient } from './admin'

// Verificaciones de autorización para Server Actions.
// Las Server Actions se pueden invocar por POST fuera de la UI,
// así que ocultar un botón no basta: cada acción sensible debe validar aquí.
// La regla replica la del menú (Sidebar/Topbar): ADMIN_TIN o permiso `puede_ver` sobre el recurso.

// cache(): una sola consulta por petición aunque varias acciones verifiquen
export const getUsuarioActual = cache(async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: perfil } = await (supabase as any)
    .from('perfiles')
    .select('id, rol')
    .eq('id', user.id)
    .single()

  return { user, rol: (perfil?.rol as string | undefined) ?? null }
})

// Recursos con puede_ver = true para el rol
const getRecursosVisibles = cache(async (rolNombre: string): Promise<string[]> => {
  const supabase = createAdminClient()
  const { data: rol } = await (supabase as any)
    .from('roles_personalizados')
    .select('id')
    .eq('nombre', rolNombre)
    .single()
  if (!rol) return []

  const { data } = await (supabase as any)
    .from('permisos_rol')
    .select('recurso')
    .eq('rol_id', rol.id)
    .eq('puede_ver', true)
  return (data ?? []).map((p: { recurso: string }) => p.recurso)
})

async function rolTienePermiso(rolNombre: string, recurso: string): Promise<boolean> {
  return (await getRecursosVisibles(rolNombre)).includes(recurso)
}

/** Misma regla que el layout de /admin: ADMIN_TIN, PRESIDENCIA, sin perfil, o al menos un permiso de menú */
export async function tieneAccesoAdmin(): Promise<boolean> {
  try {
    const actual = await getUsuarioActual()
    if (!actual) return false
    if (!actual.rol || actual.rol === 'ADMIN_TIN' || actual.rol === 'PRESIDENCIA') return true
    return (await getRecursosVisibles(actual.rol)).some(r => r.startsWith('menu:'))
  } catch {
    return false
  }
}

/** Para acciones que solo usa el área /admin: lanza error si el usuario no tiene acceso */
export async function exigirAccesoAdmin(): Promise<void> {
  if (!(await tieneAccesoAdmin())) throw new Error(NO_AUTORIZADO)
}

/** true si el usuario actual puede gestionar el recurso de menú indicado (ej. 'menu:usuarios') */
export async function puedeGestionar(recurso: string): Promise<boolean> {
  try {
    const actual = await getUsuarioActual()
    if (!actual) return false
    // Sin perfil el layout admin lo trata como ADMIN_TIN; se mantiene el mismo criterio
    if (!actual.rol || actual.rol === 'ADMIN_TIN') return true
    return await rolTienePermiso(actual.rol, recurso)
  } catch {
    return false
  }
}

export const NO_AUTORIZADO = 'No tienes permisos para realizar esta acción'
