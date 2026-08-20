'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { ZoomIn, ZoomOut, Calendar, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AsignacionCronograma } from '@/actions/desarrolladores-req'

interface Props { asignaciones: AsignacionCronograma[] }

interface DevGroup {
  perfil_id: string
  nombre: string
  cargo: string | null
  asignaciones: AsignacionCronograma[]
}

// ── Layout constants ─────────────────────────────────────────────────────────
const LEFT_W   = 280
const YEAR_H   = 20
const MONTH_H  = 22
const WEEK_H   = 18
const HEADER_H = YEAR_H + MONTH_H + WEEK_H   // 60
const BAR_H    = 26
const LANE_GAP = 4
const ROW_PAD  = 8   // top and bottom padding inside each dev row

// ── Bar color palette ─────────────────────────────────────────────────────────
const PALETTE = [
  '#3b82f6', '#8b5cf6', '#10b981', '#f59e0b',
  '#ef4444', '#ec4899', '#06b6d4', '#84cc16',
  '#f97316', '#6366f1',
]

const HOY_COLOR = '#f87171'

// ── Date helpers ─────────────────────────────────────────────────────────────
const toD  = (s: string) => new Date(s + 'T12:00:00')
const getX = (d: Date, o: Date, px: number) => Math.round((d.getTime() - o.getTime()) / 86400000 * px)

function monthEnd(d: Date) { return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59) }

function isoWeek(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

function allDatesAsig(a: AsignacionCronograma): Date[] {
  return [a.fecha_inicio_estimada, a.fecha_fin_estimada].filter(Boolean).map(s => toD(s!))
}

function buildYears(origin: Date, end: Date, pxDay: number) {
  const out: { year: number; x: number; w: number }[] = []
  for (let yr = origin.getFullYear(); yr <= end.getFullYear(); yr++) {
    const yStart = new Date(Math.max(new Date(yr, 0, 1).getTime(), origin.getTime()))
    const yEnd   = new Date(Math.min(new Date(yr, 11, 31, 23, 59, 59).getTime(), end.getTime()))
    if (yStart > yEnd) continue
    const x = getX(yStart, origin, pxDay)
    const w = getX(yEnd, origin, pxDay) - x + pxDay
    out.push({ year: yr, x: Math.max(0, x), w })
  }
  return out
}

function buildMonths(origin: Date, end: Date, pxDay: number) {
  const out: { label: string; shortLabel: string; x: number; w: number }[] = []
  let cur = new Date(origin)
  while (cur <= end) {
    const days = new Date(cur.getFullYear(), cur.getMonth() + 1, 0).getDate()
    out.push({
      label:      cur.toLocaleDateString('es-CO', { month: 'long' }),
      shortLabel: cur.toLocaleDateString('es-CO', { month: 'short' }),
      x: getX(cur, origin, pxDay),
      w: days * pxDay,
    })
    cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1)
  }
  return out
}

function buildWeeks(origin: Date, end: Date, pxDay: number) {
  const out: { weekNum: number; x: number; w: number }[] = []
  const dow = origin.getDay()
  const daysBack = dow === 0 ? 6 : dow - 1
  let cur = new Date(origin.getFullYear(), origin.getMonth(), origin.getDate() - daysBack)
  while (cur <= end) {
    out.push({ weekNum: isoWeek(cur), x: getX(cur, origin, pxDay), w: 7 * pxDay })
    cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 7)
  }
  return out
}

function fmtCorta(s: string | null) {
  if (!s) return '—'
  return toD(s).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
}

// ── Lane assignment (greedy interval scheduling) ──────────────────────────────
interface LanedItem {
  asig: AsignacionCronograma
  lane: number
  x: number
  w: number
}

