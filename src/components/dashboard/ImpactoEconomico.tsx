import { createClient } from '@/lib/supabase/server'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCOP } from '@/lib/utils'
import { DollarSign, Calendar, Clock, ClipboardCheck, TrendingUp } from 'lucide-react'

async function getImpactoData() {
  try {
  const supabase = await createClient()

  const [{ data: impacto }, { count: totalReq }, { data: reqs }] = await Promise.all([
    supabase.from('v_impacto_economico').select('*'),
    supabase.from('requerimientos')
      .select('*', { count: 'exact', head: true })
      .eq('es_borrador', false),
    // Leemos los campos nuevos directamente de la tabla para garantizar el total
    supabase.from('requerimientos')
      .select('ahorro_mensual_cop, ahorro_anual_cop, horas_ahorradas_mes, total_beneficios_cualitativos_anual, impacto_economico_total_anual')
      .eq('es_borrador', false),
  ])

  const totales = (reqs ?? []).reduce(
    (acc, r: any) => ({
      ahorro_mensual:    acc.ahorro_mensual    + (r.ahorro_mensual_cop                    ?? 0),
      ahorro_anual_hh:  acc.ahorro_anual_hh   + (r.ahorro_anual_cop                      ?? 0),
      cualitativos:     acc.cualitativos       + (r.total_beneficios_cualitativos_anual   ?? 0),
      impacto_total:    acc.impacto_total      + (r.impacto_economico_total_anual         ?? (r.ahorro_anual_cop ?? 0)),
      horas_mes:        acc.horas_mes          + (r.horas_ahorradas_mes                   ?? 0),
      con_impacto:      r.ahorro_anual_cop || r.impacto_economico_total_anual
                          ? acc.con_impacto + 1 : acc.con_impacto,
    }),
    { ahorro_mensual: 0, ahorro_anual_hh: 0, cualitativos: 0, impacto_total: 0, horas_mes: 0, con_impacto: 0 }
  )

  return { ...totales, total: totalReq ?? 0 }
  } catch {
    return { ahorro_mensual: 0, ahorro_anual_hh: 0, cualitativos: 0, impacto_total: 0, horas_mes: 0, con_impacto: 0, total: 0 }
  }
}

export async function ImpactoEconomico() {
  const d = await getImpactoData()
  const tieneCualitativos = d.cualitativos > 0

  const stats = [
    {
      icono: TrendingUp,
      label: 'Impacto económico total anual',
      valor: formatCOP(d.impacto_total),
      sub: tieneCualitativos ? 'HH + beneficios cualitativos' : 'COP / año',
      destacado: true,
    },
    {
      icono: DollarSign,
      label: 'Ahorro en horas hombre/año',
      valor: formatCOP(d.ahorro_anual_hh),
      sub: 'COP / año',
    },
    ...(tieneCualitativos ? [{
      icono: Calendar,
      label: 'Beneficios cualitativos/año',
      valor: formatCOP(d.cualitativos),
      sub: 'COP / año',
    }] : []),
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
        <p className="text-xs text-slate-400">
          Ahorro en horas hombre{tieneCualitativos ? ' + beneficios cualitativos cuantificados' : ''} · Solo requerimientos publicados
        </p>
      </div>

      <div className={`grid gap-4 ${stats.length <= 4 ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-2 lg:grid-cols-5'}`}>
        {stats.map(({ icono: Icono, label, valor, sub, destacado }) => (
          <div
            key={label}
            className={`rounded-lg p-4 backdrop-blur-sm ${destacado ? 'bg-emerald-500/20 ring-1 ring-emerald-400/30 col-span-2 lg:col-span-1' : 'bg-white/10'}`}
          >
            <div className={`mb-2 flex h-8 w-8 items-center justify-center rounded-md ${destacado ? 'bg-emerald-400/30' : 'bg-blue-500/30'}`}>
              <Icono size={16} className={destacado ? 'text-emerald-300' : 'text-blue-300'} />
            </div>
            <p className="text-xs font-medium text-slate-400">{label}</p>
            <p className={`mt-1 font-bold text-white ${destacado ? 'text-2xl' : 'text-xl'}`}>{valor}</p>
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
