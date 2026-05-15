'use client'

import { useState, useTransition } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getEstadosKanban, crearEstadoKanban, actualizarEstadoKanban,
  reordenarEstadoKanban, eliminarEstadoKanban,
} from '@/actions/estados-kanban'
import { COLOR_PALETTE } from '@/lib/constants'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ChevronUp, ChevronDown, Plus, Trash2, Save, ToggleLeft, ToggleRight,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { EstadoKanban } from '@/lib/supabase/types'

const EMOJIS = ['📥','🔍','👥','⚡','🧪','⏸','✅','🔒','🚀','📋','🔄','⭐','🎯','📌','🔔','💡']

const COLORES_OPCIONES = Object.keys(COLOR_PALETTE)

function generarNombre(label: string) {
  return label
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

/* ── Fila de estado editable ────────────────────────────────────────────── */
function FilaEstado({ estado, idx, total, onRefresh }: {
  estado: EstadoKanban; idx: number; total: number; onRefresh: () => void
}) {
  const [editando, setEditando]   = useState(false)
  const [label, setLabel]         = useState(estado.label)
  const [colorKey, setColorKey]   = useState(estado.color_key)
  const [icono, setIcono]         = useState(estado.icono)
  const [esFinal, setEsFinal]     = useState(estado.es_final)
  const [isPending, startT]       = useTransition()

  const colores = COLOR_PALETTE[colorKey] ?? COLOR_PALETTE['slate']

  const guardar = () => {
    if (!label.trim()) { toast.error('El label es obligatorio'); return }
    startT(async () => {
      const res = await actualizarEstadoKanban(estado.id, {
        label: label.trim(), color_key: colorKey, icono, es_final: esFinal,
      })
      if (res.ok) { toast.success('Estado actualizado'); setEditando(false); onRefresh() }
      else toast.error(res.error ?? 'Error')
    })
  }

  const toggleActivo = () => {
    startT(async () => {
      await actualizarEstadoKanban(estado.id, { activo: !estado.activo })
      onRefresh()
    })
  }

  const mover = (dir: 'up' | 'down') => {
    startT(async () => { await reordenarEstadoKanban(estado.id, dir); onRefresh() })
  }

  const eliminar = () => {
    if (!confirm(`¿Eliminar el estado "${estado.label}"? Los requerimientos en este estado quedarán con ese valor pero no aparecerán en el Kanban.`)) return
    startT(async () => {
      const res = await eliminarEstadoKanban(estado.id)
      if (res.ok) { toast.success('Estado eliminado'); onRefresh() }
      else toast.error(res.error ?? 'Error')
    })
  }

  return (
    <tr className={cn('border-b border-slate-100 transition-colors', !estado.activo && 'opacity-50')}>
      {/* Orden */}
      <td className="px-3 py-2.5 w-16">
        <div className="flex flex-col gap-0.5">
          <button
            disabled={idx === 0 || isPending}
            onClick={() => mover('up')}
            className="rounded p-0.5 text-slate-300 hover:text-slate-600 disabled:opacity-30"
          >
            <ChevronUp size={13} />
          </button>
          <button
            disabled={idx === total - 1 || isPending}
            onClick={() => mover('down')}
            className="rounded p-0.5 text-slate-300 hover:text-slate-600 disabled:opacity-30"
          >
            <ChevronDown size={13} />
          </button>
        </div>
      </td>

      {/* Emoji */}
      <td className="px-3 py-2.5 text-xl text-center w-12">
        {editando ? (
          <select
            value={icono}
            onChange={e => setIcono(e.target.value)}
            className="rounded border border-slate-200 bg-white px-1 py-0.5 text-sm"
          >
            {EMOJIS.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
        ) : estado.icono}
      </td>

      {/* Nombre (slug) */}
      <td className="px-3 py-2.5 w-52">
        <code className="text-xs text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
          {estado.nombre}
        </code>
      </td>

      {/* Label */}
      <td className="px-3 py-2.5">
        {editando ? (
          <input
            value={label}
            onChange={e => setLabel(e.target.value)}
            className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-sm outline-none focus:border-blue-400"
          />
        ) : (
          <span className="text-sm font-medium text-slate-700">{estado.label}</span>
        )}
      </td>

      {/* Color */}
      <td className="px-3 py-2.5 w-36">
        {editando ? (
          <select
            value={colorKey}
            onChange={e => setColorKey(e.target.value)}
            className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-sm outline-none focus:border-blue-400"
          >
            {COLORES_OPCIONES.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        ) : (
          <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', colores.bg, colores.text)}>
            {colorKey}
          </span>
        )}
      </td>

      {/* Es final */}
      <td className="px-3 py-2.5 w-20 text-center">
        {editando ? (
          <input
            type="checkbox"
            checked={esFinal}
            onChange={e => setEsFinal(e.target.checked)}
            className="h-4 w-4 rounded"
          />
        ) : (
          <span className={cn('text-xs', estado.es_final ? 'text-slate-500' : 'text-transparent')}>
            {estado.es_final ? '✓' : '—'}
          </span>
        )}
      </td>

      {/* Activo */}
      <td className="px-3 py-2.5 w-16 text-center">
        <button onClick={toggleActivo} disabled={isPending}>
          {estado.activo
            ? <ToggleRight size={18} className="text-emerald-500" />
            : <ToggleLeft size={18} className="text-slate-300" />}
        </button>
      </td>

      {/* Acciones */}
      <td className="px-3 py-2.5 w-24">
        <div className="flex items-center gap-1">
          {editando ? (
            <>
              <button
                onClick={guardar} disabled={isPending}
                className="rounded-lg bg-blue-600 p-1.5 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                <Save size={13} />
              </button>
              <button
                onClick={() => { setEditando(false); setLabel(estado.label); setColorKey(estado.color_key); setIcono(estado.icono); setEsFinal(estado.es_final) }}
                className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-100"
              >
                ✕
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setEditando(true)}
                className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
              >
                Editar
              </button>
              <button
                onClick={eliminar} disabled={isPending}
                className="rounded-lg p-1.5 text-slate-300 hover:text-red-500"
              >
                <Trash2 size={13} />
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
  )
}

/* ── Formulario nuevo estado ─────────────────────────────────────────────── */
function FormNuevoEstado({ onCreated }: { onCreated: () => void }) {
  const [label, setLabel]       = useState('')
  const [colorKey, setColorKey] = useState('slate')
  const [icono, setIcono]       = useState('📋')
  const [esFinal, setEsFinal]   = useState(false)
  const [isPending, startT]     = useTransition()

  const nombre = generarNombre(label)

  const handleSubmit = () => {
    if (!label.trim()) { toast.error('El nombre es obligatorio'); return }
    if (!nombre)        { toast.error('El nombre generado no es válido'); return }
    startT(async () => {
      const res = await crearEstadoKanban({ label: label.trim(), nombre, color_key: colorKey, icono, es_final: esFinal })
      if (res.ok) { toast.success('Estado creado'); setLabel(''); onCreated() }
      else toast.error(res.error ?? 'Error al crear')
    })
  }

  const colores = COLOR_PALETTE[colorKey] ?? COLOR_PALETTE['slate']

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4 space-y-3">
      <p className="text-sm font-semibold text-slate-700">Nuevo estado</p>
      <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto_auto_auto]">
        <div className="space-y-1">
          <label className="text-xs text-slate-500">Nombre visible <span className="text-red-500">*</span></label>
          <input
            placeholder="En revisión de calidad..."
            value={label}
            onChange={e => setLabel(e.target.value)}
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
          />
          {label && (
            <p className="text-xs text-slate-400">
              Slug: <code className="bg-slate-100 px-1 rounded">{nombre}</code>
            </p>
          )}
        </div>
        <div className="space-y-1">
          <label className="text-xs text-slate-500">Icono</label>
          <select
            value={icono}
            onChange={e => setIcono(e.target.value)}
            className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-blue-400"
          >
            {EMOJIS.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-slate-500">Color</label>
          <select
            value={colorKey}
            onChange={e => setColorKey(e.target.value)}
            className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-blue-400"
          >
            {COLORES_OPCIONES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="space-y-1 flex flex-col items-center">
          <label className="text-xs text-slate-500">Es final</label>
          <input
            type="checkbox" checked={esFinal}
            onChange={e => setEsFinal(e.target.checked)}
            className="mt-2 h-4 w-4 rounded"
          />
        </div>
        <div className="flex items-end">
          <button
            onClick={handleSubmit} disabled={isPending}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <Plus size={14} />
            {isPending ? 'Creando...' : 'Crear'}
          </button>
        </div>
      </div>
      {label && (
        <div className="flex items-center gap-2">
          <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', colores.bg, colores.text)}>
            {icono} {label}
          </span>
          <span className="text-xs text-slate-400">Vista previa</span>
        </div>
      )}
    </div>
  )
}

/* ── Componente principal ────────────────────────────────────────────────── */
export function GestionEstadosKanban() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)

  const { data: estados = [], isLoading } = useQuery<EstadoKanban[]>({
    queryKey: ['estados-kanban'],
    queryFn: getEstadosKanban,
    staleTime: 30_000,
  })

  const refresh = () => qc.invalidateQueries({ queryKey: ['estados-kanban'] })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Estados del Kanban</h2>
          <p className="text-sm text-slate-500">
            Define las columnas del tablero, su orden y apariencia. Los estados marcados como
            "final" no aparecen en el Kanban pero siguen siendo válidos en el historial.
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus size={15} /> Nuevo estado
          </button>
        )}
      </div>

      {showForm && (
        <FormNuevoEstado
          onCreated={() => { setShowForm(false); refresh() }}
        />
      )}

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                {['Orden', 'Icono', 'Slug (nombre técnico)', 'Label visible', 'Color', 'Final', 'Activo', ''].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {estados.map((e, i) => (
                <FilaEstado
                  key={e.id} estado={e} idx={i}
                  total={estados.length} onRefresh={refresh}
                />
              ))}
            </tbody>
          </table>
          {estados.length === 0 && (
            <p className="py-8 text-center text-sm text-slate-400">
              No hay estados configurados. Ejecuta el SQL inicial para poblar los estados por defecto.
            </p>
          )}
        </div>
      )}

      <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-xs text-slate-500 space-y-1">
        <p className="font-semibold text-slate-600">Guía rápida</p>
        <p>• <strong>Orden</strong>: usa ↑ ↓ para cambiar la posición de la columna en el Kanban.</p>
        <p>• <strong>Final</strong>: estados como "Cerrado" que no aparecen en el tablero pero son válidos.</p>
        <p>• <strong>Activo</strong>: desactiva para ocultar temporalmente una columna sin eliminarla.</p>
        <p>• <strong>Slug</strong>: se auto-genera del label y es el valor que se guarda en la BD. No cambia al editar el label.</p>
      </div>
    </div>
  )
}
