'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback, useState, useEffect } from 'react'
import { Search, X, ChevronDown, Filter } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { ESTADOS, PRIORIDADES, PROCESOS_INTERNOS, TIPOS_SOLUCION, getEstadoCfg } from '@/lib/constants'
import { cn } from '@/lib/utils'

const ALCANCES = [
  { value: 'IWF', color: 'bg-blue-100 text-blue-700 border-blue-300' },
  { value: 'ILT', color: 'bg-green-100 text-green-700 border-green-300' },
  { value: 'IWG', color: 'bg-purple-100 text-purple-700 border-purple-300' },
]

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

interface Props {
  totalFiltrado: number
  total: number
  estadosDisponibles?: string[]
}

export function FiltrosRequerimientos({ totalFiltrado, total, estadosDisponibles }: Props) {
  // Combina estados de la BD con los hardcodeados para no perder ninguno
  const todosLosEstados = estadosDisponibles && estadosDisponibles.length > 0
    ? Array.from(new Set([...Object.keys(ESTADOS), ...estadosDisponibles])).sort()
    : Object.keys(ESTADOS)
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const getParam = (key: string) => searchParams.get(key) ?? ''
  const getParamArray = (key: string) => {
    const v = searchParams.get(key)
    return v ? v.split(',').filter(Boolean) : []
  }

  const [search, setSearch] = useState(getParam('q'))
  const debouncedSearch = useDebounce(search, 300)

  const estadosActivos = getParamArray('estado')
  const alcanceActivo  = getParam('alcance')
  const prioridadActiva = getParam('prioridad')
  const procesoActivo  = getParam('proceso')
  const tipoActivo     = getParam('tipo')
  const soloBorradores = searchParams.get('borrador') === 'true'

  const hayFiltros = !!(debouncedSearch || estadosActivos.length || alcanceActivo ||
    prioridadActiva || procesoActivo || tipoActivo || soloBorradores)

  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString())
      Object.entries(updates).forEach(([k, v]) => {
        if (v === null || v === '') params.delete(k)
        else params.set(k, v)
      })
      params.set('page', '1')
      router.push(`${pathname}?${params.toString()}`)
    },
    [router, pathname, searchParams]
  )

  // Sync debounced search to URL
  useEffect(() => {
    updateParams({ q: debouncedSearch || null })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch])

  const toggleEstado = (estado: string) => {
    const next = estadosActivos.includes(estado)
      ? estadosActivos.filter(e => e !== estado)
      : [...estadosActivos, estado]
    updateParams({ estado: next.join(',') || null })
  }

  const limpiar = () => {
    setSearch('')
    router.push(pathname)
  }

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      {/* Fila 1: buscador + contador + limpiar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Buscar por nombre, identificación o descripción..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 text-sm"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <span className="shrink-0 text-xs text-slate-500">
          <span className="font-semibold text-slate-700">{totalFiltrado}</span> de{' '}
          <span className="font-semibold text-slate-700">{total}</span> requerimientos
        </span>

        {hayFiltros && (
          <Button variant="ghost" size="sm" onClick={limpiar} className="gap-1.5 text-xs text-slate-500">
            <X size={13} /> Limpiar filtros
          </Button>
        )}
      </div>

      {/* Fila 2: filtros secundarios */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Estado multi-select */}
        <Popover>
          <PopoverTrigger
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors',
              'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
              estadosActivos.length && 'border-blue-400 bg-blue-50 text-blue-700'
            )}
          >
            <Filter size={13} />
            Estado
            {estadosActivos.length > 0 && (
              <span className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] text-white">
                {estadosActivos.length}
              </span>
            )}
            <ChevronDown size={12} />
          </PopoverTrigger>
          <PopoverContent className="w-64 p-2 max-h-72 overflow-y-auto" align="start">
            <div className="space-y-1">
              {todosLosEstados.map((key) => {
                const cfg = getEstadoCfg(key)
                return (
                  <label
                    key={key}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-slate-50"
                  >
                    <Checkbox
                      checked={estadosActivos.includes(key)}
                      onCheckedChange={() => toggleEstado(key)}
                    />
                    <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', cfg.bgColor, cfg.textColor)}>
                      {cfg.label}
                    </span>
                  </label>
                )
              })}
            </div>
          </PopoverContent>
        </Popover>

        {/* Alcance toggle */}
        <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 gap-0.5">
          {ALCANCES.map(a => (
            <button
              key={a.value}
              onClick={() => updateParams({ alcance: alcanceActivo === a.value ? null : a.value })}
              className={cn(
                'rounded-md px-2.5 py-1 text-xs font-medium transition-all',
                alcanceActivo === a.value
                  ? cn(a.color, 'shadow-sm border')
                  : 'text-slate-500 hover:text-slate-700'
              )}
            >
              {a.value}
            </button>
          ))}
        </div>

        {/* Prioridad toggle */}
        <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 gap-0.5">
          {[1, 2, 3, 4].map(p => {
            const cfg = PRIORIDADES[p]
            const activo = prioridadActiva === String(p)
            return (
              <button
                key={p}
                onClick={() => updateParams({ prioridad: activo ? null : String(p) })}
                className={cn(
                  'rounded-md px-2.5 py-1 text-xs font-medium transition-all',
                  activo
                    ? cn(cfg.bgColor, cfg.textColor, cfg.borderColor, 'shadow-sm border')
                    : 'text-slate-500 hover:text-slate-700'
                )}
              >
                P{p}
              </button>
            )
          })}
        </div>

        {/* Proceso */}
        <Select
          value={procesoActivo || '_all'}
          onValueChange={v => updateParams({ proceso: v === '_all' ? null : v })}
        >
          <SelectTrigger className="h-8 w-[160px] text-xs">
            <SelectValue placeholder="Proceso" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">Todos los procesos</SelectItem>
            {PROCESOS_INTERNOS.map(p => (
              <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Tipo solución */}
        <Select
          value={tipoActivo || '_all'}
          onValueChange={v => updateParams({ tipo: v === '_all' ? null : v })}
        >
          <SelectTrigger className="h-8 w-[150px] text-xs">
            <SelectValue placeholder="Tipo solución" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">Todos los tipos</SelectItem>
            {Object.entries(TIPOS_SOLUCION).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Solo borradores */}
        <div className="flex items-center gap-1.5">
          <Switch
            id="borrador"
            checked={soloBorradores}
            onCheckedChange={v => updateParams({ borrador: v ? 'true' : null })}
            className="h-4 w-7"
          />
          <Label htmlFor="borrador" className="cursor-pointer text-xs text-slate-500">
            Solo borradores
          </Label>
        </div>
      </div>
    </div>
  )
}
