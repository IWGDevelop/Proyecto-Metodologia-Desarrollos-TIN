'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'
import Link from 'next/link'

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[AdminError]', error)
  }, [error])

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-5">
        <div className="flex justify-center">
          <div className="rounded-full bg-red-100 p-4">
            <AlertTriangle size={32} className="text-red-500" />
          </div>
        </div>

        <div>
          <h1 className="text-xl font-bold text-slate-800">Error al cargar la página</h1>
          <p className="mt-2 text-sm text-slate-500">
            Ocurrió un error en el servidor. Esto puede deberse a una vista de base de datos
            desactualizada o una consulta fallida.
          </p>
          {error.digest && (
            <p className="mt-1 font-mono text-xs text-slate-400">Código: {error.digest}</p>
          )}
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-left text-xs text-amber-700 space-y-1">
          <p className="font-semibold">Solución más común:</p>
          <p>Ejecuta el script <code className="font-mono bg-amber-100 px-1 rounded">migration_horas_desarrollo.sql</code> en Supabase para recrear la vista <code className="font-mono bg-amber-100 px-1 rounded">v_metricas_requerimientos</code>.</p>
        </div>

        <div className="flex justify-center gap-3">
          <button
            onClick={reset}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw size={14} /> Reintentar
          </button>
          <Link
            href="/admin/dashboard"
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Home size={14} /> Dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
