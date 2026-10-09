'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronRight, ZoomIn, ZoomOut, ChevronsDownUp, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getEstadoCfg } from '@/lib/constants'
import { ETAPAS_PLANEACION } from '@/lib/etapas-planeacion'
import { buildMonths, buildWeeks, buildYears, getX, monthEnd, toD } from '@/components/cronograma/GanttCronograma'
import type { CumplimientoEtapa, EtapaReporte, RequerimientoPlaneacion } from '@/actions/reporte-planeacion'

// ── Layout (mismas proporciones que el Gantt de Cronograma) ─────────────────
const LEFT_W   = 320
const YEAR_H   = 20
const MONTH_H  = 22
const WEEK_H   = 18
const HEADER_H = YEAR_H + MONTH_H + WEEK_H
const GROUP_H  = 46
const ETAPA_H  = 34
const HOY      = '#f87171'
const TEXTURA_EN_CURSO =
  'linear-gradient(135deg, rgba(255,255,255,.35) 25%, transparent 25%, transparent 50%, rgba(255,255,255,.35) 50%, rgba(255,255,255,.35) 75%, transparent 75%)'

/** Color fijo por etapa: tono claro = planeado, tono sólido = ejecutado */
export const COLOR_ETAPA: Record<string, { plan: string; borde: string; real: string }> = {
  EN_DEFINICION_USUARIO:          { plan: '#e9d5ff', borde: '#c084fc', real: '#9333ea' },
  ANALISIS:                       { plan: '#a5f3fc', borde: '#22d3ee', real: '#0891b2' },
  EN_DESARROLLO:                  { plan: '#c7d2fe', borde: '#818cf8', real: '#4f46e5' },
  PRUEBAS_DE_TESTING_Y_QA:        { plan: '#fbcfe8', borde: '#f472b6', real: '#db2777' },
  PRUEBAS_USUARIO:                { plan: '#fde68a', borde: '#fbbf24', real: '#d97706' },
  PROGRAMADO_PARA_SALIDA_EN_VIVO: { plan: '#a7f3d0', borde: '#34d399', real: '#059669' },
  CERRADO:                        { plan: '#fecdd3', borde: '#fb7185', real: '#be123c' },
}

export const ICONO_CUMPLIMIENTO: Record<CumplimientoEtapa, { simbolo: string; clase: string; label: string }> = {
  A_TIEMPO:        { simbolo: '✓', clase: 'text-emerald-600', label: 'A tiempo' },
  RETRASADA:       { simbolo: '!', clase: 'text-red-600',     label: 'Con retraso' },
  EN_CURSO:        { simbolo: '▶', clase: 'text-blue-600',    label: 'En curso' },
  VENCIDA:         { simbolo: '!', clase: 'text-orange-600',  label: 'En curso vencida' },
  INICIO_ATRASADO: { simbolo: '⏱', clase: 'text-amber-600',   label: 'Inicio atrasado' },
  PENDIENTE:       { simbolo: '○', clase: 'text-slate-400',   label: 'Pendiente' },
  OMITIDA:         { simbolo: '»', clase: 'text-slate-400',   label: 'No ejecutada' },
  SIN_PLAN:        { simbolo: '–', clase: 'text-slate-300',   label: 'Sin planear' },
}

const ALERTAS: CumplimientoEtapa[] = ['RETRASADA', 'VENCIDA', 'INICIO_ATRASADO']

