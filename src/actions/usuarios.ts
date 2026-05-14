'use server'

import { createAdminClient } from '@/lib/supabase/admin'

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

  // Wait briefly for the DB trigger to create the profile
  await new Promise(r => setTimeout(r, 800))

  if (authData.user) {
    // Upsert ensures the profile exists with all fields
    await (supabase as any).from('perfiles').upsert({
      id: authData.user.id,
      email: data.email,
      nombre_completo: data.nombre_completo,
      cargo: data.cargo ?? null,
      proceso_interno: data.proceso_interno ?? null,
      empresa: data.empresa ?? null,
      rol: data.rol,
      activo: true,
    }, { onConflict: 'id' })
  }

  return { id: authData.user?.id }
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
}

export async function toggleUsuarioActivo(id: string, activo: boolean) {
  await actualizarPerfil(id, { activo })
}
