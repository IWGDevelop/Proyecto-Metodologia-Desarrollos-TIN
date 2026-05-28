import { createClient } from '@/lib/supabase/server'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import {
  ClipboardList, AlertCircle, Code2,
  PauseCircle, CheckCircle2, Timer,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ESTADOS, getEstadoCfg } from '@/lib/constants'

// ─── Data fetching ────────────────────────────────────────────────────────────
async function getKPIData() {
  try {
  const supabase = await createClient()
  const hoy = new Date()
  const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0]
  const finMes    = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).toISOString().split('T')[0]

  const [
    { count: totalActivos },
    { count: sinGestion },
    { count: enDesarrollo },
    { count: standBy },
    { count: entregadosMes },
    slaResult,
    { data: standByData },
    { data: estadosRaw },
  ] = await Promise.all([
    supabase.from('requerimientos').select('*', { count: 'exact', head: true })
      .neq('estado', 'CERRADO').eq('es_borrador', false),
    supabase.from('requerimientos').select('*', { count: 'exact', head: true })
      .eq('estado', 'SIN_GESTION').eq('es_borrador', false),
    supabase.from('requerimientos').select('*', { count: 'exact', head: true })
      .eq('estado', 'EN_DESARROLLO').eq('es_borrador', false),
    supabase.from('requerimientos').select('*', { count: 'exact', head: true })
      .eq('estado', 'STAND_BY').eq('es_borrador', false),
    supabase.from('requerimientos').select('*', { count: 'exact', head: true })
      .eq('es_borrador', false)
      .gte('fecha_salida_vivo', inicioMes)
      .lte('fecha_salida_vivo', finMes),
    (supabase.from('v_metricas_requerimientos') as any)
      .select('cumple_sla')
      .not('cumple_sla', 'is', null),
    supabase.from('requerimientos')
      .select('updated_at')
      .eq('estado', 'STAND_BY')
      .eq('es_borrador', false),
    supabase.from('requerimientos')
      .select('estado')
      .eq('es_borrador', false),
  ])

  const slaData = (slaResult as any)?.data ?? null

  const totalSLA = slaData?.length ?? 0
  const cumpleSLA = slaData?.filter((r: any) => r.cumple_sla === true).length ?? 0
  const pctSLA = totalSLA > 0 ? Math.round((cumpleSLA / totalSLA) * 100) : 0

  const diasBloqueoPromedio = standByData?.length
    ? Math.round(
        standByData.reduce((sum: number, r: any) => {
          const dias = Math.floor(
            (Date.now() - new Date(r.updated_at).getTime()) / 86_400_000
          )
          return sum + dias
        }, 0) / standByData.length
      )
    : 0

  const conteoEstados: Record<string, number> = {}
  for (const r of estadosRaw ?? []) {
    conteoEstados[r.estado] = (conteoEstados[r.estado] ?? 0) + 1
  }
  // Incluir también estados dinámicos que no estén en ESTADOS
  const estadosDinamicos = Object.entries(conteoEstados)
    .filter(([k]) => !ESTADOS[k])
    .map(([estado, count]) => ({ estado, count }))

  return {
    totalActivos: totalActivos ?? 0,
    sinGestion: sinGestion ?? 0,
    enDesarrollo: enDesarrollo ?? 0,
    standBy: standBy ?? 0,
    entregadosMes: entregadosMes ?? 0,
    pctSLA,
    diasBloqueoPromedio,
    conteoEstados,
    estadosDinamicos,
  }
  } catch {
    return {
      totalActivos: 0, sinGestion: 0, enDesarrollo: 0,
      standBy: 0, entregadosMes: 0, pctSLA: 0, diasBloqueoPromedio: 0,
      conteoEstados: {}, estadosDinamicos: [],
    }
  }
}

// ─── Componente KPI individual ────────────────────────────────────────────────
function KPICard({
  titulo, valor, subtexto, icono: Icono,
  colorIcon, bgCard, borderCard, textCard,
  children,
}: {
  titulo: string
  valor: string | number
  subtexto?: string
  icono: React.ElementType
  colorIcon: string
  bgCard?: string
  borderCard?: string
  textCard?: string
  children?: React.ReactNode
}) {
  return (
    <div className={cn(
      'rounded-xl border p-5 shadow-sm transition-shadow hover:shadow-md',
      bgCard ?? 'bg-white', borderCard ?? 'border-slate-200'
    )}>
      <div className="flex items-start justify-between">
        <div>
          <p className={cn('text-xs font-medium uppercase tracking-wide', textCard ?? 'text-slate-500')}>
            {titulo}
          </p>
          <p className={cn('mt-1 text-3xl font-bold', textCard ?? 'text-slate-800')}>
            {valor}
          </p>
          {subtexto && (
            <p className={cn('mt-1 text-xs', textCard ? `${textCard} opacity-80` : 'text-slate-500')}>
              {subtexto}
            </p>
          )}
        </div>
        <div className={cn('rounded-lg p-2.5', colorIcon)}>
          <Icono size={20} className="text-white" />
        </div>
      </div>
      {children}
    </div>
  )
}

