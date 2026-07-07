'use client'

import { useState, useTransition } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Mail, Plus, Trash2, ToggleLeft, ToggleRight, Loader2, Send } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  getDestinatariosEmail,
  agregarDestinatario,
  toggleDestinatario,
  eliminarDestinatario,
} from '@/actions/config-email'
import type { DestinatarioEmail } from '@/actions/config-email'

export function GestionNotificacionesEmail() {
  const qc = useQueryClient()
  const [isPending, startTransition] = useTransition()
  const [email, setEmail] = useState('')
  const [nombre, setNombre] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const { data: destinatarios = [], isLoading } = useQuery<DestinatarioEmail[]>({
    queryKey: ['config-email'],
    queryFn: getDestinatariosEmail,
  })

  const refresh = () => qc.invalidateQueries({ queryKey: ['config-email'] })

  const handleAgregar = () => {
    setErrorMsg('')
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setErrorMsg('Ingresa un correo válido')
      return
    }
    startTransition(async () => {
      try {
        await agregarDestinatario(email, nombre)
        setEmail('')
        setNombre('')
        refresh()
      } catch (e: any) {
        setErrorMsg(e.message?.includes('unique') ? 'Ese correo ya está en la lista' : e.message)
      }
    })
  }

  const handleToggle = (dest: DestinatarioEmail) => {
    setLoadingId(dest.id)
    startTransition(async () => {
      await toggleDestinatario(dest.id, !dest.activo)
      refresh()
      setLoadingId(null)
    })
  }

  const handleEliminar = (id: string) => {
    setLoadingId(id)
    startTransition(async () => {
      await eliminarDestinatario(id)
      refresh()
      setLoadingId(null)
    })
  }

  const activos = destinatarios.filter(d => d.activo).length

  return (
    <div className="space-y-6">
      {/* Header info */}
      <div className="flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4">
        <Send size={16} className="mt-0.5 shrink-0 text-blue-500" />
        <div className="text-sm text-blue-700">
          <strong>{activos}</strong> destinatario{activos !== 1 ? 's' : ''} activo{activos !== 1 ? 's' : ''} —
          recibirán una notificación cada vez que un desarrollo cambie de estado.
        </div>
      </div>

      {/* Tabla de destinatarios */}
      <div className="overflow-hidden rounded-xl border border-slate-200">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-slate-400">
            <Loader2 size={16} className="animate-spin" />
            <span className="text-sm">Cargando...</span>
          </div>
        ) : destinatarios.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-400">
            No hay destinatarios configurados
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="py-3 pl-4 text-left font-semibold text-slate-500">Correo</th>
                <th className="py-3 px-3 text-left font-semibold text-slate-500">Nombre / Descripción</th>
                <th className="py-3 px-3 text-center font-semibold text-slate-500">Activo</th>
                <th className="py-3 pr-4 text-right font-semibold text-slate-500"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {destinatarios.map(dest => (
                <tr key={dest.id} className={cn('transition-colors', !dest.activo && 'opacity-50')}>
                  <td className="py-3 pl-4">
                    <div className="flex items-center gap-2">
                      <Mail size={13} className="shrink-0 text-slate-400" />
                      <span className="font-medium text-slate-700">{dest.email}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-slate-500">{dest.nombre ?? '—'}</td>
                  <td className="px-3 py-3 text-center">
                    <button
                      onClick={() => handleToggle(dest)}
                      disabled={loadingId === dest.id}
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition-colors hover:bg-slate-100 disabled:opacity-50"
                    >
                      {loadingId === dest.id ? (
                        <Loader2 size={14} className="animate-spin text-slate-400" />
                      ) : dest.activo ? (
                        <ToggleRight size={18} className="text-emerald-500" />
                      ) : (
                        <ToggleLeft size={18} className="text-slate-400" />
                      )}
                      <span className={dest.activo ? 'text-emerald-600' : 'text-slate-400'}>
                        {dest.activo ? 'Sí' : 'No'}
                      </span>
                    </button>
                  </td>
                  <td className="pr-4 py-3 text-right">
                    <button
                      onClick={() => handleEliminar(dest.id)}
                      disabled={loadingId === dest.id}
                      className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Formulario agregar */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p className="mb-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Agregar destinatario</p>
        <div className="flex flex-wrap gap-2">
          <input
            type="email"
            placeholder="correo@iwglogistics.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAgregar()}
            className="flex-1 min-w-[200px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
          <input
            type="text"
            placeholder="Nombre / descripción (opcional)"
            value={nombre}
            onChange={e => setNombre(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAgregar()}
            className="flex-1 min-w-[180px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
          <button
            onClick={handleAgregar}
            disabled={isPending}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
          >
            {isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Agregar
          </button>
        </div>
        {errorMsg && <p className="mt-2 text-xs text-red-500">{errorMsg}</p>}
      </div>
    </div>
  )
}
