import { redirect } from 'next/navigation'
import { getPerfil } from '@/lib/supabase/auth'

interface Props {
  children: React.ReactNode
  fallback?: React.ReactNode
}

export async function AdminGuard({ children, fallback }: Props) {
  const perfil = await getPerfil()

  if (!perfil) {
    redirect('/login')
  }

  if (perfil.rol !== 'ADMIN_TIN') {
    if (fallback) return <>{fallback}</>
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <div className="max-w-sm text-center space-y-4">
          <div className="text-4xl">🔒</div>
          <h2 className="text-lg font-bold text-slate-800">Acceso denegado</h2>
          <p className="text-sm text-slate-500">
            No tienes permisos para acceder a esta sección.
          </p>
          <a
            href="/mis-requerimientos"
            className="inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
          >
            Volver a mis requerimientos
          </a>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
