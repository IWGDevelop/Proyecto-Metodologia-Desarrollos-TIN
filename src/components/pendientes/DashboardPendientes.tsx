'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  Clock, AlertTriangle, CheckCircle2, CalendarDays,
  Users, ExternalLink, ChevronDown, ChevronUp, Filter,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TareaPendienteReunion, CompromisoPendiente } from '@/actions/pendientes'

interface Props {
  tareas: TareaPendienteReunion[]
  compromisos: CompromisoPendiente[]
}

const TIPO_COLOR: Record<string, string> = {
  entrega:     'bg-blue-100 text-blue-700 border-blue-200',
  pruebas:     'bg-purple-100 text-purple-700 border-purple-200',
  ajustes:     'bg-orange-100 text-orange-700 border-orange-200',
  salida_vivo: 'bg-green-100 text-green-700 border-green-200',
}

function diasColor(dias: number | null): string {
  if (dias === null) return 'text-slate-400'
  if (dias < 0)  return 'text-red-600 font-semibold'
  if (dias <= 3) return 'text-orange-500 font-semibold'
  if (dias <= 7) return 'text-amber-500'
  return 'text-slate-500'
}

function diasLabel(dias: number | null): string {
  if (dias === null) return 'Sin fecha'
  if (dias < 0) return `Vencida hace ${Math.abs(dias)}d`
  if (dias === 0) return 'Vence hoy'
  if (dias === 1) return 'Vence mañana'
  return `En ${dias} días`
}

function urgenciaBadge(dias: number | null) {
  if (dias === null) return null
  if (dias < 0)  return <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-600">VENCIDA</span>
  if (dias <= 3) return <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-600">URGENTE</span>
  if (dias <= 7) return <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-600">PRÓXIMA</span>
  return null
}

function formatFecha(fecha: string) {
  try { return format(parseISO(fecha), 'dd MMM yyyy', { locale: es }) }
  catch { return fecha }
}

type FiltroUrgencia = 'todas' | 'vencidas' | 'urgentes' | 'proximas'

