'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export async function crearUsuario(data: {
  email: string
  nombre_completo: string
  cargo?: string
  proceso_interno?: string
  empresa?: string
  rol: 'ADMIN_TIN' | 'USUARIO'
  password: string
}) {
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

  if (authError) throw new Error(authError.message)

  if (authData.user) {
    const { error: perfilError } = await (supabase as any)
      .from('perfiles')
      .update({
        cargo: data.cargo ?? null,
        proceso_interno: data.proceso_interno ?? null,
        empresa: data.empresa ?? null,
        rol: data.rol,
      })
      .eq('id', authData.user.id)

    if (perfilError) {
      // Profile may not exist yet if trigger hasn't run; try insert
      await (supabase as any).from('perfiles').upsert({
        id: authData.user.id,
        email: data.email,
        nombre_completo: data.nombre_completo,
        cargo: data.cargo ?? null,
        proceso_interno: data.proceso_interno ?? null,
        empresa: data.empresa ?? null,
        rol: data.rol,
      })
    }
  }

  revalidatePath('/admin/usuarios')
  return authData.user
}

export async function actualizarPerfil(id: string, data: Partial<{
  nombre_completo: string
  cargo: string | null
  proceso_interno: string | null
  empresa: string | null
  rol: 'ADMIN_TIN' | 'USUARIO'
  activo: boolean
}>) {
  const supabase = createAdminClient()
  const { error } = await (supabase as any)
    .from('perfiles')
    .update(data)
    .eq('id', id)

  if (error) throw new Error(error.message)
  revalidatePath('/admin/usuarios')
}

export async function toggleUsuarioActivo(id: string, activo: boolean) {
  await actualizarPerfil(id, { activo })
}

export async function getUsuarios() {
  const supabase = createAdminClient()
  const { data, error } = await (supabase as any)
    .from('perfiles')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return data
}
