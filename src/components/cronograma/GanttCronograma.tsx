'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { ZoomIn, ZoomOut, Calendar, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getEstadoCfg } from '@/lib/constants'

// ── Types ───────────────────────────────────────────────────────────────────
export interface ReqGantt {
  id: string
  numero: string | null
  nombre_desarrollo: string | null
  identificacion: string
  estado: string
  prioridad: number | null
  sub_prioridad: number | null
  fecha_inicio_desarrollo: string | null
  fecha_estimada_entrega: string | null
  fecha_real_entrega: string | null
  fecha_estimada_feedback_pruebas: string | null
  fecha_real_feedback_pruebas: string | null
  fecha_estimada_salida_vivo: string | null
  fecha_salida_vivo: string | null
}

interface Props { requerimientos: ReqGantt[] }

// ── Layout constants ────────────────────────────────────────────────────────
const LEFT_W    = 300
const HEADER_H  = 48
const ROW_H     = 54
const BAR_H     = 20
const BAR_Y     = (ROW_H - BAR_H) / 2   // 17

// ── Bar color palette ───────────────────────────────────────────────────────
const C = {
  devEst:   '#93c5fd',   // blue-300
  devReal:  '#1d4ed8',   // blue-700
  prbEst:   '#fcd34d',   // amber-300
  prbReal:  '#b45309',   // amber-700
  salEst:   '#6ee7b7',   // emerald-300
  salReal:  '#047857',   // emerald-700
  hoy:      '#f87171',   // red-400
}

// ── Date helpers ────────────────────────────────────────────────────────────
const toD  = (s: string)              => new Date(s + 'T12:00:00')
const getX = (d: Date, o: Date, px: number) => Math.round((d.getTime() - o.getTime()) / 86400000 * px)

function monthStart(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1) }
function monthEnd  (d: Date) { return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59) }

function allDates(r: ReqGantt): Date[] {
  return [
    r.fecha_inicio_desarrollo,
    r.fecha_estimada_entrega,       r.fecha_real_entrega,
    r.fecha_estimada_feedback_pruebas, r.fecha_real_feedback_pruebas,
    r.fecha_estimada_salida_vivo,   r.fecha_salida_vivo,
  ].filter(Boolean).map(s => toD(s!))
}

function buildMonths(origin: Date, end: Date, pxDay: number) {
  const out: { label: string; shortLabel: string; x: number; w: number }[] = []
  let cur = new Date(origin)
  while (cur <= end) {
    const days = new Date(cur.getFullYear(), cur.getMonth() + 1, 0).getDate()
    out.push({
      label:      cur.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' }),
      shortLabel: cur.toLocaleDateString('es-CO', { month: 'short', year: '2-digit' }),
      x:   getX(cur, origin, pxDay),
      w:   days * pxDay,
    })
    cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1)
  }
  return out
}