export function DashboardPendientes({ tareas, compromisos }: Props) {
  const [filtroTareas, setFiltroTareas] = useState<FiltroUrgencia>('todas')
  const [filtroCompromisos, setFiltroCompromisos] = useState<FiltroUrgencia>('todas')
  const [seccionTareasAbierta, setSeccionTareasAbierta] = useState(true)
  const [seccionCompromisosAbierta, setSeccionCompromisosAbierta] = useState(true)

  const tareasFiltradas = useMemo(() => {
    if (filtroTareas === 'todas') return tareas
    if (filtroTareas === 'vencidas') return tareas.filter(t => t.dias_restantes !== null && t.dias_restantes < 0)
    if (filtroTareas === 'urgentes') return tareas.filter(t => t.dias_restantes !== null && t.dias_restantes >= 0 && t.dias_restantes <= 3)
    if (filtroTareas === 'proximas') return tareas.filter(t => t.dias_restantes !== null && t.dias_restantes > 3 && t.dias_restantes <= 7)
    return tareas
  }, [tareas, filtroTareas])

  const compromisosFiltrados = useMemo(() => {
    if (filtroCompromisos === 'todas') return compromisos
    if (filtroCompromisos === 'vencidas') return compromisos.filter(c => c.vencida)
    if (filtroCompromisos === 'urgentes') return compromisos.filter(c => !c.vencida && c.dias_restantes !== null && c.dias_restantes <= 3)
    if (filtroCompromisos === 'proximas') return compromisos.filter(c => !c.vencida && c.dias_restantes !== null && c.dias_restantes > 3 && c.dias_restantes <= 7)
    return compromisos
  }, [compromisos, filtroCompromisos])

  const tareasVencidas   = tareas.filter(t => t.dias_restantes !== null && t.dias_restantes < 0).length
  const tareasUrgentes   = tareas.filter(t => t.dias_restantes !== null && t.dias_restantes >= 0 && t.dias_restantes <= 3).length
  const compromisosVencidos = compromisos.filter(c => c.vencida).length
  const compromisosUrgentes = compromisos.filter(c => !c.vencida && c.dias_restantes !== null && c.dias_restantes <= 3).length

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Pendientes</h1>
        <p className="text-sm text-slate-500 mt-1">Tareas de reuniones y compromisos de fechas sin completar</p>
      </div>

      {/* Resumen global */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Tareas vencidas"
          value={tareasVencidas}
          color="red"
          icon={<AlertTriangle size={18} />}
        />
        <StatCard
          label="Tareas urgentes"
          value={tareasUrgentes}
          color="orange"
          icon={<Clock size={18} />}
        />
        <StatCard
          label="Fechas vencidas"
          value={compromisosVencidos}
          color="red"
          icon={<CalendarDays size={18} />}
        />
        <StatCard
          label="Fechas urgentes"
          value={compromisosUrgentes}
          color="orange"
          icon={<CalendarDays size={18} />}
        />
      </div>

      {/* Sección: Tareas de reuniones */}
      <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <button
          className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-slate-50 transition-colors"
          onClick={() => setSeccionTareasAbierta(v => !v)}
        >
          <div className="flex items-center gap-2">
            <Users size={18} className="text-blue-500" />
            <h2 className="text-base font-semibold text-slate-700">
              Tareas pendientes de reuniones
            </h2>
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-700">
              {tareas.length}
            </span>
          </div>
          {seccionTareasAbierta ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
        </button>

        {seccionTareasAbierta && (
          <>
            <div className="border-t border-slate-100 px-5 py-3 flex items-center gap-2">
              <Filter size={13} className="text-slate-400" />
              <FiltroBtn label="Todas" activo={filtroTareas === 'todas'} onClick={() => setFiltroTareas('todas')} />
              <FiltroBtn label={`Vencidas (${tareasVencidas})`} activo={filtroTareas === 'vencidas'} onClick={() => setFiltroTareas('vencidas')} color="red" />
              <FiltroBtn label={`Urgentes (${tareasUrgentes})`} activo={filtroTareas === 'urgentes'} onClick={() => setFiltroTareas('urgentes')} color="orange" />
              <FiltroBtn label="Próximas 7d" activo={filtroTareas === 'proximas'} onClick={() => setFiltroTareas('proximas')} color="amber" />
            </div>

            {tareasFiltradas.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="divide-y divide-slate-100">
                {tareasFiltradas.map(t => (
                  <FilaTarea key={t.id} tarea={t} />
                ))}
              </div>
            )}
          </>
        )}
      </section>

      {/* Sección: Compromisos de fechas */}
      <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <button
          className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-slate-50 transition-colors"
          onClick={() => setSeccionCompromisosAbierta(v => !v)}
        >
          <div className="flex items-center gap-2">
            <CalendarDays size={18} className="text-violet-500" />
            <h2 className="text-base font-semibold text-slate-700">
              Compromisos de fechas
            </h2>
            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-bold text-violet-700">
              {compromisos.length}
            </span>
          </div>
          {seccionCompromisosAbierta ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
        </button>

        {seccionCompromisosAbierta && (
          <>
            <div className="border-t border-slate-100 px-5 py-3 flex items-center gap-2">
              <Filter size={13} className="text-slate-400" />
              <FiltroBtn label="Todas" activo={filtroCompromisos === 'todas'} onClick={() => setFiltroCompromisos('todas')} />
              <FiltroBtn label={`Vencidas (${compromisosVencidos})`} activo={filtroCompromisos === 'vencidas'} onClick={() => setFiltroCompromisos('vencidas')} color="red" />
              <FiltroBtn label={`Urgentes (${compromisosUrgentes})`} activo={filtroCompromisos === 'urgentes'} onClick={() => setFiltroCompromisos('urgentes')} color="orange" />
              <FiltroBtn label="Próximas 7d" activo={filtroCompromisos === 'proximas'} onClick={() => setFiltroCompromisos('proximas')} color="amber" />
            </div>

            {compromisosFiltrados.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="divide-y divide-slate-100">
                {compromisosFiltrados.map((c, i) => (
                  <FilaCompromiso key={`${c.requerimiento_id}-${c.tipo}`} compromiso={c} />
                ))}
              </div>
            )}
          </>
        )}
      </section>
    </div>
  )
}

