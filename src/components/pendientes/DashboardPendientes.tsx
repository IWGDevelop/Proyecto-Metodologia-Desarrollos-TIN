'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  Clock, AlertTriangle, CheckCircle2, CalendarDays,
  Users, ExternalLink, ChevronDown, ChevronUp, Filter, UserCircle2,
  ShieldCheck, FileCheck, Rocket, Calendar, ClipboardList,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TareaPendienteReunion, CompromisoPendiente, FirmaPendienteVistoBueno, TareaSolicitudPendiente } from '@/actions/pendientes'

interface Props {
  tareas: TareaPendienteReunion[]
  compromisos: CompromisoPendiente[]
  firmas: FirmaPendienteVistoBueno[]
  solicitudes: TareaSolicitudPendiente[]
  isAdmin?: boolean
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

export function DashboardPendientes({ tareas, compromisos, firmas, solicitudes, isAdmin = false }: Props) {
  const [filtroTareas, setFiltroTareas] = useState<FiltroUrgencia>('todas')
  const [filtroCompromisos, setFiltroCompromisos] = useState<FiltroUrgencia>('todas')
  const [seccionTareasAbierta, setSeccionTareasAbierta] = useState(true)
  const [seccionCompromisosAbierta, setSeccionCompromisosAbierta] = useState(true)
  const [seccionSolicitudesAbierta, setSeccionSolicitudesAbierta] = useState(true)
  const [seccionFirmasAbierta, setSeccionFirmasAbierta] = useState(true)

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
        <p className="text-sm text-slate-500 mt-1">Tareas de reuniones, compromisos de fechas y vistos buenos pendientes</p>
      </div>

      {/* Resumen global */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
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
        <StatCard
          label="Solicitudes"
          value={solicitudes.length}
          color="cyan"
          icon={<ClipboardList size={18} />}
        />
        <StatCard
          label="Vistos buenos"
          value={firmas.length}
          color="violet"
          icon={<ShieldCheck size={18} />}
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

      {/* Sección: Tareas y solicitudes */}
      <section className="rounded-xl border border-cyan-200 bg-white shadow-sm overflow-hidden">
        <button
          className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-cyan-50 transition-colors"
          onClick={() => setSeccionSolicitudesAbierta(v => !v)}
        >
          <div className="flex items-center gap-2">
            <ClipboardList size={18} className="text-cyan-500" />
            <h2 className="text-base font-semibold text-slate-700">
              {isAdmin ? 'Tareas y solicitudes (todas)' : 'Mis tareas y solicitudes'}
            </h2>
            <span className="rounded-full bg-cyan-100 px-2 py-0.5 text-xs font-bold text-cyan-700">
              {solicitudes.length}
            </span>
          </div>
          {seccionSolicitudesAbierta ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
        </button>

        {seccionSolicitudesAbierta && (
          solicitudes.length === 0 ? (
            <div className="border-t border-cyan-100">
              <EmptyState />
            </div>
          ) : (
            <div className="divide-y divide-cyan-50 border-t border-cyan-100">
              {solicitudes.map(s => (
                <FilaSolicitud key={s.id} solicitud={s} isAdmin={isAdmin} />
              ))}
            </div>
          )
        )}
      </section>

      {/* Sección: Vistos buenos pendientes */}
      <section className="rounded-xl border border-amber-200 bg-white shadow-sm overflow-hidden">
        <button
          className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-amber-50 transition-colors"
          onClick={() => setSeccionFirmasAbierta(v => !v)}
        >
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-amber-500" />
            <h2 className="text-base font-semibold text-slate-700">
              {isAdmin ? 'Vistos buenos pendientes (todos)' : 'Mis vistos buenos pendientes'}
            </h2>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">
              {firmas.length}
            </span>
          </div>
          {seccionFirmasAbierta ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
        </button>

        {seccionFirmasAbierta && (
          firmas.length === 0 ? (
            <div className="border-t border-amber-100">
              <EmptyState />
            </div>
          ) : (
            <div className="divide-y divide-amber-50 border-t border-amber-100">
              {firmas.map(f => (
                <FilaFirmaVistoBueno key={f.firma_id} firma={f} isAdmin={isAdmin} />
              ))}
            </div>
          )
        )}
      </section>
    </div>
  )
}

function StatCard({ label, value, color, icon }: {
  label: string; value: number
  color: 'red' | 'orange' | 'green' | 'blue' | 'cyan' | 'violet'
  icon: React.ReactNode
}) {
  const styles = {
    red:    'bg-red-50 border-red-200 text-red-700',
    orange: 'bg-orange-50 border-orange-200 text-orange-700',
    green:  'bg-green-50 border-green-200 text-green-700',
    blue:   'bg-blue-50 border-blue-200 text-blue-700',
    cyan:   'bg-cyan-50 border-cyan-200 text-cyan-700',
    violet: 'bg-amber-50 border-amber-200 text-amber-700',
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

function AvatarResponsable({ nombre, email }: { nombre: string | null; email: string | null }) {
  if (!email && !nombre) return null
  const displayName = nombre ?? email!
  const initials = displayName
    .split(' ')
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('')

  return (
    <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-500 text-[11px] font-bold text-white">
        {initials || <UserCircle2 size={14} />}
      </div>
      <div className="min-w-0">
        <div className="text-xs font-semibold text-blue-800 leading-tight truncate max-w-[140px]">
          {nombre ?? email}
        </div>
        {nombre && email && (
          <div className="text-[10px] text-blue-500 truncate max-w-[140px]">{email}</div>
        )}
      </div>
    </div>
  )
}

function FilaTarea({ tarea }: { tarea: TareaPendienteReunion }) {
  return (
    <div className="px-5 py-4 hover:bg-slate-50 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          {/* Requerimiento + urgencia */}
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
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

          {/* Descripción de la tarea */}
          <p className="text-sm text-slate-700 leading-snug mb-2">{tarea.descripcion}</p>

          {/* Responsable destacado + metadata */}
          <div className="flex items-center gap-3 flex-wrap">
            <AvatarResponsable nombre={tarea.nombre_responsable} email={tarea.responsable_email} />

            <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
              <span className="flex items-center gap-1">
                <Users size={11} />
                {tarea.reunion_titulo} · {formatFecha(tarea.fecha_reunion)}
              </span>
              {tarea.penalizacion_cop !== null && tarea.penalizacion_cop > 0 && (
                <span className="flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-500 border border-red-200">
                  Penalización: ${tarea.penalizacion_cop.toLocaleString('es-CO')}
                </span>
              )}
            </div>
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

function FilaSolicitud({ solicitud, isAdmin }: { solicitud: TareaSolicitudPendiente; isAdmin: boolean }) {
  return (
    <div className="px-5 py-4 hover:bg-cyan-50/50 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-1.5">
          {/* Requerimiento */}
          <div className="flex items-center gap-2 flex-wrap">
            {solicitud.requerimiento_numero && (
              <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">
                #{solicitud.requerimiento_numero}
              </span>
            )}
            <Link
              href={`/admin/requerimientos/${solicitud.requerimiento_id}?tab=comentarios`}
              className="text-sm font-medium text-slate-700 hover:text-blue-600 hover:underline truncate flex items-center gap-1"
            >
              {solicitud.requerimiento_nombre}
              <ExternalLink size={11} className="shrink-0" />
            </Link>
            {urgenciaBadge(solicitud.dias_restantes)}
          </div>

          {/* Descripción */}
          <p className="text-sm text-slate-700 leading-snug line-clamp-2">{solicitud.descripcion}</p>

          {/* Responsable + metadata */}
          <div className="flex items-center gap-3 flex-wrap">
            {(solicitud.nombre_responsable || solicitud.responsable_email) && (
              <AvatarResponsable nombre={solicitud.nombre_responsable} email={solicitud.responsable_email} />
            )}
            <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
              {solicitud.created_by && (
                <span>Creada por <strong className="text-slate-500">{solicitud.created_by}</strong></span>
              )}
              {solicitud.penalizacion_cop != null && solicitud.penalizacion_cop > 0 && (
                <span className="flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-500 border border-red-200">
                  Penalización: ${solicitud.penalizacion_cop.toLocaleString('es-CO')}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="shrink-0 text-right">
          {solicitud.fecha_compromiso ? (
            <>
              <div className="text-xs font-semibold text-slate-600">{formatFecha(solicitud.fecha_compromiso)}</div>
              <div className={cn('text-xs mt-0.5', diasColor(solicitud.dias_restantes))}>
                {diasLabel(solicitud.dias_restantes)}
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

function FilaFirmaVistoBueno({ firma, isAdmin }: { firma: FirmaPendienteVistoBueno; isAdmin: boolean }) {
  const esSalidaVivo = firma.tipo === 'SALIDA_VIVO'
  const tipoCfg = esSalidaVivo
    ? { label: 'Salida en vivo', cls: 'bg-sky-100 text-sky-700 border-sky-200', Icon: Rocket }
    : { label: 'Documentación',  cls: 'bg-violet-100 text-violet-700 border-violet-200', Icon: FileCheck }
  const TipoIcon = tipoCfg.Icon

  return (
    <div className="px-5 py-4 hover:bg-amber-50/50 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-2">
          {/* Requerimiento */}
          <div className="flex items-center gap-2 flex-wrap">
            {firma.requerimiento_numero && (
              <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">
                #{firma.requerimiento_numero}
              </span>
            )}
            <Link
              href={`/admin/requerimientos/${firma.requerimiento_id}?tab=visto-bueno`}
              className="text-sm font-medium text-slate-700 hover:text-blue-600 hover:underline truncate flex items-center gap-1"
            >
              {firma.requerimiento_nombre}
              <ExternalLink size={11} className="shrink-0" />
            </Link>
            <span className={cn('shrink-0 rounded border px-2 py-0.5 text-[10px] font-semibold flex items-center gap-1', tipoCfg.cls)}>
              <TipoIcon size={10} /> {tipoCfg.label}
            </span>
            {firma.es_estrategia && (
              <span className="shrink-0 rounded bg-blue-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-blue-700">
                Dir. Estrategia
              </span>
            )}
          </div>

          {/* Firmante (solo visible para admins) */}
          {isAdmin && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400">Debe firmar:</span>
              <AvatarResponsable nombre={firma.nombre_requerido} email={firma.email_requerido} />
            </div>
          )}

          {/* Metadata */}
          <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
            {firma.solicitado_por && (
              <span>Solicitado por <strong className="text-slate-500">{firma.solicitado_por}</strong></span>
            )}
            {esSalidaVivo && firma.fecha_propuesta_salida && (
              <span className="flex items-center gap-1 font-semibold text-sky-700">
                <Calendar size={11} />
                Salida: {formatFecha(firma.fecha_propuesta_salida)}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Clock size={11} />
              Desde {formatFecha(firma.created_at)}
            </span>
          </div>
        </div>

        {/* Acción */}
        <div className="shrink-0">
          <Link
            href={`/admin/requerimientos/${firma.requerimiento_id}?tab=visto-bueno`}
            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600 transition-colors"
          >
            <ShieldCheck size={13} />
            Firmar ahora
          </Link>
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
