import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import {
  ArrowLeft, Lock, Info, CalendarDays, Link2, Calculator, TrendingUp, Code2, FileCode, Workflow,
  History, Activity, BadgeCheck, MessageSquare, Users, Paperclip, AlertTriangle, ListTodo, type LucideIcon,
} from 'lucide-react'
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
import { TabDocumentacionTecnica } from '@/components/requerimientos/tabs/TabDocumentacionTecnica'
import { TabActividad } from '@/components/requerimientos/tabs/TabActividad'
import { TabVistoBueno } from '@/components/requerimientos/tabs/TabVistoBueno'
import { TabPendientes } from '@/components/requerimientos/tabs/TabPendientes'
import { getHistorialCompleto } from '@/actions/historial-detallado'
import { getTareasConsolidadasRequerimiento } from '@/actions/pendientes-requerimiento'
import { getHijosRequerimiento, getEtiquetaJerarquica } from '@/actions/asociaciones'
import { getHistorialFechas } from '@/actions/fechas-entrega'
import { CambiarEstadoBtn } from '@/components/requerimientos/CambiarEstadoBtn'
import { AsignarPrioridadBtn } from '@/components/requerimientos/AsignarPrioridadBtn'
import { AsignarPrioridadProcesoBtn } from '@/components/requerimientos/AsignarPrioridadProcesoBtn'
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

  const [{ data: req, error }, { data: historial }, tareas, desarrolladores, perfilesDisponibles, perfilAdmin, hijosReq, etiquetaJerarquica, historialFechas, eventosActividad, tareasConsolidadas] = await Promise.all([
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
    getHistorialCompleto(id),
    getTareasConsolidadasRequerimiento(id),
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

  // After the user visto bueno of definition, non-admins can only add documents (no delete, no edit info)
  const ESTADOS_PRE_DEFINICION = ['SIN_GESTION', 'EN_ESPERA_DE_COMITE_DE_PRIORIDADES', 'EN_DEFINICION_USUARIO', 'ANALISIS']
  const infoLocked = !isAdmin && !ESTADOS_PRE_DEFINICION.includes(req.estado)

  const tabsDef = [
    { value: 'informacion',    recurso: 'req:informacion' },
    { value: 'desarrollo',      recurso: 'req:desarrollo' },
    { value: 'doc-tecnica',    recurso: 'req:doc-tecnica' },
    { value: 'impacto',        recurso: 'req:impacto-hh' },
    { value: 'historial',      recurso: 'req:historial' },
    { value: 'actividad',      recurso: 'req:actividad' },
    { value: 'visto-bueno',   recurso: 'req:visto-bueno' },
    { value: 'impacto-real',   recurso: 'req:impacto-real' },
    { value: 'reuniones',      recurso: 'req:reuniones' },
    { value: 'penalizaciones', recurso: 'req:penalizaciones' },
    { value: 'comentarios',    recurso: 'req:comentarios' },
    { value: 'anexos',         recurso: 'req:anexos' },
  ]
  const defaultTab = tabsDef.find(t => pv(t.recurso))?.value ?? 'informacion'

  // Navegación lateral agrupada por sección
  type ItemNav = { value: string; label: string; Icon: LucideIcon; visible: boolean; bloqueado?: boolean; badge?: React.ReactNode }
  const impactoRealPendiente = ['ENTREGADO', 'CERRADO'].includes(req.estado)
  const verPendientes = pv('req:reuniones') || pv('req:comentarios')
  const numPendientes = tareasConsolidadas.filter(t => !t.completada).length
  const gruposNav: { titulo: string; items: ItemNav[] }[] = [
    {
      titulo: 'General',
      items: [
        { value: 'informacion',  label: 'Información',  Icon: Info,         visible: pv('req:informacion') },
        {
          value: 'pendientes', label: 'Tareas pendientes', Icon: ListTodo, visible: verPendientes,
          badge: numPendientes > 0 ? (
            <span className="rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold text-white">{numPendientes}</span>
          ) : undefined,
        },
        { value: 'fechas',       label: 'Fechas',       Icon: CalendarDays, visible: true },
        { value: 'asociaciones', label: 'Asociaciones', Icon: Link2,        visible: true },
      ],
    },
    {
      titulo: 'Impacto',
      items: [
        { value: 'impacto', label: 'Impacto HH', Icon: Calculator, visible: pv('req:impacto-hh') },
        {
          value: 'impacto-real', label: 'Impacto Real', Icon: TrendingUp, visible: pv('req:impacto-real'),
          badge: impactoRealPendiente ? (
            <span className={cn(
              'rounded-full px-1.5 py-0.5 text-[10px] font-bold text-white',
              req.impacto_economico_total_anual_real ? 'bg-emerald-500' : 'bg-amber-500',
            )}>
              {req.impacto_economico_total_anual_real ? '✓' : '!'}
            </span>
          ) : undefined,
        },
      ],
    },
    {
      titulo: 'Técnico',
      items: [
        { value: 'desarrollo',  label: 'Desarrollo',   Icon: Code2,    visible: true, bloqueado: !isAdmin },
        { value: 'doc-tecnica', label: 'Doc. Técnica', Icon: FileCode, visible: true, bloqueado: !isAdmin },
      ],
    },
    {
      titulo: 'Seguimiento',
      items: [
        { value: 'flujo',       label: 'Flujo',       Icon: Workflow,    visible: true },
        { value: 'historial',   label: 'Historial',   Icon: History,     visible: pv('req:historial') },
        { value: 'actividad',   label: 'Actividad',   Icon: Activity,    visible: pv('req:actividad') },
        { value: 'visto-bueno', label: 'Visto Bueno', Icon: BadgeCheck,  visible: pv('req:visto-bueno') },
      ],
    },
    {
      titulo: 'Colaboración',
      items: [
        { value: 'comentarios',    label: 'Comentarios',    Icon: MessageSquare, visible: pv('req:comentarios') },
        { value: 'reuniones',      label: 'Reuniones',      Icon: Users,         visible: pv('req:reuniones') },
        { value: 'anexos',         label: 'Anexos',         Icon: Paperclip,     visible: pv('req:anexos') },
        { value: 'penalizaciones', label: 'Penalizaciones', Icon: AlertTriangle, visible: pv('req:penalizaciones') },
      ],
    },
  ]
    .map(g => ({ ...g, items: g.items.filter(i => i.visible) }))
    .filter(g => g.items.length > 0)

  const estadoCfg    = getEstadoCfg(req.estado)
  const prioridadCfg = req.prioridad ? PRIORIDADES[req.prioridad] : null

  return (
    <Tabs
      defaultValue={defaultTab}
      orientation="vertical"
      className="flex-col gap-5 p-6 lg:flex-row-reverse lg:items-start"
    >
      {/* Menú de pestañas: columna derecha desde el inicio de la página */}
      <TabsList className="h-auto w-full shrink-0 items-stretch gap-0.5 rounded-xl border border-slate-200 bg-white p-2 shadow-sm max-lg:flex-row max-lg:flex-wrap lg:sticky lg:top-4 lg:w-56">
        {gruposNav.map((grupo, gi) => (
          <div key={grupo.titulo} className="contents lg:block">
            <p className={cn(
              'hidden px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 lg:block',
              gi > 0 && 'mt-3 border-t border-slate-100 pt-3',
            )}>
              {grupo.titulo}
            </p>
            {grupo.items.map(({ value, label, Icon, bloqueado, badge }) => (
              <TabsTrigger
                key={value}
                value={value}
                disabled={bloqueado}
                className={cn(
                  'h-auto flex-none justify-start gap-2 px-2.5 py-2 text-slate-600 max-lg:w-auto lg:w-full',
                  'hover:bg-slate-50 data-active:bg-blue-50 data-active:text-blue-700 data-active:shadow-none',
                  bloqueado && 'opacity-50',
                )}
              >
                {bloqueado ? <Lock size={14} /> : <Icon size={15} />}
                <span className="flex-1 text-left">{label}</span>
                {badge}
              </TabsTrigger>
            ))}
          </div>
        ))}
      </TabsList>

      {/* Columna principal: encabezado y contenido de la pestaña activa */}
      <div className="min-w-0 flex-1 space-y-5">
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
          {(isAdmin || !req.prioridad) && (
            <AsignarPrioridadBtn
              requerimientoId={id}
              prioridadActual={req.prioridad}
              subPrioridadActual={(req as any).sub_prioridad ?? null}
              impactoHH={req.ahorro_anual_cop}
              impactoCualitativos={req.total_beneficios_cualitativos_anual}
              impactoTotal={req.impacto_economico_total_anual}
              proceso_interno={(req as any).proceso_interno ?? null}
            />
          )}
          <AsignarPrioridadProcesoBtn
            requerimientoId={id}
            proceso_interno={(req as any).proceso_interno ?? null}
            prioridadProcesoActual={(req as any).prioridad_proceso ?? null}
          />
          {isAdmin && pe('req:estado') && (
            <CambiarEstadoBtn
              requerimientoId={id}
              estadoActual={req.estado}
              horasEstimadas={req.horas_ahorradas_mes}
              valorHoraEstimado={req.valor_hora_hombre}
            />
          )}
        </div>
      </div>

        {pv('req:informacion') && (
          <TabsContent value="informacion">
            <TabInformacion req={req as any} canEdit={pe('req:general') && !infoLocked} isAdmin={isAdmin} />
          </TabsContent>
        )}

        {verPendientes && (
          <TabsContent value="pendientes">
            <TabPendientes requerimientoId={id} initialData={tareasConsolidadas} />
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

        {pv('req:actividad') && (
          <TabsContent value="actividad">
            <TabActividad eventos={eventosActividad} />
          </TabsContent>
        )}

        {pv('req:visto-bueno') && (
          <TabsContent value="visto-bueno">
            <TabVistoBueno
              requerimientoId={id}
              nombreDesarrollo={req.nombre_desarrollo ?? req.identificacion}
              isAdmin={isAdmin}
              userEmail={perfilAdmin?.email ?? null}
              userName={perfilAdmin?.nombre_completo ?? null}
              tipoSolicitudReq={req.tipo_solicitud ?? null}
            />
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

        {pv('req:doc-tecnica') && (
          <TabsContent value="doc-tecnica" className="mt-4">
            <TabDocumentacionTecnica
              requerimientoId={id}
              currentUserId={perfilAdmin?.id}
              canUpload={pe('req:doc-tecnica')}
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
            <TabComentarios requerimientoId={id} isAdmin={isAdmin} />
          </TabsContent>
        )}

        {pv('req:anexos') && (
          <TabsContent value="anexos" className="mt-4">
            <TabAnexos
              requerimientoId={id}
              canUpload={pc('req:anexos')}
              canDelete={pc('req:anexos') && !infoLocked}
            />
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
      </div>
    </Tabs>
  )
}
