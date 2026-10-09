'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronRight, ZoomIn, ZoomOut, ChevronsDownUp, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getEstadoCfg } from '@/lib/constants'
import { ETAPAS_PLANEACION } from '@/lib/etapas-planeacion'
import type { CumplimientoEtapa, EtapaReporte, RequerimientoPlaneacion } from '@/actions/reporte-planeacion'

// ── Layout: escala diaria ───────────────────────────────────────────────────
const LEFT_W   = 320
const MES_H    = 30
const DIA_H    = 40
const HEADER_H = MES_H + DIA_H
const GROUP_H  = 46
const CARRIL_H = 34
const BARRA_H  = 22
const BARRA_Y  = (CARRIL_H - BARRA_H) / 2
const FINDE_W  = 10            // sábados y domingos: columna angosta rayada, sin etiqueta
const NAVY     = '#0f2a47'
const DIAS_LETRA = ['D', 'L', 'M', 'X', 'J', 'V', 'S']
const TEXTURA_EN_CURSO =
  'linear-gradient(135deg, rgba(255,255,255,.35) 25%, transparent 25%, transparent 50%, rgba(255,255,255,.35) 50%, rgba(255,255,255,.35) 75%, transparent 75%)'
const RAYADO_FINDE = 'repeating-linear-gradient(135deg, #f1f5f9 0 3px, #e2e8f0 3px 5px)'

