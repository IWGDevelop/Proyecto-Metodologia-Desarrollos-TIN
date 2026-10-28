'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { exigirAccesoAdmin, getUsuarioActual, puedeGestionar, NO_AUTORIZADO } from '@/lib/supabase/guards'
import { buscarInfoIgsiPorEmail } from './sync-igsi'

export async function crearUsuario(data: {
  email: string
  nombre_completo: string
  cargo?: string
  proceso_interno?: string
  empresa?: string
  rol: string
  password: string
  jefe_id?: string | null
  sede?: string | null
}): Promise<{ ok: boolean; error?: string }> {
  try {
    if (!(await puedeGestionar('menu:usuarios'))) return { ok: false, error: NO_AUTORIZADO }

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
        jefe_id: data.jefe_id || null,
        sede: data.sede?.trim() || null,
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
  cedula: string | null
  cargo: string | null
  proceso_interno: string | null
  empresa: string | null
  rol: string
  activo: boolean
  jefe_id: string | null
  sede: string | null
}>): Promise<{ ok: boolean; error?: string }> {
  try {
    // Gestores de usuarios editan cualquier perfil; el resto solo el propio y sin tocar rol/activo/jefe
    // (el jefe inmediato es quien aprueba los tickets del usuario)
    if (!(await puedeGestionar('menu:usuarios'))) {
      const actual = await getUsuarioActual()
      if (!actual || actual.user.id !== id) return { ok: false, error: NO_AUTORIZADO }
      data = { ...data }
      delete data.rol
      delete data.activo
      delete data.jefe_id
    }
    if (data.jefe_id !== undefined) {
      data = { ...data, jefe_id: data.jefe_id || null }
      if (data.jefe_id === id) return { ok: false, error: 'Un usuario no puede ser su propio jefe inmediato' }
    }
    if (data.sede !== undefined) data = { ...data, sede: data.sede?.trim() || null }

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
  await exigirAccesoAdmin()
  return actualizarPerfil(id, { activo })
}
