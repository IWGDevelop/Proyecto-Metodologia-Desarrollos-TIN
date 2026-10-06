'use client'

import { useState, useMemo } from 'react'
import { format, parseISO, isToday, isYesterday, isThisWeek, isThisMonth } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  GitBranch, Calendar, MessageSquare, Users, CheckSquare,
  CheckCircle2, Paperclip, BookOpen, Filter, ChevronDown, ChevronUp,
  AlertOctagon, ClipboardList, AlertTriangle, Clock, FileText,
} from 'lucide-react'
import { cn, formatCOP } from '@/lib/utils'
import { getEstadoCfg } from '@/lib/constants'
import type {
  CumplimientoTarea, EventoHistorial, EventoTipo, SoporteTarea,
} from '@/actions/historial-detallado'

interface Props {
  eventos: EventoHistorial[]
}

const TIPO_CFG: Record<EventoTipo, {
  label: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  iconBg: string
  iconColor: string
  badge: string
  /** Fondo y borde de la tarjeta del evento */
  card: string
}> = {
  estado:                    { label: 'Cambio de estado',     icon: GitBranch,     iconBg: 'bg-blue-100',    iconColor: 'text-blue-600',    badge: 'bg-blue-100 text-blue-700',       card: 'bg-blue-50/70 border-blue-300' },
  fecha:                     { label: 'Cambio de fecha',      icon: Calendar,      iconBg: 'bg-violet-100',  iconColor: 'text-violet-600',  badge: 'bg-violet-100 text-violet-700',   card: 'bg-violet-50/70 border-violet-300' },
  comentario:                { label: 'Comentario',           icon: MessageSquare, iconBg: 'bg-slate-200',   iconColor: 'text-slate-600',   badge: 'bg-slate-200 text-slate-700',     card: 'bg-slate-50 border-slate-300' },
  reunion:                   { label: 'Reunión',              icon: Users,         iconBg: 'bg-teal-100',    iconColor: 'text-teal-600',    badge: 'bg-teal-100 text-teal-700',       card: 'bg-teal-50/70 border-teal-300' },
  tarea_reunion:             { label: 'Tarea de reunión',     icon: CheckSquare,   iconBg: 'bg-orange-100',  iconColor: 'text-orange-500',  badge: 'bg-orange-100 text-orange-700',   card: 'bg-orange-50/70 border-orange-300' },
  tarea_tecnica:             { label: 'Tarea técnica',        icon: CheckSquare,   iconBg: 'bg-indigo-100',  iconColor: 'text-indigo-600',  badge: 'bg-indigo-100 text-indigo-700',   card: 'bg-indigo-50/70 border-indigo-300' },
  tarea_tecnica_completada:  { label: 'Tarea completada',     icon: CheckCircle2,  iconBg: 'bg-green-100',   iconColor: 'text-green-600',   badge: 'bg-green-100 text-green-700',     card: 'bg-green-50/70 border-green-300' },
  anexo:                     { label: 'Archivo adjunto',      icon: Paperclip,     iconBg: 'bg-stone-200',   iconColor: 'text-stone-600',   badge: 'bg-stone-200 text-stone-700',     card: 'bg-stone-50 border-stone-300' },
  doc_tecnica:               { label: 'Doc. técnica',         icon: BookOpen,      iconBg: 'bg-pink-100',    iconColor: 'text-pink-600',    badge: 'bg-pink-100 text-pink-700',       card: 'bg-pink-50/70 border-pink-300' },
  tarea_solicitud:           { label: 'Tarea / Solicitud',    icon: ClipboardList, iconBg: 'bg-cyan-100',    iconColor: 'text-cyan-600',    badge: 'bg-cyan-100 text-cyan-700',       card: 'bg-cyan-50/70 border-cyan-300' },
  tarea_solicitud_completada:{ label: 'Solicitud completada', icon: CheckCircle2,  iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600', badge: 'bg-emerald-100 text-emerald-700', card: 'bg-emerald-50/70 border-emerald-300' },
  penalizacion:              { label: 'Penalización',         icon: AlertOctagon,  iconBg: 'bg-rose-100',    iconColor: 'text-rose-600',    badge: 'bg-rose-100 text-rose-700',       card: 'bg-rose-50/70 border-rose-300' },
}

const TODOS_LOS_TIPOS = Object.keys(TIPO_CFG) as EventoTipo[]

function formatFechaEvento(iso: string): string {
  try {
    const d = parseISO(iso)
    if (isToday(d))     return `Hoy ${format(d, 'HH:mm')}`
    if (isYesterday(d)) return `Ayer ${format(d, 'HH:mm')}`
    return format(d, "d 'de' MMMM, HH:mm", { locale: es })
  } catch { return iso }
}

function fmtDia(fecha: string | null) {
  if (!fecha) return '—'
  try { return format(parseISO(fecha), 'd MMM yyyy', { locale: es }) } catch { return fecha }
}

function grupoPorFecha(iso: string): string {
  try {
    const d = parseISO(iso)
    if (isToday(d))     return 'Hoy'
    if (isYesterday(d)) return 'Ayer'
    if (isThisWeek(d, { weekStartsOn: 1 })) return 'Esta semana'
    if (isThisMonth(d)) return 'Este mes'
    return format(d, "MMMM yyyy", { locale: es })
  } catch { return 'Antes' }
}

const plural = (n: number, s: string) => `${n} ${s}${n === 1 ? '' : 's'}`

function EstadoBadge({ estado }: { estado: string }) {
  const cfg = getEstadoCfg(estado)
  return (
    <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', cfg.bgColor, cfg.textColor)}>
      {cfg.label}
    </span>
  )
}

/** Días de cumplimiento, fechas clave y semáforo de la tarea */
function BloqueCumplimiento({ c }: { c: CumplimientoTarea }) {
  const estadoCfg = {
    A_TIEMPO:       { txt: 'Cumplida a tiempo', cls: 'bg-green-100 text-green-700' },
    TARDE:          { txt: `Incumplida · ${plural(c.dias_retraso, 'día')} de retraso`, cls: 'bg-red-600 text-white' },
    VENCIDA:        { txt: `Vencida sin cumplir · ${plural(c.dias_retraso, 'día')}`, cls: 'bg-red-600 text-white' },
    EN_CURSO:       { txt: 'En curso', cls: 'bg-amber-100 text-amber-700' },
    SIN_COMPROMISO: { txt: 'Sin fecha de compromiso', cls: 'bg-slate-200 text-slate-600' },
  }[c.estado]

  const abierta = c.estado === 'VENCIDA' || c.estado === 'EN_CURSO' || (c.estado === 'SIN_COMPROMISO' && !c.fecha_cumplimiento)

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
      <span className={cn('rounded-full px-2 py-0.5 font-semibold', estadoCfg.cls)}>{estadoCfg.txt}</span>
      {c.dias_cumplimiento != null && (
        <span className="inline-flex items-center gap-1 rounded-full bg-white/80 px-2 py-0.5 font-medium text-slate-700 ring-1 ring-slate-200">
          <Clock size={11} />
          {abierta
            ? `${plural(c.dias_cumplimiento, 'día')} abierta`
            : `${plural(c.dias_cumplimiento, 'día')} de cumplimiento`}
        </span>
      )}
      {c.fecha_inicio && <span className="text-slate-500">Inicio: {fmtDia(c.fecha_inicio)}</span>}
      {c.fecha_compromiso && <span className="text-slate-500">· Compromiso: {fmtDia(c.fecha_compromiso)}</span>}
      {c.fecha_cumplimiento && <span className="text-slate-500">· Cumplida: {fmtDia(c.fecha_cumplimiento)}</span>}
    </div>
  )
}