function assignLanes(asigs: AsignacionCronograma[], origin: Date, pxDay: number): LanedItem[] {
  const items = asigs
    .map(a => {
      const startD = a.fecha_inicio_estimada ? toD(a.fecha_inicio_estimada)
        : a.fecha_fin_estimada ? toD(a.fecha_fin_estimada) : null
      const endD = a.fecha_fin_estimada ? toD(a.fecha_fin_estimada)
        : a.fecha_inicio_estimada ? toD(a.fecha_inicio_estimada) : null
      if (!startD || !endD) return null
      const x = getX(startD, origin, pxDay)
      const w = Math.max(getX(endD, origin, pxDay) - x + pxDay, 6)
      return { asig: a, x, w }
    })
    .filter((v): v is { asig: AsignacionCronograma; x: number; w: number } => v !== null)

  items.sort((a, b) => a.x - b.x)

  const laneEnds: number[] = []
  return items.map(item => {
    const lane = laneEnds.findIndex(end => end <= item.x)
    const assignedLane = lane === -1 ? laneEnds.length : lane
    laneEnds[assignedLane] = item.x + item.w
    return { ...item, lane: assignedLane }
  })
}

function rowHeightForLanes(numLanes: number): number {
  return ROW_PAD + numLanes * BAR_H + Math.max(0, numLanes - 1) * LANE_GAP + ROW_PAD
}

