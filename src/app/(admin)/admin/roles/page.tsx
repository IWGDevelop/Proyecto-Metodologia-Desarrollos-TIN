import { ShieldCheck } from 'lucide-react'
import { GestorRoles } from '@/components/roles/GestorRoles'

export default function AdminRolesPage() {
  return (
    <div className="space-y-5 p-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck size={20} className="text-blue-600" />
            <h1 className="text-xl font-bold text-slate-800">Roles y Permisos</h1>
          </div>
          <p className="mt-0.5 text-sm text-slate-500">
            Gestiona los roles del sistema y configura qué puede ver, editar o crear cada uno.
          </p>
        </div>
      </div>

      <GestorRoles />
    </div>
  )
}
