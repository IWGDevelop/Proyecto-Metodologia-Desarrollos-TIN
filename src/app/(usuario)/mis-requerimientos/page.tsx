import { getPerfil } from '@/lib/supabase/auth'
import { createClient } from '@/lib/supabase/server'
import { MisRequerimientosClient } from '@/components/usuario/MisRequerimientosClient'

export const dynamic = 'force-dynamic'

export default async function MisRequerimientosPage() {
  const perfil = await getPerfil()
  if (!perfil) return null

  const supabase = await createClient()
  const { data: requerimientos } = await supabase
    .from('requerimientos')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6 p-6">
      {/* Encabezado */}
      <div className="rounded-xl bg-gradient-to-br from-blue-600 to-blue-800 p-6 text-white">
        <h1 className="text-xl font-bold">Hola, {perfil.nombre_completo.split(' ')[0]} 👋</h1>
        <p className="mt-0.5 text-sm text-blue-200">
          {[perfil.proceso_interno, perfil.empresa].filter(Boolean).join(' · ')}
        </p>
        <p className="mt-3 text-sm text-blue-100">
          Aquí están todas tus solicitudes de desarrollo y los requerimientos en los que participas.
        </p>
      </div>

      <MisRequerimientosClient
        requerimientos={(requerimientos ?? []) as any[]}
        perfil={perfil}
      />
    </div>
  )
}
