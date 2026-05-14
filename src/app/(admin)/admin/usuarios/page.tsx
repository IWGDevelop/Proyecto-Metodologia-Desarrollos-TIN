import { getUsuarios } from '@/actions/usuarios'
import { GestionUsuariosClient } from '@/components/usuarios/GestionUsuariosClient'

export const dynamic = 'force-dynamic'

export default async function UsuariosPage() {
  const usuarios = await getUsuarios().catch(() => [])

  return (
    <div className="space-y-5 p-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Gestión de usuarios</h1>
        <p className="text-sm text-slate-500">Administra los usuarios del sistema IGSI</p>
      </div>
      <GestionUsuariosClient usuarios={usuarios} />
    </div>
  )
}
