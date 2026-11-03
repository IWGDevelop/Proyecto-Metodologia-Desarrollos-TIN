'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Link2, Loader2 } from 'lucide-react'
import { listarMisConexionesMcp, revocarConexionMcp, type ConexionMcp } from '@/actions/mcp-oauth'
import { Button } from '@/components/ui/button'
import { formatFecha, formatFechaRelativa } from '@/lib/utils'

/** Conexiones OAuth activas del usuario (Claude web, Desktop o Code autorizados con "Permitir acceso") */
export function ConexionesMcp() {
  const [conexiones, setConexiones] = useState<ConexionMcp[] | null>(null)
  const [revocando, setRevocando] = useState<string | null>(null)

  const cargar = () =>
    listarMisConexionesMcp()
      .then(setConexiones)
      .catch(() => { setConexiones([]); toast.error('No se pudieron cargar las conexiones') })

  useEffect(() => { cargar() }, [])

  const onRevocar = async (id: string) => {
    setRevocando(id)
    try {
      await revocarConexionMcp(id)
      toast.success('Conexión revocada')
      await cargar()
    } catch (e: any) {
      toast.error(e.message ?? 'Error al revocar la conexión')
    } finally {
      setRevocando(null)
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-slate-700">
        <Link2 size={16} /> Aplicaciones conectadas
      </h2>
      <p className="mb-4 text-xs text-slate-500">
        Aplicaciones que autorizaste con tu usuario. Al revocar una, deja de tener acceso de inmediato
        y tendrás que volver a conectarla.
      </p>
      <div className="divide-y divide-slate-100 rounded-lg border border-slate-100">
        {conexiones === null && (
          <p className="px-4 py-3 text-xs text-slate-400"><Loader2 size={12} className="mr-1 inline animate-spin" />Cargando…</p>
        )}
        {conexiones?.length === 0 && <p className="px-4 py-3 text-xs text-slate-400">No tienes aplicaciones conectadas.</p>}
        {conexiones?.map(c => (
          <div key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-xs">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-slate-700">{c.client_nombre}</p>
              <p className="text-slate-400">
                autorizada {formatFecha(c.created_at)} · último uso {c.ultimo_uso ? formatFechaRelativa(c.ultimo_uso) : 'nunca'} ·
                vence {formatFecha(c.refresh_expira_en)} si no se usa
              </p>
            </div>
            <Button variant="outline" size="sm" disabled={revocando === c.id} onClick={() => onRevocar(c.id)}>
              {revocando === c.id ? <Loader2 size={12} className="animate-spin" /> : 'Revocar'}
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}