// ── Fila por desarrollador ────────────────────────────────────────────────────
function DevRow({
  group, origin, pxDay, weeks, totalWidth, isEven, todayX,
}: {
  group: DevGroup; origin: Date; pxDay: number
  weeks: { x: number }[]; totalWidth: number; isEven: boolean; todayX: number
}) {
  const initials = group.nombre.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
  const laned    = assignLanes(group.asignaciones, origin, pxDay)
  const numLanes = laned.length > 0 ? Math.max(...laned.map(l => l.lane)) + 1 : 1
  const rowH     = rowHeightForLanes(numLanes)

  return (
    <div className="flex" style={{ height: rowH }}>
      {/* Panel izquierdo (sticky) */}
      <div
        className={cn(
          'sticky left-0 z-10 flex shrink-0 items-center gap-2.5 border-b border-r border-slate-200 px-3',
          isEven ? 'bg-slate-50' : 'bg-white'
        )}
        style={{ width: LEFT_W, minWidth: LEFT_W, height: rowH }}
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-700">{group.nombre}</p>
          {group.cargo && (
            <span className="mt-0.5 inline-block rounded-full bg-indigo-50 px-1.5 py-px text-[10px] font-medium text-indigo-500 leading-tight">
              {group.cargo}
            </span>
          )}
        </div>
        <span className="shrink-0 text-[10px] text-slate-300">{group.asignaciones.length}</span>
      </div>

      {/* Área de barras */}
      <div
        className={cn('relative shrink-0 border-b border-slate-200', isEven ? 'bg-slate-50/30' : 'bg-white')}
        style={{ width: totalWidth, height: rowH }}
      >
        {/* Líneas de semana */}
        {weeks.map((wk, i) => wk.x > 0 && (
          <div key={i} className="absolute inset-y-0 w-px bg-slate-200" style={{ left: wk.x }} />
        ))}

        {/* Línea de hoy */}
        {todayX >= 0 && todayX <= totalWidth && (
          <div className="absolute inset-y-0 w-px" style={{ left: todayX, backgroundColor: HOY_COLOR, opacity: 0.7 }} />
        )}

        {/* Barras en carriles independientes para evitar solapamiento */}
        {laned.map(({ asig, lane, x, w }, i) => {
          const color  = PALETTE[i % PALETTE.length]
          const hereda = asig.fechas_heredadas
          const barTop = ROW_PAD + lane * (BAR_H + LANE_GAP)
          const label  = asig.nombre_desarrollo ?? asig.identificacion
          const title  = `${label}${hereda ? ' (fechas del padre)' : ''}\n${asig.numero ? '#' + asig.numero + ' · ' : ''}${fmtCorta(asig.fecha_inicio_estimada)} → ${fmtCorta(asig.fecha_fin_estimada)}`

          return (
            <Link
              key={asig.requerimiento_id}
              href={`/admin/requerimientos/${asig.requerimiento_id}`}
              title={title}
              className="absolute flex items-center overflow-hidden rounded-md transition-all hover:brightness-90 hover:shadow-md"
              style={{
                left: x, width: w,
                top: barTop, height: BAR_H,
                backgroundColor: hereda ? 'transparent' : color,
                opacity: hereda ? 0.75 : 1,
                boxShadow: hereda ? 'none' : '0 1px 2px rgba(0,0,0,0.15)',
                border: hereda ? `2px dashed ${color}` : 'none',
              } as React.CSSProperties}
            >
              {w > 44 && (
                <span
                  className="px-2 text-[10px] font-semibold leading-none truncate"
                  style={{ color: hereda ? color : 'rgba(255,255,255,0.9)' }}
                >
                  {label}
                </span>
              )}
            </Link>
          )
        })}
      </div>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
export function GanttCronogramaTIN({ asignaciones }: Props) {
  const [pxDay,  setPxDay]  = useState(4)
  const [search, setSearch] = useState('')

  // Agrupar por desarrollador
  const groups = useMemo<DevGroup[]>(() => {
    const map = new Map<string, DevGroup>()
    asignaciones.forEach(a => {
      if (!map.has(a.perfil_id)) {
        map.set(a.perfil_id, { perfil_id: a.perfil_id, nombre: a.nombre_desarrollador, cargo: a.cargo, asignaciones: [] })
      }
      map.get(a.perfil_id)!.asignaciones.push(a)
    })
    return [...map.values()].sort((a, b) => a.nombre.localeCompare(b.nombre))
  }, [asignaciones])

  const filtered = useMemo(() => {
    if (!search.trim()) return groups
    const q = search.toLowerCase()
    return groups
      .map(g => ({
        ...g,
        asignaciones: g.asignaciones.filter(a =>
          (a.nombre_desarrollo ?? a.identificacion).toLowerCase().includes(q) ||
          g.nombre.toLowerCase().includes(q)
        ),
      }))
      .filter(g => g.asignaciones.length > 0)
  }, [groups, search])

  // Timeline: siempre inicia en 2026-01-01
  const { origin, end, totalDays } = useMemo(() => {
    const base = new Date(2026, 0, 1)
    const all  = asignaciones.flatMap(allDatesAsig)
    if (!all.length) {
      return { origin: base, end: new Date(2026, 11, 31, 23, 59, 59), totalDays: 365 }
    }
    const maxD = new Date(Math.max(...all.map(d => d.getTime())))
    const e    = monthEnd(new Date(maxD.getFullYear(), maxD.getMonth() + 1, 1))
    return { origin: base, end: e, totalDays: Math.ceil((e.getTime() - base.getTime()) / 86400000) }
  }, [asignaciones])

  const years      = useMemo(() => buildYears(origin, end, pxDay),  [origin, end, pxDay])
  const months     = useMemo(() => buildMonths(origin, end, pxDay), [origin, end, pxDay])
  const weeks      = useMemo(() => buildWeeks(origin, end, pxDay),  [origin, end, pxDay])
  const totalWidth = totalDays * pxDay
  const todayX     = getX(new Date(), origin, pxDay)

  if (!asignaciones.length) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white py-20 text-center">
        <Calendar size={32} className="mx-auto mb-3 text-slate-200" />
        <p className="text-sm font-medium text-slate-400">Sin asignaciones con fechas registradas</p>
        <p className="mt-1 text-xs text-slate-300">
          Asigna fechas de inicio y fin desde el tab Desarrollo de cada requerimiento
        </p>
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
            placeholder="Buscar desarrollador o requerimiento..."
            className="flex-1 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
          />
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1">
          <button onClick={() => setPxDay(p => Math.max(2, p - 1))}
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"><ZoomOut size={14} /></button>
          <span className="w-16 text-center text-xs font-medium text-slate-500">{pxDay} px/día</span>
          <button onClick={() => setPxDay(p => Math.min(14, p + 1))}
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"><ZoomIn size={14} /></button>
        </div>
      </div>

      {/* Gantt */}
      <div className="overflow-auto rounded-xl border border-slate-200 bg-white"
        style={{ maxHeight: 'calc(100vh - 280px)', minHeight: 200 }}>
        <div style={{ minWidth: LEFT_W + totalWidth + 1 }}>

          {/* Cabecera 3 niveles */}
          <div className="sticky top-0 z-20 border-b border-slate-200" style={{ height: HEADER_H }}>

            {/* Año */}
            <div className="flex" style={{ height: YEAR_H }}>
              <div className="sticky left-0 z-30 shrink-0 border-r border-slate-300 bg-slate-100"
                style={{ width: LEFT_W, minWidth: LEFT_W }} />
              <div className="relative shrink-0 bg-slate-100" style={{ width: totalWidth, height: YEAR_H }}>
                {years.map((y, i) => (
                  <div key={i}
                    className="absolute inset-y-0 flex items-center justify-center border-l border-slate-300 text-[10px] font-bold text-slate-600"
                    style={{ left: y.x, width: y.w }}>
                    {y.year}
                  </div>
                ))}
              </div>
            </div>

            {/* Mes */}
            <div className="flex border-t border-slate-200" style={{ height: MONTH_H }}>
              <div className="sticky left-0 z-30 flex shrink-0 items-center border-r border-slate-200 bg-slate-50 px-3"
                style={{ width: LEFT_W, minWidth: LEFT_W }}>
                <span className="text-xs font-semibold text-slate-400">
                  {filtered.length} desarrollador{filtered.length !== 1 ? 'es' : ''}
                </span>
              </div>
              <div className="relative shrink-0 bg-slate-50" style={{ width: totalWidth, height: MONTH_H }}>
                {months.map((m, i) => (
                  <div key={i}
                    className="absolute inset-y-0 flex items-center justify-center border-l border-slate-200 text-[10px] font-semibold text-slate-500"
                    style={{ left: m.x, width: m.w }}>
                    {m.w > 52 ? m.label : m.w > 22 ? m.shortLabel : ''}
                  </div>
                ))}
                {todayX >= 0 && todayX <= totalWidth && (
                  <div className="absolute inset-y-0 w-0.5" style={{ left: todayX, backgroundColor: HOY_COLOR }}>
                    <span className="absolute top-0 left-1 whitespace-nowrap rounded bg-red-400 px-1 py-px text-[8px] font-bold text-white">
                      Hoy
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Semana */}
            <div className="flex border-t border-slate-100" style={{ height: WEEK_H }}>
              <div className="sticky left-0 z-30 shrink-0 border-r border-slate-200 bg-white"
                style={{ width: LEFT_W, minWidth: LEFT_W }} />
              <div className="relative shrink-0 bg-white" style={{ width: totalWidth, height: WEEK_H }}>
                {weeks.map((wk, i) => {
                  const x = Math.max(0, wk.x)
                  const w = wk.x < 0 ? wk.w + wk.x : wk.w
                  if (w <= 0) return null
                  return (
                    <div key={i}
                      className="absolute inset-y-0 flex items-center justify-center border-l border-slate-200 text-[9px] text-slate-500"
                      style={{ left: x, width: w }}>
                      {w > 16 ? `S${wk.weekNum}` : ''}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Filas */}
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-400">
              No hay resultados para la búsqueda
            </div>
          ) : (
            filtered.map((group, i) => (
              <DevRow
                key={group.perfil_id}
                group={group}
                origin={origin}
                pxDay={pxDay}
                weeks={weeks}
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