/** Respuesta y soportes registrados para la tarea */
function BloqueRespuesta({ respuesta, soportes }: { respuesta: string | null; soportes: SoporteTarea[] }) {
  if (!respuesta?.trim() && soportes.length === 0) {
    return <p className="mt-2 text-[11px] italic text-slate-400">Sin respuesta registrada</p>
  }
  return (
    <div className="mt-2 rounded-md border border-white bg-white/80 p-2.5">
      <p className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        <MessageSquare size={10} /> Respuesta
      </p>
      {respuesta?.trim() && (
        <p className="whitespace-pre-wrap text-xs leading-relaxed text-slate-700">{respuesta}</p>
      )}
      {soportes.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {soportes.map((s, i) => (
            <a
              key={i}
              href={s.url_storage}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex max-w-[220px] items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] text-blue-700 hover:bg-blue-50 hover:underline"
            >
              <FileText size={11} className="shrink-0" />
              <span className="truncate">{s.nombre_archivo}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}

function esIncumplido(evento: EventoHistorial) {
  return !!(evento.extra?.cumplimiento as CumplimientoTarea | undefined)?.incumplida
}

function EventoCard({ evento }: { evento: EventoHistorial }) {
  const [expandido, setExpandido] = useState(false)
  const cfg = TIPO_CFG[evento.tipo]
  const Icon = cfg.icon
  const cumplimiento = evento.extra?.cumplimiento as CumplimientoTarea | undefined
  const incumplida = !!cumplimiento?.incumplida
  const conRespuesta = evento.tipo === 'tarea_reunion' || evento.tipo === 'tarea_solicitud'

  return (
    <div className="flex gap-3">
      {/* Icono */}
      <div className={cn(
        'mt-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-4 ring-white',
        incumplida ? 'bg-red-600' : cfg.iconBg,
      )}>
        {incumplida
          ? <AlertTriangle size={15} className="text-white" />
          : <Icon size={15} className={cfg.iconColor} />}
      </div>

      {/* Tarjeta */}
      <div className={cn(
        'min-w-0 flex-1 rounded-lg border border-l-4 p-3',
        incumplida ? 'border-red-300 border-l-red-600 bg-red-50 ring-1 ring-red-200' : cfg.card,
      )}>
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex flex-wrap items-center gap-1.5">
              <span className={cn('inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide', cfg.badge)}>
                {cfg.label}
              </span>
              {incumplida && (
                <span className="inline-block rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                  Sin cumplimiento
                </span>
              )}
            </div>

            {/* Título según tipo */}
            {evento.tipo === 'estado' ? (
              <div className="mt-0.5 flex flex-wrap items-center gap-1">
                {evento.extra.estado_anterior && <EstadoBadge estado={evento.extra.estado_anterior} />}
                {evento.extra.estado_anterior && <span className="text-xs text-slate-400">→</span>}
                <EstadoBadge estado={evento.extra.estado_nuevo} />
              </div>
            ) : (
              <p className={cn(
                'text-sm leading-snug',
                incumplida ? 'font-medium text-red-900' : 'text-slate-800',
                evento.tipo === 'comentario' && !expandido && 'line-clamp-3',
              )}>
                {evento.titulo}
              </p>
            )}

            {/* Descripción */}
            {evento.descripcion && (
              <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{evento.descripcion}</p>
            )}

            {/* Cumplimiento de tareas */}
            {cumplimiento && <BloqueCumplimiento c={cumplimiento} />}

            {/* Respuesta de tareas de reunión y solicitudes */}
            {conRespuesta && (
              <BloqueRespuesta
                respuesta={evento.extra.respuesta ?? null}
                soportes={(evento.extra.soportes ?? []) as SoporteTarea[]}
              />
            )}

            {/* Penalización: monto */}
            {evento.tipo === 'penalizacion' && evento.extra.monto_cop > 0 && (
              <span className="mt-1 inline-block rounded-full border border-red-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-red-700">
                {formatCOP(evento.extra.monto_cop)}
              </span>
            )}

            {/* Expandir comentarios largos */}
            {evento.tipo === 'comentario' && (evento.titulo?.length ?? 0) > 120 && (
              <button
                onClick={() => setExpandido(v => !v)}
                className="mt-1 flex items-center gap-0.5 text-[11px] text-blue-600 hover:text-blue-800"
              >
                {expandido ? <><ChevronUp size={11} /> Ver menos</> : <><ChevronDown size={11} /> Ver más</>}
              </button>
            )}
          </div>

          {/* Fecha + usuario */}
          <div className="shrink-0 text-right">
            <div className="text-[11px] text-slate-500">{formatFechaEvento(evento.fecha)}</div>
            {evento.usuario && (
              <div className="mt-0.5 max-w-[160px] truncate text-right text-[11px] font-medium text-slate-600">
                {evento.usuario}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export function TabActividad({ eventos }: Props) {
  const [tiposFiltro, setTiposFiltro] = useState<EventoTipo[]>([])
  const [soloIncumplidas, setSoloIncumplidas] = useState(false)

  const totalIncumplidas = useMemo(() => eventos.filter(esIncumplido).length, [eventos])

  const eventosFiltrados = useMemo(() => {
    let lista = eventos
    if (tiposFiltro.length > 0) lista = lista.filter(e => tiposFiltro.includes(e.tipo))
    if (soloIncumplidas) lista = lista.filter(esIncumplido)
    return lista
  }, [eventos, tiposFiltro, soloIncumplidas])

  // Agrupar por fecha
  const grupos = useMemo(() => {
    const map = new Map<string, EventoHistorial[]>()
    for (const e of eventosFiltrados) {
      const g = grupoPorFecha(e.fecha)
      if (!map.has(g)) map.set(g, [])
      map.get(g)!.push(e)
    }
    return map
  }, [eventosFiltrados])

  // Conteo por tipo para los filtros
  const countPorTipo = useMemo(() => {
    const m: Partial<Record<EventoTipo, number>> = {}
    for (const e of eventos) m[e.tipo] = (m[e.tipo] ?? 0) + 1
    return m
  }, [eventos])

  const toggleTipo = (tipo: EventoTipo) => {
    setTiposFiltro(prev =>
      prev.includes(tipo) ? prev.filter(t => t !== tipo) : [...prev, tipo]
    )
  }

  return (
    <div className="space-y-4">
      {/* Encabezado */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-slate-800">Resumen de Actividad</h2>
        {totalIncumplidas > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-3 py-1 text-xs font-semibold text-white">
            <AlertTriangle size={13} /> {plural(totalIncumplidas, 'tarea')} sin cumplimiento
          </span>
        )}
      </div>

      {/* Filtros */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Filter size={13} className="shrink-0 text-slate-400" />
          <button
            onClick={() => { setTiposFiltro([]); setSoloIncumplidas(false) }}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              tiposFiltro.length === 0 && !soloIncumplidas
                ? 'border-slate-700 bg-slate-700 text-white'
                : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
            )}
          >
            Todo ({eventos.length})
          </button>
          {totalIncumplidas > 0 && (
            <button
              onClick={() => setSoloIncumplidas(v => !v)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-semibold transition-colors',
                soloIncumplidas
                  ? 'border-red-600 bg-red-600 text-white'
                  : 'border-red-200 bg-red-50 text-red-700 hover:border-red-300'
              )}
            >
              Sin cumplimiento ({totalIncumplidas})
            </button>
          )}
          {TODOS_LOS_TIPOS.filter(t => (countPorTipo[t] ?? 0) > 0).map(tipo => {
            const cfg = TIPO_CFG[tipo]
            const activo = tiposFiltro.includes(tipo)
            return (
              <button
                key={tipo}
                onClick={() => toggleTipo(tipo)}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                  activo ? 'border-slate-700 bg-slate-700 text-white' : cn(cfg.card, 'text-slate-700 hover:brightness-95'),
                )}
              >
                {cfg.label} ({countPorTipo[tipo]})
              </button>
            )
          })}
        </div>
      </div>

      {/* Timeline */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        {eventosFiltrados.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-400">
            Sin actividad registrada para este filtro
          </div>
        ) : (
          <div className="space-y-6">
            {[...grupos.entries()].map(([grupo, items]) => (
              <div key={grupo}>
                {/* Separador de grupo */}
                <div className="mb-4 flex items-center gap-3">
                  <div className="h-px flex-1 bg-slate-100" />
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                    {grupo}
                  </span>
                  <div className="h-px flex-1 bg-slate-100" />
                </div>

                {/* Eventos del grupo con línea vertical */}
                <div className="relative ml-4 space-y-3 border-l-2 border-slate-100 pl-4">
                  {items.map(evento => (
                    <EventoCard key={evento.id} evento={evento} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
