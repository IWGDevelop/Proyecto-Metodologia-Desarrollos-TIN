import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Pencil, ArrowLeft, Clock, DollarSign, TrendingUp } from 'lucide-react'
import { ESTADOS, PRIORIDADES, PROCESOS_INTERNOS, TIPOS_SOLICITUD, ORIGENES_REQUERIMIENTO, getEstadoCfg } from '@/lib/constants'
import { formatFecha, formatFechaRelativa, formatCOP, cn } from '@/lib/utils'
import { TabComentarios } from '@/components/requerimientos/tabs/TabComentarios'
import { TabAnexos } from '@/components/requerimientos/tabs/TabAnexos'
import { TabDesarrollo } from '@/components/requerimientos/tabs/TabDesarrollo'
import { TabReuniones } from '@/components/requerimientos/tabs/TabReuniones'
import { TabPenalizaciones } from '@/components/requerimientos/tabs/TabPenalizaciones'
import { TabImpactoReal } from '@/components/requerimientos/tabs/TabImpactoReal'
import { CambiarEstadoBtn } from '@/components/requerimientos/CambiarEstadoBtn'
import { AsignarPrioridadBtn } from '@/components/requerimientos/AsignarPrioridadBtn'
import { AsignarOrigenBtn } from '@/components/requerimientos/AsignarOrigenBtn'
import { getTareas } from '@/actions/tareas'
import { getDesarrolladoresReq, getDesarrolladoresDisponibles } from '@/actions/desarrolladores-req'
import { getPerfil } from '@/lib/supabase/auth'
import type { Estado, ActividadImpacto, BeneficioCualitativo } from '@/lib/supabase/types'

interface Props {
  params: Promise<{ id: string }>
}

