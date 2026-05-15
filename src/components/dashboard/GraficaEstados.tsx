import { createClient } from '@/lib/supabase/server'
import { Skeleton } from '@/components/ui/skeleton'
import { GraficaEstadosChart } from './GraficaEstadosChart'
import { ESTADOS } from '@/lib/constants'
import type { Estado } from '@/lib/supabase/types'

const ESTADO_COLORS: Record<string, string> = {
  SIN_GESTION:          '#94a3b8',
  ANALISIS:             '#3b82f6',
  EN_DEFINICION_USUARIO:'#a855f7',
  EN_DESARROLLO:        '#6366f1',
  PRUEBAS_USUARIO:      '#f59e0b',
  STAND_BY:             '#f97316',
  ENTREGADO:            '#22c55e',
  CERRADO:              '#6b7280',
}

async function getEstadosData() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('requerimientos')
    .select('estado')
    .eq('es_borrador', false)

  const conteo: Record<string, number> = {}
  for (const r of data ?? []) {
    conteo[r.estado] = (conteo[r.estado] ?? 0) + 1
  }
  const total = Object.values(conteo).reduce((a, b) => a + b, 0)

  return Object.entries(ESTADOS).map(([estado, cfg]) => ({
    estado,
    label: cfg.label,
    count: conteo[estado] ?? 0,
    pct: total > 0 ? Math.round(((conteo[estado] ?? 0) / total) * 100) : 0,
    color: ESTADO_COLORS[estado as Estado],
  }))
}

export async function GraficaEstados() {
  const data = await getEstadosData()

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-1 text-sm font-semibold text-slate-700">Distribución por estado</h2>
      <p className="mb-4 text-xs text-slate-400">Requerimientos publicados por estado actual</p>
      <GraficaEstadosChart data={data} />
    </div>
  )
}

export function GraficaEstadosSkeleton() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <Skeleton className="mb-1 h-4 w-40" />
      <Skeleton className="mb-4 h-3 w-52" />
      <div className="space-y-3">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-6 flex-1 rounded" style={{ maxWidth: `${40 + i * 8}%` }} />
          </div>
        ))}
      </div>
    </div>
  )
}
