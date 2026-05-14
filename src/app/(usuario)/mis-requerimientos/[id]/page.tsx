import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ArrowLeft, DollarSign, Clock, TrendingUp } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { ESTADOS, PRIORIDADES, PROCESOS_INTERNOS } from '@/lib/constants'
import { formatFecha, formatFechaRelativa, formatCOP, cn } from '@/lib/utils'
import { TabComentarios } from '@/components/requerimientos/tabs/TabComentarios'
import type { Estado, ActividadImpacto, BeneficioCualitativo } from '@/lib/supabase/types'

interface Props {
  params: Promise<{ id: string }>
}

const ORDEN_ESTADOS: Estado[] = ['SIN_GESTION', 'ANALISIS', 'EN_DESARROLLO', 'PRUEBAS_USUARIO', 'ENTREGADO']

export default async function MiRequerimientoDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: req, error }, { data: historial }] = await Promise.all([
    supabase.from('requerimientos').select('*').eq('id', id).single(),
    supabase.from('historial_estados').select('*')
      .eq('requerimiento_id', id).order('created_at', { ascending: true }),
  ])

  if (error || !req) notFound()

  const estadoCfg = ESTADOS[req.estado as Estado]
  const prioridadCfg = req.prioridad ? PRIORIDADES[req.prioridad] : null
  const procesoLabel = PROCESOS_INTERNOS.find(p => p.value === req.proceso_interno)?.label
  const actividades = (req.actividades_impacto ?? []) as ActividadImpacto[]
  const beneficios  = (req.beneficios_cualitativos ?? []) as BeneficioCualitativo[]
  const impacto     = (req as any).impacto_economico_total_anual ?? req.ahorro_anual_cop

  const estadoActualIdx = ORDEN_ESTADOS.indexOf(req.estado as Estado)

  return (
    <div className="space-y-5 p-6 max-w-3xl">
      {/* Back */}
      <Link href="/mis-requerimientos" className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600">
        <ArrowLeft size={13} /> Volver a mis solicitudes
      </Link>

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-800">{req.nombre_desarrollo ?? req.identificacion}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {req.numero && <span className="text-xs font-mono text-slate-400">#{req.numero}</span>}
          <span className={cn('rounded-full px-3 py-1 text-xs font-semibold', estadoCfg.bgColor, estadoCfg.textColor)}>
            {estadoCfg.label}
          </span>
          {prioridadCfg && (
            <span className={cn('rounded-full px-3 py-1 text-xs font-bold', prioridadCfg.bgColor, prioridadCfg.textColor)}>
              P{req.prioridad}
            </span>
          )}
          {req.alcance && (
            <Badge variant="outline" className={cn({
              'border-blue-300 text-blue-700': req.alcance === 'IWF',
              'border-green-300 text-green-700': req.alcance === 'ILT',
              'border-purple-300 text-purple-700': req.alcance === 'IWG',
            })}>
              {req.alcance}
            </Badge>
          )}
        </div>
      </div>

      {/* Timeline de estado */}
      {!['CERRADO', 'STAND_BY'].includes(req.estado) && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-slate-400">Estado actual</p>
          <div className="flex items-center gap-0">
            {ORDEN_ESTADOS.map((estado, idx) => {
              const cfg = ESTADOS[estado]
              const pasado = idx <= estadoActualIdx
              const actual = idx === estadoActualIdx
              const fechaHistorial = historial?.find(h => h.estado_nuevo === estado)
              return (
                <div key={estado} className="flex flex-1 flex-col items-center">
                  <div className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all',
                    actual ? `${cfg.bgColor} ${cfg.textColor} ring-2 ring-offset-2 ring-blue-400` :
                    pasado ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'
                  )}>
                    {pasado ? '✓' : idx + 1}
                  </div>
                  <p className={cn('mt-1.5 text-center text-[10px] font-medium', actual ? 'text-slate-800' : pasado ? 'text-slate-500' : 'text-slate-300')}>
                    {cfg.label}
                  </p>
                  {fechaHistorial && (
                    <p className="text-[9px] text-slate-400">{formatFecha(fechaHistorial.created_at)}</p>
                  )}
                  {idx < ORDEN_ESTADOS.length - 1 && (
                    <div className={cn('absolute mt-4 h-0.5 w-full', pasado && idx < estadoActualIdx ? 'bg-emerald-300' : 'bg-slate-200')} style={{ display: 'none' }} />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Progreso */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="font-medium text-slate-700">Progreso del requerimiento</span>
          <span className="font-bold text-blue-700">{req.porcentaje_avance}%</span>
        </div>
        <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
          <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${req.porcentaje_avance}%` }} />
        </div>
      </div>

      {/* Info general */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Información general</p>
        <dl className="grid grid-cols-2 gap-2 text-sm">
          {[
            { label: 'Responsable',   valor: req.responsable },
            { label: 'Proceso',       valor: procesoLabel },
            { label: 'Empresa',       valor: req.empresa ?? req.alcance },
            { label: 'Fecha envío',   valor: formatFecha(req.fecha_envio_solicitud) },
            { label: 'Inicio desarro',valor: formatFecha(req.fecha_inicio_desarrollo) },
            { label: 'Entrega estim.', valor: formatFecha(req.fecha_estimada_entrega) },
          ].filter(f => f.valor).map(({ label, valor }) => (
            <div key={label}>
              <dt className="text-xs text-slate-400">{label}</dt>
              <dd className="font-medium text-slate-700">{valor}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* Descripción */}
      {[
        { label: 'Situación actual', valor: req.descripcion_situacion_actual },
        { label: 'Definición', valor: req.definicion_requerimiento },
        { label: 'Objetivo', valor: req.objetivo },
      ].filter(f => f.valor).map(({ label, valor }) => (
        <div key={label} className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
          <p className="whitespace-pre-wrap text-sm text-slate-700">{valor}</p>
        </div>
      ))}

      {/* Beneficio económico */}
      {impacto && impacto > 0 && (
        <div className="rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-800 p-5 text-white">
          <p className="mb-3 text-sm font-semibold text-emerald-200">Beneficio económico proyectado</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              { icon: Clock,    label: 'Horas / mes', valor: `${req.horas_ahorradas_mes?.toFixed(1) ?? 0} h` },
              { icon: DollarSign, label: 'Ahorro mensual', valor: formatCOP(req.ahorro_mensual_cop) },
              { icon: TrendingUp, label: 'Impacto anual', valor: formatCOP(impacto) },
            ].map(({ icon: Icon, label, valor }) => (
              <div key={label} className="rounded-lg bg-white/10 p-3">
                <Icon size={14} className="mb-1 text-emerald-300" />
                <p className="text-xs text-emerald-300">{label}</p>
                <p className="text-lg font-bold">{valor}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Comentarios */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Comentarios y seguimiento</p>
        <TabComentarios requerimientoId={id} />
      </div>
    </div>
  )
}
