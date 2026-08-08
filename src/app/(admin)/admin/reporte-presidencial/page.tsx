'use client'

import { useState, useMemo, useTransition, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  TrendingUp, Clock, AlertCircle, BarChart3,
  Building2, Layers, MapPin, Target, Tag, ShieldAlert, X,
  RefreshCw, CalendarCheck, ChevronDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { fetchDatosRawPresidencial } from '@/actions/reporte-presidencial'
import { registrarFechaEntrega } from '@/actions/requerimientos'
import {
  ESTADOS, PROCESOS_INTERNOS, ORIGENES_REQUERIMIENTO,
  TIPOS_SOLICITUD, PRIORIDADES, getEstadoCfg,
} from '@/lib/constants'
import type { RowPresidencial } from '@/actions/reporte-presidencial'

/* ── Formateadores ────────────────────────────────────────────────────────── */
function cop(v: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v)
}

/* ── Computar agregaciones ────────────────────────────────────────────────── */
function procesoLabel(p: string) {
  return PROCESOS_INTERNOS.find(x => x.value === p)?.label ?? p
}
function origenLabel(o: string) {
  return (ORIGENES_REQUERIMIENTO as unknown as { value: string; label: string }[]).find(x => x.value === o)?.label ?? o
}

function computar(activos: RowPresidencial[]) {
  const total = activos.length

  const totalHoras = activos.reduce((s, r) => s + (r.horas_estimadas_desarrollo ?? 0), 0)
  const impactoTotal = activos.reduce((s, r) => s + (r.impacto_economico_total_anual ?? 0), 0)
  const impactoTotalReal = activos.reduce((s, r) => s + (r.impacto_economico_total_anual_real ?? 0), 0)
  const sinCuantificar = activos.filter(r => !r.impacto_economico_total_anual || r.impacto_economico_total_anual === 0).length

  // Por estado — orden del flujo de trabajo
  const ESTADO_ORDER = [
    'SIN_GESTION', 'ANALISIS', 'EN_DEFINICION_USUARIO', 'EN_DESARROLLO',
    'PRUEBAS_USUARIO', 'EN_ESPERA_POR_TERCEROS', 'ENTREGADO', 'DESISTIDO',
  ]
  const estadoMap = new Map<string, number>()
  activos.forEach(r => { const k = r.estado ?? 'SIN_GESTION'; estadoMap.set(k, (estadoMap.get(k) ?? 0) + 1) })
  const porEstado = Array.from(estadoMap.entries())
    .sort((a, b) => {
      const ia = ESTADO_ORDER.indexOf(a[0])
      const ib = ESTADO_ORDER.indexOf(b[0])
      if (ia === -1 && ib === -1) return a[0].localeCompare(b[0])
      if (ia === -1) return 1
      if (ib === -1) return -1
      return ia - ib
    })
    .map(([estado, cantidad]) => ({
      estado, cantidad,
      label: ESTADOS[estado]?.label ?? estado.replace(/_/g, ' '),
      porcentaje: total > 0 ? Math.round((cantidad / total) * 100) : 0,
    }))

  // Por proceso
  const procesoMap = new Map<string, { cantidad: number; horas: number; impacto: number; sin: number }>()
  activos.forEach(r => {
    const k = r.proceso_interno ?? 'SIN_PROCESO'
    const prev = procesoMap.get(k) ?? { cantidad: 0, horas: 0, impacto: 0, sin: 0 }
    procesoMap.set(k, {
      cantidad: prev.cantidad + 1,
      horas:    prev.horas + (r.horas_estimadas_desarrollo ?? 0),
      impacto:  prev.impacto + (r.impacto_economico_total_anual ?? 0),
      sin:      prev.sin + (!r.impacto_economico_total_anual ? 1 : 0),
    })
  })
  const porProceso = Array.from(procesoMap.entries()).sort((a, b) => b[1].cantidad - a[1].cantidad)
    .map(([proceso, d]) => ({ proceso, label: procesoLabel(proceso), cantidad: d.cantidad, horasEstimadas: d.horas, impactoAnual: d.impacto, sinCuantificar: d.sin }))

  // Por alcance
  const alcanceMap = new Map<string, { cantidad: number; impacto: number }>()
  activos.forEach(r => {
    const k = r.alcance ?? 'SIN_ALCANCE'
    const prev = alcanceMap.get(k) ?? { cantidad: 0, impacto: 0 }
    alcanceMap.set(k, { cantidad: prev.cantidad + 1, impacto: prev.impacto + (r.impacto_economico_total_anual ?? 0) })
  })
  const porAlcance = Array.from(alcanceMap.entries()).sort((a, b) => b[1].cantidad - a[1].cantidad)
    .map(([alcance, d]) => ({ alcance, cantidad: d.cantidad, impactoAnual: d.impacto }))

  // Por origen
  const origenMap = new Map<string, number>()
  activos.forEach(r => { const k = r.origen_requerimiento ?? 'SIN_ORIGEN'; origenMap.set(k, (origenMap.get(k) ?? 0) + 1) })
  const porOrigen = Array.from(origenMap.entries()).sort((a, b) => b[1] - a[1])
    .map(([origen, cantidad]) => ({
      origen, cantidad,
      label: origen === 'SIN_ORIGEN' ? 'Sin origen asignado' : origenLabel(origen),
      porcentaje: total > 0 ? Math.round((cantidad / total) * 100) : 0,
    }))

  // Por tipo solicitud
  const tipoMap = new Map<string, number>()
  activos.forEach(r => { const k = r.tipo_solicitud ?? 'SIN_TIPO'; tipoMap.set(k, (tipoMap.get(k) ?? 0) + 1) })
  const porTipoSolicitud = TIPOS_SOLICITUD
    .map(t => ({ tipo: t.value, label: t.label, cantidad: tipoMap.get(t.value) ?? 0, porcentaje: total > 0 ? Math.round(((tipoMap.get(t.value) ?? 0) / total) * 100) : 0 }))
    .filter(t => t.cantidad > 0).sort((a, b) => b.cantidad - a.cantidad)

  // Por prioridad
  const prioridadMap = new Map<number, number>()
  activos.forEach(r => { if (r.prioridad) prioridadMap.set(r.prioridad, (prioridadMap.get(r.prioridad) ?? 0) + 1) })
  const porPrioridad = [1, 2, 3, 4].filter(p => prioridadMap.has(p)).map(p => {
    const cfg = PRIORIDADES[p]
    return { prioridad: p, label: cfg.label, cantidad: prioridadMap.get(p) ?? 0, porcentaje: total > 0 ? Math.round(((prioridadMap.get(p) ?? 0) / total) * 100) : 0, color: cfg.color, bgColor: cfg.bgColor, textColor: cfg.textColor }
  })

  // Entregas por mes (solo ENTREGADO con fecha_real_entrega)
  // Entregas por mes — incluye TODOS los ENTREGADO; sin fecha van a 'sin-fecha'
  const SIN_FECHA_KEY = 'sin-fecha'
  const entregasMesMap = new Map<string, {
    rows: RowPresidencial[]
    impactoReal: number
    impactoEstimado: number
    horasAhorradasMes: number
  }>()
  activos
    .filter(r => r.estado === 'ENTREGADO')
    .forEach(r => {
      const mes = r.fecha_real_entrega ? r.fecha_real_entrega.substring(0, 7) : SIN_FECHA_KEY
      const prev = entregasMesMap.get(mes) ?? { rows: [], impactoReal: 0, impactoEstimado: 0, horasAhorradasMes: 0 }
      entregasMesMap.set(mes, {
        rows: [...prev.rows, r],
        impactoReal:       prev.impactoReal       + (r.impacto_economico_total_anual_real ?? 0),
        impactoEstimado:   prev.impactoEstimado   + (r.impacto_economico_total_anual ?? 0),
        horasAhorradasMes: prev.horasAhorradasMes + (r.horas_ahorradas_mes ?? 0),
      })
    })
  const porMesEntrega = Array.from(entregasMesMap.entries())
    .sort((a, b) => {
      // 'sin-fecha' siempre al final
      if (a[0] === SIN_FECHA_KEY) return 1
      if (b[0] === SIN_FECHA_KEY) return -1
      return a[0].localeCompare(b[0])
    })
    .map(([mes, d]) => ({
      mes,
      label: mes === SIN_FECHA_KEY
        ? 'Sin fecha registrada'
        : new Date(`${mes}-15`).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' }),
      sinFecha: mes === SIN_FECHA_KEY,
      cantidad: d.rows.length,
      rows: d.rows.sort((a, b) => (a.nombre_desarrollo ?? '').localeCompare(b.nombre_desarrollo ?? '')),
      impactoReal:       d.impactoReal,
      impactoEstimado:   d.impactoEstimado,
      horasAhorradasMes: d.horasAhorradasMes,
    }))

  // Top impacto
  const topImpacto = activos
    .filter(r => (r.impacto_economico_total_anual ?? 0) > 0)
    .sort((a, b) => (b.impacto_economico_total_anual ?? 0) - (a.impacto_economico_total_anual ?? 0))
    .slice(0, 10)
    .map(r => ({ id: r.id, nombre: r.nombre_desarrollo ?? r.identificacion ?? '—', impacto: r.impacto_economico_total_anual ?? 0, proceso: r.proceso_interno ? procesoLabel(r.proceso_interno) : null, alcance: r.alcance ?? null }))

  return { total, totalHoras, impactoTotal, impactoTotalReal, sinCuantificar, porEstado, porProceso, porAlcance, porOrigen, porTipoSolicitud, porPrioridad, topImpacto, porMesEntrega }
}

