import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Lock } from 'lucide-react'
import { PRIORIDADES, getEstadoCfg, formatPrioridad } from '@/lib/constants'
import { formatFechaRelativa, cn } from '@/lib/utils'
import { TabComentarios } from '@/components/requerimientos/tabs/TabComentarios'
import { TabAnexos } from '@/components/requerimientos/tabs/TabAnexos'
import { TabDesarrollo } from '@/components/requerimientos/tabs/TabDesarrollo'
import { TabReuniones } from '@/components/requerimientos/tabs/TabReuniones'
import { TabPenalizaciones } from '@/components/requerimientos/tabs/TabPenalizaciones'
import { TabImpactoReal } from '@/components/requerimientos/tabs/TabImpactoReal'
import { TabInformacion } from '@/components/requerimientos/tabs/TabInformacion'
import { TabImpactoHH } from '@/components/requerimientos/tabs/TabImpactoHH'
import { TabAsociaciones } from '@/components/requerimientos/tabs/TabAsociaciones'
import { TabFechas } from '@/components/requerimientos/tabs/TabFechas'
import { TabFlujo } from '@/components/requerimientos/tabs/TabFlujo'
import { getHijosRequerimiento, getEtiquetaJerarquica } from '@/actions/asociaciones'
import { getHistorialFechas } from '@/actions/fechas-entrega'
import { CambiarEstadoBtn } from '@/components/requerimientos/CambiarEstadoBtn'
import { DesistirBtn } from '@/components/requerimientos/DesistirBtn'
import { AsignarPrioridadBtn } from '@/components/requerimientos/AsignarPrioridadBtn'
import { AsignarOrigenBtn } from '@/components/requerimientos/AsignarOrigenBtn'
import { PublicarRequerimientoBtn } from '@/components/requerimientos/PublicarRequerimientoBtn'
import { getTareas } from '@/actions/tareas'
import { getDesarrolladoresReq, getDesarrolladoresDisponibles } from '@/actions/desarrolladores-req'
import { getPerfil } from '@/lib/supabase/auth'
import { getPermisosUsuario } from '@/actions/roles-permisos'
import type { HistorialEstado } from '@/lib/supabase/types'

interface Props {
  params: Promise<{ id: string }>
}

