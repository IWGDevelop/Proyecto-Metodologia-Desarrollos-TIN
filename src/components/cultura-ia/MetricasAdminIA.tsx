import { Clock, DollarSign, Trophy, Users, Cpu, TrendingUp, Medal } from 'lucide-react'
import { getOverviewMetricasIA, getMetricasUsoIAPorUsuario } from '@/actions/registros-uso-ia'

function fmtCOP(n: number) {
  if (n === 0) return '—'
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)
}

function fmtDate(s: string) {
  return new Date(s + 'T12:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

const MEDAL_ICON = [
  <span key={0} className="text-amber-400 font-bold text-base">🥇</span>,
  <span key={1} className="text-slate-400 font-bold text-base">🥈</span>,
  <span key={2} className="text-amber-600 font-bold text-base">🥉</span>,
]

export async function MetricasAdminIA() {
  const [overview, ranking] = await Promise.all([
    getOverviewMetricasIA(),
    getMetricasUsoIAPorUsuario(),
  ])

  return (
    <div className="space-y-6">
      {/* Cards overview */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50 to-purple-50 p-4">
          <div className="flex items-center gap-2 text-xs font-medium text-violet-600 uppercase tracking-wide">
            <Users size={13} /> Funcionarios activos
          </div>
          <p className="mt-2 text-4xl font-bold text-violet-700">{overview.total_usuarios}</p>
          <p className="text-xs text-violet-500">usando IA activamente</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-green-50 p-4">
          <div className="flex items-center gap-2 text-xs font-medium text-emerald-600 uppercase tracking-wide">
            <Clock size={13} /> Total horas/mes
          </div>
          <p className="mt-2 text-4xl font-bold text-emerald-700">{overview.total_horas_mes}h</p>
          <p className="text-xs text-emerald-500">ahorradas por el equipo</p>
        </div>
        <div className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-4">
          <div className="flex items-center gap-2 text-xs font-medium text-blue-600 uppercase tracking-wide">
            <DollarSign size={13} /> Ahorro mensual
          </div>
          <p className="mt-2 text-3xl font-bold text-blue-700">{fmtCOP(overview.total_ahorro_mensual)}</p>
          <p className="text-xs text-blue-500">impacto económico del equipo</p>
        </div>
        <div className="rounded-xl border border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50 p-4">
          <div className="flex items-center gap-2 text-xs font-medium text-orange-600 uppercase tracking-wide">
            <TrendingUp size={13} /> Ahorro anual proy.
          </div>
          <p className="mt-2 text-3xl font-bold text-orange-700">{fmtCOP(overview.total_ahorro_anual)}</p>
          <p className="text-xs text-orange-500">{overview.total_registros} registros totales</p>
        </div>
      </div>

      {/* Herramientas más usadas */}
      {overview.herramientas_top.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-800">
            <Cpu size={15} className="text-violet-500" /> Herramientas más utilizadas
          </h2>
          <div className="flex flex-wrap gap-2">
            {overview.herramientas_top.map(({ herramienta, count }) => (
              <div key={herramienta} className="flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5">
                <span className="text-sm font-medium text-violet-800">{herramienta}</span>
                <span className="rounded-full bg-violet-200 px-1.5 py-0.5 text-xs font-bold text-violet-700">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ranking de funcionarios */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-4 flex items-center gap-2">
          <Trophy size={16} className="text-amber-500" />
          <h2 className="text-sm font-semibold text-slate-800">Ranking de Adoptadores de IA</h2>
          <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{ranking.length} funcionarios</span>
        </div>

        {ranking.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm text-slate-400">Aún no hay registros de uso de IA en el equipo.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="w-10 px-3 py-2.5" />
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Cédula</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Funcionario</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Área</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Registros</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Hrs/mes</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Ahorro/mes</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Ahorro/año</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Herramientas</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Último</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {ranking.map((m, idx) => (
                  <tr key={m.usuario_id} className={`transition-colors hover:bg-violet-50 ${idx < 3 ? 'bg-amber-50/30' : ''}`}>
                    <td className="px-3 py-3 text-center">
                      {idx < 3 ? MEDAL_ICON[idx] : (
                        <span className="text-xs font-medium text-slate-400">#{idx + 1}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{m.cedula ?? '—'}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">{m.nombre}</p>
                      {m.cargo && <p className="text-xs text-slate-400">{m.cargo}</p>}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{m.proceso_interno ?? '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <span className="inline-flex items-center justify-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700">
                        {m.total_registros}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-700">
                      {m.total_horas_ahorradas_mes > 0 ? `+${Math.round(m.total_horas_ahorradas_mes * 10) / 10}h` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-blue-700 font-medium">
                      {fmtCOP(m.total_ahorro_mensual_cop)}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-indigo-700 font-bold">
                      {fmtCOP(m.total_ahorro_anual_cop)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {m.herramientas.slice(0, 2).map(h => (
                          <span key={h} className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-medium text-violet-700">{h}</span>
                        ))}
                        {m.herramientas.length > 2 && (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">+{m.herramientas.length - 2}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-slate-400">{fmtDate(m.ultimo_registro)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export function MetricasAdminIASkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="h-3 w-20 animate-pulse rounded bg-slate-100" />
            <div className="mt-3 h-10 w-24 animate-pulse rounded bg-slate-100" />
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex gap-4 py-3 border-b border-slate-50">
            {[...Array(6)].map((__, j) => (
              <div key={j} className="h-4 flex-1 animate-pulse rounded bg-slate-100" />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
