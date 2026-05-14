import { createClient } from '@/lib/supabase/server'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCOP } from '@/lib/utils'
import { DollarSign, Calendar, Clock, ClipboardCheck } from 'lucide-react'

async function getImpactoData() {
  const supabase = await createClient()

  const [{ data: impacto }, { count: totalReq }] = await Promise.all([
    supabase.from('v_impacto_economico').select('*'),
    supabase.from('requerimientos')
      .select('*', { count: 'exact', head: true })
      .eq('es_borrador', false),
  ])

  const totales = (impacto ?? []).reduce(
    (acc, row) => ({
      ahorro_mensual: acc.ahorro_mensual + (row.total_ahorro_mensual_cop ?? 0),
      ahorro_anual:   acc.ahorro_anual   + (row.total_ahorro_anual_cop   ?? 0),
      horas_mes:      acc.horas_mes      + (row.total_horas_mes          ?? 0),
      con_impacto:    acc.con_impacto    + (row.total_requerimientos     ?? 0),
    }),
    { ahorro_mensual: 0, ahorro_anual: 0, horas_mes: 0, con_impacto: 0 }
  )

  return { ...totales, total: totalReq ?? 0 }
}

export async function ImpactoEconomico() {
  const d = await getImpactoData()

  const stats = [
    {
      icono: DollarSign,
      label: 'Ahorro mensual total',
      valor: formatCOP(d.ahorro_mensual),
      sub: 'COP / mes',
    },
    {
      icono: Calendar,
      label: 'Ahorro anual proyectado',
      valor: formatCOP(d.ahorro_anual),
      sub: 'COP / año',
    },
    {
      icono: Clock,
      label: 'Horas hombre ahorradas',
      valor: `${d.horas_mes.toFixed(1)} h`,
      sub: 'por mes',
    },
    {
      icono: ClipboardCheck,
      label: 'Con impacto calculado',
      valor: `${d.con_impacto} de ${d.total}`,
      sub: 'requerimientos',
    },
  ]

  return (
    <div className="rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 p-6 text-white shadow-lg">
      <div className="mb-5">
        <h2 className="text-base font-semibold text-slate-200">Impacto económico total</h2>
        <p className="text-xs text-slate-400">Solo requerimientos publicados con cálculo registrado</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map(({ icono: Icono, label, valor, sub }) => (
          <div
            key={label}
            className="rounded-lg bg-white/10 p-4 backdrop-blur-sm"
          >
            <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-md bg-blue-500/30">
              <Icono size={16} className="text-blue-300" />
            </div>
            <p className="text-xs font-medium text-slate-400">{label}</p>
            <p className="mt-1 text-xl font-bold text-white">{valor}</p>
            <p className="text-xs text-slate-500">{sub}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export function ImpactoEconomicoSkeleton() {
  return (
    <div className="rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 p-6">
      <Skeleton className="mb-5 h-5 w-48 bg-white/20" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg bg-white/10 p-4">
            <Skeleton className="mb-2 h-8 w-8 rounded-md bg-white/20" />
            <Skeleton className="h-3 w-24 bg-white/20" />
            <Skeleton className="mt-2 h-6 w-28 bg-white/20" />
          </div>
        ))}
      </div>
    </div>
  )
}
