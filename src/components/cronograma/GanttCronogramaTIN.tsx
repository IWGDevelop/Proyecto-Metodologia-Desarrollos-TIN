'use client'

import { useState, useMemo, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ZoomIn, ZoomOut, Calendar, Search, Pencil, Check, X, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AsignacionCronograma } from '@/actions/desarrolladores-req'
import { actualizarFechasDesarrollador } from '@/actions/desarrolladores-req'

interface Props { asignaciones: AsignacionCronograma[] }

interface ReqGroup {
  requerimiento_id: string
  nombre_desarrollo: string | null
  identificacion: string
  numero: string | null
  estado: string
  prioridad: number | null
  sub_prioridad: number | null
  parent_id: string | null
  devs: AsignacionCronograma[]
}

// ── Layout constants ─────────────────────────────────────────────────────────
const REQ_COL_W = 260
const DEV_COL_W = 200
const LEFT_W    = REQ_COL_W + DEV_COL_W

const YEAR_H   = 20
const MONTH_H  = 22
const WEEK_H   = 18
const HEADER_H = YEAR_H + MONTH_H + WEEK_H   // 60

const ROW_H = 44
const BAR_H = 26
const BAR_Y = (ROW_H - BAR_H) / 2

// ── Bar color palette ─────────────────────────────────────────────────────────
const PALETTE = [
  '#3b82f6', '#10b981', '#f59e0b',
  '#ef4444', '#ec4899', '#06b6d4', '#84cc16',
  '#f97316', '#64748b',
]

// Colores fijos por proceso
const COLOR_IA = '#7c3aed'   // violeta intenso
const COLOR_TI = '#0369a1'   // azul marino

function barColor(proceso: string | null, fallbackIdx: number): string {
  if (proceso === 'IA') return COLOR_IA
  if (proceso === 'TI') return COLOR_TI
  return PALETTE[fallbackIdx % PALETTE.length]
}

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

function fmtDate(d: Date) {
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
}

function addDays(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
}

function isoStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function previewLabel(left: number, width: number, origin: Date, pxDay: number) {
  const startDays = Math.round(left / pxDay)
  const endDays   = Math.max(startDays, Math.round((left + width) / pxDay) - 1)
  return `${fmtDate(addDays(origin, startDays))} → ${fmtDate(addDays(origin, endDays))}`
}

type DragType = 'move' | 'resize-left' | 'resize-right'
interface DragState {
  key: string
  asig: AsignacionCronograma
  type: DragType
  startMouseX: number
  origLeft: number
  origWidth: number
  pxDay: number
  origin: Date
}

function calcDragResult(d: DragState, mouseX: number) {
  const snapDx = Math.round((mouseX - d.startMouseX) / d.pxDay) * d.pxDay
  let left  = d.origLeft
  let width = d.origWidth
  if (d.type === 'move') {
    left = Math.max(0, d.origLeft + snapDx)
  } else if (d.type === 'resize-right') {
    width = Math.max(d.pxDay, d.origWidth + snapDx)
  } else {
    const shift = Math.max(-d.origLeft, Math.min(d.origWidth - d.pxDay, snapDx))
    left  = d.origLeft + shift
    width = d.origWidth - shift
  }
  return { left, width }
}