/** Color fijo por etapa: tono claro = planeado, tono sólido = ejecutado (texto = tinta legible sobre el sólido) */
export const COLOR_ETAPA: Record<string, { plan: string; borde: string; real: string; texto: string }> = {
  EN_DEFINICION_USUARIO:          { plan: '#e9d5ff', borde: '#c084fc', real: '#9333ea', texto: '#ffffff' },
  ANALISIS:                       { plan: '#a5f3fc', borde: '#22d3ee', real: '#0891b2', texto: '#ffffff' },
  EN_DESARROLLO:                  { plan: '#c7d2fe', borde: '#818cf8', real: '#4f46e5', texto: '#ffffff' },
  PRUEBAS_DE_TESTING_Y_QA:        { plan: '#fbcfe8', borde: '#f472b6', real: '#db2777', texto: '#ffffff' },
  PRUEBAS_USUARIO:                { plan: '#fde68a', borde: '#fbbf24', real: '#d97706', texto: '#1c1917' },
  PROGRAMADO_PARA_SALIDA_EN_VIVO: { plan: '#a7f3d0', borde: '#34d399', real: '#059669', texto: '#ffffff' },
  CERRADO:                        { plan: '#fecdd3', borde: '#fb7185', real: '#be123c', texto: '#ffffff' },
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

// ── Fechas ──────────────────────────────────────────────────────────────────
const toD = (s: string) => new Date(s + 'T12:00:00')
const isoLocal = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const HOY_ISO = isoLocal(new Date())

function formatFecha(s: string | null) {
  if (!s) return '—'
  return toD(s).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatDesv(d: number) {
  return d > 0 ? `+${d}d` : `${d}d`
}

interface Dia { iso: string; fecha: Date; x: number; w: number; finde: boolean }

interface Escala {
  dias: Dia[]
  porIso: Map<string, Dia>
  totalWidth: number
}

/** Columnas diarias de lunes a domingo: los días hábiles con ancho completo y el fin de semana angosto */
function construirEscala(desde: Date, hasta: Date, dayW: number): Escala {
  const dias: Dia[] = []
  let x = 0
  for (let d = new Date(desde); d <= hasta; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
    const finde = d.getDay() === 0 || d.getDay() === 6
    const w = finde ? FINDE_W : dayW
    dias.push({ iso: isoLocal(d), fecha: d, x, w, finde })
    x += w
  }
  return { dias, porIso: new Map(dias.map(d => [d.iso, d])), totalWidth: x }
}

function tramo(escala: Escala, desde: string | null, hasta: string | null) {
  if (!desde || !hasta) return null
  const a = escala.porIso.get(desde)
  const b = escala.porIso.get(hasta)
  if (!a || !b) return null
  return { x: a.x, w: Math.max(b.x + b.w - a.x, 6) }
}

/** Tramo planeado y ejecutado de una etapa en coordenadas de la escala */
function tramos(e: EtapaReporte, escala: Escala) {
  return {
    plan: tramo(escala, e.planInicio ?? e.planFin, e.planFin ?? e.planInicio),
    real: tramo(escala, e.realInicio, e.enCurso ? HOY_ISO : (e.realFin ?? e.realInicio)),
  }
}

// ── Cuadrícula de fondo (una sola capa para todas las filas) ────────────────
function Cuadricula({ escala }: { escala: Escala }) {
  return (
    <div className="pointer-events-none absolute inset-y-0" style={{ left: LEFT_W, width: escala.totalWidth }}>
      {escala.dias.map(d => {
        const esHoy = d.iso === HOY_ISO
        const inicioMes = d.fecha.getDate() === 1
        if (d.finde) {
          return <div key={d.iso} className="absolute inset-y-0" style={{ left: d.x, width: d.w, backgroundImage: RAYADO_FINDE }} />
        }
        return (
          <div
            key={d.iso}
            className={cn(
              'absolute inset-y-0 border-l',
              esHoy ? 'border-amber-300 bg-amber-50' : inicioMes ? 'border-slate-300' : 'border-slate-100'
            )}
            style={{ left: d.x, width: d.w, ...(esHoy && { borderRight: '1px solid #fcd34d' }) }}
          />
        )
      })}
    </div>
  )
}

// ── Cabecera: mes / día ─────────────────────────────────────────────────────
function Cabecera({ escala, total }: { escala: Escala; total: number }) {
  const meses = useMemo(() => {
    const out: { clave: string; label: string; x: number; w: number }[] = []
    for (const d of escala.dias) {
      const clave = `${d.fecha.getFullYear()}-${d.fecha.getMonth()}`
      const ultimo = out[out.length - 1]
      if (ultimo?.clave === clave) ultimo.w += d.w
      else out.push({
        clave,
        label: `${d.fecha.toLocaleDateString('es-CO', { month: 'short' }).replace('.', '').toUpperCase()} ${d.fecha.getFullYear()}`,
        x: d.x, w: d.w,
      })
    }
    return out
  }, [escala])

  return (
    <div className="sticky top-0 z-20 flex" style={{ height: HEADER_H, backgroundColor: NAVY }}>
      <div
        className="sticky left-0 z-30 flex shrink-0 flex-col justify-center border-r border-white/10 px-4"
        style={{ width: LEFT_W, minWidth: LEFT_W, backgroundColor: NAVY }}
      >
        <span className="text-xs font-bold uppercase tracking-wide text-white">Requerimiento</span>
        <span className="mt-0.5 text-[10px] text-slate-300">
          {total} requerimiento{total !== 1 ? 's' : ''} · renglón planeado y ejecutado
        </span>
      </div>
      <div className="relative shrink-0" style={{ width: escala.totalWidth }}>
        {/* Mes */}
        <div className="relative" style={{ height: MES_H }}>
          {meses.map(m => (
            <div
              key={m.clave}
              className="absolute inset-y-0 flex items-center overflow-hidden border-l border-white/20 px-2.5 text-[11px] font-bold tracking-wider text-white"
              style={{ left: m.x, width: m.w }}
            >
              <span className="truncate">{m.w > 70 ? m.label : ''}</span>
            </div>
          ))}
        </div>
        {/* Día */}
        <div className="relative" style={{ height: DIA_H }}>
          {escala.dias.map(d => {
            const esHoy = d.iso === HOY_ISO
            if (d.finde) {
              return <div key={d.iso} className="absolute inset-y-0 bg-white/5" style={{ left: d.x, width: d.w }} />
            }
            return (
              <div
                key={d.iso}
                className={cn(
                  'absolute inset-y-0 flex flex-col items-center justify-center border-l leading-tight',
                  esHoy ? 'border-amber-300 bg-amber-400 text-slate-900' : 'border-white/10 text-white'
                )}
                style={{ left: d.x, width: d.w }}
                title={d.fecha.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              >
                <span className={cn('text-[9px] font-semibold', esHoy ? 'text-slate-800' : 'text-slate-300')}>
                  {DIAS_LETRA[d.fecha.getDay()]}
                </span>
                <span className="text-xs font-bold">{d.fecha.getDate()}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Renglón Planeado / Ejecutado: una barra por etapa con su nombre ─────────
function RenglonCarril({ tipo, etapas, escala }: { tipo: 'plan' | 'real'; etapas: EtapaReporte[]; escala: Escala }) {
  const esPlan = tipo === 'plan'
  const alertas = esPlan ? 0 : etapas.filter(e => ALERTAS.includes(e.cumplimiento)).length

  return (
    <div className="flex border-b border-slate-100" style={{ height: CARRIL_H }}>
      <div
        className="sticky left-0 z-10 flex shrink-0 items-center gap-2 border-r border-slate-200 bg-white pl-9 pr-3"
        style={{ width: LEFT_W, minWidth: LEFT_W }}
      >
        <span
          className="h-2.5 w-5 shrink-0 rounded-[3px]"
          style={esPlan ? { backgroundColor: '#e2e8f0', border: '1px solid #94a3b8' } : { backgroundColor: '#475569' }}
        />
        <span className="flex-1 text-[11px] font-semibold text-slate-600">{esPlan ? 'Planeado' : 'Ejecutado'}</span>
        {alertas > 0 && <span className="text-[10px] font-semibold text-red-600">{alertas} con alerta</span>}
      </div>

      <div className="relative shrink-0" style={{ width: escala.totalWidth, height: CARRIL_H }}>
        {etapas.map(e => {
          const color = COLOR_ETAPA[e.estado]
          const icono = ICONO_CUMPLIMIENTO[e.cumplimiento]
          const t = tramos(e, escala)[tipo]
          if (!t) return null
          const esHito = e.estado === 'CERRADO'
          const titulo = esPlan
            ? `${e.label} · planeado: ${formatFecha(e.planInicio)} → ${formatFecha(e.planFin)}${e.duracionPlan != null ? ` (${e.duracionPlan}d)` : ''}`
            : `${e.label} · ejecutado: ${formatFecha(e.realInicio)} → ${e.enCurso ? 'en curso' : formatFecha(e.realFin)}${e.duracionReal != null ? ` (${e.duracionReal}d)` : ''} · ${icono.label}`
          const desv = esPlan ? null : e.desvFin

          // Cerrado es un hito: rombo (planeado) o círculo (ejecutado) con su nombre al lado
          if (esHito) {
            return (
              <div key={e.estado} title={titulo} className="absolute flex items-center gap-1.5" style={{ left: t.x + 4, top: (CARRIL_H - 12) / 2 }}>
                <span
                  className={cn('h-3 w-3 shrink-0', esPlan ? 'rotate-45' : 'rounded-full border-2 border-white shadow-sm')}
                  style={esPlan ? { backgroundColor: color.plan, border: `1.5px solid ${color.borde}` } : { backgroundColor: color.real }}
                />
                <span className="whitespace-nowrap text-[10px] font-semibold text-slate-600">{e.label}</span>
                {desv != null && desv !== 0 && <BadgeDesv dias={desv} />}
              </div>
            )
          }

          return (
            <div
              key={e.estado}
              title={titulo}
              className="absolute flex items-center justify-center gap-1 overflow-hidden rounded-[4px] px-1.5"
              style={{
                left: t.x + 1, width: t.w - 2, top: BARRA_Y, height: BARRA_H,
                ...(esPlan
                  ? { backgroundColor: color.plan, border: `1px solid ${color.borde}`, color: '#334155' }
                  : { backgroundColor: color.real, color: color.texto }),
                // En curso: textura diagonal para distinguirla de una etapa terminada
                ...(!esPlan && e.enCurso && { backgroundImage: TEXTURA_EN_CURSO, backgroundSize: '8px 8px' }),
              }}
            >
              <span className="min-w-0 truncate text-[10px] font-semibold leading-none">{e.label}</span>
              {desv != null && desv !== 0 && <BadgeDesv dias={desv} />}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function BadgeDesv({ dias }: { dias: number }) {
  return (
    <span className={cn(
      'shrink-0 rounded bg-white/90 px-1 text-[9px] font-bold leading-[14px]',
      dias > 0 ? 'text-red-600' : 'text-emerald-700'
    )}>
      {formatDesv(dias)}
    </span>
  )
}

// ── Fila de requerimiento: encabezado; contraída muestra el resumen compacto ─
function FilaRequerimiento({
  req, abierto, onToggle, escala,
}: {
  req: RequerimientoPlaneacion; abierto: boolean; onToggle: () => void; escala: Escala
}) {
  const estadoCfg = getEstadoCfg(req.estado)
  const alertas = req.etapas.filter(e => ALERTAS.includes(e.cumplimiento)).length

  return (
    <div className="flex border-b border-slate-200 bg-slate-50/40" style={{ height: GROUP_H }}>
      <div
        className="sticky left-0 z-10 flex shrink-0 items-center gap-2 border-r border-slate-200 bg-slate-50 px-3"
        style={{ width: LEFT_W, minWidth: LEFT_W }}
      >
        <button onClick={onToggle} className="rounded p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600" aria-label={abierto ? 'Contraer' : 'Expandir'}>
          {abierto ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        <div className="min-w-0 flex-1">
          <Link
            href={`/admin/requerimientos/${req.id}`}
            className="block truncate text-xs font-semibold text-slate-700 hover:text-blue-600"
            title={req.nombre}
          >
            {req.numero && <span className="mr-1 font-mono text-[10px] text-slate-400">#{req.numero}</span>}
            {req.nombre}
          </Link>
          <div className="mt-0.5 flex items-center gap-1.5">
            <span className={cn('inline-block rounded-full px-1.5 py-px text-[10px] font-medium leading-none', estadoCfg.bgColor, estadoCfg.textColor)}>
              {estadoCfg.label}
            </span>
            {alertas > 0 && <span className="text-[10px] font-semibold text-red-600">{alertas} con alerta</span>}
          </div>
        </div>
      </div>

      <div className="relative shrink-0 cursor-pointer" style={{ width: escala.totalWidth, height: GROUP_H }} onClick={onToggle}>
        {!abierto && req.etapas.map(e => {
          const { plan, real } = tramos(e, escala)
          const color = COLOR_ETAPA[e.estado]
          return (
            <div key={e.estado}>
              {plan && (
                <div
                  title={`${e.label} · planeado: ${formatFecha(e.planInicio)} → ${formatFecha(e.planFin)}`}
                  className="absolute rounded-[3px]"
                  style={{ left: plan.x + 1, width: plan.w - 2, top: 9, height: 11, backgroundColor: color.plan, border: `1px solid ${color.borde}` }}
                />
              )}
              {real && (
                <div
                  title={`${e.label} · ejecutado: ${formatFecha(e.realInicio)} → ${e.enCurso ? 'en curso' : formatFecha(e.realFin)}`}
                  className="absolute rounded-[3px]"
                  style={{ left: real.x + 1, width: real.w - 2, top: 24, height: 11, backgroundColor: color.real }}
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
  const [dayW, setDayW] = useState(36)
  // Desplegados por defecto: cada requerimiento muestra sus renglones Planeado y Ejecutado
  const [abiertos, setAbiertos] = useState<Set<string>>(() => new Set(requerimientos.map(r => r.id)))

  const toggle = (id: string) => setAbiertos(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })
  const todosAbiertos = requerimientos.length > 0 && requerimientos.every(r => abiertos.has(r.id))

  // Rango: desde el lunes de la semana más temprana hasta el domingo siguiente a la fecha más tardía
  const { desde, hasta } = useMemo(() => {
    const fechas = requerimientos
      .flatMap(r => r.etapas.flatMap(e => [e.planInicio, e.planFin, e.realInicio, e.realFin]))
      .filter((d): d is string => !!d)
      .map(toD)
    fechas.push(toD(HOY_ISO))
    const minD = new Date(Math.min(...fechas.map(d => d.getTime())))
    const maxD = new Date(Math.max(...fechas.map(d => d.getTime())))
    const lunes = new Date(minD.getFullYear(), minD.getMonth(), minD.getDate() - ((minD.getDay() + 6) % 7))
    const domingo = new Date(maxD.getFullYear(), maxD.getMonth(), maxD.getDate() + (7 - maxD.getDay()) % 7 + 7)
    return { desde: lunes, hasta: domingo }
  }, [requerimientos])

  const escala = useMemo(() => construirEscala(desde, hasta, dayW), [desde, hasta, dayW])

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
          <button onClick={() => setDayW(w => Math.max(24, w - 6))}
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100" aria-label="Alejar"><ZoomOut size={14} /></button>
          <span className="w-20 text-center text-xs font-medium text-slate-500">{dayW} px/día</span>
          <button onClick={() => setDayW(w => Math.min(72, w + 6))}
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
          <span className="inline-block h-2.5 w-8 rounded-[3px] bg-slate-600" style={{ backgroundImage: TEXTURA_EN_CURSO, backgroundSize: '8px 8px' }} /> En curso
        </span>
        <span className="flex items-center gap-1.5"><span className="font-semibold text-red-600">+Nd</span> días de retraso al cierre</span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm border border-amber-300 bg-amber-400" /> Hoy
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundImage: RAYADO_FINDE }} /> Fin de semana
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
        <div style={{ minWidth: LEFT_W + escala.totalWidth + 1 }}>
          <Cabecera escala={escala} total={requerimientos.length} />

          {requerimientos.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-400">No hay resultados para los filtros aplicados</div>
          ) : (
            <div className="relative">
              <Cuadricula escala={escala} />
              {requerimientos.map(req => (
                <div key={req.id} className="relative">
                  <FilaRequerimiento req={req} abierto={abiertos.has(req.id)} onToggle={() => toggle(req.id)} escala={escala} />
                  {abiertos.has(req.id) && (['plan', 'real'] as const).map(tipo => (
                    <RenglonCarril key={tipo} tipo={tipo} etapas={req.etapas} escala={escala} />
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
