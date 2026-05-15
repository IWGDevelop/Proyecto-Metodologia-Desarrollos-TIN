import { createAdminClient } from '@/lib/supabase/admin'
import { Skeleton } from '@/components/ui/skeleton'
import { Clock, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PRIORIDADES } from '@/lib/constants'
import type { Estado } from '@/lib/supabase/types'

// ─── Tipos ───────────────────────────────────────────────────────────────────
interface ReqHoras {
  id: string
  nombre: string
  prioridad: number | null
  estado: string
  alcance: string | null
  horas_estimadas: number
  horas_reales: number
}

// ─── Data fetching ─────────────────────────────────────────────────────────
async function getHorasDesarrollo() {
  try {
    const supabase = createAdminClient()

    // Requerimientos con estimación (no cerrados)
    const { data: reqs, error } = await (supabase as any)
      .from('requerimientos')
      .select('id, nombre_desarrollo, identificacion, prioridad, estado, alcance, horas_estimadas_desarrollo')
      .eq('es_borrador', false)
      .not('horas_estimadas_desarrollo', 'is', null)
      .gt('horas_estimadas_desarrollo', 0)
      .not('estado', 'in', '("CERRADO")')
      .order('prioridad', { ascending: true, nullsFirst: false })
      .order('horas_estimadas_desarrollo', { ascending: false })

    if (error || !reqs?.length) return { filas: [], totales: { estimadas: 0, reales: 0, conEstimacion: 0 } }

    // Para cada req, sumar horas reales de tareas DESARROLLO
    const ids = reqs.map((r: any) => r.id)

    const { data: tareasData } = await (supabase as any)
      .from('tareas_tecnicas')
      .select('requerimiento_id, registros_horas_tarea(horas)')
      .in('requerimiento_id', ids)
      .eq('categoria', 'DESARROLLO')

    // Agrupar horas reales por requerimiento
    const horasPorReq: Record<string, number> = {}
    for (const t of tareasData ?? []) {
      const rid = t.requerimiento_id
      const horas = (t.registros_horas_tarea ?? []).reduce((s: number, r: any) => s + (r.horas ?? 0), 0)
      horasPorReq[rid] = (horasPorReq[rid] ?? 0) + horas
    }

    const filas: ReqHoras[] = reqs.map((r: any) => ({
      id: r.id,
      nombre: r.nombre_desarrollo ?? r.identificacion ?? '—',
      prioridad: r.prioridad,
      estado: r.estado,
      alcance: r.alcance,
      horas_estimadas: r.horas_estimadas_desarrollo ?? 0,
      horas_reales: horasPorReq[r.id] ?? 0,
    }))

    const totales = {
      estimadas:    filas.reduce((s, r) => s + r.horas_estimadas, 0),
      reales:       filas.reduce((s, r) => s + r.horas_reales, 0),
      conEstimacion: filas.length,
    }

    return { filas, totales }
  } catch {
    return { filas: [], totales: { estimadas: 0, reales: 0, conEstimacion: 0 } }
  }
}

