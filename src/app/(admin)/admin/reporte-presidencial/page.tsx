import { fetchReportePresidencial } from '@/actions/reporte-presidencial'
import { cn } from '@/lib/utils'
import {
  TrendingUp, Clock, AlertCircle, BarChart3,
  Building2, Layers, MapPin, Target,
} from 'lucide-react'

/* ── Formateadores ────────────────────────────────────────────────────────── */
function cop(v: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v)
}
const copFull = cop
function fechaLocal(iso: string) {
  return new Date(iso).toLocaleDateString('es-CO', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

/* ── KPI Card ─────────────────────────────────────────────────────────────── */
function KpiCard({
  label, valor, sub, icon: Icon, color,
}: {
  label: string; valor: string; sub?: string
  icon: React.ElementType; color: string
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
          <p className={cn('mt-1 text-3xl font-extrabold', color)}>{valor}</p>
          {sub && <p className="mt-0.5 text-xs text-slate-400">{sub}</p>}
        </div>
        <div className={cn('rounded-xl p-2.5', color.replace('text-', 'bg-').replace('700', '100').replace('600', '100'))}>
          <Icon size={20} className={color} />
        </div>
      </div>
    </div>
  )
}

/* ── Barra horizontal ─────────────────────────────────────────────────────── */
function BarraHorizontal({
  label, valor, max, display, colorBar = 'bg-blue-500',
}: {
  label: string; valor: number; max: number; display: string; colorBar?: string
}) {
  const pct = max > 0 ? Math.round((valor / max) * 100) : 0
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-600 truncate max-w-[60%]">{label}</span>
        <span className="text-xs font-bold text-slate-700">{display}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div className={cn('h-full rounded-full transition-all', colorBar)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

/* ── Sección wrapper ──────────────────────────────────────────────────────── */
function Seccion({ titulo, icono: Icon, children, className }: {
  titulo: string; icono: React.ElementType; children: React.ReactNode; className?: string
}) {
  return (
    <div className={cn('rounded-2xl border border-slate-200 bg-white p-5 shadow-sm', className)}>
      <div className="mb-4 flex items-center gap-2">
        <div className="rounded-lg bg-slate-100 p-1.5">
          <Icon size={15} className="text-slate-500" />
        </div>
        <h3 className="text-sm font-bold text-slate-700">{titulo}</h3>
      </div>
      {children}
    </div>
  )
}

/* ── Colores para estados ─────────────────────────────────────────────────── */
const ESTADO_BAR: Record<string, string> = {
  SIN_GESTION:           'bg-slate-400',
  ANALISIS:              'bg-blue-500',
  EN_DEFINICION_USUARIO: 'bg-violet-500',
  EN_DESARROLLO:         'bg-indigo-500',
  PRUEBAS_USUARIO:       'bg-amber-500',
  STAND_BY:              'bg-orange-400',
  ENTREGADO:             'bg-emerald-500',
  CERRADO:               'bg-teal-500',
}

const ORIGEN_BAR: Record<string, string> = {
  LISTA_MEJORAS_PENDIENTES: 'bg-amber-500',
  TIN_NOVA:                 'bg-violet-500',
  DESARROLLO_EXTERNO:       'bg-cyan-500',
  SIN_ORIGEN:               'bg-slate-300',
}

const ALCANCE_COLOR: Record<string, { badge: string; bar: string }> = {
  IWF: { badge: 'bg-blue-100 text-blue-700 border-blue-300',     bar: 'bg-blue-500'   },
  ILT: { badge: 'bg-green-100 text-green-700 border-green-300',  bar: 'bg-green-500'  },
  IWG: { badge: 'bg-purple-100 text-purple-700 border-purple-300', bar: 'bg-purple-500' },
}

/* ── Página ───────────────────────────────────────────────────────────────── */
export default async function ReportePresidencialPage() {
  const r = await fetchReportePresidencial()

  const maxEstado  = Math.max(...r.porEstado.map(e => e.cantidad), 1)
  const maxProceso = Math.max(...r.porProceso.map(p => p.cantidad), 1)
  const maxImpactoProceso = Math.max(...r.porProceso.map(p => p.impactoAnual), 1)
  const maxAlcance = Math.max(...r.porAlcance.map(a => a.cantidad), 1)
  const maxOrigen  = Math.max(...r.porOrigen.map(o => o.cantidad), 1)
  const maxTopImpacto = Math.max(...r.topImpacto.map(t => t.impacto), 1)

  const pctCuantificados = r.totalActivos > 0
    ? Math.round(((r.totalActivos - r.sinCuantificar) / r.totalActivos) * 100)
    : 0

  return (
    <div className="space-y-6 p-6">
      {/* ── Encabezado ── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800">Reporte presidencial</h1>
          <p className="mt-0.5 text-sm text-slate-400">
            Consolidado ejecutivo de requerimientos TIN · Generado {fechaLocal(r.generadoEn)}
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm">
          <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-medium text-slate-500">Datos en tiempo real</span>
        </div>
      </div>

      {/* ── KPIs principales ── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          label="Total requerimientos"
          valor={String(r.totalActivos)}
          sub={`${r.totalBorradores} borradores no incluidos`}
          icon={Layers}
          color="text-blue-700"
        />
        <KpiCard
          label="Horas desarrollo estimadas"
          valor={`${r.totalHorasEstimadas.toLocaleString('es-CO')} h`}
          sub="Suma de todos los requerimientos"
          icon={Clock}
          color="text-indigo-700"
        />
        <KpiCard
          label="Impacto económico total"
          valor={cop(r.impactoTotalAnual)}
          sub={`${copFull(r.impactoTotalAnual)} / año`}
          icon={TrendingUp}
          color="text-emerald-700"
        />
        <KpiCard
          label="Sin impacto cuantificado"
          valor={String(r.sinCuantificar)}
          sub={`${r.totalActivos - r.sinCuantificar} cuantificados (${pctCuantificados}%)`}
          icon={AlertCircle}
          color={r.sinCuantificar > 0 ? 'text-amber-600' : 'text-emerald-600'}
        />
      </div>

      {/* ── Fila 2: Estado + Alcance ── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Seccion titulo="Requerimientos por estado" icono={BarChart3}>
          <div className="space-y-3">
            {r.porEstado.map(e => (
              <BarraHorizontal
                key={e.estado}
                label={e.label}
                valor={e.cantidad}
                max={maxEstado}
                display={`${e.cantidad} (${e.porcentaje}%)`}
                colorBar={ESTADO_BAR[e.estado] ?? 'bg-slate-400'}
              />
            ))}
          </div>
        </Seccion>

        <Seccion titulo="Requerimientos por empresa (alcance)" icono={Building2}>
          <div className="space-y-3 mb-4">
            {r.porAlcance.map(a => (
              <BarraHorizontal
                key={a.alcance}
                label={a.alcance}
                valor={a.cantidad}
                max={maxAlcance}
                display={`${a.cantidad} req`}
                colorBar={ALCANCE_COLOR[a.alcance]?.bar ?? 'bg-slate-400'}
              />
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2 border-t border-slate-100 pt-4">
            {r.porAlcance.map(a => (
              <div key={a.alcance} className="rounded-xl border bg-white p-3 text-center shadow-sm">
                <span className={cn(
                  'inline-block rounded-full border px-2 py-0.5 text-xs font-bold mb-1',
                  ALCANCE_COLOR[a.alcance]?.badge ?? 'bg-slate-100 text-slate-600 border-slate-300'
                )}>
                  {a.alcance}
                </span>
                <p className="text-lg font-extrabold text-slate-800">{a.cantidad}</p>
                {a.impactoAnual > 0 && (
                  <p className="text-[11px] text-emerald-600 font-semibold">{cop(a.impactoAnual)}</p>
                )}
              </div>
            ))}
          </div>
        </Seccion>
      </div>

      {/* ── Fila 3: Por proceso ── */}
      <Seccion titulo="Requerimientos por proceso interno" icono={MapPin}>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100">
                {['Proceso', 'Requerimientos', 'Horas est.', 'Impacto anual', 'Sin cuantificar', 'Distribución'].map(h => (
                  <th key={h} className="pb-2 text-left font-semibold text-slate-400 px-2 first:px-0">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {r.porProceso.map(p => (
                <tr key={p.proceso} className="group">
                  <td className="py-2.5 pr-2 font-medium text-slate-700">{p.label}</td>
                  <td className="px-2 py-2.5 text-center">
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 font-bold text-blue-700">{p.cantidad}</span>
                  </td>
                  <td className="px-2 py-2.5 font-semibold text-indigo-600">
                    {p.horasEstimadas > 0 ? `${p.horasEstimadas.toLocaleString('es-CO')} h` : '—'}
                  </td>
                  <td className="px-2 py-2.5 font-bold text-emerald-600">
                    {p.impactoAnual > 0 ? cop(p.impactoAnual) : '—'}
                  </td>
                  <td className="px-2 py-2.5 text-center">
                    {p.sinCuantificar > 0 ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700">{p.sinCuantificar}</span>
                    ) : (
                      <span className="text-emerald-500">✓</span>
                    )}
                  </td>
                  <td className="px-2 py-2.5 w-32">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-blue-400"
                        style={{ width: `${maxProceso > 0 ? Math.round((p.cantidad / maxProceso) * 100) : 0}%` }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Seccion>

      {/* ── Fila 4: Origen + Impacto por proceso ── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Seccion titulo="Requerimientos por origen" icono={Target}>
          <div className="space-y-3">
            {r.porOrigen.map(o => (
              <BarraHorizontal
                key={o.origen}
                label={o.label}
                valor={o.cantidad}
                max={maxOrigen}
                display={`${o.cantidad} (${o.porcentaje}%)`}
                colorBar={ORIGEN_BAR[o.origen] ?? 'bg-slate-300'}
              />
            ))}
          </div>
          <div className="mt-4 grid gap-2">
            {r.porOrigen.map(o => (
              <div key={o.origen} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                <div className="flex items-center gap-2">
                  <div className={cn('h-2.5 w-2.5 rounded-full', ORIGEN_BAR[o.origen] ?? 'bg-slate-300')} />
                  <span className="text-xs text-slate-600">{o.label}</span>
                </div>
                <span className="text-sm font-bold text-slate-800">{o.cantidad}</span>
              </div>
            ))}
          </div>
        </Seccion>

        <Seccion titulo="Impacto económico por proceso" icono={TrendingUp}>
          {r.porProceso.filter(p => p.impactoAnual > 0).length === 0 ? (
            <p className="text-xs italic text-slate-400">Sin requerimientos con impacto cuantificado por proceso</p>
          ) : (
            <div className="space-y-3">
              {r.porProceso
                .filter(p => p.impactoAnual > 0)
                .sort((a, b) => b.impactoAnual - a.impactoAnual)
                .map(p => (
                  <BarraHorizontal
                    key={p.proceso}
                    label={p.label}
                    valor={p.impactoAnual}
                    max={maxImpactoProceso}
                    display={cop(p.impactoAnual)}
                    colorBar="bg-emerald-500"
                  />
                ))
              }
              <div className="flex items-center justify-between rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2.5 mt-2">
                <span className="text-xs font-semibold text-emerald-700">Total impacto anual</span>
                <span className="text-base font-extrabold text-emerald-800">{copFull(r.impactoTotalAnual)}</span>
              </div>
            </div>
          )}
        </Seccion>
      </div>

      {/* ── Top 10 por impacto ── */}
      {r.topImpacto.length > 0 && (
        <Seccion titulo="Top 10 requerimientos por impacto económico" icono={TrendingUp}>
          <div className="space-y-2">
            {r.topImpacto.map((t, i) => (
              <a
                key={t.id}
                href={`/admin/requerimientos/${t.id}`}
                className="grid grid-cols-[2rem_1fr_auto] items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 hover:border-emerald-200 hover:bg-emerald-50 transition-colors"
              >
                <span className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-extrabold',
                  i === 0 ? 'bg-yellow-100 text-yellow-700' :
                  i === 1 ? 'bg-slate-200 text-slate-600' :
                  i === 2 ? 'bg-orange-100 text-orange-600' :
                  'bg-white border border-slate-200 text-slate-400'
                )}>
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-slate-700">{t.nombre}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {t.proceso && <span className="text-[10px] text-slate-400">{t.proceso}</span>}
                    {t.alcance && (
                      <span className={cn(
                        'rounded-full border px-1.5 py-px text-[10px] font-bold',
                        ALCANCE_COLOR[t.alcance]?.badge ?? 'bg-slate-100 text-slate-500 border-slate-300'
                      )}>
                        {t.alcance}
                      </span>
                    )}
                    <div className="flex-1 h-1.5 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-emerald-400"
                        style={{ width: `${Math.round((t.impacto / maxTopImpacto) * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
                <span className="shrink-0 text-sm font-extrabold text-emerald-700">{cop(t.impacto)}</span>
              </a>
            ))}
          </div>
        </Seccion>
      )}

      {/* ── Alerta sin cuantificar ── */}
      {r.sinCuantificar > 0 && (
        <div className="flex items-start gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <AlertCircle size={22} className="mt-0.5 shrink-0 text-amber-500" />
          <div>
            <p className="font-bold text-amber-800">
              {r.sinCuantificar} requerimiento{r.sinCuantificar > 1 ? 's' : ''} sin impacto cuantificado
            </p>
            <p className="mt-0.5 text-sm text-amber-600">
              Estos requerimientos no tienen registrado el impacto económico (HH ahorradas o beneficios cualitativos).
              Cuantificarlos mejorará la exactitud del reporte presidencial.
            </p>
          </div>
          <div className="ml-auto shrink-0 text-center">
            <p className="text-3xl font-extrabold text-amber-700">{100 - pctCuantificados}%</p>
            <p className="text-xs text-amber-500">sin cuantificar</p>
          </div>
        </div>
      )}
    </div>
  )
}
