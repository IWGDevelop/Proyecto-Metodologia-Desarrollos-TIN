import { getSesionesLog, getEstadisticasSesiones } from '@/actions/sesiones'
import { Monitor, Users, LogIn, Globe, Mail, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

function formatFecha(iso: string) {
  return new Date(iso).toLocaleString('es-CO', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Bogota',
  })
}

function StatCard({ label, value, sub, icon: Icon, color }: {
  label: string; value: number; sub?: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  color: string
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 flex items-start gap-4">
      <div className={cn('rounded-lg p-2.5', color)}>
        <Icon size={18} className="text-white" />
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-800">{value.toLocaleString()}</p>
        <p className="text-sm font-medium text-slate-600">{label}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

export default async function SesionesPage() {
  const [sesiones, stats] = await Promise.all([
    getSesionesLog(300),
    getEstadisticasSesiones(),
  ])

  // Agrupar ingresos por día (últimos 14 días)
  const porDia: Record<string, number> = {}
  sesiones.forEach(s => {
    const dia = new Date(s.created_at).toLocaleDateString('es-CO', { timeZone: 'America/Bogota', month: 'short', day: 'numeric' })
    porDia[dia] = (porDia[dia] ?? 0) + 1
  })
  const diasOrdenados = Object.entries(porDia).slice(0, 14).reverse()
  const maxDia = Math.max(...diasOrdenados.map(([, v]) => v), 1)

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <Monitor size={20} className="text-blue-600" />
          Registro de Sesiones
        </h1>
        <p className="text-sm text-slate-500">Monitoreo de ingresos a la plataforma TIN-FLOW</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Ingresos hoy"       value={stats.totalHoy}              icon={LogIn}     color="bg-blue-500"    sub="últimas 24h" />
        <StatCard label="Ingresos semana"    value={stats.totalSemana}           icon={Calendar}  color="bg-indigo-500"  sub="últimos 7 días" />
        <StatCard label="Ingresos mes"       value={stats.totalMes}              icon={BarChart}  color="bg-violet-500"  sub="últimos 30 días" />
        <StatCard label="Usuarios activos hoy"    value={stats.usuariosActivosHoy}    icon={Users} color="bg-emerald-500" sub="usuarios únicos" />
        <StatCard label="Usuarios activos semana" value={stats.usuariosActivosSemana} icon={Users} color="bg-teal-500"   sub="usuarios únicos" />
      </div>

      {/* Mini gráfico por día */}
      {diasOrdenados.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="mb-4 text-sm font-semibold text-slate-600">Ingresos por día (últimos registros)</p>
          <div className="flex items-end gap-1.5 h-24">
            {diasOrdenados.map(([dia, count]) => (
              <div key={dia} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-[10px] text-slate-500 font-medium">{count}</span>
                <div
                  className="w-full rounded-t bg-blue-400"
                  style={{ height: `${Math.max(4, (count / maxDia) * 72)}px` }}
                />
                <span className="text-[9px] text-slate-400 text-center leading-tight">{dia}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabla de sesiones */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="border-b border-slate-100 bg-slate-50 px-5 py-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-700">Últimos {sesiones.length} ingresos</p>
          <span className="text-xs text-slate-400">Hora en Colombia (UTC-5)</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-400">Fecha y hora</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-400">Usuario</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-400">Correo</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-400">Método</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-400">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {sesiones.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-sm text-slate-400">
                    Sin registros aún. Los ingresos aparecerán aquí automáticamente.
                  </td>
                </tr>
              ) : sesiones.map(s => (
                <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-2.5 text-xs text-slate-500 whitespace-nowrap">
                    {formatFecha(s.created_at)}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="text-sm font-medium text-slate-700">
                      {s.nombre ?? '—'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-500">{s.email}</td>
                  <td className="px-4 py-2.5">
                    {s.metodo === 'google' ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 border border-red-200 px-2 py-0.5 text-xs font-medium text-red-600">
                        <Globe size={10} /> Google
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-xs font-medium text-blue-600">
                        <Mail size={10} /> Email
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-400 font-mono">
                    {s.ip ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function BarChart({ size, className }: { size?: number; className?: string }) {
  return (
    <svg width={size ?? 18} height={size ?? 18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  )
}
