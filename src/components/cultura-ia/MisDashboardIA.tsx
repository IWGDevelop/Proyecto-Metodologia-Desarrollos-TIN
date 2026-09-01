import Link from 'next/link'
import { Clock, DollarSign, FileText, Plus, Cpu, Calendar } from 'lucide-react'
import { getMisRegistrosUsoIA, getMisMétricasUsoIA } from '@/actions/registros-uso-ia'

function fmtCOP(n: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)
}
function fmtDate(s: string) {
  return new Date(s + 'T12:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

export async function MisDashboardIA() {
  const [registros, metricas] = await Promise.all([
    getMisRegistrosUsoIA(),
    getMisMétricasUsoIA(),
  ])

  return (
    <div className="space-y-6">
      {/* Cards de métricas personales */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500 uppercase tracking-wide">
            <FileText size={13} className="text-violet-400" /> Registros
          </div>
          <p className="mt-2 text-3xl font-bold text-slate-800">{metricas.total_registros}</p>
        </div>
        <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-medium text-emerald-600 uppercase tracking-wide">
            <Clock size={13} /> Horas/mes
          </div>
          <p className="mt-2 text-3xl font-bold text-emerald-700">{metricas.total_horas_mes}h</p>
          <p className="text-xs text-emerald-500">ahorradas con IA</p>
        </div>
        <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-medium text-blue-600 uppercase tracking-wide">
            <DollarSign size={13} /> Ahorro/mes
          </div>
          <p className="mt-2 text-lg font-bold text-blue-700">{metricas.total_ahorro_mensual > 0 ? fmtCOP(metricas.total_ahorro_mensual) : '—'}</p>
        </div>
        <div className="rounded-xl border border-purple-100 bg-purple-50 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-medium text-purple-600 uppercase tracking-wide">
            <Cpu size={13} /> Herramientas
          </div>
          <p className="mt-2 text-sm font-semibold text-purple-700">{metricas.herramientas.slice(0, 2).join(', ') || '—'}</p>
        </div>
      </div>

      {/* Historial */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-800">Mis registros de uso</h2>
          <Link href="/cultura-ia/nuevo">
            <button className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-700">
              <Plus size={13} /> Nuevo registro
            </button>
          </Link>
        </div>

        {registros.length === 0 ? (
          <div className="p-10 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-violet-100">
              <Cpu size={22} className="text-violet-400" />
            </div>
            <p className="text-sm font-medium text-slate-500">Aún no tienes registros</p>
            <p className="mt-1 text-xs text-slate-400">Comienza registrando cómo usas la IA en tu trabajo</p>
            <Link href="/cultura-ia/nuevo">
              <button className="mt-4 flex items-center gap-1.5 mx-auto rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700">
                <Plus size={14} /> Mi primer registro
              </button>
            </Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Fecha</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Herramienta</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Proceso</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Horas/mes</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Ahorro/mes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {registros.map(r => (
                <tr key={r.id} className="hover:bg-violet-50 transition-colors">
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1 text-xs text-slate-500">
                      <Calendar size={11} /> {fmtDate(r.fecha)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-medium text-violet-700">
                      <Cpu size={10} /> {r.herramienta}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600 text-xs">{r.proceso}</td>
                  <td className="px-4 py-3 text-right font-semibold text-emerald-700">
                    {r.horas_ahorradas_mes > 0 ? `+${r.horas_ahorradas_mes}h` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-blue-700">
                    {r.ahorro_mensual_cop ? fmtCOP(r.ahorro_mensual_cop) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

export function MisDashboardIASkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="h-3 w-20 animate-pulse rounded bg-slate-100" />
            <div className="mt-3 h-8 w-16 animate-pulse rounded bg-slate-100" />
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex gap-4 py-3 border-b border-slate-50">
            <div className="h-4 w-24 animate-pulse rounded bg-slate-100" />
            <div className="h-4 w-32 animate-pulse rounded bg-slate-100" />
            <div className="h-4 flex-1 animate-pulse rounded bg-slate-100" />
          </div>
        ))}
      </div>
    </div>
  )
}