export default async function AdminRequerimientoDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = createAdminClient()

  const [{ data: req, error }, { data: historial }, tareas, desarrolladores, perfilesDisponibles, perfilAdmin, hijosReq, etiquetaJerarquica, historialFechas] = await Promise.all([
    (supabase as any).from('requerimientos').select('*, lote:lotes(id, numero, nombre, cerrado)').eq('id', id).single(),
    (supabase as any).from('historial_estados').select('*')
      .eq('requerimiento_id', id).order('created_at', { ascending: false }),
    getTareas(id),
    getDesarrolladoresReq(id),
    getDesarrolladoresDisponibles(),
    getPerfil(),
    getHijosRequerimiento(id),
    getEtiquetaJerarquica(id),
    getHistorialFechas(id),
  ])

  if (error || !req) notFound()

  // Fetch requerimiento padre si existe
  const parentId: string | null = (req as any).parent_id ?? null
  let padreReq = null
  if (parentId) {
    const { data: p } = await (supabase as any)
      .from('requerimientos')
      .select('id, numero, identificacion, nombre_desarrollo, prioridad, sub_prioridad, parent_id, estado')
      .eq('id', parentId)
      .single()
    padreReq = p ?? null
  }

  const isAdmin = perfilAdmin?.rol === 'ADMIN_TIN'
  const permisos = isAdmin ? {} : await getPermisosUsuario(perfilAdmin?.rol ?? 'USUARIO')

  // Lote vinculado a este requerimiento
  const lote = (req as any).lote as { id: string; numero: number; nombre: string; cerrado: boolean } | null
  const loteCerrado = lote?.cerrado === true

  const pv = (recurso: string) => isAdmin || permisos[recurso]?.puede_ver === true
  // Admin siempre puede editar; usuarios normales bloqueados si el lote está cerrado
  const pe = (recurso: string) => isAdmin || (!loteCerrado && permisos[recurso]?.puede_editar === true)
  const pc = (recurso: string) => isAdmin || (!loteCerrado && permisos[recurso]?.puede_crear === true)

  const tabsDef = [
    { value: 'informacion',    recurso: 'req:informacion' },
    { value: 'desarrollo',     recurso: 'req:desarrollo' },
    { value: 'impacto',        recurso: 'req:impacto-hh' },
    { value: 'historial',      recurso: 'req:historial' },
    { value: 'impacto-real',   recurso: 'req:impacto-real' },
    { value: 'reuniones',      recurso: 'req:reuniones' },
    { value: 'penalizaciones', recurso: 'req:penalizaciones' },
    { value: 'comentarios',    recurso: 'req:comentarios' },
    { value: 'anexos',         recurso: 'req:anexos' },
  ]
  const defaultTab = tabsDef.find(t => pv(t.recurso))?.value ?? 'informacion'

  const estadoCfg    = getEstadoCfg(req.estado)
  const prioridadCfg = req.prioridad ? PRIORIDADES[req.prioridad] : null

  return (
    <div className="space-y-5 p-6">
      {/* Banner lote cerrado */}
      {lote && (
        <div className={cn(
          'rounded-xl border px-4 py-3 flex items-center gap-3 text-sm',
          loteCerrado
            ? 'border-slate-300 bg-slate-50 text-slate-600'
            : 'border-blue-200 bg-blue-50 text-blue-700'
        )}>
          {loteCerrado ? <Lock size={14} className="shrink-0 text-slate-400" /> : null}
          <span>
            <span className="font-semibold">Lote {lote.numero} — {lote.nombre}</span>
            {loteCerrado && (
              <span className="ml-2 text-slate-500">· Este lote está cerrado. Los requerimientos no pueden ser modificados.</span>
            )}
          </span>
        </div>
      )}

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
                {etiquetaJerarquica} {prioridadCfg.label}
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
              <>
                <Badge variant="outline" className="border-slate-300 text-slate-500">Borrador</Badge>
                <PublicarRequerimientoBtn requerimientoId={id} />
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {pe('req:general') && (
            <AsignarOrigenBtn
              requerimientoId={id}
              origenActual={req.origen_requerimiento ?? null}
            />
          )}
          <AsignarPrioridadBtn
            requerimientoId={id}
            prioridadActual={req.prioridad}
            subPrioridadActual={(req as any).sub_prioridad ?? null}
            impactoHH={req.ahorro_anual_cop}
            impactoCualitativos={req.total_beneficios_cualitativos_anual}
            impactoTotal={req.impacto_economico_total_anual}
            proceso_interno={(req as any).proceso_interno ?? null}
          />
          {isAdmin && pe('req:estado') && (
            <CambiarEstadoBtn
              requerimientoId={id}
              estadoActual={req.estado}
              horasEstimadas={req.horas_ahorradas_mes}
              valorHoraEstimado={req.valor_hora_hombre}
            />
          )}
          {!isAdmin && (
            <DesistirBtn
              requerimientoId={id}
              estadoActual={req.estado}
            />
          )}
        </div>
      </div>

      <Tabs defaultValue={defaultTab}>
        <TabsList className="w-full justify-start flex-wrap">
          {pv('req:informacion')    && <TabsTrigger value="informacion">Información</TabsTrigger>}
          {pv('req:desarrollo')     && <TabsTrigger value="desarrollo">Desarrollo</TabsTrigger>}
          {pv('req:impacto-hh')    && <TabsTrigger value="impacto">Impacto HH</TabsTrigger>}
          {pv('req:historial')      && <TabsTrigger value="historial">Historial</TabsTrigger>}
          {pv('req:impacto-real')  && (
            <TabsTrigger value="impacto-real">
              Impacto Real{['ENTREGADO','CERRADO'].includes(req.estado) && (
                <span className="ml-1.5 rounded-full bg-emerald-500 px-1.5 py-0.5 text-[10px] text-white">
                  {req.impacto_economico_total_anual_real ? '✓' : '!'}
                </span>
              )}
            </TabsTrigger>
          )}
          {pv('req:reuniones')      && <TabsTrigger value="reuniones">Reuniones</TabsTrigger>}
          {pv('req:penalizaciones') && <TabsTrigger value="penalizaciones">Penalizaciones</TabsTrigger>}
          {pv('req:comentarios')    && <TabsTrigger value="comentarios">Comentarios</TabsTrigger>}
          {pv('req:anexos')         && <TabsTrigger value="anexos">Anexos</TabsTrigger>}
          <TabsTrigger value="asociaciones">Asociaciones</TabsTrigger>
          <TabsTrigger value="fechas">Fechas</TabsTrigger>
          <TabsTrigger value="flujo">Flujo</TabsTrigger>
        </TabsList>

        {pv('req:informacion') && (
          <TabsContent value="informacion">
            <TabInformacion req={req as any} canEdit={pe('req:general')} isAdmin={isAdmin} />
          </TabsContent>
        )}

        {pv('req:impacto-hh') && (
          <TabsContent value="impacto">
            <TabImpactoHH req={req as any} canEdit={pe('req:general')} />
          </TabsContent>
        )}

        {pv('req:historial') && (
          <TabsContent value="historial" className="mt-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              {(!historial || historial.length === 0) ? (
                <p className="py-8 text-center text-sm text-slate-400">Sin cambios de estado registrados</p>
              ) : (
                <ol className="space-y-0 divide-y divide-slate-50">
                  {historial.map((h: HistorialEstado) => {
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
        )}

        {pv('req:desarrollo') && (
          <TabsContent value="desarrollo" className="mt-4">
            <TabDesarrollo
              requerimientoId={id}
              rama={(req as any).rama ?? null}
              tareas={tareas}
              desarrolladores={desarrolladores}
              perfilesDisponibles={perfilesDisponibles}
              isAdmin={isAdmin}
              currentUserId={perfilAdmin?.id}
              horasEstimadasDesarrollo={(req as any).horas_estimadas_desarrollo ?? null}
            />
          </TabsContent>
        )}

        {pv('req:impacto-real') && (
          <TabsContent value="impacto-real" className="mt-4">
            <TabImpactoReal req={req as any} />
          </TabsContent>
        )}

        {pv('req:reuniones') && (
          <TabsContent value="reuniones" className="mt-4">
            <TabReuniones requerimientoId={id} isAdmin={isAdmin} />
          </TabsContent>
        )}

        {pv('req:penalizaciones') && (
          <TabsContent value="penalizaciones" className="mt-4">
            <TabPenalizaciones requerimientoId={id} isAdmin={isAdmin} />
          </TabsContent>
        )}

        {pv('req:comentarios') && (
          <TabsContent value="comentarios" className="mt-4">
            <TabComentarios requerimientoId={id} />
          </TabsContent>
        )}

        {pv('req:anexos') && (
          <TabsContent value="anexos" className="mt-4">
            <TabAnexos requerimientoId={id} />
          </TabsContent>
        )}

        <TabsContent value="asociaciones">
          <TabAsociaciones
            requerimientoId={id}
            padre={padreReq}
            hijos={hijosReq}
            etiquetaActual={etiquetaJerarquica}
          />
        </TabsContent>

        <TabsContent value="flujo">
          <TabFlujo requerimientoId={id} />
        </TabsContent>

        <TabsContent value="fechas">
          <TabFechas
            requerimientoId={id}
            fechasActuales={{
              fecha_estimada_entrega:          (req as any).fecha_estimada_entrega ?? null,
              fecha_real_entrega:              (req as any).fecha_real_entrega ?? null,
              fecha_estimada_feedback_pruebas: (req as any).fecha_estimada_feedback_pruebas ?? null,
              fecha_real_feedback_pruebas:     (req as any).fecha_real_feedback_pruebas ?? null,
              fecha_estimada_ajustes_tecnicos: (req as any).fecha_estimada_ajustes_tecnicos ?? null,
              fecha_real_ajustes_tecnicos:     (req as any).fecha_real_ajustes_tecnicos ?? null,
              fecha_estimada_salida_vivo:      (req as any).fecha_estimada_salida_vivo ?? null,
              fecha_salida_vivo:               (req as any).fecha_salida_vivo ?? null,
            }}
            historial={historialFechas}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
