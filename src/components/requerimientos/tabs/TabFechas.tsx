'use client'

import { useState, useTransition } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  CheckCircle2, FlaskConical, Rocket, History, Wrench, UserPen, Bug, ListTodo,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  actualizarFechasEntrega, type FechasEntrega, type HistorialFecha, type ResponsablesFechas,
} from '@/actions/fechas-entrega'
import { getPerfilesActivos } from '@/actions/perfiles'
import { ETAPAS_FECHA, type TipoEtapaFecha } from '@/lib/etapas-fecha'
import { cn } from '@/lib/utils'
import type { Perfil } from '@/lib/supabase/types'

interface Props {
  requerimientoId: string
  fechasActuales: FechasEntrega
  responsablesActuales: ResponsablesFechas
  historial: HistorialFecha[]
}

const ESTILO_ETAPA: Record<TipoEtapaFecha, { icon: React.ReactNode; color: string }> = {
  definicion_usuario: { icon: <UserPen size={14} className="text-sky-500" />,         color: 'border-sky-100 bg-sky-50/30' },
  entrega:            { icon: <CheckCircle2 size={14} className="text-indigo-400" />, color: 'border-indigo-100 bg-indigo-50/30' },
  testing:            { icon: <Bug size={14} className="text-rose-400" />,            color: 'border-rose-100 bg-rose-50/30' },
  pruebas:            { icon: <FlaskConical size={14} className="text-amber-400" />,  color: 'border-amber-100 bg-amber-50/30' },
  ajustes:            { icon: <Wrench size={14} className="text-violet-500" />,       color: 'border-violet-100 bg-violet-50/30' },
  salida_vivo:        { icon: <Rocket size={14} className="text-emerald-500" />,      color: 'border-emerald-100 bg-emerald-50/30' },
}

function formatFecha(d: string | null): string {
  if (!d) return '—'
  try {
    return new Date(d + 'T12:00:00').toLocaleDateString('es-CO', {
      day: '2-digit', month: 'short', year: 'numeric',
    })
  } catch { return d }
}

function formatRelativa(d: string): string {
  try {
    const diff = Date.now() - new Date(d).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'ahora'
    if (mins < 60) return `hace ${mins} min`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `hace ${hrs}h`
    return `hace ${Math.floor(hrs / 24)}d`
  } catch { return d }
}

function Campo({
  label, value, onChange, isReal = false,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  isReal?: boolean
}) {
  return (
    <div className="space-y-1.5">
      <label className={cn(
        'text-xs font-semibold',
        isReal ? 'text-emerald-600' : 'text-slate-500'
      )}>
        {label}
      </label>
      <input
        type="date"
        value={value}
        onChange={e => onChange(e.target.value)}
        className={cn(
          'w-full rounded-lg border px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2',
          isReal
            ? 'border-emerald-200 bg-emerald-50 focus:ring-emerald-300'
            : 'border-slate-200 bg-white focus:ring-blue-300'
        )}
      />
    </div>
  )
}

function Seccion({
  titulo, icon, color, children,
}: {
  titulo: string
  icon: React.ReactNode
  color: string
  children: React.ReactNode
}) {
  return (
    <div className={cn('rounded-xl border p-5', color)}>
      <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700">
        {icon}
        {titulo}
      </h3>
      {children}
    </div>
  )
}

export function TabFechas({ requerimientoId, fechasActuales, responsablesActuales, historial }: Props) {
  const [fechas, setFechas] = useState<FechasEntrega>(fechasActuales)
  const [responsables, setResponsables] = useState<ResponsablesFechas>(responsablesActuales)
  const [isPending, startTransition] = useTransition()

  const { data: perfiles = [] } = useQuery<Perfil[]>({
    queryKey: ['perfiles-activos'],
    queryFn:  () => getPerfilesActivos(),
    staleTime: 1000 * 60 * 5,
  })

  // Incluye al responsable actual aunque ya no esté entre los perfiles activos
  const opcionesResponsable = (actual: string | null | undefined) => {
    const opciones = perfiles.map(p => ({ email: p.email, nombre: p.nombre_completo }))
    if (actual && !opciones.some(o => o.email === actual)) opciones.unshift({ email: actual, nombre: actual })
    return opciones
  }

  const setFecha = (campo: keyof FechasEntrega, valor: string) =>
    setFechas(f => ({ ...f, [campo]: valor || null }))

  const handleGuardar = () => {
    startTransition(async () => {
      const res = await actualizarFechasEntrega(requerimientoId, fechas, responsables)
      if (res.ok) {
        toast.success('Fechas y tareas guardadas · Se notificó a los interesados')
        window.location.reload()
      } else {
        toast.error(res.error ?? 'Error al guardar fechas')
      }
    })
  }

  return (
    <div className="mt-4 space-y-5">

      <p className="flex items-center gap-1.5 text-xs text-slate-500">
        <ListTodo size={13} className="text-slate-400" />
        Cada fecha estimada se guarda como tarea del responsable asignado; la fecha real la marca como cumplida.
      </p>

      {ETAPAS_FECHA.map(etapa => {
        const estilo = ESTILO_ETAPA[etapa.tipo]
        const estimada = etapa.estimada as keyof FechasEntrega
        const real = etapa.real as keyof FechasEntrega
        const faltaResponsable = !!fechas[estimada] && !responsables[etapa.tipo]
        return (
          <Seccion key={etapa.tipo} titulo={etapa.titulo} icon={estilo.icon} color={estilo.color}>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Campo
                label="Fecha estimada"
                value={fechas[estimada] ?? ''}
                onChange={v => setFecha(estimada, v)}
              />
              <Campo
                label="Fecha real"
                value={fechas[real] ?? ''}
                onChange={v => setFecha(real, v)}
                isReal
              />
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500">
                  Responsable{fechas[estimada] && <span className="text-red-500"> *</span>}
                </label>
                <select
                  value={responsables[etapa.tipo] ?? ''}
                  onChange={e => setResponsables(r => ({ ...r, [etapa.tipo]: e.target.value || null }))}
                  className={cn(
                    'w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300',
                    faltaResponsable ? 'border-red-300' : 'border-slate-200'
                  )}
                >
                  <option value="">Sin asignar</option>
                  {opcionesResponsable(responsables[etapa.tipo]).map(p => (
                    <option key={p.email} value={p.email}>{p.nombre}</option>
                  ))}
                </select>
              </div>
            </div>
          </Seccion>
        )
      })}

      <div className="flex justify-end">
        <button
          onClick={handleGuardar}
          disabled={isPending}
          className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {isPending ? 'Guardando...' : 'Guardar fechas'}
        </button>
      </div>

      {/* ── Historial de cambios ─────────────────────────────────────────── */}
      {historial.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700">
            <History size={14} className="text-slate-400" />
            Historial de cambios
          </h3>
          <ol className="space-y-0 divide-y divide-slate-50">
            {historial.map(h => (
              <li key={h.id} className="flex gap-3 py-3">
                <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-400 ring-2 ring-blue-100" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-slate-600">{h.label_fecha}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    <span className="text-slate-400">{formatFecha(h.fecha_anterior)}</span>
                    {' → '}
                    <span className="font-semibold text-slate-700">{formatFecha(h.fecha_nueva)}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {h.usuario ?? 'Sistema'} · {formatRelativa(h.created_at)}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}
