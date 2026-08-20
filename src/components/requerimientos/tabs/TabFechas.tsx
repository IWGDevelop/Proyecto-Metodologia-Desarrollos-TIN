'use client'

import { useState, useTransition } from 'react'
import { CalendarDays, CheckCircle2, FlaskConical, Rocket, History, Wrench } from 'lucide-react'
import { toast } from 'sonner'
import { actualizarFechasEntrega, type FechasEntrega, type HistorialFecha } from '@/actions/fechas-entrega'
import { cn } from '@/lib/utils'

interface Props {
  requerimientoId: string
  fechasActuales: FechasEntrega
  historial: HistorialFecha[]
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

export function TabFechas({ requerimientoId, fechasActuales, historial }: Props) {
  const [fechas, setFechas] = useState<FechasEntrega>(fechasActuales)
  const [isPending, startTransition] = useTransition()

  const setFecha = (campo: keyof FechasEntrega, valor: string) =>
    setFechas(f => ({ ...f, [campo]: valor || null }))

  const handleGuardar = () => {
    startTransition(async () => {
      const res = await actualizarFechasEntrega(requerimientoId, fechas)
      if (res.ok) {
        toast.success('Fechas guardadas · Se notificó a los interesados')
        window.location.reload()
      } else {
        toast.error(res.error ?? 'Error al guardar fechas')
      }
    })
  }

  return (
    <div className="mt-4 space-y-5">

      {/* ── Entrega del desarrollo ──────────────────────────────────────── */}
      <Seccion
        titulo="Entrega del desarrollo"
        icon={<CheckCircle2 size={14} className="text-indigo-400" />}
        color="border-indigo-100 bg-indigo-50/30"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Campo
            label="Fecha estimada"
            value={fechas.fecha_estimada_entrega ?? ''}
            onChange={v => setFecha('fecha_estimada_entrega', v)}
          />
          <Campo
            label="Fecha real"
            value={fechas.fecha_real_entrega ?? ''}
            onChange={v => setFecha('fecha_real_entrega', v)}
            isReal
          />
        </div>
      </Seccion>

      {/* ── Feedback de pruebas de usuario ──────────────────────────────── */}
      <Seccion
        titulo="Feedback de pruebas de usuario"
        icon={<FlaskConical size={14} className="text-amber-400" />}
        color="border-amber-100 bg-amber-50/30"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Campo
            label="Fecha estimada"
            value={fechas.fecha_estimada_feedback_pruebas ?? ''}
            onChange={v => setFecha('fecha_estimada_feedback_pruebas', v)}
          />
          <Campo
            label="Fecha real"
            value={fechas.fecha_real_feedback_pruebas ?? ''}
            onChange={v => setFecha('fecha_real_feedback_pruebas', v)}
            isReal
          />
        </div>
      </Seccion>

      {/* ── Ajustes técnicos ─────────────────────────────────────────────── */}
      <Seccion
        titulo="Ajustes técnicos"
        icon={<Wrench size={14} className="text-violet-500" />}
        color="border-violet-100 bg-violet-50/30"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Campo
            label="Fecha estimada"
            value={fechas.fecha_estimada_ajustes_tecnicos ?? ''}
            onChange={v => setFecha('fecha_estimada_ajustes_tecnicos', v)}
          />
          <Campo
            label="Fecha real"
            value={fechas.fecha_real_ajustes_tecnicos ?? ''}
            onChange={v => setFecha('fecha_real_ajustes_tecnicos', v)}
            isReal
          />
        </div>
      </Seccion>

      {/* ── Salida en vivo ───────────────────────────────────────────────── */}
      <Seccion
        titulo="Salida en vivo"
        icon={<Rocket size={14} className="text-emerald-500" />}
        color="border-emerald-100 bg-emerald-50/30"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Campo
            label="Fecha estimada"
            value={fechas.fecha_estimada_salida_vivo ?? ''}
            onChange={v => setFecha('fecha_estimada_salida_vivo', v)}
          />
          <Campo
            label="Fecha real"
            value={fechas.fecha_salida_vivo ?? ''}
            onChange={v => setFecha('fecha_salida_vivo', v)}
            isReal
          />
        </div>
      </Seccion>

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
