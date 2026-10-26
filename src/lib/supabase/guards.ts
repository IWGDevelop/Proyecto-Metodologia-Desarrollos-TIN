import { createClient } from './server'
import { createAdminClient } from './admin'

// Verificaciones de autorización para Server Actions.
// Las Server Actions se pueden invocar por POST fuera de la UI,
// así que ocultar un botón no basta: cada acción sensible debe validar aquí.
// La regla replica la del menú (Sidebar/Topbar): ADMIN_TIN o permiso `puede_ver` sobre el recurso.

export async function getUsuarioActual() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: perfil } = await (supabase as any)
    .from('perfiles')
    .select('id, rol')
    .eq('id', user.id)
    .single()

  return { user, rol: (perfil?.rol as string | undefined) ?? null }
}

async function rolTienePermiso(rolNombre: string, recurso: string): Promise<boolean> {
  const supabase = createAdminClient()
  const { data: rol } = await (supabase as any)
    .from('roles_personalizados')
    .select('id')
    .eq('nombre', rolNombre)
    .single()
  if (!rol) return false

  const { data: permiso } = await (supabase as any)
    .from('permisos_rol')
    .select('puede_ver')
    .eq('rol_id', rol.id)
    .eq('recurso', recurso)
    .maybeSingle()
  return permiso?.puede_ver === true
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
