import { createClient } from '@/lib/supabase/server'
import { Skeleton } from '@/components/ui/skeleton'
import { GraficaProcesosChart } from './GraficaProcesosChart'
import { PROCESOS_INTERNOS } from '@/lib/constants'

async function getProcesosData() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('requerimientos')
    .select('proceso_interno')
    .eq('es_borrador', false)
    .not('proceso_interno', 'is', null)

  const conteo: Record<string, number> = {}
  for (const r of data ?? []) {
    if (r.proceso_interno) {
      conteo[r.proceso_interno] = (conteo[r.proceso_interno] ?? 0) + 1
    }
  }
  const total = Object.values(conteo).reduce((a, b) => a + b, 0)

  return PROCESOS_INTERNOS.map(p => ({
    proceso: p.value,
    label: p.label,
    count: conteo[p.value] ?? 0,
    pct: total > 0 ? Math.round(((conteo[p.value] ?? 0) / total) * 100) : 0,
  })).sort((a, b) => b.count - a.count)
}

export async function GraficaProcesos() {
  const data = await getProcesosData()

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-1 text-sm font-semibold text-slate-700">Distribución por proceso</h2>
      <p className="mb-4 text-xs text-slate-400">Requerimientos agrupados por proceso interno</p>
      <GraficaProcesosChart data={data} />
    </div>
  )
}

export function GraficaProcesosSkeleton() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <Skeleton className="mb-1 h-4 w-44" />
      <Skeleton className="mb-4 h-3 w-56" />
      <div className="flex items-center gap-6">
        <Skeleton className="h-44 w-44 rounded-full" />
        <div className="flex-1 space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-3 w-full" />
          ))}
        </div>
      </div>
    </div>
  )
}
