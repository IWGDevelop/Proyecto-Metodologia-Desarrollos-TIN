'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Building2, ChevronUp, ChevronDown, Plus, Pencil, Save, X, ToggleLeft, ToggleRight, Info,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useProcesos } from '@/context/ProcesosContext'
import { codigoDesdeNombre, type ProcesoInternoCfg } from '@/lib/procesos'
import {
  crearProcesoInterno, actualizarProcesoInterno, moverProcesoInterno, getUsoProcesos,
} from '@/actions/procesos-internos'

/* ── Fila de proceso ───────────────────────────────────────────────────── */
function FilaProceso({
  proceso, idx, total, uso, onCambio,
}: {
  proceso: ProcesoInternoCfg
  idx: number
  total: number
  uso: { requerimientos: number; usuarios: number } | undefined
  onCambio: () => void
}) {
  const [editando, setEditando] = useState(false)
  const [label, setLabel] = useState(proceso.label)
  const [isPending, startT] = useTransition()

  const ejecutar = (accion: () => Promise<{ ok: boolean; error?: string }>, exito?: string) =>
    startT(async () => {
      const res = await accion()
      if (!res.ok) { toast.error(res.error ?? 'No se pudo guardar'); return }
      if (exito) toast.success(exito)
      onCambio()
    })

  const guardarNombre = () => {
    if (!label.trim()) { toast.error('El nombre no puede quedar vacío'); return }
    ejecutar(() => actualizarProcesoInterno(proceso.value, { label }), 'Nombre actualizado')
    setEditando(false)
  }

  const alternarActivo = () => {
    if (proceso.activo && (uso?.requerimientos || uso?.usuarios)) {
      const ok = confirm(
        `"${proceso.label}" tiene ${uso?.requerimientos ?? 0} requerimiento(s) y ${uso?.usuarios ?? 0} usuario(s) asociados.\n\n` +
        'Al desactivarlo dejará de ofrecerse en los formularios, pero esos registros conservan su proceso. ¿Continuar?'
      )
      if (!ok) return
    }
    ejecutar(() => actualizarProcesoInterno(proceso.value, { activo: !proceso.activo }), proceso.activo ? 'Proceso desactivado' : 'Proceso activado')
  }

  return (
    <li className={cn('flex items-center gap-3 px-4 py-2.5', !proceso.activo && 'bg-slate-50/70')}>
      <div className="flex flex-col">
        <button
          onClick={() => ejecutar(() => moverProcesoInterno(proceso.value, 'arriba'))}
          disabled={idx === 0 || isPending}
          className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30"
          aria-label="Subir"
        >
          <ChevronUp size={13} />
        </button>
        <button
          onClick={() => ejecutar(() => moverProcesoInterno(proceso.value, 'abajo'))}
          disabled={idx === total - 1 || isPending}
          className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30"
          aria-label="Bajar"
        >
          <ChevronDown size={13} />
        </button>
      </div>

      <div className="min-w-0 flex-1">
        {editando ? (
          <div className="flex items-center gap-2">
            <input
              autoFocus
              value={label}
              onChange={e => setLabel(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') guardarNombre(); if (e.key === 'Escape') { setLabel(proceso.label); setEditando(false) } }}
              className="w-64 rounded-md border border-slate-300 px-2.5 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
            <button onClick={guardarNombre} disabled={isPending} className="rounded p-1 text-blue-600 hover:bg-blue-50" aria-label="Guardar"><Save size={14} /></button>
            <button onClick={() => { setLabel(proceso.label); setEditando(false) }} className="rounded p-1 text-slate-400 hover:bg-slate-100" aria-label="Cancelar"><X size={14} /></button>
          </div>
        ) : (
          <p className={cn('text-sm font-medium', proceso.activo ? 'text-slate-800' : 'text-slate-400 line-through')}>{proceso.label}</p>
        )}
        <p className="mt-0.5 font-mono text-[10px] text-slate-400">{proceso.value}</p>
      </div>

      <div className="hidden text-right text-xs text-slate-500 sm:block">
        <p>{uso?.requerimientos ?? 0} requerimiento{(uso?.requerimientos ?? 0) !== 1 ? 's' : ''}</p>
        <p className="text-slate-400">{uso?.usuarios ?? 0} usuario{(uso?.usuarios ?? 0) !== 1 ? 's' : ''}</p>
      </div>

      {!editando && (
        <button onClick={() => setEditando(true)} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" title="Renombrar">
          <Pencil size={13} />
        </button>
      )}
      <button
        onClick={alternarActivo}
        disabled={isPending}
        className={cn(
          'flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors',
          proceso.activo ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
        )}
        title={proceso.activo ? 'Desactivar' : 'Activar'}
      >
        {proceso.activo ? <ToggleRight size={15} /> : <ToggleLeft size={15} />}
        {proceso.activo ? 'Activo' : 'Inactivo'}
      </button>
    </li>
  )
}

/* ── Gestión del catálogo ──────────────────────────────────────────────── */
export function GestionProcesosInternos() {
  const router = useRouter()
  const { todos } = useProcesos()
  const [nombre, setNombre] = useState('')
  const [isPending, startT] = useTransition()

  const { data: uso = {}, refetch } = useQuery({
    queryKey: ['uso-procesos'],
    queryFn: () => getUsoProcesos(),
    staleTime: 60_000,
  })

  // El catálogo vive en el layout raíz: refrescar la página trae la versión actualizada
  const refrescar = () => { router.refresh(); refetch() }

  const crear = () => {
    startT(async () => {
      const res = await crearProcesoInterno(nombre)
      if (!res.ok) { toast.error(res.error ?? 'No se pudo crear el proceso'); return }
      toast.success(`Proceso "${nombre.trim()}" creado`)
      setNombre('')
      refrescar()
    })
  }

  const codigo = codigoDesdeNombre(nombre)

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-xl border border-blue-100 bg-blue-50/50 px-4 py-3 text-xs text-blue-800">
        <Info size={14} className="mt-0.5 shrink-0" />
        <p>
          Los procesos activos se ofrecen en los formularios (requerimientos, usuarios, casos de uso IA) y en los filtros de los reportes.
          Al desactivar un proceso, los registros que ya lo tienen lo conservan. El código no cambia al renombrar,
          así que el historial no se pierde.
        </p>
      </div>

      {/* Nuevo proceso */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="mb-2 text-sm font-semibold text-slate-700">Agregar proceso</p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={nombre}
            onChange={e => setNombre(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && nombre.trim()) crear() }}
            placeholder="Nombre del proceso, ej. Gestión Humana"
            className="w-72 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
          <button
            onClick={crear}
            disabled={!nombre.trim() || isPending}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <Plus size={14} /> {isPending ? 'Creando...' : 'Agregar'}
          </button>
          {codigo && <span className="text-xs text-slate-400">Código: <span className="font-mono">{codigo}</span></span>}
        </div>
      </div>

      {/* Catálogo */}
      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <Building2 size={15} className="text-slate-400" /> Procesos internos
          </p>
          <span className="text-xs text-slate-400">
            {todos.filter(p => p.activo).length} activos · {todos.filter(p => !p.activo).length} inactivos
          </span>
        </div>
        <ul className="divide-y divide-slate-100">
          {todos.map((p, i) => (
            <FilaProceso
              key={`${p.value}-${p.label}-${p.activo}`}
              proceso={p}
              idx={i}
              total={todos.length}
              uso={uso[p.value]}
              onCambio={refrescar}
            />
          ))}
        </ul>
      </div>
    </div>
  )
}
