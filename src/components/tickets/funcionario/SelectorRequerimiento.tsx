'use client'

import { useMemo, useRef, useState } from 'react'
import { FolderGit2, Search, X } from 'lucide-react'
import type { RequerimientoResumen } from '@/lib/tickets/requerimientos'
import { cn } from '@/lib/utils'

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

const LABEL_ESTADO: Record<string, string> = { ENTREGADO: 'Entregado', CERRADO: 'Cerrado' }

interface Props {
  requerimientos: RequerimientoResumen[]
  value: string
  onChange: (id: string) => void
  destacado?: boolean
  disabled?: boolean
}

/** Buscador del requerimiento entregado o cerrado sobre el que se abre el ticket */
export function SelectorRequerimiento({ requerimientos, value, onChange, destacado, disabled }: Props) {
  const [q, setQ] = useState('')
  const [abierto, setAbierto] = useState(false)
  const cerrarRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const elegido = requerimientos.find(r => r.id === value) ?? null

  const resultados = useMemo(() => {
    const t = norm(q.trim())
    const lista = t
      ? requerimientos.filter(r => norm(`${r.numero ?? ''} ${r.nombre}`).includes(t))
      : requerimientos
    return lista.slice(0, 40)
  }, [q, requerimientos])

  if (elegido) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2">
        <FolderGit2 size={15} className="mt-0.5 shrink-0 text-violet-600" />
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-medium text-violet-900">
            {elegido.numero && <span className="font-mono text-xs text-violet-600">#{elegido.numero} </span>}
            {elegido.nombre}
          </p>
          <p className="text-[11px] text-violet-700">{LABEL_ESTADO[elegido.estado] ?? elegido.estado}</p>
        </div>
        {!disabled && (
          <button type="button" onClick={() => onChange('')} aria-label="Quitar requerimiento" className="rounded p-0.5 text-violet-500 hover:bg-violet-100 hover:text-violet-800">
            <X size={14} />
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="relative">
      <Search size={14} className="pointer-events-none absolute left-2.5 top-2.5 text-slate-400" />
      <input
        type="text"
        value={q}
        disabled={disabled || requerimientos.length === 0}
        onChange={e => { setQ(e.target.value); setAbierto(true) }}
        onFocus={() => { if (cerrarRef.current) clearTimeout(cerrarRef.current); setAbierto(true) }}
        onBlur={() => { cerrarRef.current = setTimeout(() => setAbierto(false), 150) }}
        placeholder={requerimientos.length === 0 ? 'No hay requerimientos entregados o cerrados' : 'Busca por número o nombre del desarrollo…'}
        className={cn(
          'h-9 w-full rounded-lg border bg-white pl-8 pr-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50',
          destacado ? 'border-violet-300' : 'border-input',
        )}
        role="combobox"
        aria-expanded={abierto}
        aria-controls="lista-requerimientos"
        aria-label="Requerimiento relacionado"
      />
      {abierto && resultados.length > 0 && (
        <ul id="lista-requerimientos" role="listbox" className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          {resultados.map(r => (
            <li key={r.id} role="option" aria-selected={false}>
              <button
                type="button"
                onMouseDown={e => e.preventDefault()}
                onClick={() => { onChange(r.id); setQ(''); setAbierto(false) }}
                className="flex w-full items-start gap-2 px-3 py-1.5 text-left text-sm hover:bg-violet-50"
              >
                <span className="w-14 shrink-0 font-mono text-xs text-slate-400">{r.numero ? `#${r.numero}` : '—'}</span>
                <span className="flex-1 text-slate-700">{r.nombre}</span>
                <span className="shrink-0 text-[10px] text-slate-400">{LABEL_ESTADO[r.estado] ?? r.estado}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {abierto && q.trim() && resultados.length === 0 && (
        <p className="absolute z-20 mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500 shadow-lg">
          Ningún requerimiento entregado o cerrado coincide con la búsqueda
        </p>
      )}
    </div>
  )
}