export default async function AdminRequerimientoDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: req, error }, { data: historial }, tareas, desarrolladores, perfilesDisponibles, perfilAdmin] = await Promise.all([
    supabase.from('requerimientos').select('*').eq('id', id).single(),
    supabase.from('historial_estados').select('*')
      .eq('requerimiento_id', id).order('created_at', { ascending: false }),
    getTareas(id),
    getDesarrolladoresReq(id),
    getDesarrolladoresDisponibles(),
    getPerfil(),
  ])

  if (error || !req) notFound()

  const estadoCfg    = getEstadoCfg(req.estado)
  const prioridadCfg = req.prioridad ? PRIORIDADES[req.prioridad] : null
  const tipoLabel    = TIPOS_SOLICITUD.find(t => t.value === req.tipo_solicitud)?.label
  const origenLabel  = ORIGENES_REQUERIMIENTO.find(o => o.value === req.origen_requerimiento)?.label
  const procesoLabel = PROCESOS_INTERNOS.find(p => p.value === req.proceso_interno)?.label
  const actividades  = (req.actividades_impacto ?? []) as (ActividadImpacto & { horas_mes?: number })[]
  const beneficios   = (req.beneficios_cualitativos ?? []) as BeneficioCualitativo[]

  return (
    <div className="space-y-5 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/admin/requerimientos" className="mb-2 inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600">
            <ArrowLeft size={13} /> Volver al listado
          </Link>
          <h1 className="text-xl font-bold text-slate-800 max-w-2xl">{req.nombre_desarrollo ?? req.identificacion}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {req.numero && <span className="text-xs font-mono text-slate-400">#{req.numero}</span>}
            <span className={cn('rounded-full px-3 py-1 text-xs font-semibold', estadoCfg.bgColor, estadoCfg.textColor)}>
              {estadoCfg.label}
            </span>
            {prioridadCfg && (
              <span className={cn('rounded-full px-3 py-1 text-xs font-bold', prioridadCfg.bgColor, prioridadCfg.textColor)}>
                P{req.prioridad} {prioridadCfg.label}
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
            {req.es_borrador && (
              <Badge variant="outline" className="border-slate-300 text-slate-500">Borrador</Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <AsignarOrigenBtn
            requerimientoId={id}
            origenActual={req.origen_requerimiento ?? null}
          />
          <AsignarPrioridadBtn
            requerimientoId={id}
            prioridadActual={req.prioridad}
            impactoHH={req.ahorro_anual_cop}
            impactoCualitativos={req.total_beneficios_cualitativos_anual}
            impactoTotal={req.impacto_economico_total_anual}
          />
          <CambiarEstadoBtn
            requerimientoId={id}
            estadoActual={req.estado}
            horasEstimadas={req.horas_ahorradas_mes}
            valorHoraEstimado={req.valor_hora_hombre}
          />
          <Link href={`/admin/requerimientos/${id}/editar`}>
            <Button size="sm" variant="outline" className="gap-1.5">
              <Pencil size={13} /> Editar
            </Button>
          </Link>
        </div>
      </div>

      <Tabs defaultValue="informacion">
        <TabsList className="w-full justify-start flex-wrap">
          <TabsTrigger value="informacion">Información</TabsTrigger>
          <TabsTrigger value="desarrollo">Desarrollo</TabsTrigger>
          <TabsTrigger value="impacto">Impacto HH</TabsTrigger>
          <TabsTrigger value="historial">Historial</TabsTrigger>
          <TabsTrigger value="impacto-real">
            Impacto Real{['ENTREGADO','CERRADO'].includes(req.estado) && (
              <span className="ml-1.5 rounded-full bg-emerald-500 px-1.5 py-0.5 text-[10px] text-white">
                {req.impacto_economico_total_anual_real ? '✓' : '!'}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="reuniones">Reuniones</TabsTrigger>
          <TabsTrigger value="penalizaciones">Penalizaciones</TabsTrigger>
          <TabsTrigger value="comentarios">Comentarios</TabsTrigger>
          <TabsTrigger value="anexos">Anexos</TabsTrigger>
        </TabsList>

        <TabsContent value="informacion" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Encabezado</p>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between"><dt className="text-slate-500">Fecha solicitud</dt><dd>{formatFecha(req.fecha_solicitud)}</dd></div>
                <div className="flex justify-between"><dt className="text-slate-500">Tipo</dt><dd>{tipoLabel}</dd></div>
                {origenLabel && <div className="flex justify-between"><dt className="text-slate-500">Origen</dt><dd className="font-medium text-violet-700">{origenLabel}</dd></div>}
                <div className="flex justify-between"><dt className="text-slate-500">Empresa</dt><dd>{req.empresa ?? req.alcance}</dd></div>
                <div className="flex justify-between"><dt className="text-slate-500">Sucursal</dt><dd>{req.sucursal}</dd></div>
              </dl>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Solicitante</p>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between"><dt className="text-slate-500">Responsable</dt><dd className="font-medium">{req.responsable}</dd></div>
                <div className="flex justify-between"><dt className="text-slate-500">Proceso</dt><dd>{procesoLabel}</dd></div>
                <div className="flex justify-between"><dt className="text-slate-500">Avance</dt><dd className="font-medium">{req.porcentaje_avance}%</dd></div>
                {req.fecha_envio_tin && <div className="flex justify-between"><dt className="text-slate-500">Fecha TIN</dt><dd>{formatFecha(req.fecha_envio_tin)}</dd></div>}
              </dl>
            </div>
          </div>
          {[
            { label: 'Situación actual', valor: req.descripcion_situacion_actual },
            { label: 'Definición del requerimiento', valor: req.definicion_requerimiento },
            { label: 'Objetivo', valor: req.objetivo },
            { label: 'Criterios de validación', valor: req.criterios_validacion },
            { label: 'Definición de usuarios', valor: req.definicion_usuarios },
            { label: 'Ventajas y beneficios', valor: req.ventajas_beneficios },
          ].filter(f => f.valor).map(({ label, valor }) => (
            <div key={label} className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
              <p className="whitespace-pre-wrap text-sm text-slate-700">{valor}</p>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="impacto" className="mt-4 space-y-4">
          {actividades.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <p className="border-b border-slate-100 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Actividades impactadas</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      {['Actividad', 'Cargo que ejecuta', 'Salario cargo', 'Frecuencia', 'Horas/mes'].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-slate-400">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {actividades.map((act, i) => (
                      <tr key={i}>
                        <td className="px-4 py-2.5 text-slate-700">{act.actividad}</td>
                        <td className="px-4 py-2.5 text-slate-600 text-xs">{act.cargo_ejecuta ?? '—'}</td>
                        <td className="px-4 py-2.5 text-xs">
                          {act.salario_cargo
                            ? <span className="font-medium text-blue-600">{formatCOP(act.salario_cargo)}</span>
                            : <span className="text-slate-400">Global</span>}
                        </td>
                        <td className="px-4 py-2.5 text-slate-500 text-xs">{act.frecuencia ?? '—'}</td>
                        <td className="px-4 py-2.5 font-semibold text-emerald-600">{(act.horas_mes ?? 0).toFixed(2)} h</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {req.ahorro_anual_cop && (
            <div className="rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-800 p-5 text-white">
              <p className="mb-3 text-sm font-semibold text-emerald-200">Impacto económico</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {[
                  { icon: Clock, label: 'Horas ahorradas / mes', valor: `${req.horas_ahorradas_mes?.toFixed(1) ?? 0} h` },
                  { icon: DollarSign, label: 'Ahorro mensual', valor: formatCOP(req.ahorro_mensual_cop) },
                  { icon: TrendingUp, label: 'Ahorro anual', valor: formatCOP(req.ahorro_anual_cop) },
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
          {beneficios.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Beneficios cualitativos</p>
              <ul className="space-y-1">
                {beneficios.map((b, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                    <span className="text-emerald-500">✓</span> {b.descripcion}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </TabsContent>

        <TabsContent value="historial" className="mt-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            {(!historial || historial.length === 0) ? (
              <p className="py-8 text-center text-sm text-slate-400">Sin cambios de estado registrados</p>
            ) : (
              <ol className="space-y-0 divide-y divide-slate-50">
                {historial.map(h => {
                  const antCfg  = h.estado_anterior ? getEstadoCfg(h.estado_anterior) : null
                  const nuevCfg = getEstadoCfg(h.estado_nuevo)
                  return (
                    <li key={h.id} className="flex gap-3 py-3">
                      <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-400 ring-2 ring-blue-100" />
                      <div className="min-w-0 flex-1 text-sm">
                        <div className="flex flex-wrap items-center gap-1">
                          {antCfg && <span className={cn('rounded-full px-2 py-0.5 text-xs', antCfg.bgColor, antCfg.textColor)}>{antCfg.label}</span>}
                          {antCfg && <span className="text-slate-400">→</span>}
                          <span className={cn('rounded-full px-2 py-0.5 text-xs', nuevCfg.bgColor, nuevCfg.textColor)}>{nuevCfg.label}</span>
                        </div>
                        {h.observacion && <p className="mt-0.5 text-xs text-slate-500">"{h.observacion}"</p>}
                        <p className="mt-0.5 text-xs text-slate-400">{h.usuario ?? 'Sistema'} · {formatFechaRelativa(h.created_at)}</p>
                      </div>
                    </li>
                  )
                })}
              </ol>
            )}
          </div>
        </TabsContent>

        <TabsContent value="desarrollo" className="mt-4">
          <TabDesarrollo
            requerimientoId={id}
            rama={(req as any).rama ?? null}
            tareas={tareas}
            desarrolladores={desarrolladores}
            perfilesDisponibles={perfilesDisponibles}
            isAdmin
            currentUserId={perfilAdmin?.id}
            horasEstimadasDesarrollo={(req as any).horas_estimadas_desarrollo ?? null}
          />
        </TabsContent>

        <TabsContent value="impacto-real" className="mt-4">
          <TabImpactoReal req={req as any} />
        </TabsContent>

        <TabsContent value="reuniones" className="mt-4">
          <TabReuniones requerimientoId={id} isAdmin={perfilAdmin?.rol === 'ADMIN_TIN'} />
        </TabsContent>

        <TabsContent value="penalizaciones" className="mt-4">
          <TabPenalizaciones requerimientoId={id} isAdmin={perfilAdmin?.rol === 'ADMIN_TIN'} />
        </TabsContent>

        <TabsContent value="comentarios" className="mt-4">
          <TabComentarios requerimientoId={id} />
        </TabsContent>

        <TabsContent value="anexos" className="mt-4">
          <TabAnexos requerimientoId={id} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