/* ── Filtros state ────────────────────────────────────────────────────────── */
interface Filtros {
  alcance: string
  estado: string
  proceso: string
  tipo_solicitud: string
  prioridad: string
  origen: string
}
const FILTROS_VACIOS: Filtros = { alcance: '', estado: '', proceso: '', tipo_solicitud: '', prioridad: '', origen: '' }

/* ── Sub-componentes UI ───────────────────────────────────────────────────── */
function KpiCard({ label, valor, sub, icon: Icon, color }: { label: string; valor: string; sub?: string; icon: React.ElementType; color: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
          <p className={cn('mt-1 text-3xl font-extrabold', color)}>{valor}</p>
          {sub && <p className="mt-0.5 text-xs text-slate-400">{sub}</p>}
        </div>
        <div className={cn('rounded-xl p-2.5', color.replace('text-', 'bg-').replace('700', '100').replace('600', '100'))}>
          <Icon size={20} className={color} />
        </div>
      </div>
    </div>
  )
}

function BarraHorizontal({ label, valor, max, display, colorBar = 'bg-blue-500' }: { label: string; valor: number; max: number; display: string; colorBar?: string }) {
  const pct = max > 0 ? Math.round((valor / max) * 100) : 0
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-600 truncate max-w-[60%]">{label}</span>
        <span className="text-xs font-bold text-slate-700">{display}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div className={cn('h-full rounded-full transition-all', colorBar)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function Seccion({ titulo, icono: Icon, children, className }: { titulo: string; icono: React.ElementType; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-2xl border border-slate-200 bg-white p-5 shadow-sm', className)}>
      <div className="mb-4 flex items-center gap-2">
        <div className="rounded-lg bg-slate-100 p-1.5"><Icon size={15} className="text-slate-500" /></div>
        <h3 className="text-sm font-bold text-slate-700">{titulo}</h3>
      </div>
      {children}
    </div>
  )
}

/* ── Colores ─────────────────────────────────────────────────────────────── */
const ESTADO_BAR: Record<string, string> = {
  SIN_GESTION:                        'bg-slate-400',
  EN_ESPERA_DE_COMITE_DE_PRIORIDADES: 'bg-slate-300',
  ANALISIS:                           'bg-blue-500',
  EN_DEFINICION_USUARIO:              'bg-violet-500',
  EN_DESARROLLO:                      'bg-indigo-500',
  PRUEBAS_USUARIO:                    'bg-amber-500',
  STAND_BY:                           'bg-orange-400',
  EN_ESPERA_POR_TERCEROS:             'bg-slate-400',
  AJUSTES_TECNICOS:                   'bg-cyan-500',
  PROGRAMADO_PARA_SALIDA_EN_VIVO:     'bg-emerald-500',
  ENTREGADO:                          'bg-green-500',
  CERRADO:                            'bg-teal-500',
  DESISTIDO:                          'bg-red-400',
  NO_VIABLE:                          'bg-rose-400',
}
const TIPO_BAR: Record<string, string> = { NUEVO_DESARROLLO: 'bg-blue-500', MEJORA: 'bg-violet-500', INTEGRACION: 'bg-cyan-500', INFORME: 'bg-amber-500' }
const TIPO_BADGE: Record<string, string> = { NUEVO_DESARROLLO: 'bg-blue-100 text-blue-700 border-blue-200', MEJORA: 'bg-violet-100 text-violet-700 border-violet-200', INTEGRACION: 'bg-cyan-100 text-cyan-700 border-cyan-200', INFORME: 'bg-amber-100 text-amber-700 border-amber-200' }
const ORIGEN_BAR: Record<string, string> = { LISTA_MEJORAS_PENDIENTES: 'bg-amber-500', TIN_NOVA: 'bg-violet-500', DESARROLLO_EXTERNO: 'bg-cyan-500', SIN_ORIGEN: 'bg-slate-300' }
const ALCANCE_COLOR: Record<string, { badge: string; bar: string }> = {
  IWF: { badge: 'bg-blue-100 text-blue-700 border-blue-300', bar: 'bg-blue-500' },
  ILT: { badge: 'bg-green-100 text-green-700 border-green-300', bar: 'bg-green-500' },
  IWG: { badge: 'bg-purple-100 text-purple-700 border-purple-300', bar: 'bg-purple-500' },
}

/* ── Barra de filtros ────────────────────────────────────────────────────── */
function FiltrosPresidencial({ filtros, onChange, totalFiltrado, totalBase, estadosDisponibles }: {
  filtros: Filtros
  onChange: (f: Filtros) => void
  totalFiltrado: number
  totalBase: number
  estadosDisponibles: string[]
}) {
  const activos = Object.values(filtros).filter(Boolean).length
  const limpiar = () => onChange(FILTROS_VACIOS)

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        {/* Alcance — pill buttons */}
        <div className="flex items-center gap-1">
          {['', 'IWF', 'ILT', 'IWG'].map(a => (
            <button
              key={a}
              onClick={() => onChange({ ...filtros, alcance: a })}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-semibold transition-colors',
                filtros.alcance === a
                  ? (a ? (ALCANCE_COLOR[a]?.badge ?? 'bg-slate-700 text-white border-slate-700') : 'bg-slate-800 text-white border-slate-800')
                  : 'border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700'
              )}
            >
              {a || 'Todas las empresas'}
            </button>
          ))}
        </div>

        <div className="h-6 w-px bg-slate-200" />

        {/* Estado — dinámico con todos los estados existentes */}
        <select
          value={filtros.estado}
          onChange={e => onChange({ ...filtros, estado: e.target.value })}
          className={cn(
            'rounded-lg border px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-blue-400',
            filtros.estado ? 'border-blue-300 bg-blue-50 text-blue-700 font-semibold' : 'border-slate-200 bg-white text-slate-600'
          )}
        >
          <option value="">Todos los estados</option>
          {estadosDisponibles.map(k => {
            const cfg = getEstadoCfg(k)
            return <option key={k} value={k}>{cfg.label}</option>
          })}
        </select>

        {/* Proceso */}
        <select
          value={filtros.proceso}
          onChange={e => onChange({ ...filtros, proceso: e.target.value })}
          className={cn(
            'rounded-lg border px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-blue-400',
            filtros.proceso ? 'border-violet-300 bg-violet-50 text-violet-700 font-semibold' : 'border-slate-200 bg-white text-slate-600'
          )}
        >
          <option value="">Todos los procesos</option>
          {PROCESOS_INTERNOS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>

        {/* Tipo solicitud */}
        <select
          value={filtros.tipo_solicitud}
          onChange={e => onChange({ ...filtros, tipo_solicitud: e.target.value })}
          className={cn(
            'rounded-lg border px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-blue-400',
            filtros.tipo_solicitud ? 'border-cyan-300 bg-cyan-50 text-cyan-700 font-semibold' : 'border-slate-200 bg-white text-slate-600'
          )}
        >
          <option value="">Todos los tipos</option>
          {TIPOS_SOLICITUD.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>

        {/* Prioridad */}
        <select
          value={filtros.prioridad}
          onChange={e => onChange({ ...filtros, prioridad: e.target.value })}
          className={cn(
            'rounded-lg border px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-blue-400',
            filtros.prioridad ? 'border-red-300 bg-red-50 text-red-700 font-semibold' : 'border-slate-200 bg-white text-slate-600'
          )}
        >
          <option value="">Todas las prioridades</option>
          {[1, 2, 3, 4].map(p => <option key={p} value={String(p)}>P{p} — {PRIORIDADES[p]?.label}</option>)}
        </select>

        {/* Origen */}
        <select
          value={filtros.origen}
          onChange={e => onChange({ ...filtros, origen: e.target.value })}
          className={cn(
            'rounded-lg border px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-blue-400',
            filtros.origen ? 'border-amber-300 bg-amber-50 text-amber-700 font-semibold' : 'border-slate-200 bg-white text-slate-600'
          )}
        >
          <option value="">Todos los orígenes</option>
          {(ORIGENES_REQUERIMIENTO as unknown as { value: string; label: string }[]).map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
          <option value="SIN_ORIGEN">Sin origen asignado</option>
        </select>

        {activos > 0 && (
          <button
            onClick={limpiar}
            className="flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100"
          >
            <X size={11} /> Limpiar ({activos})
          </button>
        )}

        <div className="ml-auto flex items-center gap-1.5 text-xs text-slate-400">
          {activos > 0 && (
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-700">
              {totalFiltrado} de {totalBase}
            </span>
          )}
          <span>{totalFiltrado} requerimientos</span>
        </div>
      </div>
    </div>
  )
}

/* ── Página principal ────────────────────────────────────────────────────── */
export default function ReportePresidencialPage() {
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_VACIOS)
  const [expandedMeses, setExpandedMeses] = useState<Set<string>>(new Set())
  const toggleMes = (mes: string) => setExpandedMeses(prev => {
    const next = new Set(prev)
    next.has(mes) ? next.delete(mes) : next.add(mes)
    return next
  })

  // Fechas pendientes: map de id → fecha seleccionada (para filas sin fecha)
  const hoyISO = new Date().toISOString().split('T')[0]
  const [fechasPendientes, setFechasPendientes] = useState<Record<string, string>>({})
  const [savingId, setSavingId] = useState<string | null>(null)
  const [, startSave] = useTransition()

  const getFecha = useCallback((id: string) => fechasPendientes[id] ?? hoyISO, [fechasPendientes, hoyISO])
  const setFecha = (id: string, f: string) => setFechasPendientes(prev => ({ ...prev, [id]: f }))

  const guardarFecha = (id: string) => {
    const fecha = getFecha(id)
    setSavingId(id)
    startSave(async () => {
      try {
        await registrarFechaEntrega(id, fecha)
        await refetch()
      } finally {
        setSavingId(null)
      }
    })
  }

  const { data: todos = [], isLoading, dataUpdatedAt, refetch, isFetching } = useQuery({
    queryKey: ['datos-presidencial'],
    queryFn: fetchDatosRawPresidencial,
    staleTime: 60_000,
  })

  const base  = useMemo(() => todos.filter(r => !r.es_borrador), [todos])
  const totalBorradores = todos.length - base.length

  // Estados distintos presentes en los datos (incluye personalizados)
  const estadosDisponibles = useMemo(() => {
    const set = new Set<string>([
      ...Object.keys(ESTADOS),
      ...todos.map(r => r.estado).filter(Boolean) as string[],
    ])
    return Array.from(set).sort()
  }, [todos])

  const activos = useMemo(() => {
    return base.filter(r => {
      if (filtros.alcance       && r.alcance           !== filtros.alcance)                    return false
      if (filtros.estado        && r.estado            !== filtros.estado)                     return false
      if (filtros.proceso       && r.proceso_interno   !== filtros.proceso)                    return false
      if (filtros.tipo_solicitud && r.tipo_solicitud   !== filtros.tipo_solicitud)             return false
      if (filtros.prioridad     && String(r.prioridad) !== filtros.prioridad)                  return false
      if (filtros.origen        && (r.origen_requerimiento ?? 'SIN_ORIGEN') !== filtros.origen) return false
      return true
    })
  }, [base, filtros])

  const r = useMemo(() => computar(activos), [activos])

  const maxEstado         = Math.max(...r.porEstado.map(e => e.cantidad),       1)
  const maxProceso        = Math.max(...r.porProceso.map(p => p.cantidad),      1)
  const maxImpactoProceso = Math.max(...r.porProceso.map(p => p.impactoAnual),  1)
  const maxAlcance        = Math.max(...r.porAlcance.map(a => a.cantidad),      1)
  const maxOrigen         = Math.max(...r.porOrigen.map(o => o.cantidad),       1)
  const maxTopImpacto     = Math.max(...r.topImpacto.map(t => t.impacto),       1)
  const maxMesEntrega     = Math.max(...r.porMesEntrega.map(m => m.cantidad),   1)
  const pctCuantificados  = r.total > 0 ? Math.round(((r.total - r.sinCuantificar) / r.total) * 100) : 0

  const generadoEn = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—'

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center gap-3 text-slate-400">
        <RefreshCw size={20} className="animate-spin" />
        <span className="text-sm">Cargando reporte presidencial...</span>
      </div>
    )
  }

  const hayFiltros = Object.values(filtros).some(Boolean)

  return (
    <div className="space-y-6 p-6">
      {/* ── Encabezado ── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800">Reporte presidencial</h1>
          <p className="mt-0.5 text-sm text-slate-400">
            Consolidado ejecutivo de requerimientos TIN · {generadoEn}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {hayFiltros && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-semibold text-blue-700">
              Vista filtrada — {activos.length} de {base.length} requerimientos
            </div>
          )}
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw size={13} className={cn('text-slate-500', isFetching && 'animate-spin')} />
            <span className="text-xs font-medium text-slate-500">Actualizar</span>
          </button>
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm">
            <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-medium text-slate-500">Datos en tiempo real</span>
          </div>
        </div>
      </div>

      {/* ── Barra de filtros ── */}
      <FiltrosPresidencial
        filtros={filtros}
        onChange={setFiltros}
        totalFiltrado={activos.length}
        totalBase={base.length}
        estadosDisponibles={estadosDisponibles}
      />

      {activos.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white py-20 text-center shadow-sm">
          <BarChart3 size={36} className="mx-auto mb-3 text-slate-200" />
          <p className="text-sm font-semibold text-slate-500">Sin requerimientos con los filtros seleccionados</p>
          <button onClick={() => setFiltros(FILTROS_VACIOS)} className="mt-3 text-xs text-blue-600 hover:underline">
            Limpiar filtros
          </button>
        </div>
      ) : (
        <>
          {/* ── KPIs principales ── */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KpiCard
              label="Total requerimientos"
              valor={String(r.total)}
              sub={hayFiltros ? `${base.length} total · ${totalBorradores} borradores` : `${totalBorradores} borradores no incluidos`}
              icon={Layers}
              color="text-blue-700"
            />
            <KpiCard
              label="Horas desarrollo estimadas"
              valor={`${r.totalHoras.toLocaleString('es-CO')} h`}
              sub="Suma de los requerimientos filtrados"
              icon={Clock}
              color="text-indigo-700"
            />
            <KpiCard
              label="Impacto económico total"
              valor={cop(r.impactoTotal)}
              sub={`${cop(r.impactoTotal)} / año`}
              icon={TrendingUp}
              color="text-emerald-700"
            />
            <KpiCard
              label="Sin impacto cuantificado"
              valor={String(r.sinCuantificar)}
              sub={`${r.total - r.sinCuantificar} cuantificados (${pctCuantificados}%)`}
              icon={AlertCircle}
              color={r.sinCuantificar > 0 ? 'text-amber-600' : 'text-emerald-600'}
            />
          </div>

          {/* ── Fila 2: Estado + Alcance ── */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Seccion titulo="Requerimientos por estado" icono={BarChart3}>
              <div className="space-y-3">
                {r.porEstado.map(e => (
                  <BarraHorizontal key={e.estado} label={e.label} valor={e.cantidad} max={maxEstado}
                    display={`${e.cantidad} (${e.porcentaje}%)`} colorBar={ESTADO_BAR[e.estado] ?? 'bg-slate-400'} />
                ))}
              </div>
            </Seccion>

            <Seccion titulo="Requerimientos por empresa (alcance)" icono={Building2}>
              <div className="space-y-3 mb-4">
                {r.porAlcance.map(a => (
                  <BarraHorizontal key={a.alcance} label={a.alcance} valor={a.cantidad} max={maxAlcance}
                    display={`${a.cantidad} req`} colorBar={ALCANCE_COLOR[a.alcance]?.bar ?? 'bg-slate-400'} />
                ))}
              </div>
              <div className="grid grid-cols-3 gap-2 border-t border-slate-100 pt-4">
                {r.porAlcance.map(a => (
                  <div key={a.alcance} className="rounded-xl border bg-white p-3 text-center shadow-sm">
                    <span className={cn('inline-block rounded-full border px-2 py-0.5 text-xs font-bold mb-1', ALCANCE_COLOR[a.alcance]?.badge ?? 'bg-slate-100 text-slate-600 border-slate-300')}>
                      {a.alcance}
                    </span>
                    <p className="text-lg font-extrabold text-slate-800">{a.cantidad}</p>
                    {a.impactoAnual > 0 && <p className="text-[11px] text-emerald-600 font-semibold">{cop(a.impactoAnual)}</p>}
                  </div>
                ))}
              </div>
            </Seccion>
          </div>

          {/* ── Fila 3: Tipo solicitud + Prioridad ── */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Seccion titulo="Requerimientos por tipo de solicitud" icono={Tag}>
              <div className="space-y-3">
                {r.porTipoSolicitud.length > 0 ? r.porTipoSolicitud.map(t => (
                  <div key={t.tipo} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium', TIPO_BADGE[t.tipo] ?? 'bg-slate-100 text-slate-600 border-slate-200')}>
                        {t.label}
                      </span>
                      <span className="text-xs font-bold text-slate-700">{t.cantidad} ({t.porcentaje}%)</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                      <div className={cn('h-full rounded-full transition-all', TIPO_BAR[t.tipo] ?? 'bg-slate-400')} style={{ width: `${t.porcentaje}%` }} />
                    </div>
                  </div>
                )) : <p className="text-xs italic text-slate-400">Sin datos de tipo de solicitud</p>}
              </div>
            </Seccion>

            <Seccion titulo="Distribución por prioridad" icono={ShieldAlert}>
              {r.porPrioridad.length > 0 ? (
                <div className="space-y-3">
                  {r.porPrioridad.map(p => (
                    <BarraHorizontal key={p.prioridad} label={`P${p.prioridad} — ${p.label}`} valor={p.cantidad}
                      max={Math.max(...r.porPrioridad.map(x => x.cantidad), 1)} display={`${p.cantidad} (${p.porcentaje}%)`}
                      colorBar={p.prioridad === 1 ? 'bg-red-500' : p.prioridad === 2 ? 'bg-orange-400' : p.prioridad === 3 ? 'bg-yellow-400' : 'bg-green-400'} />
                  ))}
                  <div className="mt-3 grid grid-cols-4 gap-2 border-t border-slate-100 pt-3">
                    {r.porPrioridad.map(p => (
                      <div key={p.prioridad} className={cn('rounded-xl border p-2.5 text-center', p.bgColor, p.textColor.replace('text-', 'border-').replace('700', '200').replace('600', '200'))}>
                        <p className={cn('text-lg font-extrabold', p.textColor)}>{p.cantidad}</p>
                        <p className={cn('text-[11px] font-medium', p.textColor)}>P{p.prioridad} {p.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : <p className="text-xs italic text-slate-400">Sin datos de prioridad asignada</p>}
            </Seccion>
          </div>

          {/* ── Fila 4: Por proceso ── */}
          <Seccion titulo="Requerimientos por proceso interno" icono={MapPin}>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-100">
                    {['Proceso', 'Requerimientos', 'Horas est.', 'Impacto anual', 'Sin cuantificar', 'Distribución'].map(h => (
                      <th key={h} className="pb-2 text-left font-semibold text-slate-400 px-2 first:px-0">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {r.porProceso.map(p => (
                    <tr key={p.proceso} className="group">
                      <td className="py-2.5 pr-2 font-medium text-slate-700">{p.label}</td>
                      <td className="px-2 py-2.5 text-center">
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 font-bold text-blue-700">{p.cantidad}</span>
                      </td>
                      <td className="px-2 py-2.5 font-semibold text-indigo-600">
                        {p.horasEstimadas > 0 ? `${p.horasEstimadas.toLocaleString('es-CO')} h` : '—'}
                      </td>
                      <td className="px-2 py-2.5 font-bold text-emerald-600">
                        {p.impactoAnual > 0 ? cop(p.impactoAnual) : '—'}
                      </td>
                      <td className="px-2 py-2.5 text-center">
                        {p.sinCuantificar > 0
                          ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700">{p.sinCuantificar}</span>
                          : <span className="text-emerald-500">✓</span>}
                      </td>
                      <td className="px-2 py-2.5 w-32">
                        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-blue-400" style={{ width: `${maxProceso > 0 ? Math.round((p.cantidad / maxProceso) * 100) : 0}%` }} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Seccion>

          {/* ── Fila 5: Origen + Impacto por proceso ── */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Seccion titulo="Requerimientos por origen" icono={Target}>
              <div className="space-y-3">
                {r.porOrigen.map(o => (
                  <BarraHorizontal key={o.origen} label={o.label} valor={o.cantidad} max={maxOrigen}
                    display={`${o.cantidad} (${o.porcentaje}%)`} colorBar={ORIGEN_BAR[o.origen] ?? 'bg-slate-300'} />
                ))}
              </div>
              <div className="mt-4 grid gap-2">
                {r.porOrigen.map(o => (
                  <div key={o.origen} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className={cn('h-2.5 w-2.5 rounded-full', ORIGEN_BAR[o.origen] ?? 'bg-slate-300')} />
                      <span className="text-xs text-slate-600">{o.label}</span>
                    </div>
                    <span className="text-sm font-bold text-slate-800">{o.cantidad}</span>
                  </div>
                ))}
              </div>
            </Seccion>

            <Seccion titulo="Impacto económico por proceso" icono={TrendingUp}>
              {r.porProceso.filter(p => p.impactoAnual > 0).length === 0 ? (
                <p className="text-xs italic text-slate-400">Sin requerimientos con impacto cuantificado</p>
              ) : (
                <div className="space-y-3">
                  {r.porProceso.filter(p => p.impactoAnual > 0).sort((a, b) => b.impactoAnual - a.impactoAnual).map(p => (
                    <BarraHorizontal key={p.proceso} label={p.label} valor={p.impactoAnual} max={maxImpactoProceso}
                      display={cop(p.impactoAnual)} colorBar="bg-emerald-500" />
                  ))}
                  <div className="flex items-center justify-between rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2.5 mt-2">
                    <span className="text-xs font-semibold text-emerald-700">Total impacto anual (filtrado)</span>
                    <span className="text-base font-extrabold text-emerald-800">{cop(r.impactoTotal)}</span>
                  </div>
                </div>
              )}
            </Seccion>
          </div>

          {/* ── Top 10 por impacto ── */}
          {r.topImpacto.length > 0 && (
            <Seccion titulo="Top 10 requerimientos por impacto económico" icono={TrendingUp}>
              <div className="space-y-2">
                {r.topImpacto.map((t, i) => (
                  <a key={t.id} href={`/admin/requerimientos/${t.id}`}
                    className="grid grid-cols-[2rem_1fr_auto] items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 hover:border-emerald-200 hover:bg-emerald-50 transition-colors">
                    <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-extrabold',
                      i === 0 ? 'bg-yellow-100 text-yellow-700' : i === 1 ? 'bg-slate-200 text-slate-600' : i === 2 ? 'bg-orange-100 text-orange-600' : 'bg-white border border-slate-200 text-slate-400')}>
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-slate-700">{t.nombre}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {t.proceso && <span className="text-[10px] text-slate-400">{t.proceso}</span>}
                        {t.alcance && (
                          <span className={cn('rounded-full border px-1.5 py-px text-[10px] font-bold', ALCANCE_COLOR[t.alcance]?.badge ?? 'bg-slate-100 text-slate-500 border-slate-300')}>
                            {t.alcance}
                          </span>
                        )}
                        <div className="flex-1 h-1.5 overflow-hidden rounded-full bg-slate-200">
                          <div className="h-full rounded-full bg-emerald-400" style={{ width: `${Math.round((t.impacto / maxTopImpacto) * 100)}%` }} />
                        </div>
                      </div>
                    </div>
                    <span className="shrink-0 text-sm font-extrabold text-emerald-700">{cop(t.impacto)}</span>
                  </a>
                ))}
              </div>
            </Seccion>
          )}

          {/* ── Entregas por mes ── */}
          <Seccion titulo="Entregas por mes" icono={CalendarCheck}>
            {r.porMesEntrega.length === 0 ? (
              <p className="text-xs italic text-slate-400">
                Sin entregas registradas con fecha en los datos actuales
              </p>
            ) : (
              <div className="space-y-4">
                {/* Resumen global */}
                <div className="grid grid-cols-3 gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                  <div className="text-center">
                    <p className="text-2xl font-extrabold text-emerald-700">
                      {r.porMesEntrega.reduce((s, m) => s + m.cantidad, 0)}
                    </p>
                    <p className="text-[11px] text-emerald-600">Total entregados</p>
                  </div>
                  <div className="text-center border-x border-emerald-200">
                    <p className="text-2xl font-extrabold text-emerald-700">
                      {r.porMesEntrega.length}
                    </p>
                    <p className="text-[11px] text-emerald-600">Meses con entregas</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-extrabold text-emerald-700">
                      {cop(r.porMesEntrega.reduce((s, m) => s + (m.impactoReal || m.impactoEstimado), 0))}
                    </p>
                    <p className="text-[11px] text-emerald-600">Impacto total / año</p>
                  </div>
                </div>

                {/* Barra resumen */}
                <div className="space-y-2">
                  {r.porMesEntrega.map(m => (
                    <BarraHorizontal
                      key={m.mes}
                      label={m.label.charAt(0).toUpperCase() + m.label.slice(1)}
                      valor={m.cantidad}
                      max={maxMesEntrega}
                      display={`${m.cantidad} entrega${m.cantidad !== 1 ? 's' : ''}`}
                      colorBar={m.sinFecha ? 'bg-amber-400' : 'bg-emerald-500'}
                    />
                  ))}
                </div>

                {/* Acordeón por mes */}
                <div className="space-y-2 border-t border-slate-100 pt-3">
                  {r.porMesEntrega.map(m => {
                    const isOpen = expandedMeses.has(m.mes)
                    const impactoMes = m.impactoReal || m.impactoEstimado
                    const accentBg  = m.sinFecha ? 'bg-amber-100'  : 'bg-emerald-100'
                    const accentText = m.sinFecha ? 'text-amber-700' : 'text-emerald-700'
                    return (
                      <div key={m.mes} className={cn('overflow-hidden rounded-xl border', m.sinFecha ? 'border-amber-200' : 'border-slate-200')}>
                        {/* Cabecera del mes */}
                        <button
                          onClick={() => toggleMes(m.mes)}
                          className="flex w-full items-center justify-between gap-3 bg-white px-4 py-3 text-left hover:bg-slate-50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <span className={cn('inline-flex items-center justify-center rounded-full px-3 py-0.5 text-xs font-extrabold', accentBg, accentText)}>
                              {m.cantidad}
                            </span>
                            <span className="text-sm font-semibold text-slate-700 capitalize">{m.label}</span>
                            {m.sinFecha && (
                              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-600">
                                Registrar fecha
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-4">
                            {impactoMes > 0 && (
                              <span className="text-xs font-bold text-emerald-600">{cop(impactoMes)} / año</span>
                            )}
                            {m.horasAhorradasMes > 0 && (
                              <span className="text-xs text-slate-400">{m.horasAhorradasMes.toLocaleString('es-CO')} HH/mes</span>
                            )}
                            <ChevronDown
                              size={15}
                              className={cn('text-slate-400 transition-transform', isOpen && 'rotate-180')}
                            />
                          </div>
                        </button>

                        {/* Detalle expandido */}
                        {isOpen && (
                          <div className="border-t border-slate-100 bg-slate-50">
                            {/* Consolidado del mes */}
                            <div className="grid grid-cols-3 gap-3 border-b border-slate-200 bg-emerald-50/60 px-4 py-2.5">
                              <div>
                                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Entregas</p>
                                <p className="text-sm font-bold text-slate-700">{m.cantidad}</p>
                              </div>
                              <div>
                                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Impacto / año</p>
                                <p className="text-sm font-bold text-emerald-700">
                                  {impactoMes > 0 ? cop(impactoMes) : '—'}
                                  {m.impactoReal > 0 && (
                                    <span className="ml-1 text-[10px] font-medium text-emerald-500">(real)</span>
                                  )}
                                </p>
                              </div>
                              <div>
                                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">HH ahorradas / mes</p>
                                <p className="text-sm font-bold text-indigo-600">
                                  {m.horasAhorradasMes > 0 ? `${m.horasAhorradasMes.toLocaleString('es-CO')} h` : '—'}
                                </p>
                              </div>
                            </div>

                            {/* Tabla de desarrollos */}
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="border-b border-slate-200 bg-slate-100">
                                  <th className="py-2 pl-4 text-left font-semibold text-slate-400">Desarrollo</th>
                                  <th className="py-2 px-2 text-left font-semibold text-slate-400">Proceso</th>
                                  <th className="py-2 px-2 text-center font-semibold text-slate-400">Empresa</th>
                                  <th className="py-2 px-2 text-right font-semibold text-slate-400">HH/mes</th>
                                  <th className="py-2 pr-4 text-right font-semibold text-slate-400">Impacto / año</th>
                                  {m.sinFecha && <th className="py-2 pr-4 text-right font-semibold text-slate-400">Fecha entrega</th>}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {m.rows.map(row => {
                                  const impactoRow = row.impacto_economico_total_anual_real ?? row.impacto_economico_total_anual ?? 0
                                  return (
                                    <tr key={row.id} className="hover:bg-white transition-colors">
                                      <td className="py-2.5 pl-4 pr-2">
                                        <a
                                          href={`/admin/requerimientos/${row.id}`}
                                          className="font-medium text-slate-700 hover:text-blue-600 hover:underline"
                                        >
                                          {row.nombre_desarrollo ?? row.identificacion ?? '—'}
                                        </a>
                                      </td>
                                      <td className="px-2 py-2.5 text-slate-500">
                                        {row.proceso_interno ? procesoLabel(row.proceso_interno) : '—'}
                                      </td>
                                      <td className="px-2 py-2.5 text-center">
                                        {row.alcance ? (
                                          <span className={cn(
                                            'inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold',
                                            ALCANCE_COLOR[row.alcance]?.badge ?? 'bg-slate-100 text-slate-600 border-slate-300'
                                          )}>
                                            {row.alcance}
                                          </span>
                                        ) : '—'}
                                      </td>
                                      <td className="px-2 py-2.5 text-right text-indigo-600 font-semibold">
                                        {row.horas_ahorradas_mes != null && row.horas_ahorradas_mes > 0
                                          ? `${row.horas_ahorradas_mes.toLocaleString('es-CO')} h`
                                          : <span className="text-slate-300 font-normal">—</span>}
                                      </td>
                                      <td className="py-2.5 pl-2 pr-4 text-right font-bold text-emerald-600">
                                        {impactoRow > 0 ? cop(impactoRow) : <span className="text-slate-300 font-normal">Sin datos</span>}
                                      </td>
                                      {m.sinFecha && (
                                        <td className="py-1.5 pr-4">
                                          <div className="flex items-center justify-end gap-1.5">
                                            <input
                                              type="date"
                                              value={getFecha(row.id)}
                                              max={hoyISO}
                                              onChange={e => setFecha(row.id, e.target.value)}
                                              className="rounded border border-amber-300 bg-white px-2 py-1 text-xs outline-none focus:border-amber-500"
                                            />
                                            <button
                                              onClick={() => guardarFecha(row.id)}
                                              disabled={savingId === row.id}
                                              className="rounded bg-amber-500 px-2 py-1 text-xs font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
                                            >
                                              {savingId === row.id ? '...' : 'Guardar'}
                                            </button>
                                          </div>
                                        </td>
                                      )}
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </Seccion>

          {/* ── Alerta sin cuantificar ── */}
          {r.sinCuantificar > 0 && (
            <div className="flex items-start gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <AlertCircle size={22} className="mt-0.5 shrink-0 text-amber-500" />
              <div>
                <p className="font-bold text-amber-800">
                  {r.sinCuantificar} requerimiento{r.sinCuantificar > 1 ? 's' : ''} sin impacto cuantificado
                </p>
                <p className="mt-0.5 text-sm text-amber-600">
                  Cuantificarlos mejorará la exactitud del reporte presidencial.
                </p>
              </div>
              <div className="ml-auto shrink-0 text-center">
                <p className="text-3xl font-extrabold text-amber-700">{100 - pctCuantificados}%</p>
                <p className="text-xs text-amber-500">sin cuantificar</p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
