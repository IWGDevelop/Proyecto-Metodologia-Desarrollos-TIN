'use client'

import { useState, useTransition } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getConfigSLA, actualizarConfigSLA, getEstadisticasSLA } from '@/actions/configuracion-sla'
import type { ConfigSLA, EstadisticaSLA } from '@/actions/configuracion-sla'
import { Skeleton } from '@/components/ui/skeleton'
import { Save, Info, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const PRIORIDAD_CFG: Record<number, { label: string; bg: string; text: string; border: string; ring: string }> = {
  1: { label: 'P1 Crítica', bg: 'bg-red-50',    text: 'text-red-700',    border: 'border-red-200',    ring: 'ring-red-400'    },
  2: { label: 'P2 Alta',    bg: 'bg-orange-50',  text: 'text-orange-700', border: 'border-orange-200', ring: 'ring-orange-400' },
  3: { label: 'P3 Media',   bg: 'bg-yellow-50',  text: 'text-yellow-700', border: 'border-yellow-200', ring: 'ring-yellow-400' },
  4: { label: 'P4 Baja',    bg: 'bg-green-50',   text: 'text-green-700',  border: 'border-green-200',  ring: 'ring-green-400'  },
}

function PctBadge({ pct, total }: { pct: number; total: number }) {
  if (total === 0) return <span className="text-xs text-slate-400">Sin datos</span>
  const color = pct >= 80 ? 'text-emerald-600' : pct >= 60 ? 'text-amber-600' : 'text-red-600'
  const Icon  = pct >= 80 ? TrendingUp : pct >= 60 ? Minus : TrendingDown
  return (
    <span className={cn('flex items-center gap-1 text-sm font-bold', color)}>
      <Icon size={13} /> {pct}%
    </span>
  )
}

/* ── Fila editable de prioridad ─────────────────────────────────────────── */
function FilaSLA({
  config, estadistica, onSaved,
}: {
  config: ConfigSLA
  estadistica?: EstadisticaSLA
  onSaved: () => void
}) {
  const [dias, setDias]       = useState(config.dias_limite)
  const [label, setLabel]     = useState(config.label)
  const [desc, setDesc]       = useState(config.descripcion ?? '')
  const [isPending, startT]   = useTransition()
  const cfg = PRIORIDAD_CFG[config.prioridad]

  const cambiado = dias !== config.dias_limite || label !== config.label || desc !== (config.descripcion ?? '')

  const guardar = () => {
    if (dias < 1) { toast.error('Los días deben ser mayor a 0'); return }
    startT(async () => {
      const res = await actualizarConfigSLA(config.prioridad, {
        dias_limite: dias, label, descripcion: desc || null,
      })
      if (res.ok) { toast.success(`SLA P${config.prioridad} actualizado`); onSaved() }
      else toast.error(res.error ?? 'Error al guardar')
    })
  }

  const conDatos = (estadistica?.cumple ?? 0) + (estadistica?.no_cumple ?? 0)

  return (
    <div className={cn('rounded-xl border p-4 space-y-4', cfg.border)}>
      {/* Encabezado */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className={cn('rounded-full px-3 py-1 text-xs font-bold', cfg.bg, cfg.text)}>
            {cfg.label}
          </span>
          {cambiado && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
              Sin guardar
            </span>
          )}
        </div>
        {estadistica && estadistica.total > 0 && (
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span>{estadistica.total} reqs</span>
            <span className="text-emerald-600">✓ {estadistica.cumple} cumplen</span>
            <span className="text-red-500">✗ {estadistica.no_cumple} incumplen</span>
            {estadistica.promedio_dias !== null && (
              <span>⌀ {estadistica.promedio_dias} días</span>
            )}
          </div>
        )}
      </div>

      {/* Campos editables */}
      <div className="grid gap-3 sm:grid-cols-[auto_1fr_1fr]">
        {/* Días límite — campo principal */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-600">Días límite SLA</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={365}
              value={dias}
              onChange={e => setDias(parseInt(e.target.value) || 1)}
              className={cn(
                'w-24 rounded-lg border-2 px-3 py-2 text-xl font-bold text-center outline-none transition-all',
                cfg.border, cfg.text, cfg.bg,
                'focus:ring-2', cfg.ring
              )}
            />
            <span className="text-sm text-slate-500">días hábiles</span>
          </div>
          {estadistica && conDatos > 0 && (
            <div className="flex items-center gap-2">
              <PctBadge pct={estadistica.pct_cumple} total={conDatos} />
              <span className="text-xs text-slate-400">cumplimiento actual</span>
            </div>
          )}
        </div>

        {/* Etiqueta */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-600">Etiqueta</label>
          <input
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder="Ej. Crítica"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
          />
        </div>

        {/* Descripción */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-600">Descripción</label>
          <input
            value={desc}
            onChange={e => setDesc(e.target.value)}
            placeholder="Descripción de la prioridad"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
          />
        </div>
      </div>

      {/* Botón guardar */}
      {cambiado && (
        <div className="flex items-center justify-between rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
          <p className="text-xs text-amber-700">
            ⚠ Cambiar el SLA actualizará el cálculo <strong>cumple_sla</strong> en todos los requerimientos de esta prioridad.
          </p>
          <button
            onClick={guardar}
            disabled={isPending}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap ml-3"
          >
            <Save size={13} />
            {isPending ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      )}
    </div>
  )
}

/* ── Componente principal ────────────────────────────────────────────────── */
export function GestionSLA() {
  const qc = useQueryClient()

  const { data: configs = [], isLoading: loadingCfg } = useQuery<ConfigSLA[]>({
    queryKey: ['config-sla'],
    queryFn: getConfigSLA,
    staleTime: 30_000,
  })

  const { data: estadisticas = [], isLoading: loadingStats } = useQuery<EstadisticaSLA[]>({
    queryKey: ['estadisticas-sla'],
    queryFn: getEstadisticasSLA,
    staleTime: 60_000,
  })

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['config-sla'] })
    qc.invalidateQueries({ queryKey: ['estadisticas-sla'] })
  }

  const isLoading = loadingCfg || loadingStats

  // Totales globales
  const totalReqs    = estadisticas.reduce((s, e) => s + e.total, 0)
  const totalCumple  = estadisticas.reduce((s, e) => s + e.cumple, 0)
  const totalConDatos = estadisticas.reduce((s, e) => s + e.cumple + e.no_cumple, 0)
  const pctGlobal    = totalConDatos > 0 ? Math.round((totalCumple / totalConDatos) * 100) : null

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="space-y-1">
        <h2 className="text-lg font-bold text-slate-800">SLA y Prioridades</h2>
        <p className="text-sm text-slate-500">
          Define cuántos días hábiles tiene el equipo TIN para iniciar el desarrollo
          desde que se recibe el requerimiento, según su prioridad.
        </p>
      </div>

      {/* Explicación de la métrica */}
      <div className="flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4">
        <Info size={16} className="mt-0.5 shrink-0 text-blue-500" />
        <div className="text-xs text-blue-700 space-y-1">
          <p className="font-semibold">¿Cómo se calcula el SLA?</p>
          <p>
            <strong>Días respuesta TIN</strong> = <code className="bg-blue-100 px-1 rounded">fecha_inicio_desarrollo − fecha_envio_tin</code>
          </p>
          <p>
            <strong>Cumple SLA</strong> = los días de respuesta son ≤ al límite configurado para esa prioridad.
          </p>
          <p className="text-blue-600">
            Solo se calcula cuando ambas fechas están registradas. Si falta alguna, queda como "Sin datos".
          </p>
        </div>
      </div>

      {/* KPI global */}
      {!isLoading && totalReqs > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-center">
            <p className="text-xs text-slate-500">Requerimientos evaluados</p>
            <p className="mt-1 text-2xl font-extrabold text-slate-800">{totalReqs}</p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center">
            <p className="text-xs text-slate-500">Cumplen SLA</p>
            <p className="mt-1 text-2xl font-extrabold text-emerald-700">{totalCumple}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-center">
            <p className="text-xs text-slate-500">Cumplimiento global</p>
            {pctGlobal !== null ? (
              <p className={cn(
                'mt-1 text-2xl font-extrabold',
                pctGlobal >= 80 ? 'text-emerald-600' : pctGlobal >= 60 ? 'text-amber-600' : 'text-red-600'
              )}>
                {pctGlobal}%
              </p>
            ) : (
              <p className="mt-1 text-sm text-slate-400">Sin datos</p>
            )}
          </div>
        </div>
      )}

      {/* Filas por prioridad */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-36 w-full rounded-xl" />)}
        </div>
      ) : (
        <div className="space-y-3">
          {configs.map(cfg => (
            <FilaSLA
              key={cfg.prioridad}
              config={cfg}
              estadistica={estadisticas.find(e => e.prioridad === cfg.prioridad)}
              onSaved={refresh}
            />
          ))}
        </div>
      )}

      {/* Nota sobre la vista */}
      <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-xs text-slate-500 space-y-1">
        <p className="font-semibold text-slate-600">Nota técnica</p>
        <p>
          Los cambios se aplican inmediatamente en todos los reportes y el tablero Kanban.
          La vista <code className="bg-slate-200 px-1 rounded">v_metricas_requerimientos</code> consulta
          esta tabla en tiempo real para calcular <code className="bg-slate-200 px-1 rounded">cumple_sla</code>.
        </p>
      </div>
    </div>
  )
}
