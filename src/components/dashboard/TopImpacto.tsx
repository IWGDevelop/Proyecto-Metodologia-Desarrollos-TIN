import { createClient } from '@/lib/supabase/server'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCOP } from '@/lib/utils'
import { TrendingUp, ExternalLink } from 'lucide-react'
import Link from 'next/link'

async function getTopImpacto() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('v_top_impacto')
    .select('*')
    .limit(5)
  return data ?? []
}

export async function TopImpacto() {
  const rows = await getTopImpacto()

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <TrendingUp size={16} className="text-emerald-500" />
        <h2 className="text-sm font-semibold text-slate-700">Top 5 mayor impacto económico</h2>
      </div>

      {rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">
          Sin requerimientos con impacto calculado
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="pb-2 text-left text-xs font-medium text-slate-400">#</th>
                <th className="pb-2 text-left text-xs font-medium text-slate-400">Identificación</th>
                <th className="pb-2 text-left text-xs font-medium text-slate-400">Área</th>
                <th className="pb-2 text-right text-xs font-medium text-slate-400">Horas/mes</th>
                <th className="pb-2 text-right text-xs font-medium text-slate-400">Ahorro anual</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {rows.map((r, i) => (
                <tr key={r.id} className="group hover:bg-slate-50">
                  <td className="py-2.5 pr-3 text-xs font-medium text-slate-400">{i + 1}</td>
                  <td className="py-2.5 pr-4">
                    <p className="font-medium text-slate-700 line-clamp-1">{r.identificacion}</p>
                    {r.numero && <p className="text-xs text-slate-400">{r.numero}</p>}
                  </td>
                  <td className="py-2.5 pr-4">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                      {r.proceso_interno ?? r.alcance ?? '—'}
                    </span>
                  </td>
                  <td className="py-2.5 pr-4 text-right font-medium text-slate-600">
                    {r.horas_ahorradas_mes != null ? `${r.horas_ahorradas_mes} h` : '—'}
                  </td>
                  <td className="py-2.5 pr-2 text-right">
                    <p className="font-bold text-emerald-600">
                      {formatCOP((r as any).impacto_economico_total_anual ?? r.ahorro_anual_cop)}
                    </p>
                    {(r as any).total_beneficios_cualitativos_anual > 0 && (
                      <p className="text-[10px] text-slate-400">
                        incl. {formatCOP((r as any).total_beneficios_cualitativos_anual)} cualitativos
                      </p>
                    )}
                  </td>
                  <td className="py-2.5">
                    <Link href={`/requerimientos/${r.id}`}>
                      <ExternalLink
                        size={14}
                        className="text-slate-300 transition group-hover:text-blue-500"
                      />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export function TopImpactoSkeleton() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <Skeleton className="mb-4 h-4 w-52" />
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <Skeleton className="h-3 w-4" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </div>
    </div>
  )
}
