'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { buscarInfoIgsiPorEmail } from './sync-igsi'

export async function crearUsuario(data: {
  email: string
  nombre_completo: string
  cargo?: string
  proceso_interno?: string
  empresa?: string
  rol: 'ADMIN_TIN' | 'USUARIO' | 'PRESIDENCIA'
  password: string
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = createAdminClient()

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        nombre_completo: data.nombre_completo,
        rol: data.rol,
      },
    })

    if (authError) return { ok: false, error: authError.message }
    if (!authData.user) return { ok: false, error: 'No se pudo crear el usuario' }

    // Intentar obtener proceso/empresa/cargo desde el directorio IGSI
    const igsi = await buscarInfoIgsiPorEmail(data.email)

    // Upsert profile — works regardless of whether the trigger ran first
    const { error: upsertError } = await (supabase as any)
      .from('perfiles')
      .upsert({
        id: authData.user.id,
        email: data.email,
        nombre_completo: data.nombre_completo,
        // IGSI tiene prioridad; si el admin llenó algo manualmente lo respeta como fallback
        cargo:           igsi.cargo           ?? data.cargo           ?? null,
        proceso_interno: igsi.proceso_interno ?? data.proceso_interno ?? null,
        empresa:         igsi.empresa         ?? data.empresa         ?? null,
        rol: data.rol,
        activo: true,
      }, { onConflict: 'id' })

    if (upsertError) {
      console.error('Profile upsert error:', upsertError.message)
    }

    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'Error inesperado al crear usuario' }
  }
}

export async function actualizarPerfil(id: string, data: Partial<{
  nombre_completo: string
  cargo: string | null
  proceso_interno: string | null
  empresa: string | null
  rol: 'ADMIN_TIN' | 'USUARIO' | 'PRESIDENCIA'
  activo: boolean
}>): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = createAdminClient()
    const { error } = await (supabase as any)
      .from('perfiles')
      .update(data)
      .eq('id', id)

    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'Error al actualizar perfil' }
  }
}

export async function toggleUsuarioActivo(id: string, activo: boolean) {
  return actualizarPerfil(id, { activo })
}
