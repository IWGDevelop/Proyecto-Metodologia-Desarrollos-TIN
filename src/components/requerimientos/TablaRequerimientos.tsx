'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback, useState, useTransition } from 'react'
import {
  ChevronUp, ChevronDown, ChevronsUpDown,
  MoreHorizontal, Eye, Pencil, RefreshCw, Archive,
  ChevronLeft, ChevronRight,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { CambiarEstadoDialog } from './CambiarEstadoDialog'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { EmptyState } from '@/components/shared/EmptyState'
import { AsignarPrioridadBtn } from './AsignarPrioridadBtn'
import {
  useRequerimientos, useInvalidateRequerimientos,
  PAGE_SIZE, type FiltrosRequerimientos, type SortConfig,
} from '@/hooks/useRequerimientos'
import type { PerfilFiltro } from '@/actions/requerimientos-admin'
import { eliminarRequerimiento, actualizarRequerimiento } from '@/actions/requerimientos'
import { ESTADOS, PRIORIDADES, ORIGENES_REQUERIMIENTO, PROCESOS_INTERNOS, TIPOS_SOLICITUD } from '@/lib/constants'
import { formatCOP, cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { MetricaRequerimiento, Estado } from '@/lib/supabase/types'

// ─── Celda editable inline ────────────────────────────────────────────────────
interface OpcionEdit { value: string; label: string; badgeClass?: string }

function CeldaEditable({
  rowId, valor, opciones, onGuardar, renderBadge, placeholder = '—', editable = true,
}: {
  rowId: string
  valor: string | null | undefined
  opciones: OpcionEdit[]
  onGuardar: (id: string, v: string | null) => Promise<void>
  renderBadge: (v: string | null | undefined) => React.ReactNode
  placeholder?: string
  editable?: boolean
}) {
  const [editando, setEditando] = useState(false)
  const [guardando, setGuardando] = useState(false)

  if (!editable) {
    return <>{renderBadge(valor) ?? <span className="text-xs text-slate-300">{placeholder}</span>}</>
  }

  if (editando) {
    return (
      <select
        autoFocus
        defaultValue={valor ?? ''}
        disabled={guardando}
        className="rounded-md border border-blue-400 bg-white px-1.5 py-1 text-xs shadow-sm outline-none focus:ring-1 focus:ring-blue-400 cursor-pointer"
        onChange={async (e) => {
          const val = e.target.value || null
          setGuardando(true)
          try {
            await onGuardar(rowId, val)
          } finally {
            setGuardando(false)
            setEditando(false)
          }
        }}
        onBlur={() => setEditando(false)}
        onClick={(e) => e.stopPropagation()}
      >
        <option value="">— Sin asignar —</option>
        {opciones.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    )
  }

  return (
    <div
      className="group/edit flex items-center gap-1 cursor-pointer"
      onClick={(e) => { e.stopPropagation(); setEditando(true) }}
      title="Clic para editar"
    >
      {renderBadge(valor) ?? <span className="text-xs text-slate-300">{placeholder}</span>}
      <Pencil
        size={10}
        className="shrink-0 text-slate-300 opacity-0 group-hover/edit:opacity-100 transition-opacity"
      />
    </div>
  )
}

// ─── Colores por campo ────────────────────────────────────────────────────────
const ALCANCE_BADGE: Record<string, string> = {
  IWF: 'border-blue-300 bg-blue-50 text-blue-700',
  ILT: 'border-green-300 bg-green-50 text-green-700',
  IWG: 'border-purple-300 bg-purple-50 text-purple-700',
}

// ─── Cabecera ordenable ───────────────────────────────────────────────────────
function ColHeader({
  label, column, sort, onSort, className,
}: {
  label: string; column?: string
  sort: SortConfig; onSort: (col: string) => void; className?: string
}) {
  if (!column) return <th className={cn('px-3 py-2.5 text-left text-xs font-medium text-slate-400', className)}>{label}</th>
  const active = sort.column === column
  return (
    <th
      className={cn('px-3 py-2.5 text-left text-xs font-medium text-slate-400 cursor-pointer select-none hover:text-slate-600', className)}
      onClick={() => onSort(column)}
    >
      <span className="flex items-center gap-1">
        {label}
        {active
          ? sort.direction === 'asc'
            ? <ChevronUp size={12} className="text-blue-500" />
            : <ChevronDown size={12} className="text-blue-500" />
          : <ChevronsUpDown size={12} className="opacity-40" />
        }
      </span>
    </th>
  )
}

// ─── Acciones por fila ────────────────────────────────────────────────────────
function AccionesMenu({
  row, onCambiarEstado, onEliminar, basePath, isAdmin,
}: {
  row: MetricaRequerimiento
  onCambiarEstado: (r: MetricaRequerimiento) => void
  onEliminar: (id: string) => void
  basePath: string
  isAdmin: boolean
}) {
  const router = useRouter()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        onClick={e => e.stopPropagation()}
        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600"
      >
        <MoreHorizontal size={15} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44" onClick={e => e.stopPropagation()}>
        <DropdownMenuItem onClick={() => router.push(`${basePath}/${row.id}`)}>
          <Eye size={13} className="mr-2" /> Ver detalle
        </DropdownMenuItem>
        {isAdmin && (
          <>
            <DropdownMenuItem onClick={() => router.push(`${basePath}/${row.id}/editar`)}>
              <Pencil size={13} className="mr-2" /> Editar completo
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onCambiarEstado(row)}>
              <RefreshCw size={13} className="mr-2" /> Cambiar estado
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onEliminar(row.id)} variant="destructive">
              <Archive size={13} className="mr-2" /> Cerrar requerimiento
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ─── Paginación ───────────────────────────────────────────────────────────────
function Paginacion({ page, total, onPage }: { page: number; total: number; onPage: (p: number) => void }) {
  const totalPaginas = Math.ceil(total / PAGE_SIZE)
  if (totalPaginas <= 1) return null
  const paginas: (number | '...')[] = []
  if (totalPaginas <= 7) {
    for (let i = 1; i <= totalPaginas; i++) paginas.push(i)
  } else {
    paginas.push(1)
    if (page > 3) paginas.push('...')
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPaginas - 1, page + 1); i++) paginas.push(i)
    if (page < totalPaginas - 2) paginas.push('...')
    paginas.push(totalPaginas)
  }
  return (
    <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
      <span className="text-xs text-slate-400">Página {page} de {totalPaginas} · {total} resultados</span>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon" className="h-7 w-7" disabled={page === 1} onClick={() => onPage(page - 1)}>
          <ChevronLeft size={13} />
        </Button>
        {paginas.map((p, i) =>
          p === '...' ? (
            <span key={`e${i}`} className="px-1 text-xs text-slate-400">…</span>
          ) : (
            <Button
              key={p} variant={page === p ? 'default' : 'outline'} size="icon"
              className={cn('h-7 w-7 text-xs', page === p && 'bg-blue-600')}
              onClick={() => onPage(p as number)}
            >
              {p}
            </Button>
          )
        )}
        <Button variant="outline" size="icon" className="h-7 w-7" disabled={page === totalPaginas} onClick={() => onPage(page + 1)}>
          <ChevronRight size={13} />
        </Button>
      </div>
    </div>
  )
}

// ─── Opciones estáticas para selects ─────────────────────────────────────────
const OPCIONES_ALCANCE: OpcionEdit[] = [
  { value: 'IWF', label: 'IWF' },
  { value: 'ILT', label: 'ILT' },
  { value: 'IWG', label: 'IWG' },
]
const OPCIONES_PRIORIDAD: OpcionEdit[] = [
  { value: '',    label: '— Sin prioridad' },
  ...[1, 2, 3, 4].flatMap(p => [
    { value: String(p), label: `P${p} — ${PRIORIDADES[p].label}` },
    ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map(sp => ({
      value: `${p}.${sp}`,
      label: `P${p}.${sp} — ${PRIORIDADES[p].label}`,
    })),
  ]),
]
const OPCIONES_ORIGEN: OpcionEdit[] = ORIGENES_REQUERIMIENTO.map(o => ({ value: o.value, label: o.label }))
const OPCIONES_PROCESO: OpcionEdit[] = PROCESOS_INTERNOS.map(p => ({ value: p.value, label: p.label }))
const OPCIONES_TIPO_SOLICITUD: OpcionEdit[] = TIPOS_SOLICITUD.map(t => ({ value: t.value, label: t.label }))

const TIPO_SOLICITUD_BADGE: Record<string, string> = {
  NUEVO_DESARROLLO: 'bg-blue-100 text-blue-700 border-blue-200',
  MEJORA:           'bg-violet-100 text-violet-700 border-violet-200',
  INTEGRACION:      'bg-cyan-100 text-cyan-700 border-cyan-200',
  INFORME:          'bg-amber-100 text-amber-700 border-amber-200',
}

// ─── Componente principal ─────────────────────────────────────────────────────
interface Props {
  filtros: FiltrosRequerimientos
  page: number
  sort: SortConfig
  basePath?: string
  isAdmin?: boolean
  perfilFiltro?: PerfilFiltro | null
}

export function TablaRequerimientos({ filtros, page, sort, basePath = '/admin/requerimientos', isAdmin = false, perfilFiltro }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const invalidar = useInvalidateRequerimientos()

  const { data: result, isLoading, isFetching } = useRequerimientos(filtros, page, sort, isAdmin, perfilFiltro)

  const [cambioEstadoRow, setCambioEstadoRow] = useState<MetricaRequerimiento | null>(null)
  const [eliminarId, setEliminarId] = useState<string | null>(null)
  const [eliminando, setEliminando] = useState(false)

  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString())
      Object.entries(updates).forEach(([k, v]) => {
        if (v === null) params.delete(k)
        else params.set(k, v)
      })
      router.push(`${pathname}?${params.toString()}`)
    },
    [router, pathname, searchParams]
  )

  const handleSort = (col: string) => {
    const dir = sort.column === col && sort.direction === 'asc' ? 'desc' : 'asc'
    updateParams({ sort: col, dir, page: '1' })
  }
  const handlePage = (p: number) => updateParams({ page: String(p) })

  const handleEliminar = async () => {
    if (!eliminarId) return
    setEliminando(true)
    try {
      await eliminarRequerimiento(eliminarId)
      toast.success('Requerimiento cerrado')
      invalidar()
    } catch {
      toast.error('Error al cerrar el requerimiento')
    } finally {
      setEliminando(false)
      setEliminarId(null)
    }
  }

  // Guardado inline genérico
  const guardarCampo = async (id: string, campo: string, valor: string | null) => {
    try {
      let payload: Record<string, unknown> = { [campo]: valor }
      if (campo === 'prioridad') {
        if (!valor) {
          payload = { prioridad: null, sub_prioridad: null }
        } else if (valor.includes('.')) {
          const [p, sp] = valor.split('.')
          payload = { prioridad: Number(p), sub_prioridad: Number(sp) }
        } else {
          payload = { prioridad: Number(valor), sub_prioridad: null }
        }
      }
      await actualizarRequerimiento(id, payload)
      invalidar()
      toast.success('Guardado')
    } catch {
      toast.error('Error al guardar')
    }
  }

  if (isLoading) return <TablaRequerimientosSkeleton />

  const rows = result?.data ?? []
  const total = result?.totalFiltrado ?? 0

  return (
    <>
      <div className={cn('rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden', isFetching && 'opacity-70')}>
        {rows.length === 0 ? (
          <EmptyState title="Sin requerimientos" description="No se encontraron requerimientos con los filtros aplicados." className="py-20" />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-100 bg-slate-50">
                  <tr>
                    <ColHeader label="Rank"    sort={sort} onSort={handleSort} className="w-14 text-center" />
                    <ColHeader label="Nombre"  sort={sort} onSort={handleSort} className="min-w-[260px]" />
                    <ColHeader label="Alcance" column="alcance" sort={sort} onSort={handleSort} className="w-24" />
                    <ColHeader label="Proceso"   sort={sort} onSort={handleSort} className="w-36" />
                    <ColHeader label="Tipo"     column="tipo_solicitud" sort={sort} onSort={handleSort} className="w-32" />
                    <ColHeader label="Prior."   column="prioridad" sort={sort} onSort={handleSort} className="w-20" />
                    <ColHeader label="Estado"  column="estado"    sort={sort} onSort={handleSort} className="w-36" />
                    <ColHeader label="Origen"  column="origen_requerimiento" sort={sort} onSort={handleSort} className="w-36" />
                    <ColHeader label="Avance"  sort={sort} onSort={handleSort} className="w-20" />
                    <ColHeader label="Hs. dev." column="horas_estimadas_desarrollo" sort={sort} onSort={handleSort} className="w-20 text-right" />
                    <ColHeader label="HH anual" column="ahorro_anual_cop" sort={sort} onSort={handleSort} className="w-28 text-right" />
                    <ColHeader label="Cualitativos" column="total_beneficios_cualitativos_anual" sort={sort} onSort={handleSort} className="w-28 text-right" />
                    <ColHeader label="Total impacto" column="impacto_economico_total_anual" sort={sort} onSort={handleSort} className="w-32 text-right" />
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {rows.map((row, rowIdx) => {
                    const estadoCfg = ESTADOS[row.estado as Estado] ?? { label: row.estado, bgColor: 'bg-slate-100', textColor: 'text-slate-600' }
                    const rankNum = (page - 1) * PAGE_SIZE + rowIdx + 1
                    const tieneImpacto = (row.impacto_economico_total_anual ?? 0) > 0 ||
                                        (row.ahorro_anual_cop ?? 0) > 0 ||
                                        ((row as any).total_beneficios_cualitativos_anual ?? 0) > 0

                    const rankBadge = tieneImpacto
                      ? rankNum === 1 ? { cls: 'bg-yellow-100 text-yellow-700 border-yellow-300', ico: '🥇' }
                      : rankNum === 2 ? { cls: 'bg-slate-100 text-slate-600 border-slate-300',   ico: '🥈' }
                      : rankNum === 3 ? { cls: 'bg-orange-50 text-orange-600 border-orange-200', ico: '🥉' }
                      : null : null

                    return (
                      <tr
                        key={row.id}
                        className="group cursor-pointer hover:bg-slate-50 transition-colors"
                        onClick={() => router.push(`${basePath}/${row.id}`)}
                      >
                        {/* Ranking */}
                        <td className="px-2 py-2.5 text-center">
                          {rankBadge ? (
                            <span className={cn('inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-xs font-bold', rankBadge.cls)}>
                              {rankBadge.ico} #{rankNum}
                            </span>
                          ) : tieneImpacto ? (
                            <span className="text-xs font-mono text-slate-400">#{rankNum}</span>
                          ) : (
                            <span className="text-xs text-slate-300">—</span>
                          )}
                          {row.es_borrador && (
                            <Badge variant="outline" className="mt-0.5 border-slate-300 py-0 text-[10px] text-slate-400 block">Draft</Badge>
                          )}
                        </td>

                        {/* Nombre — nombre_desarrollo completo como principal */}
                        <td className="px-3 py-2.5 max-w-[340px]">
                          <p className="font-semibold text-slate-800 leading-snug break-words">
                            {row.nombre_desarrollo || row.identificacion}
                          </p>
                          {row.nombre_desarrollo && (
                            <p className="mt-0.5 text-[11px] text-slate-400 line-clamp-1" title={row.identificacion}>
                              {row.identificacion}
                            </p>
                          )}
                        </td>

                        {/* Alcance — editable solo admin */}
                        <td className="px-3 py-2.5">
                          <CeldaEditable
                            rowId={row.id}
                            valor={row.alcance}
                            opciones={OPCIONES_ALCANCE}
                            onGuardar={(id, v) => guardarCampo(id, 'alcance', v)}
                            editable={isAdmin}
                            renderBadge={(v) => v ? (
                              <Badge variant="outline" className={cn('text-xs', ALCANCE_BADGE[v] ?? '')}>
                                {v}
                              </Badge>
                            ) : null}
                          />
                        </td>

                        {/* Proceso — editable solo admin */}
                        <td className="px-3 py-2.5">
                          <CeldaEditable
                            rowId={row.id}
                            valor={(row as any).proceso_interno}
                            opciones={OPCIONES_PROCESO}
                            onGuardar={(id, v) => guardarCampo(id, 'proceso_interno', v)}
                            editable={isAdmin}
                            renderBadge={(v) => v ? (
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                                {PROCESOS_INTERNOS.find(p => p.value === v)?.label ?? v}
                              </span>
                            ) : null}
                          />
                        </td>

                        {/* Tipo solicitud — editable solo admin */}
                        <td className="px-3 py-2.5">
                          <CeldaEditable
                            rowId={row.id}
                            valor={row.tipo_solicitud}
                            opciones={OPCIONES_TIPO_SOLICITUD}
                            onGuardar={(id, v) => guardarCampo(id, 'tipo_solicitud', v)}
                            editable={isAdmin}
                            renderBadge={(v) => v ? (
                              <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium', TIPO_SOLICITUD_BADGE[v] ?? 'bg-slate-100 text-slate-600 border-slate-200')}>
                                {TIPOS_SOLICITUD.find(t => t.value === v)?.label ?? v}
                              </span>
                            ) : null}
                          />
                        </td>

                        {/* Prioridad — admin: select inline / usuario: botón con dialog */}
                        <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                          {isAdmin ? (
                            <CeldaEditable
                              rowId={row.id}
                              valor={row.prioridad
                                ? row.sub_prioridad
                                  ? `${row.prioridad}.${row.sub_prioridad}`
                                  : String(row.prioridad)
                                : null}
                              opciones={OPCIONES_PRIORIDAD}
                              onGuardar={(id, v) => guardarCampo(id, 'prioridad', v)}
                              editable
                              renderBadge={(v) => {
                                if (!v) return <span className="rounded-full border border-dashed border-slate-200 px-1.5 py-0.5 text-xs text-slate-300">—</span>
                                const p = v.includes('.') ? Number(v.split('.')[0]) : Number(v)
                                const cfg = PRIORIDADES[p]
                                return cfg ? (
                                  <span className={cn('rounded-full px-1.5 py-0.5 text-xs font-bold', cfg.bgColor, cfg.textColor)}>
                                    P{v}
                                  </span>
                                ) : null
                              }}
                            />
                          ) : (
                            <AsignarPrioridadBtn
                              requerimientoId={row.id}
                              prioridadActual={row.prioridad ?? null}
                              subPrioridadActual={(row as any).sub_prioridad ?? null}
                              proceso_interno={(row as any).proceso_interno ?? null}
                            />
                          )}
                        </td>

                        {/* Estado — admin: abre diálogo / usuario: solo lectura */}
                        <td className="px-3 py-2.5">
                          {isAdmin ? (
                            <div
                              className="group/edit flex items-center gap-1 cursor-pointer"
                              onClick={(e) => { e.stopPropagation(); setCambioEstadoRow(row) }}
                              title="Clic para cambiar estado"
                            >
                              <span className={cn(
                                'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                                estadoCfg.bgColor, estadoCfg.textColor
                              )}>
                                {estadoCfg.label}
                              </span>
                              <Pencil size={10} className="shrink-0 text-slate-300 opacity-0 group-hover/edit:opacity-100 transition-opacity" />
                            </div>
                          ) : (
                            <span className={cn(
                              'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                              estadoCfg.bgColor, estadoCfg.textColor
                            )}>
                              {estadoCfg.label}
                            </span>
                          )}
                        </td>

                        {/* Origen — editable solo admin */}
                        <td className="px-3 py-2.5">
                          <CeldaEditable
                            rowId={row.id}
                            valor={(row as any).origen_requerimiento}
                            opciones={OPCIONES_ORIGEN}
                            onGuardar={(id, v) => guardarCampo(id, 'origen_requerimiento', v)}
                            editable={isAdmin}
                            renderBadge={(v) => {
                              const cfg = v ? ORIGENES_REQUERIMIENTO.find(o => o.value === v) : null
                              return cfg ? (
                                <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border', cfg.color, cfg.iconColor)}>
                                  {cfg.label}
                                </span>
                              ) : null
                            }}
                          />
                        </td>

                        {/* Avance */}
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <Progress value={row.porcentaje_avance} className="h-1.5 w-14" />
                            <span className="text-xs text-slate-400">{row.porcentaje_avance}%</span>
                          </div>
                        </td>

                        {/* Horas desarrollo */}
                        <td className="px-3 py-2.5 text-right">
                          {(row as any).horas_estimadas_desarrollo
                            ? <span className="text-xs font-semibold text-indigo-600">{((row as any).horas_estimadas_desarrollo as number).toFixed(1)} h</span>
                            : <span className="text-xs text-slate-300">—</span>}
                        </td>

                        {/* HH anual */}
                        <td className="px-3 py-2.5 text-right">
                          {(row.ahorro_anual_cop ?? 0) > 0
                            ? <span className="text-xs font-medium text-emerald-600">{formatCOP(row.ahorro_anual_cop)}</span>
                            : <span className="text-xs text-slate-300">—</span>}
                        </td>

                        {/* Cualitativos */}
                        <td className="px-3 py-2.5 text-right">
                          {((row as any).total_beneficios_cualitativos_anual ?? 0) > 0
                            ? <span className="text-xs font-medium text-blue-600">{formatCOP((row as any).total_beneficios_cualitativos_anual)}</span>
                            : <span className="text-xs text-slate-300">—</span>}
                        </td>

                        {/* Total impacto */}
                        <td className="px-3 py-2.5 text-right">
                          {tieneImpacto ? (
                            <div className="flex flex-col items-end gap-0.5">
                              <span className="text-sm font-extrabold text-emerald-700">
                                {formatCOP((row as any).impacto_economico_total_anual
                                  ?? ((row.ahorro_anual_cop ?? 0) + ((row as any).total_beneficios_cualitativos_anual ?? 0)))}
                              </span>
                              <span className="text-[10px] text-slate-400">HH + Cual/año</span>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-300">Sin cálculo</span>
                          )}
                        </td>

                        {/* Acciones */}
                        <td className="px-2 py-2.5" onClick={e => e.stopPropagation()}>
                          <AccionesMenu
                            row={row}
                            onCambiarEstado={setCambioEstadoRow}
                            onEliminar={setEliminarId}
                            basePath={basePath}
                            isAdmin={isAdmin}
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <Paginacion page={page} total={total} onPage={handlePage} />
          </>
        )}
      </div>

      {cambioEstadoRow && (
        <CambiarEstadoDialog
          open={!!cambioEstadoRow}
          onOpenChange={open => !open && setCambioEstadoRow(null)}
          requerimientoId={cambioEstadoRow.id}
          estadoActual={cambioEstadoRow.estado as Estado}
          onSuccess={invalidar}
        />
      )}

      <ConfirmDialog
        open={!!eliminarId}
        onOpenChange={open => !open && setEliminarId(null)}
        title="¿Cerrar requerimiento?"
        description="El requerimiento quedará en estado CERRADO. Esta acción se puede revertir cambiando el estado manualmente."
        confirmLabel="Cerrar requerimiento"
        variant="destructive"
        onConfirm={handleEliminar}
        loading={eliminando}
      />
    </>
  )
}

export function TablaRequerimientosSkeleton() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="border-b border-slate-100 bg-slate-50 px-4 py-2.5">
        <div className="flex gap-6">
          {[16, 48, 12, 20, 24, 28, 8, 24, 10, 16, 20].map((w, i) => (
            <Skeleton key={i} className={`h-3 w-${w}`} />
          ))}
        </div>
      </div>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-6 border-b border-slate-50 px-4 py-3">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-4 w-52" />
          <Skeleton className="h-5 w-10 rounded-full" />
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="h-5 w-8 rounded-full" />
          <Skeleton className="h-5 w-24 rounded-full" />
          <Skeleton className="h-3 w-6" />
          <Skeleton className="h-2 w-16 rounded-full" />
          <Skeleton className="h-3 w-20" />
        </div>
      ))}
    </div>
  )
}