function formatFecha(s: string | null) {
  if (!s) return '—'
  return toD(s).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatDesv(d: number) {
  return d > 0 ? `+${d}d` : `${d}d`
}

const hoyISO = () => new Date().toISOString().slice(0, 10)

/** Tramo planeado y ejecutado de una etapa en coordenadas de la línea de tiempo */
function tramos(e: EtapaReporte, origin: Date, px: number) {
  const hoy = hoyISO()
  const planDesde = e.planInicio ?? e.planFin
  const planHasta = e.planFin ?? e.planInicio
  const realHasta = e.enCurso ? hoy : (e.realFin ?? e.realInicio)

  const plan = planDesde && planHasta ? {
    x: getX(toD(planDesde), origin, px),
    w: Math.max(getX(toD(planHasta), origin, px) - getX(toD(planDesde), origin, px) + px, 6),
  } : null
  const real = e.realInicio && realHasta ? {
    x: getX(toD(e.realInicio), origin, px),
    w: Math.max(getX(toD(realHasta), origin, px) - getX(toD(e.realInicio), origin, px) + px, 6),
  } : null
  return { plan, real }
}

// ── Fondo común de cada fila: semanas + línea de hoy ────────────────────────
function FondoFila({ weeks, todayX, totalWidth }: { weeks: { x: number }[]; todayX: number; totalWidth: number }) {
  return (
    <>
      {weeks.map((wk, i) => wk.x > 0 && (
        <div key={i} className="absolute inset-y-0 w-px bg-slate-100" style={{ left: wk.x }} />
      ))}
      {todayX >= 0 && todayX <= totalWidth && (
        <div className="absolute inset-y-0 w-px bg-red-300/60" style={{ left: todayX }} />
      )}
    </>
  )
}

// ── Fila de etapa: barra planeada arriba, ejecutada abajo ───────────────────
function FilaEtapa({
  etapa, origin, pxDay, weeks, todayX, totalWidth,
}: {
  etapa: EtapaReporte; origin: Date; pxDay: number
  weeks: { x: number }[]; todayX: number; totalWidth: number
}) {
  const color = COLOR_ETAPA[etapa.estado]
  const icono = ICONO_CUMPLIMIENTO[etapa.cumplimiento]
  const { plan, real } = tramos(etapa, origin, pxDay)
  const esHito = etapa.estado === 'CERRADO'
  const desv = etapa.desvFin

  return (
    <div className="flex" style={{ height: ETAPA_H }}>
      <div
        className="sticky left-0 z-10 flex shrink-0 items-center gap-2 border-b border-r border-slate-100 bg-white pl-9 pr-3"
        style={{ width: LEFT_W, minWidth: LEFT_W }}
      >
        <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: color.real }} />
        <span className="min-w-0 flex-1 truncate text-[11px] text-slate-600" title={etapa.label}>{etapa.label}</span>
        <span className={cn('shrink-0 text-[10px] font-semibold', icono.clase)} title={icono.label}>
          {icono.simbolo} {icono.label}
        </span>
      </div>

      <div className="relative shrink-0 border-b border-slate-100 bg-white" style={{ width: totalWidth, height: ETAPA_H }}>
        <FondoFila weeks={weeks} todayX={todayX} totalWidth={totalWidth} />

        {/* Planeado */}
        {plan && (esHito ? (
          <div
            title={`${etapa.label} · planeado: ${formatFecha(etapa.planFin ?? etapa.planInicio)}`}
            className="absolute"
            style={{
              left: plan.x - 5, top: 5, width: 10, height: 10,
              backgroundColor: color.plan, border: `1.5px solid ${color.borde}`, transform: 'rotate(45deg)',
            }}
          />
        ) : (
          <div
            title={`${etapa.label} · planeado: ${formatFecha(etapa.planInicio)} → ${formatFecha(etapa.planFin)}${etapa.duracionPlan != null ? ` (${etapa.duracionPlan}d)` : ''}`}
            className="absolute rounded-[4px]"
            style={{ left: plan.x, width: plan.w, top: 5, height: 10, backgroundColor: color.plan, border: `1px solid ${color.borde}` }}
          />
        ))}

        {/* Ejecutado */}
        {real && (esHito ? (
          <div
            title={`${etapa.label} · ejecutado: ${formatFecha(etapa.realInicio)}`}
            className="absolute rounded-full border-2 border-white shadow-sm"
            style={{ left: real.x - 6, top: 17, width: 12, height: 12, backgroundColor: color.real }}
          />
        ) : (
          <div
            title={`${etapa.label} · ejecutado: ${formatFecha(etapa.realInicio)} → ${etapa.enCurso ? 'en curso' : formatFecha(etapa.realFin)}${etapa.duracionReal != null ? ` (${etapa.duracionReal}d)` : ''} · ${icono.label}`}
            className="absolute rounded-[4px]"
            style={{
              left: real.x, width: real.w, top: 18, height: 11, backgroundColor: color.real,
              // En curso: textura diagonal para distinguirla de una etapa terminada
              ...(etapa.enCurso && { backgroundImage: TEXTURA_EN_CURSO, backgroundSize: '8px 8px' }),
            }}
          />
        ))}

        {/* Desviación del fin, junto a la barra ejecutada */}
        {real && desv != null && desv !== 0 && (
          <span
            className={cn('absolute whitespace-nowrap text-[10px] font-semibold', desv > 0 ? 'text-red-600' : 'text-emerald-600')}
            style={{ left: real.x + (esHito ? 10 : real.w + 4), top: 17 }}
          >
            {formatDesv(desv)}
          </span>
        )}
      </div>
    </div>
  )
}

