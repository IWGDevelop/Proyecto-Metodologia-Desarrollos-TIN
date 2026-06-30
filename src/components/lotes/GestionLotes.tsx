'use client'

import { useState, useTransition } from 'react'
import { Layers, Lock, Unlock, Plus, X, AlertTriangle, CheckCircle2, Package } from 'lucide-react'
import { cn } from '@/lib/utils'
import { setConfigBloqueo, crearLote, cerrarLote } from '@/actions/lotes'
import type { LoteConStats } from '@/actions/lotes'

function formatFecha(iso: string) {
  return new Date(iso).toLocaleDateString('es-CO', {
    dateStyle: 'medium',
    timeZone: 'America/Bogota',
  })
}

interface Props {
  lotes: LoteConStats[]
  bloqueoActivo: boolean
}

export function GestionLotes({ lotes: initialLotes, bloqueoActivo: initialBloqueo }: Props) {
  const [bloqueo, setBloqueo] = useState(initialBloqueo)
  const [lotes, setLotes] = useState(initialLotes)
  const [isPending, startTransition] = useTransition()
  const [showCrear, setShowCrear] = useState(false)
  const [nombreLote, setNombreLote] = useState('')
  const [descripcionLote, setDescripcionLote] = useState('')
  const [confirmCerrar, setConfirmCerrar] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleToggleBloqueo = () => {
    const newVal = !bloqueo
    setBloqueo(newVal)
    startTransition(async () => {
      try {
        await setConfigBloqueo(newVal)
      } catch {
        setBloqueo(!newVal) // revert
      }
    })
  }

  const handleCrearLote = () => {
    if (!nombreLote.trim()) return
    setError(null)
    startTransition(async () => {
      try {
        await crearLote(nombreLote.trim(), descripcionLote.trim())
        setNombreLote('')
        setDescripcionLote('')
        setShowCrear(false)
        // Reload page to show updated list
        window.location.reload()
      } catch (e: any) {
        setError(e?.message ?? 'Error al crear el lote')
      }
    })
  }

  const handleCerrarLote = (id: string) => {
    setError(null)
    setConfirmCerrar(null)
    startTransition(async () => {
      try {
        await cerrarLote(id)
        setLotes(prev => prev.map(l => l.id === id ? { ...l, cerrado: true, activo: false } : l))
      } catch (e: any) {
        setError(e?.message ?? 'Error al cerrar el lote')
      }
    })
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 flex items-center gap-2">
          <AlertTriangle size={14} />
          {error}
          <button onClick={() => setError(null)} className="ml-auto"><X size={14} /></button>
        </div>
      )}

      {/* Control de acceso */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-slate-700">Registro de nuevos requerimientos</p>
            <p className="mt-1 text-xs text-slate-500">
              {bloqueo
                ? 'Los usuarios generales no pueden crear nuevos requerimientos.'
                : 'Los usuarios generales pueden crear nuevos requerimientos.'}
            </p>
          </div>
          <button
            onClick={handleToggleBloqueo}
            disabled={isPending}
            className={cn(
              'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200',
              bloqueo ? 'bg-red-500' : 'bg-emerald-500',
              isPending && 'opacity-60 cursor-not-allowed'
            )}
            aria-label="Activar/desactivar bloqueo"
          >
            <span className={cn(
              'inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-200',
              bloqueo ? 'translate-x-5' : 'translate-x-0'
            )} />
          </button>
        </div>
        <div className={cn(
          'mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium',
          bloqueo
            ? 'bg-red-50 text-red-600 border border-red-200'
            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
        )}>
          {bloqueo ? <Lock size={11} /> : <Unlock size={11} />}
          {bloqueo ? 'Bloqueado' : 'Abierto'}
        </div>
      </div>

      {/* Lista de lotes */}
      <div className="space-y-3">
        {lotes.map(lote => (
          <div
            key={lote.id}
            className={cn(
              'rounded-xl border bg-white p-5',
              lote.activo && 'border-blue-300 ring-1 ring-blue-200',
              lote.cerrado && !lote.activo && 'border-slate-200 opacity-80',
              !lote.cerrado && !lote.activo && 'border-slate-200'
            )}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className={cn(
                  'mt-0.5 rounded-lg p-2',
                  lote.activo ? 'bg-blue-100' : lote.cerrado ? 'bg-slate-100' : 'bg-slate-100'
                )}>
                  <Package size={16} className={lote.activo ? 'text-blue-600' : 'text-slate-400'} />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-slate-800">
                      Lote {lote.numero} — {lote.nombre}
                    </span>
                    {lote.activo && (
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700 border border-blue-200">
                        ACTIVO
                      </span>
                    )}
                    {lote.cerrado && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500 border border-slate-200 flex items-center gap-1">
                        <Lock size={9} /> CERRADO
                      </span>
                    )}
                  </div>
                  {lote.descripcion && (
                    <p className="mt-0.5 text-xs text-slate-500">{lote.descripcion}</p>
                  )}
                  <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                    <span className="flex items-center gap-1">
                      <Layers size={10} />
                      {lote.total} requerimiento{lote.total !== 1 ? 's' : ''}
                    </span>
                    <span>Creado: {formatFecha(lote.created_at)}</span>
                    {lote.fecha_cierre && (
                      <span>Cerrado: {formatFecha(lote.fecha_cierre)}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Acción cerrar (solo si activo o no cerrado) */}
              {!lote.cerrado && (
                confirmCerrar === lote.id ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-red-600">¿Confirmar cierre?</span>
                    <button
                      onClick={() => handleCerrarLote(lote.id)}
                      disabled={isPending}
                      className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-600 disabled:opacity-60"
                    >
                      Sí, cerrar
                    </button>
                    <button
                      onClick={() => setConfirmCerrar(null)}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmCerrar(lote.id)}
                    className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 flex items-center gap-1.5"
                  >
                    <Lock size={12} /> Cerrar lote
                  </button>
                )
              )}

              {lote.cerrado && (
                <div className="flex items-center gap-1 text-xs text-slate-400">
                  <CheckCircle2 size={13} className="text-slate-300" />
                  Congelado
                </div>
              )}
            </div>
          </div>
        ))}

        {lotes.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-200 p-10 text-center">
            <p className="text-sm text-slate-400">No hay lotes creados. Crea el primero.</p>
          </div>
        )}
      </div>

      {/* Crear nuevo lote */}
      {showCrear ? (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 space-y-3">
          <p className="text-sm font-semibold text-blue-800">Nuevo lote</p>
          <div className="space-y-2">
            <input
              type="text"
              value={nombreLote}
              onChange={e => setNombreLote(e.target.value)}
              placeholder="Nombre del lote (ej: Plan de Trabajo 2)"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
            <input
              type="text"
              value={descripcionLote}
              onChange={e => setDescripcionLote(e.target.value)}
              placeholder="Descripción (opcional)"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCrearLote}
              disabled={!nombreLote.trim() || isPending}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {isPending ? 'Creando...' : 'Crear lote'}
            </button>
            <button
              onClick={() => { setShowCrear(false); setNombreLote(''); setDescripcionLote('') }}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowCrear(true)}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 py-3 text-sm font-medium text-slate-500 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 transition-colors"
        >
          <Plus size={16} /> Crear nuevo lote
        </button>
      )}
    </div>
  )
}
