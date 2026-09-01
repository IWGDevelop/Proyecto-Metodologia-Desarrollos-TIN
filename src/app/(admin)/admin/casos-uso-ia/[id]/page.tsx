import { notFound } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Brain, Building2, Calendar, Clock,
  Database, Server, ShieldCheck, Sparkles, Users, AlertTriangle, FileText,
} from 'lucide-react'
import { getCasoUsoIA, getHistorialCasoUsoIA, getAnexosCasoUsoIA } from '@/actions/casos-uso-ia'
import { BadgeEstadoCasoIA } from '@/components/casos-uso-ia/BadgeEstadoCasoIA'
import { CambiarEstadoCasoIA } from '@/components/casos-uso-ia/CambiarEstadoCasoIA'
import { getPerfil } from '@/lib/supabase/auth'

export const dynamic = 'force-dynamic'

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })
}

function fmtDateTime(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-CO', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

const NIVEL_RIESGO_COLOR: Record<string, string> = {
  BAJO:    'bg-green-100 text-green-700',
  MEDIO:   'bg-amber-100 text-amber-700',
  ALTO:    'bg-orange-100 text-orange-700',
  CRITICO: 'bg-red-100 text-red-700',
}

interface Props { params: Promise<{ id: string }> }

export default async function DetalleCasoUsoIAPage({ params }: Props) {
  const { id } = await params
  const [caso, historial, anexos, perfil] = await Promise.all([
    getCasoUsoIA(id),
    getHistorialCasoUsoIA(id),
    getAnexosCasoUsoIA(id),
    getPerfil(),
  ])

  if (!caso) notFound()

  const isAdmin = perfil?.rol === 'ADMIN_TIN' || perfil?.rol === 'PRESIDENCIA' || perfil?.rol === 'DIRECCION_ESTRATEGIA'

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      {/* Breadcrumb */}
      <Link href="/admin/casos-uso-ia" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-violet-600">
        <ArrowLeft size={14} /> Casos de Uso IA
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-violet-100 bg-gradient-to-r from-violet-50 to-purple-50 p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100">
            <Brain size={20} className="text-violet-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-bold text-violet-700">
                #{String(caso.numero).padStart(4, '0')}
              </span>
              <BadgeEstadoCasoIA estado={caso.estado} />
              {caso.nivel_riesgo && (
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${NIVEL_RIESGO_COLOR[caso.nivel_riesgo] ?? 'bg-slate-100 text-slate-600'}`}>
                  Riesgo {caso.nivel_riesgo}
                </span>
              )}
            </div>
            <h1 className="mt-1 text-lg font-bold text-slate-800">
              {caso.herramienta_producto} — {caso.proceso_solicitante}
            </h1>
            <p className="text-xs text-slate-500">
              {caso.herramienta_proveedor} · {caso.alcance} · Radicado {fmtDate(caso.created_at)}
            </p>
          </div>
        </div>

        {/* Acciones de estado (solo admin) */}
        {isAdmin && (
          <CambiarEstadoCasoIA casoId={caso.id} estadoActual={caso.estado} />
        )}
      </div>

      {/* Alerta EN_AJUSTE */}
      {caso.estado === 'EN_AJUSTE' && caso.observaciones_ajuste && (
        <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-500" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Solicitud en ajuste — acción requerida</p>
            <p className="mt-1 text-sm text-amber-700">{caso.observaciones_ajuste}</p>
          </div>
        </div>
      )}

      {/* Vigencia (si está autorizado/en operación) */}
      {caso.fecha_vencimiento && ['AUTORIZADO','HABILITADO','EN_OPERACION','RENOVACION_PENDIENTE'].includes(caso.estado) && (
        <div className="flex gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <Calendar size={18} className="mt-0.5 shrink-0 text-emerald-600" />
          <div>
            <p className="text-sm font-semibold text-emerald-800">Autorización vigente</p>
            <p className="mt-0.5 text-sm text-emerald-700">
              Válida hasta el <strong>{fmtDate(caso.fecha_vencimiento)}</strong>
              {caso.fecha_autorizacion && ` · Autorizada el ${fmtDate(caso.fecha_autorizacion)}`}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Propósito */}
        <div className="col-span-2 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
            <Brain size={15} className="text-violet-500" /> Propósito del caso de uso
          </div>
          <p className="text-sm leading-relaxed text-slate-700 whitespace-pre-wrap">{caso.proposito}</p>
        </div>

        {/* Herramienta */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
            <Server size={15} className="text-violet-500" /> Herramienta propuesta
          </div>
          <dl className="space-y-2 text-sm">
            <div className="flex gap-2">
              <dt className="w-28 shrink-0 text-slate-400">Proveedor</dt>
              <dd className="font-medium text-slate-800">{caso.herramienta_proveedor}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-28 shrink-0 text-slate-400">Producto</dt>
              <dd className="font-medium text-slate-800">{caso.herramienta_producto}</dd>
            </div>
            {caso.herramienta_modelo && (
              <div className="flex gap-2">
                <dt className="w-28 shrink-0 text-slate-400">Modelo</dt>
                <dd className="font-medium text-slate-800">{caso.herramienta_modelo}</dd>
              </div>
            )}
            {caso.herramienta_modalidad_acceso && (
              <div className="flex gap-2">
                <dt className="w-28 shrink-0 text-slate-400">Modalidad</dt>
                <dd className="font-medium text-slate-800">{caso.herramienta_modalidad_acceso}</dd>
              </div>
            )}
          </dl>
        </div>

        {/* Datos y usuarios */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
            <Database size={15} className="text-violet-500" /> Datos y usuarios
          </div>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="mb-0.5 text-xs font-medium text-slate-400 uppercase tracking-wide">Tipo de datos</dt>
              <dd className="text-slate-700">{caso.tipo_datos}</dd>
            </div>
            {caso.sistemas_conectar && (
              <div>
                <dt className="mb-0.5 text-xs font-medium text-slate-400 uppercase tracking-wide">Sistemas a conectar</dt>
                <dd className="text-slate-700">{caso.sistemas_conectar}</dd>
              </div>
            )}
            <div>
              <dt className="mb-0.5 text-xs font-medium text-slate-400 uppercase tracking-wide">Usuarios previstos</dt>
              <dd className="text-slate-700">{caso.usuarios_previstos}</dd>
            </div>
          </dl>
        </div>

        {/* Beneficios */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
            <Sparkles size={15} className="text-violet-500" /> Beneficios esperados
          </div>
          <p className="text-sm leading-relaxed text-slate-700 whitespace-pre-wrap">{caso.beneficios_esperados}</p>
        </div>

        {/* Solicitante */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
            <Users size={15} className="text-violet-500" /> Solicitante
          </div>
          <dl className="space-y-2 text-sm">
            <div className="flex gap-2">
              <dt className="w-28 shrink-0 text-slate-400">Nombre</dt>
              <dd className="font-medium text-slate-800">{caso.solicitante?.nombre_completo ?? '—'}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-28 shrink-0 text-slate-400">Email</dt>
              <dd className="text-slate-700">{caso.solicitante?.email ?? '—'}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-28 shrink-0 text-slate-400">Proceso</dt>
              <dd className="flex items-center gap-1 text-slate-700">
                <Building2 size={11} />
                {caso.proceso_solicitante} · {caso.alcance}
              </dd>
            </div>
          </dl>
        </div>

        {/* Autorización */}
        {(caso.autorizado_by_tin || caso.autorizado_by_ia || caso.fecha_autorizacion) && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-emerald-800">
              <ShieldCheck size={15} /> Autorización conjunta
            </div>
            <dl className="space-y-2 text-sm">
              {caso.autorizador_tin && (
                <div className="flex gap-2">
                  <dt className="w-28 shrink-0 text-emerald-600">Dir. TIN</dt>
                  <dd className="font-medium text-slate-800">{caso.autorizador_tin.nombre_completo}</dd>
                </div>
              )}
              {caso.autorizador_ia && (
                <div className="flex gap-2">
                  <dt className="w-28 shrink-0 text-emerald-600">Dir. IA</dt>
                  <dd className="font-medium text-slate-800">{caso.autorizador_ia.nombre_completo}</dd>
                </div>
              )}
              {caso.fecha_autorizacion && (
                <div className="flex gap-2">
                  <dt className="w-28 shrink-0 text-emerald-600">Fecha auth.</dt>
                  <dd className="text-slate-700">{fmtDate(caso.fecha_autorizacion)}</dd>
                </div>
              )}
              {caso.fecha_vencimiento && (
                <div className="flex gap-2">
                  <dt className="w-28 shrink-0 text-emerald-600">Vence</dt>
                  <dd className="text-slate-700">{fmtDate(caso.fecha_vencimiento)}</dd>
                </div>
              )}
            </dl>
          </div>
        )}
      </div>

      {/* Anexos */}
      {anexos.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
            <FileText size={15} className="text-violet-500" /> Anexos y soportes ({anexos.length})
          </div>
          <ul className="divide-y divide-slate-100">
            {anexos.map(a => (
              <li key={a.id} className="flex items-center justify-between py-2">
                <span className="text-sm text-slate-700">{a.nombre}</span>
                <a
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-violet-600 hover:underline"
                >
                  Ver
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Historial */}
      {historial.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700">
            <Clock size={15} className="text-violet-500" /> Historial de estados
          </div>
          <ol className="relative border-l border-slate-200 pl-4 space-y-4">
            {historial.map(h => (
              <li key={h.id} className="relative">
                <div className="absolute -left-[21px] top-1 h-3 w-3 rounded-full border-2 border-white bg-violet-400" />
                <div className="flex flex-wrap items-center gap-2">
                  {h.estado_anterior && (
                    <>
                      <BadgeEstadoCasoIA estado={h.estado_anterior} />
                      <span className="text-slate-400 text-xs">→</span>
                    </>
                  )}
                  <BadgeEstadoCasoIA estado={h.estado_nuevo} />
                  <span className="text-xs text-slate-400">{fmtDateTime(h.created_at)}</span>
                  {h.cambiado_por && (
                    <span className="text-xs text-slate-500">por {h.cambiado_por.nombre_completo}</span>
                  )}
                </div>
                {h.comentario && (
                  <p className="mt-1 text-xs text-slate-500">{h.comentario}</p>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}