// ─── Server component principal ───────────────────────────────────────────────
export async function KPICards() {
  const d = await getKPIData()

  const sinGestionStyle =
    d.sinGestion > 10
      ? { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-800', sub: '¡Requiere atención!' }
      : d.sinGestion > 5
      ? { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-800', sub: 'Revisar pronto' }
      : { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-800', sub: 'Bajo control' }

  const slaColor =
    d.pctSLA >= 80 ? 'bg-green-500'
    : d.pctSLA >= 60 ? 'bg-yellow-400'
    : 'bg-red-500'

  const slaIconBg =
    d.pctSLA >= 80 ? 'bg-green-500'
    : d.pctSLA >= 60 ? 'bg-yellow-500'
    : 'bg-red-500'

  return (
    <div className="space-y-4">
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {/* 1 — Total activos */}
      <KPICard
        titulo="Requerimientos activos"
        valor={d.totalActivos}
        subtexto="Sin contar cerrados"
        icono={ClipboardList}
        colorIcon="bg-blue-600"
      />

      {/* 2 — Sin gestión */}
      <KPICard
        titulo="Sin gestión"
        valor={d.sinGestion}
        subtexto={sinGestionStyle.sub}
        icono={AlertCircle}
        colorIcon={d.sinGestion > 10 ? 'bg-red-500' : d.sinGestion > 5 ? 'bg-yellow-500' : 'bg-green-500'}
        bgCard={sinGestionStyle.bg}
        borderCard={sinGestionStyle.border}
        textCard={sinGestionStyle.text}
      />

      {/* 3 — En desarrollo */}
      <KPICard
        titulo="En desarrollo"
        valor={d.enDesarrollo}
        subtexto="En curso actualmente"
        icono={Code2}
        colorIcon="bg-indigo-500"
      />

      {/* 4 — Stand by */}
      <KPICard
        titulo="En stand by"
        valor={d.standBy}
        subtexto={d.diasBloqueoPromedio > 0 ? `${d.diasBloqueoPromedio} días promedio de bloqueo` : 'Sin bloqueos prolongados'}
        icono={PauseCircle}
        colorIcon="bg-amber-500"
      />

      {/* 5 — Entregados este mes */}
      <KPICard
        titulo="Entregados este mes"
        valor={d.entregadosMes}
        subtexto={new Date().toLocaleString('es-CO', { month: 'long', year: 'numeric' })}
        icono={CheckCircle2}
        colorIcon="bg-emerald-500"
      />

      {/* 6 — SLA */}
      <KPICard
        titulo="Cumplimiento SLA"
        valor={`${d.pctSLA}%`}
        icono={Timer}
        colorIcon={slaIconBg}
      >
        <div className="mt-3">
          <Progress value={d.pctSLA} className={cn('h-2', '[&>div]:' + slaColor)} />
          <p className="mt-1 text-xs text-slate-500">
            {d.pctSLA >= 80 ? 'Excelente cumplimiento' : d.pctSLA >= 60 ? 'Cumplimiento aceptable' : 'Por debajo del objetivo'}
          </p>
        </div>
      </KPICard>
    </div>

    {/* ── Resumen por estado ── */}
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Requerimientos por estado</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8">
        {Object.entries(ESTADOS).map(([key, cfg]) => {
          const count = d.conteoEstados[key] ?? 0
          return (
            <div
              key={key}
              className={cn(
                'flex flex-col items-center justify-center rounded-lg border px-3 py-3 text-center',
                cfg.bgColor, cfg.borderColor
              )}
            >
              <span className={cn('text-2xl font-extrabold', cfg.textColor)}>{count}</span>
              <span className={cn('mt-1 text-[11px] font-medium leading-tight', cfg.textColor)}>
                {cfg.label}
              </span>
            </div>
          )
        })}
        {d.estadosDinamicos.map(({ estado, count }) => {
          const cfg = getEstadoCfg(estado)
          return (
            <div
              key={estado}
              className={cn(
                'flex flex-col items-center justify-center rounded-lg border px-3 py-3 text-center',
                cfg.bgColor, cfg.borderColor
              )}
            >
              <span className={cn('text-2xl font-extrabold', cfg.textColor)}>{count}</span>
              <span className={cn('mt-1 text-[11px] font-medium leading-tight', cfg.textColor)}>
                {cfg.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
export function KPICardsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-10 w-10 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <Skeleton className="mb-3 h-3 w-40" />
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  )
}
