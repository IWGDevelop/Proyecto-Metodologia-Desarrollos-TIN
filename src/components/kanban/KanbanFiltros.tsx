'use client'

import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { PRIORIDADES } from '@/lib/constants'

const ALCANCES = ['IWF', 'ILT', 'IWG'] as const
type Alcance = typeof ALCANCES[number]

export interface FiltrosKanban {
  search: string
  alcances: Alcance[]
  prioridades: number[]
  responsable: string
}

interface Props {
  filtros: FiltrosKanban
  onChange: (f: FiltrosKanban) => void
  responsables: string[]
  total: number
  visibles: number
}

export function KanbanFiltros({ filtros, onChange, responsables, total, visibles }: Props) {
  const hayFiltros = !!(
    filtros.search || filtros.alcances.length || filtros.prioridades.length || filtros.responsable
  )

  const toggleAlcance = (a: Alcance) =>
    onChange({
      ...filtros,
      alcances: filtros.alcances.includes(a)
        ? filtros.alcances.filter(x => x !== a)
        : [...filtros.alcances, a],
    })

  const togglePrioridad = (p: number) =>
    onChange({
      ...filtros,
      prioridades: filtros.prioridades.includes(p)
        ? filtros.prioridades.filter(x => x !== p)
        : [...filtros.prioridades, p],
    })

  const limpiar = () =>
    onChange({ search: '', alcances: [], prioridades: [], responsable: '' })

  const ALCANCE_COLORS: Record<Alcance, string> = {
    IWF: 'border-blue-400 bg-blue-100 text-blue-700',
    ILT: 'border-green-400 bg-green-100 text-green-700',
    IWG: 'border-purple-400 bg-purple-100 text-purple-700',
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      {/* Búsqueda */}
      <div className="relative min-w-[180px] flex-1">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <Input
          placeholder="Buscar por nombre..."
          value={filtros.search}
          onChange={e => onChange({ ...filtros, search: e.target.value })}
          className="h-8 pl-8 text-xs"
        />
        {filtros.search && (
          <button
            onClick={() => onChange({ ...filtros, search: '' })}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            <X size={12} />
          </button>
        )}
      </div>

      {/* Alcances */}
      <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 gap-0.5">
        {ALCANCES.map(a => (
          <button
            key={a}
            onClick={() => toggleAlcance(a)}
            className={cn(
              'rounded-md px-2.5 py-1 text-xs font-semibold transition-all',
              filtros.alcances.includes(a)
                ? cn(ALCANCE_COLORS[a], 'border')
                : 'text-slate-500 hover:text-slate-700'
            )}
          >
            {a}
          </button>
        ))}
      </div>

      {/* Prioridades */}
      <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 gap-0.5">
        {[1, 2, 3, 4].map(p => {
          const cfg = PRIORIDADES[p]
          const activo = filtros.prioridades.includes(p)
          return (
            <button
              key={p}
              onClick={() => togglePrioridad(p)}
              className={cn(
                'rounded-md px-2.5 py-1 text-xs font-medium transition-all',
                activo
                  ? cn(cfg.bgColor, cfg.textColor, cfg.borderColor, 'border')
                  : 'text-slate-500 hover:text-slate-700'
              )}
            >
              P{p}
            </button>
          )
        })}
      </div>

      {/* Responsable */}
      {responsables.length > 0 && (
        <select
          value={filtros.responsable}
          onChange={e => onChange({ ...filtros, responsable: e.target.value })}
          className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-400"
        >
          <option value="">Todos los responsables</option>
          {responsables.map(r => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      )}

      {/* Contador + limpiar */}
      <span className="text-xs text-slate-400">
        <span className="font-semibold text-slate-600">{visibles}</span> de {total}
      </span>

      {hayFiltros && (
        <button
          onClick={limpiar}
          className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600"
        >
          <X size={12} /> Limpiar
        </button>
      )}
    </div>
  )
}
