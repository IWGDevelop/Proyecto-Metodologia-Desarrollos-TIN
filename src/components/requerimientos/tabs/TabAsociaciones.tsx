'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ExternalLink, Link2, Unlink, Search, GitBranch, ChevronRight } from 'lucide-react'
import {
  asociarRequerimiento,
  desasociarRequerimiento,
  getRequerimientosDisponibles,
  type ReqBasico,
} from '@/actions/asociaciones'
import { getEstadoCfg, formatPrioridad } from '@/lib/constants'
import { cn } from '@/lib/utils'

interface Props {
  requerimientoId: string
  padre: ReqBasico | null
  hijos: ReqBasico[]
  etiquetaActual: string  // label completo del req actual, ej. "P1.2"
}

function BuscadorReq({
  onSelect,
  onCancel,
  excludeId,
  placeholder,
}: {
  onSelect: (id: string) => void
  onCancel: () => void
  excludeId: string
  placeholder: string
}) {
  const [query, setQuery] = useState('')
  const [lista, setLista] = useState<ReqBasico[]>([])
  const [loading, setLoading] = useState(true)

  useState(() => {
    getRequerimientosDisponibles(excludeId).then(data => {
      setLista(data)
      setLoading(false)
    })
  })

  const filtrados = lista.filter(r => {
    const q = query.toLowerCase()
    return (
      (r.nombre_desarrollo ?? '').toLowerCase().includes(q) ||
      r.identificacion.toLowerCase().includes(q) ||
      (r.numero ?? '').includes(q)
    )
  })

  return (
    <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="relative">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          autoFocus
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-lg border border-slate-200 bg-white pl-8 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
        />
      </div>

      {loading ? (
        <p className="px-2 py-3 text-xs text-slate-400">Cargando...</p>
      ) : (
        <div className="max-h-52 overflow-y-auto divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
          {filtrados.length === 0 ? (
            <p className="px-3 py-4 text-center text-xs text-slate-400">Sin resultados</p>
          ) : filtrados.slice(0, 25).map(r => {
            const estadoCfg = getEstadoCfg(r.estado)
            return (
              <button
                key={r.id}
                onClick={() => onSelect(r.id)}
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-blue-50"
              >
                {r.prioridad && (
                  <span className="shrink-0 rounded px-1.5 py-0.5 text-xs font-bold border border-slate-200 text-slate-600 bg-slate-50">
                    {formatPrioridad(r.prioridad, r.sub_prioridad)}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-700">
                    {r.nombre_desarrollo ?? r.identificacion}
                  </p>
                  <p className="text-xs text-slate-400">#{r.numero ?? r.identificacion}</p>
                </div>
                <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-xs border', estadoCfg.bgColor, estadoCfg.textColor, estadoCfg.borderColor)}>
                  {estadoCfg.label}
                </span>
              </button>
            )
          })}
        </div>
      )}

      <button onClick={onCancel} className="text-xs text-slate-400 hover:text-slate-600">
        Cancelar
      </button>
    </div>
  )
}

export function TabAsociaciones({ requerimientoId, padre, hijos, etiquetaActual }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showAddHijo, setShowAddHijo]     = useState(false)
  const [showSetPadre, setShowSetPadre]   = useState(false)

  function exec(fn: () => Promise<{ ok: boolean; error?: string }>, successMsg: string) {
    startTransition(async () => {
      const res = await fn()
      if (res.ok) { toast.success(successMsg); router.refresh() }
      else toast.error(res.error ?? 'Error')
    })
  }

  return (
    <div className="mt-4 space-y-6">

      {/* ── PADRE ─────────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700">
          <GitBranch size={14} className="text-slate-400" />
          Requerimiento padre
        </h3>

        {padre ? (
          <div className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <ChevronRight size={14} className="shrink-0 text-blue-400" />
              {padre.prioridad && (
                <span className="shrink-0 rounded border border-blue-300 bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-700">
                  {formatPrioridad(padre.prioridad, padre.sub_prioridad)}
                </span>
              )}
              <div className="min-w-0">
                <Link href={`/admin/requerimientos/${padre.id}`}
                  className="text-sm font-medium text-blue-700 hover:underline line-clamp-1">
                  {padre.nombre_desarrollo ?? padre.identificacion}
                </Link>
                <p className="text-xs text-blue-400">#{padre.numero ?? padre.identificacion}</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Link href={`/admin/requerimientos/${padre.id}`}>
                <ExternalLink size={13} className="text-blue-400 hover:text-blue-600" />
              </Link>
              <button
                onClick={() => exec(() => desasociarRequerimiento(requerimientoId), 'Desvinculado del padre')}
                disabled={isPending}
                className="flex items-center gap-1 rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50 disabled:opacity-50"
              >
                <Unlink size={11} /> Desvincular
              </button>
            </div>
          </div>
        ) : showSetPadre ? (
          <BuscadorReq
            excludeId={requerimientoId}
            placeholder="Buscar requerimiento padre..."
            onCancel={() => setShowSetPadre(false)}
            onSelect={parentId => {
              setShowSetPadre(false)
              exec(() => asociarRequerimiento(requerimientoId, parentId), 'Padre vinculado')
            }}
          />
        ) : (
          <button
            onClick={() => setShowSetPadre(true)}
            className="flex w-full items-center gap-2 rounded-lg border border-dashed border-slate-300 px-4 py-3 text-sm text-slate-400 hover:border-blue-300 hover:text-blue-500"
          >
            <Link2 size={14} /> Vincular a un requerimiento padre
          </button>
        )}
      </div>

      {/* ── HIJOS ─────────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <GitBranch size={14} className="rotate-180 text-slate-400" />
            Sub-requerimientos
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-normal text-slate-500">
              {hijos.length}
            </span>
          </h3>
          {!showAddHijo && (
            <button
              onClick={() => setShowAddHijo(true)}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
            >
              <Link2 size={12} /> Vincular sub-req
            </button>
          )}
        </div>

        {showAddHijo && (
          <div className="mb-4">
            <BuscadorReq
              excludeId={requerimientoId}
              placeholder="Buscar requerimiento para vincular como hijo..."
              onCancel={() => setShowAddHijo(false)}
              onSelect={childId => {
                setShowAddHijo(false)
                exec(() => asociarRequerimiento(childId, requerimientoId), 'Sub-requerimiento vinculado')
              }}
            />
          </div>
        )}

        {hijos.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">
            Sin sub-requerimientos vinculados
          </p>
        ) : (
          <div className="space-y-2">
            {hijos.map(hijo => {
              const estadoCfg = getEstadoCfg(hijo.estado)
              // etiqueta del hijo = etiqueta del padre actual + "." + posición del hijo
              const etiquetaHijo = `${etiquetaActual}.${hijo.sub_prioridad ?? 0}`
              return (
                <div key={hijo.id}
                  className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-4 py-2.5">
                  <div className="flex min-w-0 items-center gap-3">
                    <ChevronRight size={14} className="shrink-0 text-slate-300" />
                    {hijo.prioridad && (
                      <span className="shrink-0 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-xs font-bold text-slate-600">
                        {etiquetaHijo}
                      </span>
                    )}
                    <div className="min-w-0">
                      <Link href={`/admin/requerimientos/${hijo.id}`}
                        className="text-sm font-medium text-slate-700 hover:text-blue-600 line-clamp-1">
                        {hijo.nombre_desarrollo ?? hijo.identificacion}
                      </Link>
                      <p className="text-xs text-slate-400">#{hijo.numero ?? hijo.identificacion}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className={cn('rounded-full border px-2 py-0.5 text-xs', estadoCfg.bgColor, estadoCfg.textColor, estadoCfg.borderColor)}>
                      {estadoCfg.label}
                    </span>
                    <Link href={`/admin/requerimientos/${hijo.id}`}>
                      <ExternalLink size={12} className="text-slate-300 hover:text-blue-400" />
                    </Link>
                    <button
                      onClick={() => exec(() => desasociarRequerimiento(hijo.id), 'Sub-req desvinculado')}
                      disabled={isPending}
                      title="Desvincular"
                      className="text-slate-300 hover:text-red-400 disabled:opacity-50"
                    >
                      <Unlink size={12} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
