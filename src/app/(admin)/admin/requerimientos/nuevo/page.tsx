import { Lock } from 'lucide-react'
import { RequerimientoWizard } from '@/components/requerimientos/RequerimientoWizard'
import { getPerfil } from '@/lib/supabase/auth'
import { getConfigBloqueo } from '@/actions/lotes'

export default async function NuevoRequerimientoAdminPage() {
  const [perfil, bloqueo] = await Promise.all([
    getPerfil(),
    getConfigBloqueo(),
  ])

  const isAdmin = perfil?.rol === 'ADMIN_TIN'

  if (!isAdmin && bloqueo) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] p-6">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-10 max-w-lg text-center space-y-4">
          <div className="flex justify-center">
            <div className="rounded-full bg-amber-100 p-4">
              <Lock size={32} className="text-amber-500" />
            </div>
          </div>
          <h2 className="text-lg font-bold text-amber-800">
            Registro de requerimientos pausado
          </h2>
          <p className="text-sm text-amber-700 leading-relaxed">
            El administrador ha pausado temporalmente el ingreso de nuevos requerimientos.
            Los desarrollos actuales están siendo procesados en el Plan de Trabajo vigente.
          </p>
          <p className="text-xs text-amber-500">
            Comunícate con el equipo TIN si tienes una solicitud urgente.
          </p>
        </div>
      </div>
    )
  }

  return <RequerimientoWizard redirectBasePath="/admin/requerimientos" isAdmin />
}