// ─── Barra de progreso de horas ───────────────────────────────────────────
function BarraHoras({ reales, estimadas }: { reales: number; estimadas: number }) {
  if (estimadas === 0) return <span className="text-xs text-slate-300">—</span>
  const pct     = Math.min((reales / estimadas) * 100, 100)
  const excede  = reales > estimadas
  const completo = reales >= estimadas

  return (
    <div className="space-y-1 min-w-[120px]">
      <div className="flex items-center justify-between text-[10px] text-slate-500">
        <span className={cn('font-semibold', excede ? 'text-red-600' : completo ? 'text-emerald-600' : 'text-slate-600')}>
          {reales.toFixed(1)} h
        </span>
        <span className="text-slate-400">/ {estimadas.toFixed(1)} h</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', excede ? 'bg-red-400' : completo ? 'bg-emerald-400' : 'bg-blue-400')}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      {excede && (
        <p className="text-[10px] font-medium text-red-500">
          +{(reales - estimadas).toFixed(1)} h sobre estimado
        </p>
      )}
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────
export async function HorasDesarrollo() {
  const { filas, totales } = await getHorasDesarrollo()

  const horasInvertidas = totales.reales
  const pctAvance = totales.estimadas > 0
    ? Math.round((horasInvertidas / totales.estimadas) * 100)
    : 0

  const reqsExceden = filas.filter(r => r.horas_reales > r.horas_estimadas).length
  const reqsSinIniciar = filas.filter(r => r.horas_reales === 0).length

  if (filas.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex items-center gap-2 mb-3">
          <Clock size={16} className="text-blue-500" />
          <h2 className="text-sm font-bold text-slate-800">Horas de desarrollo estimadas</h2>
        </div>
        <p className="text-sm text-slate-400 text-center py-6">
          Sin requerimientos con horas estimadas. Asígnalas desde el detalle de cada requerimiento → pestaña Desarrollo.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="border-b border-slate-100 px-5 py-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-blue-500" />
            <h2 className="text-sm font-bold text-slate-800">Horas de desarrollo estimadas</h2>
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-700">
              {totales.conEstimacion} reqs
            </span>
          </div>

          {/* KPIs compactos */}
          <div className="flex items-center gap-4 text-xs">
            <div className="text-center">
              <p className="text-slate-400">Total estimado</p>
              <p className="font-extrabold text-slate-800 text-base">{totales.estimadas.toFixed(1)} h</p>
            </div>
            <div className="text-center">
              <p className="text-slate-400">Invertidas</p>
              <p className={cn('font-extrabold text-base', pctAvance > 100 ? 'text-red-600' : 'text-emerald-600')}>
                {horasInvertidas.toFixed(1)} h
              </p>
            </div>
            <div className="text-center">
              <p className="text-slate-400">Avance</p>
              <p className={cn('font-extrabold text-base', pctAvance >= 80 ? 'text-emerald-600' : pctAvance >= 40 ? 'text-amber-600' : 'text-blue-600')}>
                {pctAvance}%
              </p>
            </div>
          </div>
        </div>

        {/* Alertas resumen */}
        {(reqsExceden > 0 || reqsSinIniciar > 0) && (
          <div className="mt-3 flex flex-wrap gap-2">
            {reqsExceden > 0 && (
              <span className="flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600">
                <AlertTriangle size={11} />
                {reqsExceden} req{reqsExceden > 1 ? 's' : ''} excede{reqsExceden === 1 ? '' : 'n'} el estimado
              </span>
            )}
            {reqsSinIniciar > 0 && (
              <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                <Clock size={11} />
                {reqsSinIniciar} sin horas registradas
              </span>
            )}
          </div>
        )}
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium text-slate-400 w-10">P</th>
              <th className="px-4 py-2.5 text-left font-medium text-slate-400">Requerimiento</th>
              <th className="px-4 py-2.5 text-left font-medium text-slate-400 w-24">Estado</th>
              <th className="px-4 py-2.5 text-left font-medium text-slate-400 w-20">Alcance</th>
              <th className="px-4 py-2.5 text-left font-medium text-slate-400 w-48">
                Progreso horas (real / estimado)
              </th>
              <th className="px-4 py-2.5 text-center font-medium text-slate-400 w-16">Est.</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filas.map(r => {
              const priCfg = r.prioridad ? PRIORIDADES[r.prioridad] : null
              const excede  = r.horas_reales > r.horas_estimadas
              const completo = r.horas_reales >= r.horas_estimadas && r.horas_reales > 0
              const sinIniciar = r.horas_reales === 0

              return (
                <tr key={r.id} className={cn(
                  'hover:bg-slate-50/70 transition-colors',
                  excede && 'bg-red-50/40'
                )}>
                  {/* Prioridad */}
                  <td className="px-4 py-3">
                    {priCfg ? (
                      <span className={cn('rounded-full px-1.5 py-0.5 text-xs font-bold', priCfg.bgColor, priCfg.textColor)}>
                        P{r.prioridad}
                      </span>
                    ) : (
                      <span className="text-slate-300 text-xs">—</span>
                    )}
                  </td>

                  {/* Nombre */}
                  <td className="px-4 py-3 max-w-[280px]">
                    <p className="font-medium text-slate-700 line-clamp-1">{r.nombre}</p>
                  </td>

                  {/* Estado */}
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                      {r.estado.replace(/_/g, ' ')}
                    </span>
                  </td>

                  {/* Alcance */}
                  <td className="px-4 py-3">
                    <span className={cn('text-xs font-semibold', {
                      'text-blue-600': r.alcance === 'IWF',
                      'text-green-600': r.alcance === 'ILT',
                      'text-purple-600': r.alcance === 'IWG',
                    })}>
                      {r.alcance ?? '—'}
                    </span>
                  </td>

                  {/* Barra de progreso */}
                  <td className="px-4 py-3">
                    <BarraHoras reales={r.horas_reales} estimadas={r.horas_estimadas} />
                  </td>

                  {/* Icono estado */}
                  <td className="px-4 py-3 text-center">
                    {excede ? (
                      <span title="Supera el estimado"><TrendingUp size={14} className="mx-auto text-red-500" /></span>
                    ) : completo ? (
                      <span title="Completado"><CheckCircle2 size={14} className="mx-auto text-emerald-500" /></span>
                    ) : sinIniciar ? (
                      <span title="Sin iniciar"><Clock size={14} className="mx-auto text-slate-300" /></span>
                    ) : (
                      <span title="En progreso"><TrendingDown size={14} className="mx-auto text-blue-400" /></span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>

          {/* Totales */}
          {filas.length > 1 && (
            <tfoot className="border-t-2 border-slate-200 bg-slate-50">
              <tr>
                <td colSpan={4} className="px-4 py-2.5 text-xs font-semibold text-slate-600">
                  Totales ({filas.length} requerimientos)
                </td>
                <td className="px-4 py-2.5">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="font-bold text-slate-700">{horasInvertidas.toFixed(1)} h</span>
                      <span className="text-slate-400">/ {totales.estimadas.toFixed(1)} h</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
                      <div
                        className={cn('h-full rounded-full', pctAvance > 100 ? 'bg-red-400' : 'bg-blue-400')}
                        style={{ width: `${Math.min(pctAvance, 100)}%` }}
                      />
                    </div>
                  </div>
                </td>
                <td className="px-4 py-2.5 text-center text-xs font-bold text-slate-700">{pctAvance}%</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────
export function HorasDesarrolloSkeleton() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-56" />
        <div className="flex gap-4">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-20" />
        </div>
      </div>
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <Skeleton className="h-5 w-8 rounded-full" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-40" />
          </div>
        ))}
      </div>
    </div>
  )
}