// ── Fila de requerimiento: resumen compacto de todas sus etapas ─────────────
function FilaRequerimiento({
  req, abierto, onToggle, origin, pxDay, weeks, todayX, totalWidth, isEven,
}: {
  req: RequerimientoPlaneacion; abierto: boolean; onToggle: () => void
  origin: Date; pxDay: number; weeks: { x: number }[]; todayX: number; totalWidth: number; isEven: boolean
}) {
  const estadoCfg = getEstadoCfg(req.estado)
  const alertas = req.etapas.filter(e => ALERTAS.includes(e.cumplimiento)).length
  const etapas = req.etapas.filter(e => e.cumplimiento !== 'SIN_PLAN' || e.realInicio)

  return (
    <div className="flex" style={{ height: GROUP_H }}>
      <div
        className={cn(
          'sticky left-0 z-10 flex shrink-0 items-center gap-2 border-b border-r border-slate-200 px-3',
          isEven ? 'bg-slate-50' : 'bg-white'
        )}
        style={{ width: LEFT_W, minWidth: LEFT_W }}
      >
        <button onClick={onToggle} className="rounded p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600" aria-label={abierto ? 'Contraer' : 'Expandir'}>
          {abierto ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        <div className="min-w-0 flex-1">
          <Link
            href={`/admin/requerimientos/${req.id}`}
            className="block truncate text-xs font-medium text-slate-700 hover:text-blue-600"
            title={req.nombre}
          >
            {req.numero && <span className="mr-1 font-mono text-[10px] text-slate-400">#{req.numero}</span>}
            {req.nombre}
          </Link>
          <div className="mt-0.5 flex items-center gap-1.5">
            <span className={cn('inline-block rounded-full px-1.5 py-px text-[10px] font-medium leading-none', estadoCfg.bgColor, estadoCfg.textColor)}>
              {estadoCfg.label}
            </span>
            {alertas > 0 && (
              <span className="text-[10px] font-semibold text-red-600">{alertas} con alerta</span>
            )}
          </div>
        </div>
      </div>

      <div
        className={cn('relative shrink-0 cursor-pointer border-b border-slate-200', isEven ? 'bg-slate-50/30' : 'bg-white')}
        style={{ width: totalWidth, height: GROUP_H }}
        onClick={onToggle}
      >
        <FondoFila weeks={weeks} todayX={todayX} totalWidth={totalWidth} />
        {etapas.map(e => {
          const { plan, real } = tramos(e, origin, pxDay)
          const color = COLOR_ETAPA[e.estado]
          return (
            <div key={e.estado}>
              {plan && (
                <div
                  title={`${e.label} · planeado: ${formatFecha(e.planInicio)} → ${formatFecha(e.planFin)}`}
                  className="absolute rounded-[3px]"
                  style={{ left: plan.x, width: plan.w, top: 9, height: 11, backgroundColor: color.plan, border: `1px solid ${color.borde}` }}
                />
              )}
              {real && (
                <div
                  title={`${e.label} · ejecutado: ${formatFecha(e.realInicio)} → ${e.enCurso ? 'en curso' : formatFecha(e.realFin)}`}
                  className="absolute rounded-[3px]"
                  style={{ left: real.x, width: real.w, top: 24, height: 11, backgroundColor: color.real }}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Gantt ───────────────────────────────────────────────────────────────────
export function GanttPlaneacion({ requerimientos }: { requerimientos: RequerimientoPlaneacion[] }) {
  const [pxDay, setPxDay] = useState(4)
  // Con pocos requerimientos se muestran desplegados por defecto
  const [abiertos, setAbiertos] = useState<Set<string>>(
    () => new Set(requerimientos.length <= 5 ? requerimientos.map(r => r.id) : [])
  )

  const toggle = (id: string) => setAbiertos(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })
  const todosAbiertos = requerimientos.length > 0 && requerimientos.every(r => abiertos.has(r.id))

  const { origin, end, totalDays } = useMemo(() => {
    const fechas = requerimientos
      .flatMap(r => r.etapas.flatMap(e => [e.planInicio, e.planFin, e.realInicio, e.realFin]))
      .filter((d): d is string => !!d)
      .map(toD)
    fechas.push(new Date())
    const minD = new Date(Math.min(...fechas.map(d => d.getTime())))
    const maxD = new Date(Math.max(...fechas.map(d => d.getTime())))
    const o = new Date(minD.getFullYear(), minD.getMonth(), 1)
    const e = monthEnd(new Date(maxD.getFullYear(), maxD.getMonth() + 1, 1))
    return { origin: o, end: e, totalDays: Math.ceil((e.getTime() - o.getTime()) / 86400000) }
  }, [requerimientos])

  const years      = useMemo(() => buildYears(origin, end, pxDay),  [origin, end, pxDay])
  const months     = useMemo(() => buildMonths(origin, end, pxDay), [origin, end, pxDay])
  const weeks      = useMemo(() => buildWeeks(origin, end, pxDay),  [origin, end, pxDay])
  const totalWidth = totalDays * pxDay
  const todayX     = getX(new Date(), origin, pxDay)

  return (
    <div className="space-y-3">
      {/* Controles del Gantt */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => setAbiertos(todosAbiertos ? new Set() : new Set(requerimientos.map(r => r.id)))}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          {todosAbiertos ? <ChevronsDownUp size={14} /> : <ChevronsUpDown size={14} />}
          {todosAbiertos ? 'Contraer todo' : 'Expandir todo'}
        </button>
        <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1">
          <button onClick={() => setPxDay(p => Math.max(2, p - 1))}
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100" aria-label="Alejar"><ZoomOut size={14} /></button>
          <span className="w-16 text-center text-xs font-medium text-slate-500">{pxDay} px/día</span>
          <button onClick={() => setPxDay(p => Math.min(10, p + 1))}
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100" aria-label="Acercar"><ZoomIn size={14} /></button>
        </div>
      </div>

      {/* Leyenda */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 rounded-lg border border-slate-100 bg-slate-50 px-4 py-2 text-[11px] text-slate-600">
        <span className="font-semibold text-slate-400">Leyenda</span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-8 rounded-[3px] border border-slate-400 bg-slate-200" /> Planeado (tono claro)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-8 rounded-[3px] bg-slate-600" /> Ejecutado (tono sólido)
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-8 rounded-[3px] bg-slate-600"
            style={{ backgroundImage: TEXTURA_EN_CURSO, backgroundSize: '8px 8px' }}
          /> En curso
        </span>
        <span className="flex items-center gap-1.5"><span className="font-semibold text-red-600">+Nd</span> días de retraso al cierre</span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3" style={{ backgroundColor: HOY, width: 2 }} /> Hoy
        </span>
        <span className="mx-1 h-3 w-px bg-slate-200" />
        {ETAPAS_PLANEACION.map(e => (
          <span key={e.estado} className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: COLOR_ETAPA[e.estado].real }} />
            {e.label}
          </span>
        ))}
      </div>

      {/* Gantt */}
      <div className="overflow-auto rounded-xl border border-slate-200 bg-white" style={{ maxHeight: 'calc(100vh - 260px)', minHeight: 200 }}>
        <div style={{ minWidth: LEFT_W + totalWidth + 1 }}>
          {/* Cabecera 3 niveles: Año / Mes / Semana */}
          <div className="sticky top-0 z-20 border-b border-slate-200" style={{ height: HEADER_H }}>
            <div className="flex" style={{ height: YEAR_H }}>
              <div className="sticky left-0 z-30 shrink-0 border-r border-slate-300 bg-slate-100" style={{ width: LEFT_W, minWidth: LEFT_W }} />
              <div className="relative shrink-0 bg-slate-100" style={{ width: totalWidth, height: YEAR_H }}>
                {years.map((y, i) => (
                  <div key={i} className="absolute inset-y-0 flex items-center justify-center border-l border-slate-300 text-[10px] font-bold text-slate-600"
                    style={{ left: y.x, width: y.w }}>
                    {y.year}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex border-t border-slate-200" style={{ height: MONTH_H }}>
              <div className="sticky left-0 z-30 flex shrink-0 items-center border-r border-slate-200 bg-slate-50 px-3" style={{ width: LEFT_W, minWidth: LEFT_W }}>
                <span className="text-xs font-semibold text-slate-400">
                  {requerimientos.length} requerimiento{requerimientos.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="relative shrink-0 bg-slate-50" style={{ width: totalWidth, height: MONTH_H }}>
                {months.map((m, i) => (
                  <div key={i} className="absolute inset-y-0 flex items-center justify-center border-l border-slate-200 text-[10px] font-semibold text-slate-500"
                    style={{ left: m.x, width: m.w }}>
                    {m.w > 52 ? m.label : m.w > 22 ? m.shortLabel : ''}
                  </div>
                ))}
                {todayX >= 0 && todayX <= totalWidth && (
                  <div className="absolute inset-y-0 w-0.5" style={{ left: todayX, backgroundColor: HOY }}>
                    <span className="absolute top-0 left-1 whitespace-nowrap rounded bg-red-400 px-1 py-px text-[8px] font-bold text-white">Hoy</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex border-t border-slate-100" style={{ height: WEEK_H }}>
              <div className="sticky left-0 z-30 flex shrink-0 items-center border-r border-slate-200 bg-white px-3 text-[10px] text-slate-400" style={{ width: LEFT_W, minWidth: LEFT_W }}>
                Arriba planeado · abajo ejecutado
              </div>
              <div className="relative shrink-0 bg-white" style={{ width: totalWidth, height: WEEK_H }}>
                {weeks.map((wk, i) => {
                  const x = Math.max(0, wk.x)
                  const w = wk.x < 0 ? wk.w + wk.x : wk.w
                  if (w <= 0) return null
                  return (
                    <div key={i} className="absolute inset-y-0 flex items-center justify-center border-l border-slate-200 text-[9px] text-slate-500"
                      style={{ left: x, width: w }}>
                      {w > 16 ? `S${wk.weekNum}` : ''}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Filas */}
          {requerimientos.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-400">No hay resultados para los filtros aplicados</div>
          ) : (
            requerimientos.map((req, i) => (
              <div key={req.id}>
                <FilaRequerimiento
                  req={req}
                  abierto={abiertos.has(req.id)}
                  onToggle={() => toggle(req.id)}
                  origin={origin} pxDay={pxDay} weeks={weeks} todayX={todayX} totalWidth={totalWidth}
                  isEven={i % 2 === 0}
                />
                {abiertos.has(req.id) && req.etapas.map(e => (
                  <FilaEtapa
                    key={e.estado}
                    etapa={e}
                    origin={origin} pxDay={pxDay} weeks={weeks} todayX={todayX} totalWidth={totalWidth}
                  />
                ))}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