function formatFecha(s: string | null) {
  if (!s) return '—'
  return toD(s).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ── Bar & marker computation ────────────────────────────────────────────────
interface Bar { x: number; w: number; color: string; opacity: number; title: string; radius: number }
interface Mrk { x: number; color: string; title: string; shape: 'circle' | 'diamond'; size: number }

function buildBars(req: ReqGantt, origin: Date, px: number): { bars: Bar[]; mrks: Mrk[] } {
  const bars: Bar[] = []
  const mrks: Mrk[] = []
  const d = (s: string | null) => s ? toD(s) : null

  const ini  = d(req.fecha_inicio_desarrollo)
  const estE = d(req.fecha_estimada_entrega)
  const rlE  = d(req.fecha_real_entrega)
  const estF = d(req.fecha_estimada_feedback_pruebas)
  const rlF  = d(req.fecha_real_feedback_pruebas)
  const estS = d(req.fecha_estimada_salida_vivo)
  const rlS  = d(req.fecha_salida_vivo)

  // ── Barra 1: Desarrollo (inicio → entrega estimada) ────────────────────
  if (ini && estE) {
    const x = getX(ini, origin, px)
    const w = Math.max(getX(estE, origin, px) - x, 6)
    bars.push({ x, w, color: C.devEst, opacity: 1, title: `Desarrollo: ${formatFecha(req.fecha_inicio_desarrollo)} → ${formatFecha(req.fecha_estimada_entrega)}`, radius: 6 })
  } else if (ini) {
    mrks.push({ x: getX(ini, origin, px), color: C.devEst, title: `Inicio: ${formatFecha(req.fecha_inicio_desarrollo)}`, shape: 'diamond', size: 10 })
  }

  // Marcador entrega real
  if (rlE) {
    mrks.push({ x: getX(rlE, origin, px), color: C.devReal, title: `Entrega real: ${formatFecha(req.fecha_real_entrega)}`, shape: 'circle', size: 12 })
  }

  // ── Barra 2: Pruebas (entrega → feedback) ─────────────────────────────
  const prbStart = estE ?? ini
  if (prbStart && estF) {
    const x = getX(prbStart, origin, px)
    const w = Math.max(getX(estF, origin, px) - x, 6)
    bars.push({ x, w, color: C.prbEst, opacity: 1, title: `Pruebas: ${formatFecha(req.fecha_estimada_entrega ?? req.fecha_inicio_desarrollo)} → ${formatFecha(req.fecha_estimada_feedback_pruebas)}`, radius: 6 })
  } else if (!prbStart && estF) {
    mrks.push({ x: getX(estF, origin, px), color: C.prbEst, title: `Feedback est.: ${formatFecha(req.fecha_estimada_feedback_pruebas)}`, shape: 'diamond', size: 10 })
  }

  // Marcador feedback real
  if (rlF) {
    mrks.push({ x: getX(rlF, origin, px), color: C.prbReal, title: `Feedback real: ${formatFecha(req.fecha_real_feedback_pruebas)}`, shape: 'circle', size: 12 })
  }

  // ── Barra 3: Pre-salida (feedback → salida) ───────────────────────────
  const salStart = estF ?? prbStart
  if (salStart && estS) {
    const x = getX(salStart, origin, px)
    const w = Math.max(getX(estS, origin, px) - x, 6)
    bars.push({ x, w, color: C.salEst, opacity: 1, title: `Salida en vivo: ${formatFecha(req.fecha_estimada_feedback_pruebas ?? req.fecha_estimada_entrega)} → ${formatFecha(req.fecha_estimada_salida_vivo)}`, radius: 6 })
  } else if (!salStart && estS) {
    mrks.push({ x: getX(estS, origin, px), color: C.salEst, title: `Salida est.: ${formatFecha(req.fecha_estimada_salida_vivo)}`, shape: 'diamond', size: 10 })
  }

  // Marcador salida real
  if (rlS) {
    mrks.push({ x: getX(rlS, origin, px), color: C.salReal, title: `Salida real: ${formatFecha(req.fecha_salida_vivo)}`, shape: 'circle', size: 12 })
  }

  return { bars, mrks }
}

// ── Fila individual ─────────────────────────────────────────────────────────
function GanttRow({
  req, origin, pxDay, months, totalWidth, isEven, todayX,
}: {
  req: ReqGantt; origin: Date; pxDay: number
  months: { x: number }[]; totalWidth: number; isEven: boolean; todayX: number
}) {
  const estadoCfg = getEstadoCfg(req.estado)
  const etiqueta  = req.prioridad != null
    ? `P${req.prioridad}.${req.sub_prioridad ?? 1}`
    : null
  const { bars, mrks } = useMemo(
    () => buildBars(req, origin, pxDay),
    [req, origin, pxDay]
  )

  return (
    <div className="flex" style={{ height: ROW_H }}>
      {/* Panel izquierdo (sticky) */}
      <div
        className={cn(
          'sticky left-0 z-10 flex shrink-0 items-center gap-2 border-b border-r border-slate-100 px-3',
          isEven ? 'bg-slate-50' : 'bg-white'
        )}
        style={{ width: LEFT_W, minWidth: LEFT_W }}
      >
        {etiqueta && (
          <span className="shrink-0 text-[10px] font-bold text-slate-300">{etiqueta}</span>
        )}
        <div className="min-w-0 flex-1">
          <Link
            href={`/admin/requerimientos/${req.id}`}
            className="block truncate text-xs font-medium text-slate-700 hover:text-blue-600"
            title={req.nombre_desarrollo ?? req.identificacion}
          >
            {req.nombre_desarrollo ?? req.identificacion}
          </Link>
          <span className={cn(
            'mt-0.5 inline-block rounded-full px-1.5 py-px text-[10px] font-medium leading-none',
            estadoCfg.bgColor, estadoCfg.textColor
          )}>
            {estadoCfg.label}
          </span>
        </div>
      </div>

      {/* Área de barras */}
      <div
        className={cn('relative shrink-0 border-b border-slate-100', isEven ? 'bg-slate-50/30' : 'bg-white')}
        style={{ width: totalWidth, height: ROW_H }}
      >
        {/* Líneas verticales de meses */}
        {months.map((m, i) => (
          <div key={i} className="absolute inset-y-0 w-px bg-slate-100" style={{ left: m.x }} />
        ))}

        {/* Línea de hoy */}
        {todayX >= 0 && todayX <= totalWidth && (
          <div className="absolute inset-y-0 w-px bg-red-300/60" style={{ left: todayX }} />
        )}

        {/* Barras */}
        {bars.map((b, i) => (
          <div
            key={i}
            title={b.title}
            className="absolute cursor-default transition-opacity hover:opacity-90"
            style={{
              left: b.x, width: b.w,
              top: BAR_Y, height: BAR_H,
              backgroundColor: b.color,
              borderRadius: b.radius,
              opacity: b.opacity,
            }}
          />
        ))}

        {/* Marcadores */}
        {mrks.map((m, i) =>
          m.shape === 'circle' ? (
            <div
              key={i}
              title={m.title}
              className="absolute cursor-default border-2 border-white shadow-sm"
              style={{
                left: m.x - m.size / 2,
                top: BAR_Y + (BAR_H - m.size) / 2,
                width: m.size, height: m.size,
                backgroundColor: m.color,
                borderRadius: '50%',
              }}
            />
          ) : (
            <div
              key={i}
              title={m.title}
              className="absolute cursor-default"
              style={{
                left: m.x - m.size / 2,
                top: BAR_Y + (BAR_H - m.size) / 2,
                width: m.size, height: m.size,
                backgroundColor: m.color,
                transform: 'rotate(45deg)',
                opacity: 0.65,
              }}
            />
          )
        )}
      </div>
    </div>
  )
}

// ── Componente principal ────────────────────────────────────────────────────
export function GanttCronograma({ requerimientos }: Props) {
  const [pxDay,  setPxDay]  = useState(4)
  const [search, setSearch] = useState('')
  const [estado, setEstado] = useState('')

  // Filtrado
  const filtered = useMemo(() => requerimientos.filter(r => {
    if (allDates(r).length === 0) return false
    if (search) {
      const q = search.toLowerCase()
      if (!`${r.nombre_desarrollo ?? ''} ${r.identificacion}`.toLowerCase().includes(q)) return false
    }
    if (estado && r.estado !== estado) return false
    return true
  }), [requerimientos, search, estado])

  // Rango del timeline
  const { origin, end, totalDays } = useMemo(() => {
    const all = filtered.flatMap(allDates)
    if (!all.length) {
      const now = new Date()
      return { origin: monthStart(now), end: monthEnd(new Date(now.getFullYear(), now.getMonth() + 2, 1)), totalDays: 90 }
    }
    const minD = new Date(Math.min(...all.map(d => d.getTime())))
    const maxD = new Date(Math.max(...all.map(d => d.getTime())))
    const o = monthStart(new Date(minD.getFullYear(), minD.getMonth() - 1, 1))
    const e = monthEnd(new Date(maxD.getFullYear(), maxD.getMonth() + 1, 1))
    return { origin: o, end: e, totalDays: Math.ceil((e.getTime() - o.getTime()) / 86400000) }
  }, [filtered])

  const months     = useMemo(() => buildMonths(origin, end, pxDay), [origin, end, pxDay])
  const totalWidth = totalDays * pxDay
  const todayX     = getX(new Date(), origin, pxDay)

  const estados = useMemo(
    () => [...new Set(requerimientos.map(r => r.estado))].sort(),
    [requerimientos]
  )

  if (!requerimientos.length) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white py-16 text-center">
        <Calendar size={32} className="mx-auto mb-3 text-slate-200" />
        <p className="text-sm text-slate-400">No hay requerimientos con fechas registradas</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">

      {/* Controles */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-52 flex-1 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2">
          <Search size={13} className="shrink-0 text-slate-400" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar requerimiento..."
            className="flex-1 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
          />
        </div>
        <select
          value={estado} onChange={e => setEstado(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none"
        >
          <option value="">Todos los estados</option>
          {estados.map(e => (
            <option key={e} value={e}>{getEstadoCfg(e).label}</option>
          ))}
        </select>

        {/* Zoom */}
        <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1">
          <button onClick={() => setPxDay(p => Math.max(2, p - 1))}
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"><ZoomOut size={14} /></button>
          <span className="w-16 text-center text-xs font-medium text-slate-500">{pxDay} px/día</span>
          <button onClick={() => setPxDay(p => Math.min(10, p + 1))}
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"><ZoomIn size={14} /></button>
        </div>
      </div>

      {/* Leyenda */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 rounded-lg border border-slate-100 bg-slate-50 px-4 py-2 text-[11px] text-slate-600">
        <span className="font-semibold text-slate-400">Leyenda</span>
        {([
          [C.devEst, 'Desarrollo (estimado)'],
          [C.prbEst, 'Pruebas (estimado)'],
          [C.salEst, 'Salida en vivo (estimado)'],
        ] as [string, string][]).map(([color, label]) => (
          <span key={label} className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-8 rounded-full" style={{ backgroundColor: color }} />
            {label}
          </span>
        ))}
        {([
          [C.devReal, 'Entrega real'],
          [C.prbReal, 'Pruebas real'],
          [C.salReal, 'Salida real'],
        ] as [string, string][]).map(([color, label]) => (
          <span key={label} className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-full border-2 border-white shadow-sm" style={{ backgroundColor: color }} />
            {label}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-px" style={{ backgroundColor: C.hoy, width: 2 }} />
          Hoy
        </span>
      </div>

      {/* Gantt */}
      <div className="overflow-auto rounded-xl border border-slate-200 bg-white"
        style={{ maxHeight: 'calc(100vh - 310px)', minHeight: 200 }}>
        <div style={{ minWidth: LEFT_W + totalWidth + 1 }}>

          {/* Cabecera de meses */}
          <div className="sticky top-0 z-20 flex border-b border-slate-200 bg-slate-50"
            style={{ height: HEADER_H }}>
            <div
              className="sticky left-0 z-30 flex shrink-0 items-center border-r border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-500"
              style={{ width: LEFT_W, minWidth: LEFT_W }}
            >
              {filtered.length} desarrollo{filtered.length !== 1 ? 's' : ''}
            </div>
            <div className="relative shrink-0" style={{ width: totalWidth, height: HEADER_H }}>
              {months.map((m, i) => (
                <div
                  key={i}
                  className="absolute inset-y-0 flex items-center justify-center border-l border-slate-200 text-[11px] font-semibold text-slate-500"
                  style={{ left: m.x, width: m.w }}
                >
                  {m.w > 60 ? m.label : m.shortLabel}
                </div>
              ))}
              {/* Línea de hoy en cabecera */}
              {todayX >= 0 && todayX <= totalWidth && (
                <div
                  className="absolute inset-y-0 w-0.5"
                  style={{ left: todayX, backgroundColor: C.hoy }}
                >
                  <span className="absolute -top-0 left-1 whitespace-nowrap rounded bg-red-400 px-1 py-px text-[9px] font-bold text-white">
                    Hoy
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Filas */}
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-400">
              No hay resultados para los filtros aplicados
            </div>
          ) : (
            filtered.map((req, i) => (
              <GanttRow
                key={req.id}
                req={req}
                origin={origin}
                pxDay={pxDay}
                months={months}
                totalWidth={totalWidth}
                isEven={i % 2 === 0}
                todayX={todayX}
              />
            ))
          )}
        </div>
      </div>
    </div>
  )
}
