'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts'
import { ExternalLink, AlertTriangle } from 'lucide-react'
import { cn, formatCOP } from '@/lib/utils'
import { ESTADOS } from '@/lib/constants'
import type { MetricaRequerimiento, Estado } from '@/lib/supabase/types'

interface Props { datos: MetricaRequerimiento[] }

const PRIORIDAD_COLOR: Record<number, string> = {
  1: '#ef4444', 2: '#f97316', 3: '#f59e0b', 4: '#3b82f6', 5: '#8b5cf6',
}
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
}

const PROCESO_COLORS = [
  '#3b82f6','#10b981','#f59e0b','#8b5cf6','#06b6d4',
  '#ec4899','#f97316','#84cc16','#a78bfa','#0ea5e9','#94a3b8','#fb7185','#34d399',
]

const ESTADO_LABEL: Record<string, string> = {
  SIN_GESTION: 'Sin gestión', ANALISIS: 'En análisis', EN_DEFINICION_USUARIO: 'En definición',
  EN_DESARROLLO: 'En desarrollo', PRUEBAS_USUARIO: 'Pruebas', STAND_BY: 'Stand By',
  ENTREGADO: 'Entregado', CERRADO: 'Cerrado', DESISTIDO: 'Desistido',
}

function labelPrioridad(p: number | null, sp: number | null) {
  if (!p) return '—'
  return sp != null ? `${p}.${sp}` : `${p}`
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
  // ── 1. Conteos por prioridad ────────────────────────────────────────────
  const conteosPrioridad = useMemo(() => {
    const map: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0, 'Sin prioridad': 0 }
    datos.forEach(r => {
      const k = r.prioridad ? String(r.prioridad) : 'Sin prioridad'
      map[k] = (map[k] ?? 0) + 1
    })
    return map
  }, [datos])

  // ── 2. Tabla por prioridad/sub-prioridad ─────────────────────────────────
  const grupos = useMemo(() => {
    const map = new Map<number, MetricaRequerimiento[]>()
    const sinPrioridad: MetricaRequerimiento[] = []
    datos.forEach(r => {
      if (!r.prioridad) { sinPrioridad.push(r); return }
      if (!map.has(r.prioridad)) map.set(r.prioridad, [])
      map.get(r.prioridad)!.push(r)
    })
    return { grupos: map, sinPrioridad }
  }, [datos])

  // ── 3. Conteos por estado ────────────────────────────────────────────────
  const datosPorEstado = useMemo(() => {
    const map: Record<string, number> = {}
    datos.forEach(r => {
      const k = r.estado ?? 'SIN_GESTION'
      map[k] = (map[k] ?? 0) + 1
    })
    return Object.entries(map)
      .map(([estado, cantidad]) => ({ estado, label: ESTADO_LABEL[estado] ?? estado, cantidad }))
      .sort((a, b) => b.cantidad - a.cantidad)
  }, [datos])

  const ESTADO_COLORS = datosPorEstado.map((_, i) => {
    const colors = ['#3b82f6','#10b981','#f59e0b','#8b5cf6','#06b6d4','#ec4899','#94a3b8','#ef4444','#f97316']
    return colors[i % colors.length]
  })

  // ── 4. Impacto económico por proceso ────────────────────────────────────
  const impactoPorProceso = useMemo(() => {
    const map: Record<string, number> = {}
    datos.forEach(r => {
      const proc = r.proceso_interno ?? 'Sin proceso'
      const impacto = (r as any).impacto_economico_total_anual ?? r.ahorro_anual_cop ?? 0
      map[proc] = (map[proc] ?? 0) + impacto
    })
    return Object.entries(map)
      .filter(([, v]) => v > 0)
      .map(([proceso, total]) => ({
        proceso,
        label: PROCESO_LABEL[proceso] ?? proceso,
        total,
      }))
      .sort((a, b) => b.total - a.total)
  }, [datos])

  // ── 5. Sin impacto ───────────────────────────────────────────────────────
  const sinImpacto = useMemo(() =>
    datos.filter(r => {
      const imp = (r as any).impacto_economico_total_anual ?? 0
      const aho = r.ahorro_anual_cop ?? 0
      return imp === 0 && aho === 0
    }).sort((a, b) => (a.prioridad ?? 99) - (b.prioridad ?? 99))
  , [datos])

  const totalDesarrollos = datos.length
  const totalImpacto = datos.reduce((s, r) => s + ((r as any).impacto_economico_total_anual ?? r.ahorro_anual_cop ?? 0), 0)

  return (
    <div className="space-y-10">

      {/* ── SECCIÓN 1: KPIs ─────────────────────────────────────────────── */}
      {seccionTitle('1. Cantidad de desarrollos por prioridad')}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
        {[1,2,3,4,5].map(p => (
          <div key={p} className="rounded-xl border bg-white p-4 text-center shadow-sm">
            <div className={cn('inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold border mb-2', PRIORIDAD_BG[p])}>
              P{p}
            </div>
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
          <p className="text-2xl font-bold text-blue-700">{totalDesarrollos}</p>
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
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 w-16">Nº</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Desarrollo</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 w-36">Proceso</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 w-40">Impacto total/año</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 w-36">Estado</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {[1,2,3,4,5].map(p => {
              const reqs = grupos.grupos.get(p) ?? []
              if (reqs.length === 0) return null
              return reqs.map((r, idx) => {
                const etiqueta = labelPrioridad(r.prioridad, (r as any).sub_prioridad ?? null)
                const impacto = (r as any).impacto_economico_total_anual ?? r.ahorro_anual_cop ?? 0
                const estadoCfg = ESTADOS[r.estado as Estado]
                const esPrimero = idx === 0
                return (
                  <tr key={r.id} className={cn('hover:bg-slate-50 transition-colors', esPrimero && 'border-t-2 border-slate-300')}>
                    <td className="px-4 py-3">
                      <span className={cn('inline-flex items-center justify-center rounded-md px-2 py-0.5 text-xs font-bold border min-w-[2.5rem]', PRIORIDAD_BG[p] ?? 'bg-slate-100 text-slate-600 border-slate-200')}>
                        {etiqueta}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/admin/requerimientos/${r.id}`} className="font-medium text-slate-800 hover:text-blue-600 transition-colors line-clamp-2">
                        {r.nombre_desarrollo ?? r.identificacion}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {r.proceso_interno ? (PROCESO_LABEL[r.proceso_interno] ?? r.proceso_interno) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {impacto > 0
                        ? <span className="font-semibold text-emerald-700 text-xs">{formatCOP(impacto)}</span>
                        : <span className="text-slate-300 text-xs">Sin datos</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border', estadoCfg?.bgColor ?? 'bg-slate-100', estadoCfg?.textColor ?? 'text-slate-600', estadoCfg?.borderColor ?? 'border-slate-200')}>
                        {ESTADO_LABEL[r.estado] ?? r.estado}
                      </span>
                    </td>
                    <td className="px-2 py-3">
                      <Link href={`/admin/requerimientos/${r.id}`} className="text-slate-300 hover:text-blue-400">
                        <ExternalLink size={13} />
                      </Link>
                    </td>
                  </tr>
                )
              })
            })}
            {grupos.sinPrioridad.map((r, idx) => {
              const impacto = (r as any).impacto_economico_total_anual ?? r.ahorro_anual_cop ?? 0
              const estadoCfg = ESTADOS[r.estado as Estado]
              return (
                <tr key={r.id} className={cn('hover:bg-slate-50 transition-colors', idx === 0 && 'border-t-2 border-slate-300')}>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center justify-center rounded-md px-2 py-0.5 text-xs font-bold border bg-slate-100 text-slate-400 border-slate-200 min-w-[2.5rem]">—</span>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/requerimientos/${r.id}`} className="font-medium text-slate-800 hover:text-blue-600 transition-colors line-clamp-2">
                      {r.nombre_desarrollo ?? r.identificacion}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {r.proceso_interno ? (PROCESO_LABEL[r.proceso_interno] ?? r.proceso_interno) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {impacto > 0
                      ? <span className="font-semibold text-emerald-700 text-xs">{formatCOP(impacto)}</span>
                      : <span className="text-slate-300 text-xs">Sin datos</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border', estadoCfg?.bgColor ?? 'bg-slate-100', estadoCfg?.textColor ?? 'text-slate-600', estadoCfg?.borderColor ?? 'border-slate-200')}>
                      {ESTADO_LABEL[r.estado] ?? r.estado}
                    </span>
                  </td>
                  <td className="px-2 py-3">
                    <Link href={`/admin/requerimientos/${r.id}`} className="text-slate-300 hover:text-blue-400">
                      <ExternalLink size={13} />
                    </Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="bg-slate-50 border-t-2 border-slate-300">
              <td colSpan={3} className="px-4 py-3 text-xs font-semibold text-slate-600">Total ({totalDesarrollos} desarrollos)</td>
              <td className="px-4 py-3 text-right text-xs font-bold text-emerald-700">{formatCOP(totalImpacto)}</td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="border-t border-slate-200" />

      {/* ── SECCIÓN 3 y 4: Gráficas ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          {seccionTitle('3. Desarrollos por estado')}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={datosPorEstado} dataKey="cantidad" nameKey="label" cx="50%" cy="50%" outerRadius={90} label={(props: any) => `${props.label}: ${props.cantidad}`} labelLine={false}>
                  {datosPorEstado.map((_, i) => (
                    <Cell key={i} fill={ESTADO_COLORS[i]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: any) => [v, 'Desarrollos']} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div>
          {seccionTitle('4. Impacto económico por proceso')}
          {impactoPorProceso.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">Sin datos de impacto registrados</div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={impactoPorProceso} layout="vertical" margin={{ left: 8, right: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={v => `$${(v/1_000_000).toFixed(0)}M`} />
                  <YAxis type="category" dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} width={90} />
                  <Tooltip formatter={(v: any) => [formatCOP(v as number), 'Impacto anual']} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                    {impactoPorProceso.map((_, i) => (
                      <Cell key={i} fill={PROCESO_COLORS[i % PROCESO_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

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
              {sinImpacto.length} desarrollo{sinImpacto.length !== 1 ? 's' : ''} sin impacto económico — solicitar a los responsables que completen la información
            </p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 w-16">Prior.</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Desarrollo</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 w-36">Proceso</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 w-36">Estado</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 w-36">Responsable</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sinImpacto.map(r => {
                const estadoCfg = ESTADOS[r.estado as Estado]
                const p = r.prioridad
                return (
                  <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      {p
                        ? <span className={cn('inline-flex items-center justify-center rounded-md px-2 py-0.5 text-xs font-bold border', PRIORIDAD_BG[p] ?? 'bg-slate-100 text-slate-600 border-slate-200')}>P{p}</span>
                        : <span className="text-slate-300 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/admin/requerimientos/${r.id}`} className="font-medium text-slate-800 hover:text-blue-600 transition-colors line-clamp-1">
                        {r.nombre_desarrollo ?? r.identificacion}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {r.proceso_interno ? (PROCESO_LABEL[r.proceso_interno] ?? r.proceso_interno) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border', estadoCfg?.bgColor ?? 'bg-slate-100', estadoCfg?.textColor ?? 'text-slate-600', estadoCfg?.borderColor ?? 'border-slate-200')}>
                        {ESTADO_LABEL[r.estado] ?? r.estado}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 truncate max-w-[140px]">{r.responsable ?? '—'}</td>
                    <td className="px-2 py-3">
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