// ── Fila de requerimiento (col-1 combina todas las filas de dev) ─────────────
function ReqRow({
  group, origin, pxDay, weeks, totalWidth, isEven, todayX,
}: {
  group: ReqGroup; origin: Date; pxDay: number
  weeks: { x: number }[]; totalWidth: number; isEven: boolean; todayX: number
}) {
  const router = useRouter()

  // ── Edit state (entrada manual exacta) ────────────────────────────────────
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [editInicio, setEditInicio] = useState('')
  const [editFin,    setEditFin]    = useState('')
  const [saving,     setSaving]     = useState(false)

  const startEdit = (asig: AsignacionCronograma) => {
    setEditingKey(`${asig.requerimiento_id}-${asig.perfil_id}`)
    setEditInicio(asig.fecha_inicio_estimada ?? '')
    setEditFin(asig.fecha_fin_estimada ?? '')
  }
  const cancelEdit = () => setEditingKey(null)
  const handleSave = async (asig: AsignacionCronograma) => {
    setSaving(true)
    const res = await actualizarFechasDesarrollador(
      asig.requerimiento_id, asig.perfil_id, editInicio || null, editFin || null
    )
    setSaving(false)
    if (res.ok) { setEditingKey(null); router.refresh() }
  }

  // ── Drag state ────────────────────────────────────────────────────────────
  const dragRef  = useRef<DragState | null>(null)
  const [dragPreview, setDragPreview] = useState<{ key: string; left: number; width: number } | null>(null)

  const onBarMouseDown = (
    e: React.MouseEvent,
    asig: AsignacionCronograma,
    type: DragType,
    barLeft: number,
    barWidth: number,
  ) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()

    const key = `${asig.requerimiento_id}-${asig.perfil_id}`
    dragRef.current = { key, asig, type, startMouseX: e.clientX, origLeft: barLeft, origWidth: barWidth, pxDay, origin }
    setDragPreview({ key, left: barLeft, width: barWidth })

    document.body.style.cursor    = type === 'move' ? 'grabbing' : 'ew-resize'
    document.body.style.userSelect = 'none'

    const onMove = (ev: MouseEvent) => {
      const d = dragRef.current
      if (!d) return
      const { left, width } = calcDragResult(d, ev.clientX)
      setDragPreview({ key: d.key, left, width })
    }

    const onUp = async (ev: MouseEvent) => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup',   onUp)
      document.body.style.cursor     = ''
      document.body.style.userSelect = ''

      const d = dragRef.current
      dragRef.current = null
      setDragPreview(null)
      if (!d) return

      const { left, width } = calcDragResult(d, ev.clientX)
      if (left === d.origLeft && width === d.origWidth) return   // sin cambio

      const startDays = Math.round(left / d.pxDay)
      const endDays   = Math.max(startDays, Math.round((left + width) / d.pxDay) - 1)
      await actualizarFechasDesarrollador(
        d.asig.requerimiento_id, d.asig.perfil_id,
        isoStr(addDays(d.origin, startDays)),
        isoStr(addDays(d.origin, endDays)),
      )
      router.refresh()
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup',   onUp)
  }

  const bg      = isEven ? 'bg-indigo-50' : 'bg-white'
  const bgGantt = isEven ? 'bg-indigo-50' : 'bg-white'
  const groupH  = group.devs.length * ROW_H

  return (
    <div className="flex border-t-2 border-slate-300" style={{ minHeight: groupH }}>

      {/* Columna 1: nombre del requerimiento — abarca todas las filas del grupo */}
      <div
        className={cn(
          'sticky left-0 z-10 flex shrink-0 items-start border-b border-r border-slate-300 px-3 pt-3',
          bg
        )}
        style={{ width: REQ_COL_W, minWidth: REQ_COL_W, minHeight: groupH }}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-1.5">
            {group.numero && (
              <span className="mt-0.5 shrink-0 text-[10px] font-bold text-indigo-500">#{group.numero}</span>
            )}
            <Link
              href={`/admin/requerimientos/${group.requerimiento_id}`}
              className="text-sm font-semibold text-slate-700 hover:text-indigo-600 break-words leading-snug"
            >
              {group.nombre_desarrollo ?? group.identificacion}
            </Link>
          </div>
          {group.parent_id && (
            <span className="mt-0.5 block text-[10px] text-slate-400">Sub-requerimiento</span>
          )}
        </div>
      </div>

      {/* Columna 2 + Gantt: una sub-fila por desarrollador */}
      <div className="flex flex-1 flex-col">
        {group.devs.map((asig, devIdx) => {
          const isLastDev  = devIdx === group.devs.length - 1
          const devBorderB = isLastDev ? 'border-b border-slate-300' : 'border-b border-slate-200'
          const rowKey     = `${asig.requerimiento_id}-${asig.perfil_id}`
          const isEditing  = editingKey === rowKey
          const isDragging = dragPreview?.key === rowKey

          const startD = asig.fecha_inicio_estimada ? toD(asig.fecha_inicio_estimada) : null
          const endD   = asig.fecha_fin_estimada    ? toD(asig.fecha_fin_estimada)    : null
          const hasBar = !!(startD && endD)
          const baseX  = hasBar ? getX(startD!, origin, pxDay) : 0
          const baseW  = hasBar ? Math.max(getX(endD!, origin, pxDay) - baseX + pxDay, pxDay) : 0

          // Posición real (preview durante drag, calculada si no)
          const barLeft  = isDragging ? dragPreview!.left  : baseX
          const barWidth = isDragging ? dragPreview!.width : baseW

          const color  = barColor(asig.proceso_interno, devIdx)
          const hereda = asig.fechas_heredadas

          const barLabel = isDragging
            ? previewLabel(barLeft, barWidth, origin, pxDay)
            : `${fmtCorta(asig.fecha_inicio_estimada)} → ${fmtCorta(asig.fecha_fin_estimada)}`

          return (
            <div key={rowKey} className="flex" style={{ height: ROW_H }}>

              {/* Columna 2: desarrollador + cargo + botón editar manual */}
              <div
                className={cn(
                  'sticky z-10 flex shrink-0 items-center gap-2 border-r border-slate-200 px-3',
                  devBorderB, bg
                )}
                style={{ left: REQ_COL_W, width: DEV_COL_W, minWidth: DEV_COL_W }}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-slate-700">{asig.nombre_desarrollador}</p>
                  {asig.cargo && (
                    <span className="block truncate text-[10px] text-slate-400">{asig.cargo}</span>
                  )}
                </div>
                <button
                  onClick={() => isEditing ? cancelEdit() : startEdit(asig)}
                  className={cn(
                    'shrink-0 rounded p-1 transition-colors',
                    isEditing
                      ? 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                      : 'text-slate-300 hover:bg-indigo-50 hover:text-indigo-500'
                  )}
                  title={isEditing ? 'Cancelar' : 'Editar fechas manualmente'}
                >
                  <Pencil size={12} />
                </button>
              </div>

              {/* Área Gantt */}
              <div
                className={cn('relative shrink-0', devBorderB, bgGantt)}
                style={{ width: totalWidth, height: ROW_H }}
              >
                {/* Líneas de semana */}
                {weeks.map((wk, i) => wk.x > 0 && (
                  <div key={i} className="absolute inset-y-0 w-px bg-slate-200" style={{ left: wk.x }} />
                ))}

                {/* Línea de hoy */}
                {todayX >= 0 && todayX <= totalWidth && (
                  <div className="absolute inset-y-0 w-px" style={{ left: todayX, backgroundColor: HOY_COLOR, opacity: 0.7 }} />
                )}

                {/* Panel de edición manual */}
                {isEditing && (
                  <div className="absolute inset-y-0 left-0 z-20 flex items-center gap-2 rounded-r-lg border-r border-slate-200 bg-white px-3 shadow-md"
                    style={{ minWidth: 340 }}>
                    <span className="shrink-0 text-[10px] font-medium text-slate-400">Inicio</span>
                    <input type="date" value={editInicio} onChange={e => setEditInicio(e.target.value)}
                      className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-700 focus:border-indigo-400 focus:outline-none" />
                    <span className="shrink-0 text-slate-300">→</span>
                    <span className="shrink-0 text-[10px] font-medium text-slate-400">Fin</span>
                    <input type="date" value={editFin} onChange={e => setEditFin(e.target.value)}
                      className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-700 focus:border-indigo-400 focus:outline-none" />
                    <button onClick={() => handleSave(asig)} disabled={saving}
                      className="flex shrink-0 items-center gap-1 rounded-md bg-indigo-500 px-2.5 py-1 text-xs font-semibold text-white hover:bg-indigo-600 disabled:opacity-50">
                      <Check size={11} />{saving ? 'Guardando…' : 'Guardar'}
                    </button>
                    <button onClick={cancelEdit}
                      className="shrink-0 rounded-md p-1 text-slate-400 hover:bg-slate-100">
                      <X size={13} />
                    </button>
                  </div>
                )}

                {/* Barra draggable */}
                {hasBar && !isEditing && (
                  <div
                    onMouseDown={(e) => onBarMouseDown(e, asig, 'move', baseX, baseW)}
                    title={`${asig.nombre_desarrollador} · ${barLabel}${hereda ? ' (heredadas del padre)' : ''}\nArrastra para mover · Bordes para redimensionar`}
                    className="absolute flex items-center overflow-visible select-none"
                    style={{
                      left:            barLeft,
                      width:           barWidth,
                      top:             BAR_Y,
                      height:          BAR_H,
                      backgroundColor: hereda ? 'transparent' : color,
                      border:          hereda || isDragging ? `2px dashed ${color}` : 'none',
                      opacity:         isDragging ? 0.75 : (hereda ? 0.75 : 1),
                      boxShadow:       isDragging || hereda ? 'none' : '0 1px 3px rgba(0,0,0,0.2)',
                      borderRadius:    6,
                      cursor:          'grab',
                      zIndex:          isDragging ? 20 : 1,
                    } as React.CSSProperties}
                  >
                    {/* Handle izquierdo — resize inicio */}
                    <div
                      onMouseDown={(e) => { e.stopPropagation(); onBarMouseDown(e, asig, 'resize-left', baseX, baseW) }}
                      className="absolute inset-y-0 left-0 z-10 flex items-center justify-center rounded-l"
                      style={{ width: 8, cursor: 'ew-resize', backgroundColor: 'rgba(0,0,0,0.15)' }}
                    />

                    {/* Etiqueta de fechas */}
                    {barWidth > 72 && (
                      <span
                        className="flex-1 truncate px-2 text-[10px] font-semibold leading-none pointer-events-none"
                        style={{ color: hereda ? color : 'rgba(255,255,255,0.95)' }}
                      >
                        {barLabel}
                      </span>
                    )}

                    {/* Enlace al requerimiento (hover) */}
                    {barWidth > 44 && (
                      <Link
                        href={`/admin/requerimientos/${asig.requerimiento_id}`}
                        onClick={e => e.stopPropagation()}
                        onMouseDown={e => e.stopPropagation()}
                        title="Abrir requerimiento"
                        className="mr-1 shrink-0 rounded p-0.5 opacity-0 hover:opacity-100 group-hover:opacity-60 transition-opacity"
                        style={{ color: hereda ? color : 'rgba(255,255,255,0.8)' }}
                      >
                        <ExternalLink size={10} />
                      </Link>
                    )}

                    {/* Handle derecho — resize fin */}
                    <div
                      onMouseDown={(e) => { e.stopPropagation(); onBarMouseDown(e, asig, 'resize-right', baseX, baseW) }}
                      className="absolute inset-y-0 right-0 z-10 flex items-center justify-center rounded-r"
                      style={{ width: 8, cursor: 'ew-resize', backgroundColor: 'rgba(0,0,0,0.15)' }}
                    />
                  </div>
                )}
              </div>
            </div>
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

  // Agrupar por requerimiento
  const groups = useMemo<ReqGroup[]>(() => {
    const map = new Map<string, ReqGroup>()
    asignaciones.forEach(a => {
      if (!map.has(a.requerimiento_id)) {
        map.set(a.requerimiento_id, {
          requerimiento_id: a.requerimiento_id,
          nombre_desarrollo: a.nombre_desarrollo,
          identificacion:    a.identificacion,
          numero:            a.numero,
          estado:            a.estado,
          prioridad:         a.prioridad,
          sub_prioridad:     a.sub_prioridad,
          parent_id:         a.parent_id,
          devs: [],
        })
      }
      map.get(a.requerimiento_id)!.devs.push(a)
    })

    return [...map.values()].sort((a, b) => {
      // Padres antes que hijos
      if (!a.parent_id && b.parent_id) return -1
      if (a.parent_id && !b.parent_id) return 1
      const pa = a.prioridad     ?? 9999
      const pb = b.prioridad     ?? 9999
      if (pa !== pb) return pa - pb
      const sa = a.sub_prioridad ?? 9999
      const sb = b.sub_prioridad ?? 9999
      return sa - sb
    })
  }, [asignaciones])

  const filtered = useMemo(() => {
    if (!search.trim()) return groups
    const q = search.toLowerCase()
    return groups
      .map(g => {
        const reqMatch = (g.nombre_desarrollo ?? g.identificacion).toLowerCase().includes(q)
        if (reqMatch) return g
        const devs = g.devs.filter(d => d.nombre_desarrollador.toLowerCase().includes(q))
        return devs.length > 0 ? { ...g, devs } : null
      })
      .filter(Boolean) as ReqGroup[]
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

  const totalRows = filtered.reduce((acc, g) => acc + g.devs.length, 0)

  return (
    <div className="space-y-3">
      {/* Controles */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-52 flex-1 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2">
          <Search size={13} className="shrink-0 text-slate-400" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar requerimiento o desarrollador..."
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

            {/* Mes — cabeceras de columnas izquierdas */}
            <div className="flex border-t border-slate-200" style={{ height: MONTH_H }}>
              {/* Encabezado col 1 */}
              <div
                className="sticky left-0 z-30 flex shrink-0 items-center border-r border-slate-200 bg-slate-50 px-3"
                style={{ width: REQ_COL_W, minWidth: REQ_COL_W }}
              >
                <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Requerimiento</span>
              </div>
              {/* Encabezado col 2 */}
              <div
                className="sticky z-30 flex shrink-0 items-center border-r border-slate-200 bg-slate-50 px-3"
                style={{ left: REQ_COL_W, width: DEV_COL_W, minWidth: DEV_COL_W }}
              >
                <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                  Desarrollador · {totalRows} fila{totalRows !== 1 ? 's' : ''}
                </span>
              </div>
              {/* Meses */}
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
              <ReqRow
                key={group.requerimiento_id}
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
