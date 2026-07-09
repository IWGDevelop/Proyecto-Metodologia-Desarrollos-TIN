import { createAdminClient } from '@/lib/supabase/admin'
import { GestionUsuariosClient } from '@/components/usuarios/GestionUsuariosClient'
import type { Perfil } from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'

async function fetchUsuarios(): Promise<Perfil[]> {
  try {
    const supabase = createAdminClient()
    const { data, error } = await (supabase as any)
      .from('perfiles')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) return []
    return data ?? []
  } catch { return [] }
}

async function fetchRoles(): Promise<{ nombre: string; descripcion: string | null }[]> {
  try {
    const supabase = createAdminClient()
    const { data } = await (supabase as any)
      .from('roles_personalizados')
      .select('nombre, descripcion')
      .eq('activo', true)
      .order('es_sistema', { ascending: false })
      .order('nombre')
    return data ?? []
  } catch { return [] }
}

export default async function UsuariosPage() {
  const [usuarios, roles] = await Promise.all([fetchUsuarios(), fetchRoles()])

  return (
    <div className="space-y-5 p-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Gestión de usuarios</h1>
        <p className="text-sm text-slate-500">Administra los usuarios del sistema IGSI</p>
      </div>
      <GestionUsuariosClient usuarios={usuarios} roles={roles} />
    </div>
  )
}
