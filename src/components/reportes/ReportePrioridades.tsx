'use client'

import { useMemo, useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts'
import { ExternalLink, AlertTriangle, Filter, X, ChevronDown } from 'lucide-react'
import { cn, formatCOP } from '@/lib/utils'
import { ESTADOS } from '@/lib/constants'
import type { MetricaRequerimiento, Estado } from '@/lib/supabase/types'
import { AsignarPrioridadBtn } from '@/components/requerimientos/AsignarPrioridadBtn'

interface Props { datos: MetricaRequerimiento[] }

const PRIORIDAD_BG: Record<number, string> = {
  1: 'bg-red-100 text-red-700 border-red-300',
  2: 'bg-orange-100 text-orange-700 border-orange-300',
  3: 'bg-amber-100 text-amber-700 border-amber-300',
  4: 'bg-blue-100 text-blue-700 border-blue-300',
  5: 'bg-violet-100 text-violet-700 border-violet-300',
}

const PROCESO_LABEL: Record<string, string> = {
  FINANCIERO: 'Financiero', OPERACIONES: 'Operaciones', COMERCIAL: 'Comercial',
  CARGA: 'Carga', SISTEMAS_GESTION: 'Sistemas Gestión', SERVICIO_CLIENTE: 'Serv. Cliente',
  COMPRAS: 'Compras', SEGUROS: 'Seguros', DATOS: 'Datos', TI: 'TI',
  GENERAL: 'General', PRICING: 'Pricing', ESTRATEGIA: 'Estrategia',
  MARKETING: 'Marketing', TRAFICO_SEGURIDAD: 'Tráfico y Seguridad',
}

const PROCESO_COLORS = [
  '#3b82f6','#10b981','#f59e0b','#8b5cf6','#06b6d4',
  '#ec4899','#f97316','#84cc16','#a78bfa','#0ea5e9','#94a3b8','#fb7185','#34d399',
]

const ESTADO_LABEL: Record<string, string> = {
  SIN_GESTION: 'Sin gestión', ANALISIS: 'En estudio y evaluación técnica', EN_DEFINICION_USUARIO: 'En definición',
  EN_DESARROLLO: 'En desarrollo', PRUEBAS_USUARIO: 'Pruebas', STAND_BY: 'Stand By',
  AJUSTES_TECNICOS: 'Ajustes técnicos', ENTREGADO: 'Prog. salida en vivo', CERRADO: 'Cerrado', DESISTIDO: 'Desistido',
}

const ORIGEN_LABEL: Record<string, string> = {
  LISTA_MEJORAS_PENDIENTES: 'Lista mejoras',
  TIN_NOVA:                 'TIN Nova',
  DESARROLLO_EXTERNO:       'Desarrollo externo',
}

// sub_prioridad null = 0 para ordenar primero
function subNum(sp: number | null) { return sp ?? 0 }

// Etiqueta jerárquica recorriendo árbol de padres
function labelJerarquico(
  id: string,
  allReqs: { id: string; prioridad: number | null; sub_prioridad?: number | null; parent_id?: string | null }[]
): string {
  const req = allReqs.find(r => r.id === id)
  if (!req?.prioridad) return '—'
  const sp = (req as any).sub_prioridad ?? null
  if (!(req as any).parent_id) {
    return sp != null ? `${req.prioridad}.${sp}` : `${req.prioridad}.0`
  }
  const parentLabel = labelJerarquico((req as any).parent_id, allReqs)
  return `${parentLabel}.${sp ?? 0}`
}

// Ordenamiento DFS: raíces ordenadas por prioridad, hijos siguen a su padre
function sortByTree(reqs: MetricaRequerimiento[]): MetricaRequerimiento[] {
  const childrenOf = new Map<string | null, MetricaRequerimiento[]>()
  reqs.forEach(r => {
    const pid = (r as any).parent_id ?? null
    if (!childrenOf.has(pid)) childrenOf.set(pid, [])
    childrenOf.get(pid)!.push(r)
  })
  childrenOf.forEach(arr => arr.sort((a, b) => {
    const pa = a.prioridad ?? 99, pb = b.prioridad ?? 99
    if (pa !== pb) return pa - pb
    return subNum((a as any).sub_prioridad) - subNum((b as any).sub_prioridad)
  }))
  const result: MetricaRequerimiento[] = []
  function dfs(parentId: string | null) {
    for (const r of childrenOf.get(parentId) ?? []) {
      result.push(r)
      dfs(r.id)
    }
  }
  dfs(null)
  return result
}

function Select({ label, value, onChange, options }: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
      >
        <option value="">Todos</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

function MultiSelect({ label, values, onChange, options }: {
  label: string
  values: string[]
  onChange: (v: string[]) => void
  options: { value: string; label: string }[]
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const toggle = (v: string) =>
    onChange(values.includes(v) ? values.filter(x => x !== v) : [...values, v])

  const displayLabel = values.length === 0
    ? 'Todos'
    : values.length === 1
    ? (options.find(o => o.value === values[0])?.label ?? values[0])
    : `${values.length} seleccionados`

  return (
    <div ref={ref} className="flex flex-col gap-1 relative">
      <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{label}</label>
      <button
        onClick={() => setOpen(o => !o)}
        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-left flex items-center justify-between gap-1 focus:outline-none focus:ring-2 focus:ring-blue-300"
      >
        <span className={values.length === 0 ? 'text-slate-400' : 'text-slate-700 truncate'}>{displayLabel}</span>
        <ChevronDown size={11} className="shrink-0 text-slate-400" />
      </button>
      {open && (
        <div className="absolute top-full left-0 z-30 mt-1 min-w-[210px] rounded-lg border border-slate-200 bg-white shadow-lg max-h-60 overflow-y-auto">
          {options.map(o => (
            <label key={o.value} className="flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 cursor-pointer">
              <input
                type="checkbox"
                checked={values.includes(o.value)}
                onChange={() => toggle(o.value)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-300"
              />
              <span className="text-xs text-slate-700">{o.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

function seccionTitle(title: string) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <h2 className="text-base font-bold text-slate-800">{title}</h2>
      <div className="flex-1 h-px bg-slate-200" />
    </div>
  )
}

export function ReportePrioridades({ datos }: Props) {
  const [fEmpresa,   setFEmpresa]   = useState('')
  const [fPrioridad, setFPrioridad] = useState('')
  const [fEstados,   setFEstados]   = useState<string[]>([])
  const [fProceso,   setFProceso]   = useState('')
  const [fOrigen,    setFOrigen]    = useState('')

  const hayFiltros = fEmpresa || fPrioridad || fEstados.length > 0 || fProceso || fOrigen

  // ── Datos filtrados ───────────────────────────────────────────────────────
  const filtrados = useMemo(() => {
    const base = datos.filter(r => {
      if (fEmpresa              && r.alcance          !== fEmpresa)                  return false
      if (fPrioridad            && String(r.prioridad) !== fPrioridad)               return false
      if (fEstados.length > 0   && !fEstados.includes(r.estado))                    return false
      if (fProceso              && r.proceso_interno   !== fProceso)                 return false
      if (fOrigen               && (r as any).origen_requerimiento !== fOrigen)      return false
      return true
    })
    return sortByTree(base)
  }, [datos, fEmpresa, fPrioridad, fEstados, fProceso, fOrigen])

  // ── 1. Conteos por prioridad ──────────────────────────────────────────────
  const conteosPrioridad = useMemo(() => {
    const map: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0, 'Sin prioridad': 0 }
    filtrados.forEach(r => {
      const k = r.prioridad ? String(r.prioridad) : 'Sin prioridad'
      map[k] = (map[k] ?? 0) + 1
    })
    return map
  }, [filtrados])

  // ── 2. Grupos por prioridad ───────────────────────────────────────────────
  const grupos = useMemo(() => {
    const map = new Map<number, MetricaRequerimiento[]>()
    const sinPrioridad: MetricaRequerimiento[] = []
    filtrados.forEach(r => {
      if (!r.prioridad) { sinPrioridad.push(r); return }
      if (!map.has(r.prioridad)) map.set(r.prioridad, [])
      map.get(r.prioridad)!.push(r)
    })
    return { grupos: map, sinPrioridad }
  }, [filtrados])

  // ── 3. Conteos por estado ─────────────────────────────────────────────────
  const datosPorEstado = useMemo(() => {
    const map: Record<string, number> = {}
    filtrados.forEach(r => { const k = r.estado ?? 'SIN_GESTION'; map[k] = (map[k] ?? 0) + 1 })
    return Object.entries(map)
      .map(([estado, cantidad]) => ({ estado, label: ESTADO_LABEL[estado] ?? estado, cantidad }))
      .sort((a, b) => b.cantidad - a.cantidad)
  }, [filtrados])

  const ESTADO_COLORS = ['#3b82f6','#10b981','#f59e0b','#8b5cf6','#06b6d4','#ec4899','#94a3b8','#ef4444','#f97316']

  // ── 4. Impacto por proceso ────────────────────────────────────────────────
  const impactoPorProceso = useMemo(() => {
    const map: Record<string, number> = {}
    filtrados.forEach(r => {
      const proc = r.proceso_interno ?? 'Sin proceso'
      const imp = (r as any).impacto_economico_total_anual ?? r.ahorro_anual_cop ?? 0
      map[proc] = (map[proc] ?? 0) + imp
    })
    return Object.entries(map)
      .filter(([, v]) => v > 0)
      .map(([proceso, total]) => ({ proceso, label: PROCESO_LABEL[proceso] ?? proceso, total }))
      .sort((a, b) => b.total - a.total)
  }, [filtrados])

  // ── 5. Sin impacto ────────────────────────────────────────────────────────
  const sinImpacto = useMemo(() =>
    filtrados.filter(r => {
      const imp = (r as any).impacto_economico_total_anual ?? 0
      return imp === 0 && (r.ahorro_anual_cop ?? 0) === 0
    })
  , [filtrados])

  const totalImpacto = filtrados.reduce((s, r) => s + ((r as any).impacto_economico_total_anual ?? r.ahorro_anual_cop ?? 0), 0)

  // ── Opciones de filtros ───────────────────────────────────────────────────
  const procesosDisponibles = useMemo(() => {
    const set = new Set(datos.map(r => r.proceso_interno).filter(Boolean) as string[])
    return Array.from(set).sort().map(p => ({ value: p, label: PROCESO_LABEL[p] ?? p }))
  }, [datos])

  const estadosDisponibles = useMemo(() => {
    const set = new Set(datos.map(r => r.estado).filter(Boolean) as string[])
    return Array.from(set).map(e => ({ value: e, label: ESTADO_LABEL[e] ?? e }))
  }, [datos])

  const origenesDisponibles = useMemo(() => {
    const set = new Set(datos.map(r => (r as any).origen_requerimiento).filter(Boolean) as string[])
    return Array.from(set).map(o => ({ value: o, label: ORIGEN_LABEL[o] ?? o }))
  }, [datos])

  // ── Fila de tabla reutilizable ────────────────────────────────────────────
  function FilaReq({ r, esPrimero }: { r: MetricaRequerimiento; esPrimero: boolean }) {
    const impacto = (r as any).impacto_economico_total_anual ?? r.ahorro_anual_cop ?? 0
    const estadoCfg = ESTADOS[r.estado as Estado]
    const origen = (r as any).origen_requerimiento as string | null
    const esHijo = !!(r as any).parent_id
    const etiqueta = labelJerarquico(r.id, datos)

    return (
      <tr className={cn('hover:bg-slate-50 transition-colors', esPrimero && !esHijo && 'border-t-2 border-slate-300')}>
        <td className="px-3 py-2.5">
          <div className={cn('flex items-center gap-1', esHijo && 'pl-4')}>
            {esHijo && <span className="text-slate-300 text-xs">↳</span>}
            <AsignarPrioridadBtn
              requerimientoId={r.id}
              prioridadActual={r.prioridad ?? null}
              subPrioridadActual={(r as any).sub_prioridad ?? null}
              impactoHH={r.ahorro_anual_cop ?? null}
              impactoCualitativos={r.total_beneficios_cualitativos_anual ?? null}
              impactoTotal={(r as any).impacto_economico_total_anual ?? null}
              proceso_interno={r.proceso_interno ?? null}
              etiqueta={etiqueta !== '—' ? etiqueta : undefined}
            />
          </div>
        </td>
        <td className="px-3 py-2.5">
          <Link href={`/admin/requerimientos/${r.id}`} className="font-medium text-slate-800 hover:text-blue-600 transition-colors line-clamp-2 text-sm">
            {r.nombre_desarrollo ?? r.identificacion}
          </Link>
        </td>
        <td className="px-3 py-2.5 text-xs text-slate-500">
          {r.proceso_interno ? (PROCESO_LABEL[r.proceso_interno] ?? r.proceso_interno) : '—'}
        </td>
        <td className="px-3 py-2.5 text-xs text-slate-500">
          {origen ? (ORIGEN_LABEL[origen] ?? origen) : '—'}
        </td>
        <td className="px-3 py-2.5 text-right">
          {impacto > 0
            ? <span className="font-semibold text-emerald-700 text-xs">{formatCOP(impacto)}</span>
            : <span className="text-slate-300 text-xs">—</span>}
        </td>
        <td className="px-3 py-2.5">
          <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border',
            estadoCfg?.bgColor ?? 'bg-slate-100', estadoCfg?.textColor ?? 'text-slate-600', estadoCfg?.borderColor ?? 'border-slate-200')}>
            {ESTADO_LABEL[r.estado] ?? r.estado}
          </span>
        </td>
        <td className="px-2 py-2.5">
          <Link href={`/admin/requerimientos/${r.id}`} className="text-slate-300 hover:text-blue-400">
            <ExternalLink size={13} />
          </Link>
        </td>
      </tr>
    )
  }

  return (
    <div className="space-y-10">

      {/* ── FILTROS ─────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={13} className="text-slate-400" />
          <span className="text-xs font-semibold text-slate-500">Filtros</span>
          {hayFiltros && (
            <button onClick={() => { setFEmpresa(''); setFPrioridad(''); setFEstados([]); setFProceso(''); setFOrigen('') }}
              className="ml-auto flex items-center gap-1 text-xs text-slate-400 hover:text-red-500">
              <X size={11} /> Limpiar
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <Select label="Empresa" value={fEmpresa} onChange={setFEmpresa}
            options={[{ value: 'IWF', label: 'IWF' }, { value: 'ILT', label: 'ILT' }, { value: 'IWG', label: 'IWG' }]} />
          <Select label="Prioridad" value={fPrioridad} onChange={setFPrioridad}
            options={[1,2,3,4,5].map(p => ({ value: String(p), label: `P${p}` }))} />
          <MultiSelect label="Estado" values={fEstados} onChange={setFEstados} options={estadosDisponibles} />
          <Select label="Proceso" value={fProceso} onChange={setFProceso} options={procesosDisponibles} />
          <Select label="Origen" value={fOrigen} onChange={setFOrigen} options={origenesDisponibles} />
        </div>
        <p className="mt-2 text-[11px] text-slate-400">{filtrados.length} de {datos.length} desarrollos</p>
      </div>

      {/* ── SECCIÓN 1: KPIs ─────────────────────────────────────────────── */}
      {seccionTitle('1. Cantidad de desarrollos por prioridad')}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
        {[1,2,3,4,5].map(p => (
          <div key={p} className="rounded-xl border bg-white p-4 text-center shadow-sm">
            <div className={cn('inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold border mb-2', PRIORIDAD_BG[p])}>P{p}</div>
            <p className="text-2xl font-bold text-slate-800">{conteosPrioridad[String(p)]}</p>
            <p className="text-xs text-slate-400 mt-0.5">desarrollos</p>
          </div>
        ))}
        <div className="rounded-xl border bg-white p-4 text-center shadow-sm col-span-2 sm:col-span-1">
          <div className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 border border-slate-200 text-xs font-bold mb-2">—</div>
          <p className="text-2xl font-bold text-slate-800">{conteosPrioridad['Sin prioridad']}</p>
          <p className="text-xs text-slate-400 mt-0.5">sin prioridad</p>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-center shadow-sm">
          <p className="text-xs text-blue-500 font-medium mb-1">Total</p>
          <p className="text-2xl font-bold text-blue-700">{filtrados.length}</p>
          <p className="text-xs text-blue-400 mt-0.5">desarrollos</p>
        </div>
      </div>

      <div className="border-t border-slate-200" />

      {/* ── SECCIÓN 2: Tabla por prioridad ──────────────────────────────── */}
      {seccionTitle('2. Desarrollos organizados por prioridad')}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-3 py-3 text-xs font-semibold text-slate-500 w-16">Nº</th>
              <th className="text-left px-3 py-3 text-xs font-semibold text-slate-500">Desarrollo</th>
              <th className="text-left px-3 py-3 text-xs font-semibold text-slate-500 w-32">Proceso</th>
              <th className="text-left px-3 py-3 text-xs font-semibold text-slate-500 w-32">Origen</th>
              <th className="text-right px-3 py-3 text-xs font-semibold text-slate-500 w-36">Impacto total/año</th>
              <th className="text-left px-3 py-3 text-xs font-semibold text-slate-500 w-32">Estado</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtrados.map((r, idx) => {
              const esHijo = !!(r as any).parent_id
              const esPrimero = !esHijo && (idx === 0 || !!(filtrados[idx - 1] && (filtrados[idx - 1].prioridad !== r.prioridad || !!(filtrados[idx - 1] as any).parent_id)))
              return <FilaReq key={r.id} r={r} esPrimero={esPrimero} />
            })}
          </tbody>
          <tfoot>
            <tr className="bg-slate-50 border-t-2 border-slate-300">
              <td colSpan={4} className="px-3 py-3 text-xs font-semibold text-slate-600">
                Total ({filtrados.length} desarrollos)
              </td>
              <td className="px-3 py-3 text-right text-xs font-bold text-emerald-700">{formatCOP(totalImpacto)}</td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="border-t border-slate-200" />

      {/* ── SECCIÓN 3: Gráfico de barras por estado ─────────────────────── */}
      {seccionTitle('3. Desarrollos por estado')}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        {datosPorEstado.length === 0 ? (
          <p className="text-center text-sm text-slate-400 py-8">Sin datos</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={datosPorEstado} layout="vertical" margin={{ left: 16, right: 32, top: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis type="category" dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} width={195} />
              <Tooltip formatter={(v: any) => [v, 'Desarrollos']} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Bar dataKey="cantidad" radius={[0, 4, 4, 0]}>
                {datosPorEstado.map((_, i) => <Cell key={i} fill={ESTADO_COLORS[i % ESTADO_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="border-t border-slate-200" />

      {/* ── SECCIÓN 4: Tabla impacto por proceso ────────────────────────── */}
      {seccionTitle('4. Impacto económico por proceso')}
      {impactoPorProceso.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">Sin datos de impacto</div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Proceso</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">Impacto total / año</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 w-24">% del total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {impactoPorProceso.map((row, i) => {
                const pct = totalImpacto > 0 ? (row.total / totalImpacto * 100) : 0
                return (
                  <tr key={row.proceso} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-2.5 flex items-center gap-2">
                      <span className="inline-block h-2.5 w-2.5 rounded-full shrink-0" style={{ background: PROCESO_COLORS[i % PROCESO_COLORS.length] }} />
                      <span className="font-medium text-slate-700">{row.label}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold text-emerald-700">{formatCOP(row.total)}</td>
                    <td className="px-4 py-2.5 text-right">
                      <span className="text-xs font-medium text-slate-500">{pct.toFixed(1)}%</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 border-t-2 border-slate-300">
                <td className="px-4 py-3 text-xs font-bold text-slate-700">Total ({impactoPorProceso.length} procesos)</td>
                <td className="px-4 py-3 text-right text-xs font-bold text-emerald-700">{formatCOP(totalImpacto)}</td>
                <td className="px-4 py-3 text-right text-xs font-bold text-slate-500">100%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <div className="border-t border-slate-200" />

      {/* ── SECCIÓN 5: Sin impacto ───────────────────────────────────────── */}
      {seccionTitle(`5. Desarrollos sin impacto registrado (${sinImpacto.length})`)}
      {sinImpacto.length === 0 ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
          <p className="text-sm font-medium text-emerald-700">✓ Todos los desarrollos tienen impacto registrado</p>
        </div>
      ) : (
        <div className="rounded-xl border border-amber-200 bg-white overflow-hidden shadow-sm">
          <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 border-b border-amber-200">
            <AlertTriangle size={14} className="text-amber-600" />
            <p className="text-xs font-medium text-amber-700">
              {sinImpacto.length} desarrollo{sinImpacto.length !== 1 ? 's' : ''} sin impacto económico
            </p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-3 py-3 text-xs font-semibold text-slate-500 w-16">Prior.</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-slate-500">Desarrollo</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-slate-500 w-32">Proceso</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-slate-500 w-32">Estado</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-slate-500 w-36">Responsable</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sinImpacto.map(r => {
                const p = r.prioridad
                const estadoCfg = ESTADOS[r.estado as Estado]
                return (
                  <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-3 py-2.5">
                      {p
                        ? <span className={cn('inline-flex items-center justify-center rounded-md px-2 py-0.5 text-xs font-bold border', PRIORIDAD_BG[p])}>P{p}</span>
                        : <span className="text-slate-300 text-xs">—</span>}
                    </td>
                    <td className="px-3 py-2.5">
                      <Link href={`/admin/requerimientos/${r.id}`} className="font-medium text-slate-800 hover:text-blue-600 line-clamp-1 text-sm">
                        {r.nombre_desarrollo ?? r.identificacion}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-slate-500">
                      {r.proceso_interno ? (PROCESO_LABEL[r.proceso_interno] ?? r.proceso_interno) : '—'}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border',
                        estadoCfg?.bgColor ?? 'bg-slate-100', estadoCfg?.textColor ?? 'text-slate-600', estadoCfg?.borderColor ?? 'border-slate-200')}>
                        {ESTADO_LABEL[r.estado] ?? r.estado}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-slate-500 truncate max-w-[140px]">{r.responsable ?? '—'}</td>
                    <td className="px-2 py-2.5">
                      <Link href={`/admin/requerimientos/${r.id}`} className="text-slate-300 hover:text-blue-400">
                        <ExternalLink size={13} />
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