function StatCard({ label, value, color, icon }: {
  label: string; value: number
  color: 'red' | 'orange' | 'green' | 'blue'
  icon: React.ReactNode
}) {
  const styles = {
    red:    'bg-red-50 border-red-200 text-red-700',
    orange: 'bg-orange-50 border-orange-200 text-orange-700',
    green:  'bg-green-50 border-green-200 text-green-700',
    blue:   'bg-blue-50 border-blue-200 text-blue-700',
  }
  return (
    <div className={cn('rounded-xl border p-4', styles[color])}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium opacity-80">{label}</span>
        <span className="opacity-60">{icon}</span>
      </div>
      <div className="mt-2 text-3xl font-bold">{value}</div>
    </div>
  )
}

function FiltroBtn({ label, activo, onClick, color }: {
  label: string; activo: boolean; onClick: () => void; color?: string
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'rounded-full px-3 py-1 text-xs font-medium transition-colors border',
        activo
          ? 'bg-slate-700 text-white border-slate-700'
          : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-700'
      )}
    >
      {label}
    </button>
  )
}

function FilaTarea({ tarea }: { tarea: TareaPendienteReunion }) {
  return (
    <div className="px-5 py-3.5 hover:bg-slate-50 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            {tarea.requerimiento_numero && (
              <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">
                #{tarea.requerimiento_numero}
              </span>
            )}
            <Link
              href={`/admin/requerimientos/${tarea.requerimiento_id}`}
              className="text-sm font-medium text-slate-700 hover:text-blue-600 hover:underline truncate flex items-center gap-1"
            >
              {tarea.requerimiento_nombre}
              <ExternalLink size={11} className="shrink-0" />
            </Link>
            {urgenciaBadge(tarea.dias_restantes)}
          </div>

          <p className="text-sm text-slate-600 leading-snug">{tarea.descripcion}</p>

          <div className="mt-1.5 flex items-center gap-3 text-xs text-slate-400 flex-wrap">
            <span className="flex items-center gap-1">
              <Users size={11} />
              {tarea.reunion_titulo} · {formatFecha(tarea.fecha_reunion)}
            </span>
            {tarea.responsable_email && (
              <span className="flex items-center gap-1">
                <CheckCircle2 size={11} />
                {tarea.responsable_email}
              </span>
            )}
            {tarea.penalizacion_cop !== null && tarea.penalizacion_cop > 0 && (
              <span className="text-red-400 font-medium">
                Penalización: ${tarea.penalizacion_cop.toLocaleString('es-CO')}
              </span>
            )}
          </div>
        </div>

        <div className="shrink-0 text-right">
          {tarea.fecha_compromiso ? (
            <>
              <div className="text-xs font-semibold text-slate-600">{formatFecha(tarea.fecha_compromiso)}</div>
              <div className={cn('text-xs mt-0.5', diasColor(tarea.dias_restantes))}>
                {diasLabel(tarea.dias_restantes)}
              </div>
            </>
          ) : (
            <span className="text-xs text-slate-400">Sin fecha límite</span>
          )}
        </div>
      </div>
    </div>
  )
}

function FilaCompromiso({ compromiso }: { compromiso: CompromisoPendiente }) {
  return (
    <div className="px-5 py-3.5 hover:bg-slate-50 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            {compromiso.requerimiento_numero && (
              <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">
                #{compromiso.requerimiento_numero}
              </span>
            )}
            <Link
              href={`/admin/requerimientos/${compromiso.requerimiento_id}`}
              className="text-sm font-medium text-slate-700 hover:text-blue-600 hover:underline truncate flex items-center gap-1"
            >
              {compromiso.requerimiento_nombre}
              <ExternalLink size={11} className="shrink-0" />
            </Link>
            <span className={cn('shrink-0 rounded border px-2 py-0.5 text-[10px] font-semibold', TIPO_COLOR[compromiso.tipo])}>
              {compromiso.label}
            </span>
            {urgenciaBadge(compromiso.dias_restantes)}
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
              {compromiso.estado}
            </span>
            {compromiso.proceso_interno && (
              <span>{compromiso.proceso_interno}</span>
            )}
          </div>
        </div>

        <div className="shrink-0 text-right">
          <div className="text-xs font-semibold text-slate-600">{formatFecha(compromiso.fecha_estimada)}</div>
          <div className={cn('text-xs mt-0.5', diasColor(compromiso.dias_restantes))}>
            {diasLabel(compromiso.dias_restantes)}
          </div>
        </div>
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-slate-400">
      <CheckCircle2 size={28} className="text-green-400" />
      <span className="text-sm">Sin pendientes en este filtro</span>
    </div>
  )
}
