'use client'

import { useState, useMemo } from 'react'
import { format, parseISO, isToday, isYesterday, isThisWeek, isThisMonth } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  GitBranch, Calendar, MessageSquare, Users, CheckSquare,
  CheckCircle2, Paperclip, BookOpen, Filter, ChevronDown, ChevronUp,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { getEstadoCfg } from '@/lib/constants'
import type { EventoHistorial, EventoTipo } from '@/actions/historial-detallado'

interface Props {
  eventos: EventoHistorial[]
}

const TIPO_CFG: Record<EventoTipo, {
  label: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  iconBg: string
  iconColor: string
  badge: string
}> = {
  estado:                  { label: 'Cambio de estado',      icon: GitBranch,     iconBg: 'bg-blue-100',    iconColor: 'text-blue-600',    badge: 'bg-blue-100 text-blue-700' },
  fecha:                   { label: 'Cambio de fecha',       icon: Calendar,      iconBg: 'bg-violet-100',  iconColor: 'text-violet-600',  badge: 'bg-violet-100 text-violet-700' },
  comentario:              { label: 'Comentario',            icon: MessageSquare, iconBg: 'bg-slate-100',   iconColor: 'text-slate-500',   badge: 'bg-slate-100 text-slate-600' },
  reunion:                 { label: 'Reunión',               icon: Users,         iconBg: 'bg-teal-100',    iconColor: 'text-teal-600',    badge: 'bg-teal-100 text-teal-700' },
  tarea_reunion:           { label: 'Tarea de reunión',      icon: CheckSquare,   iconBg: 'bg-orange-100',  iconColor: 'text-orange-500',  badge: 'bg-orange-100 text-orange-700' },
  tarea_tecnica:           { label: 'Tarea técnica',         icon: CheckSquare,   iconBg: 'bg-indigo-100',  iconColor: 'text-indigo-600',  badge: 'bg-indigo-100 text-indigo-700' },
  tarea_tecnica_completada:{ label: 'Tarea completada',      icon: CheckCircle2,  iconBg: 'bg-green-100',   iconColor: 'text-green-600',   badge: 'bg-green-100 text-green-700' },
  anexo:                   { label: 'Archivo adjunto',       icon: Paperclip,     iconBg: 'bg-slate-100',   iconColor: 'text-slate-500',   badge: 'bg-slate-100 text-slate-600' },
  doc_tecnica:             { label: 'Doc. técnica',          icon: BookOpen,      iconBg: 'bg-pink-100',    iconColor: 'text-pink-600',    badge: 'bg-pink-100 text-pink-700' },
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

function EstadoBadge({ estado }: { estado: string }) {
  const cfg = getEstadoCfg(estado)
  return (
    <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', cfg.bgColor, cfg.textColor)}>
      {cfg.label}
    </span>
  )
}

function EventoCard({ evento }: { evento: EventoHistorial }) {
  const [expandido, setExpandido] = useState(false)
  const cfg = TIPO_CFG[evento.tipo]
  const Icon = cfg.icon
  const tieneDetalle = evento.tipo === 'estado' ||
    (evento.tipo === 'comentario' && (evento.titulo?.length ?? 0) > 120)

  return (
    <div className="flex gap-3">
      {/* Icono */}
      <div className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full', cfg.iconBg)}>
        <Icon size={15} className={cfg.iconColor} />
      </div>

      {/* Contenido */}
      <div className="min-w-0 flex-1 pb-4">
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
          <div className="min-w-0 flex-1">
            {/* Tipo badge */}
            <span className={cn('inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide mb-1', cfg.badge)}>
              {cfg.label}
            </span>

            {/* Título según tipo */}
            {evento.tipo === 'estado' ? (
              <div className="flex flex-wrap items-center gap-1 mt-0.5">
                {evento.extra.estado_anterior && <EstadoBadge estado={evento.extra.estado_anterior} />}
                {evento.extra.estado_anterior && <span className="text-slate-400 text-xs">→</span>}
                <EstadoBadge estado={evento.extra.estado_nuevo} />
              </div>
            ) : (
              <p className={cn(
                'text-sm text-slate-700 leading-snug',
                evento.tipo === 'comentario' && !expandido && 'line-clamp-3',
              )}>
                {evento.titulo}
              </p>
            )}

            {/* Descripción */}
            {evento.descripcion && (
              <p className="mt-0.5 text-xs text-slate-500 leading-relaxed">{evento.descripcion}</p>
            )}

            {/* Extra para tarea_reunion: badge de completada */}
            {evento.tipo === 'tarea_reunion' && (
              <span className={cn(
                'mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold',
                evento.extra.completada
                  ? 'bg-green-100 text-green-700'
                  : 'bg-amber-100 text-amber-700'
              )}>
                {evento.extra.completada ? 'Completada' : 'Pendiente'}
              </span>
            )}

            {/* Expandir comentarios largos */}
            {evento.tipo === 'comentario' && (evento.titulo?.length ?? 0) > 120 && (
              <button
                onClick={() => setExpandido(v => !v)}
                className="mt-1 flex items-center gap-0.5 text-[11px] text-blue-500 hover:text-blue-700"
              >
                {expandido ? <><ChevronUp size={11} /> Ver menos</> : <><ChevronDown size={11} /> Ver más</>}
              </button>
            )}
          </div>

          {/* Fecha + usuario */}
          <div className="shrink-0 text-right">
            <div className="text-[11px] text-slate-400">{formatFechaEvento(evento.fecha)}</div>
            {evento.usuario && (
              <div className="mt-0.5 text-[11px] font-medium text-slate-500 max-w-[140px] truncate text-right">
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

  const eventosFiltrados = useMemo(() => {
    if (tiposFiltro.length === 0) return eventos
    return eventos.filter(e => tiposFiltro.includes(e.tipo))
  }, [eventos, tiposFiltro])

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
    <div className="mt-4 space-y-4">
      {/* Filtros */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Filter size={13} className="text-slate-400 shrink-0" />
          <button
            onClick={() => setTiposFiltro([])}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              tiposFiltro.length === 0
                ? 'bg-slate-700 text-white border-slate-700'
                : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
            )}
          >
            Todo ({eventos.length})
          </button>
          {TODOS_LOS_TIPOS.filter(t => (countPorTipo[t] ?? 0) > 0).map(tipo => {
            const cfg = TIPO_CFG[tipo]
            const activo = tiposFiltro.includes(tipo)
            return (
              <button
                key={tipo}
                onClick={() => toggleTipo(tipo)}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                  activo
                    ? 'bg-slate-700 text-white border-slate-700'
                    : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
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
                <div className="relative ml-4 border-l-2 border-slate-100 pl-4 space-y-0">
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
