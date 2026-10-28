import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  AlertCircle, ArrowLeft, CheckCircle2, Clock, CornerDownRight, FileText, MessageSquareReply, ShieldCheck,
} from 'lucide-react'
import { obtenerMiTicket } from '@/actions/tickets/mis-tickets'
import {
  ACCIONES_IGSI,
  CADENA_IGSI,
  IMPACTOS_OPERACION_IGSI,
  LABEL_ESTADO_TICKET,
  LABEL_EVENTO_TICKET,
  LABEL_IMPACTO_TICKET,
} from '@/lib/tickets/constantes'
import type { EstadoTicket } from '@/lib/tickets/types'
import { cn } from '@/lib/utils'
import { EstadoChip, PrioridadChip, TipoGestionChip, fechaHora, fechaSolo } from '@/components/tickets/funcionario/Chips'
import { ComentarYAdjuntar, DecisionResuelto } from '@/components/tickets/funcionario/AccionesMiTicket'
import type { EventoVisible } from '@/components/tickets/funcionario/tipos'

export const dynamic = 'force-dynamic'

const labelEstado = (v: string | null) => (v ? (LABEL_ESTADO_TICKET[v as EstadoTicket] ?? v) : '—')

function textoEvento(e: EventoVisible): string {
  switch (e.tipo_evento) {
    case 'CREACION': return 'Ticket creado'
    case 'CAMBIO_ESTADO': return `${labelEstado(e.valor_anterior)} → ${labelEstado(e.valor_nuevo)}`
    case 'ADJUNTO': return `Adjuntó ${e.valor_nuevo ?? 'un archivo'}`
    case 'COMENTARIO': return e.es_mio ? 'Tu comentario' : 'Comentario de TIN'
    default: return LABEL_EVENTO_TICKET[e.tipo_evento] ?? e.tipo_evento
  }
}

function Dato({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-700">{children || '—'}</dd>
    </div>
  )
}

export default async function MiTicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const t = await obtenerMiTicket(id)
  if (!t) notFound()

  const n = t.novedad
  const docLabel = n ? (n.tipo_documento === 'OTRO' ? (n.tipo_documento_otro ?? 'Otro') : CADENA_IGSI.find(c => c.value === n.tipo_documento)?.label) : null

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-6">
      <Link href="/mis-tickets" className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600">
        <ArrowLeft size={13} /> Volver a mis tickets
      </Link>

      {/* Encabezado */}
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm font-semibold text-blue-700">{t.codigo}</span>
          <EstadoChip estado={t.estado} />
          <PrioridadChip prioridad={t.prioridad} />
          <TipoGestionChip tipo={t.tipo_gestion} />
        </div>
        <h1 className="mt-2 text-xl font-bold text-slate-800">{t.asunto}</h1>
        <p className="mt-0.5 text-sm text-slate-500">{t.categoria} · {t.tipologia}</p>
      </div>

      {/* Avisos según el estado */}
      {t.estado === 'ESPERA_USUARIO' && (
        <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-amber-900">
            <MessageSquareReply size={16} /> TIN necesita información de tu parte
          </p>
          {t.solicitudPendiente && t.solicitudPendiente.textos.length > 0 ? (
            <ul className="mt-2 space-y-1.5">
              {t.solicitudPendiente.textos.map((x, i) => (
                <li key={i} className="whitespace-pre-wrap rounded-lg bg-white/70 px-3 py-2 text-sm text-amber-950">{x}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-sm text-amber-900">Revisa los comentarios del historial.</p>
          )}
          <p className="mt-2 text-xs text-amber-800">
            Responde abajo con un comentario o adjunta lo que se te pidió. Al responder, el ticket vuelve a En proceso.
            {t.solicitudPendiente && <> Pedido el {fechaHora(t.solicitudPendiente.fecha)}.</>}
          </p>
        </div>
      )}

      {t.estado === 'ESPERA_APROBACION' && (
        <div className="flex gap-2 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
          <ShieldCheck size={16} className="mt-0.5 shrink-0" />
          <span>
            Pendiente de aprobación {t.aprobador ? <>de <strong>{t.aprobador}</strong></> : <>de un coordinador TIN (no tienes jefe inmediato configurado)</>}.
            Cuando se apruebe, TIN empieza a atenderlo.
          </span>
        </div>
      )}

      {t.cierre && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-emerald-900">
            <CheckCircle2 size={16} /> Respuesta de TIN
          </p>
          <p className="mt-2 whitespace-pre-wrap text-sm text-emerald-950">{t.cierre.respuesta}</p>
          <p className="mt-1 text-xs text-emerald-700">{fechaHora(t.cierre.fecha)}</p>
        </div>
      )}

      {t.estado === 'RESUELTO' && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-semibold text-slate-800">¿La solución resolvió tu solicitud?</p>
          <p className="mb-3 mt-0.5 text-xs text-slate-500">
            Si no respondes, el ticket se cerrará automáticamente después de unos días hábiles.
          </p>
          <DecisionResuelto ticketId={t.id} />
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {/* Descripción y campos */}
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Descripción</p>
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{t.descripcion}</p>
            {t.valores.length > 0 && (
              <dl className="mt-4 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2">
                {t.valores.map((v, i) => (
                  <Dato key={i} label={v.etiqueta}>{v.tipo_dato === 'FECHA' ? fechaSolo(v.valor) : <span className="whitespace-pre-wrap">{v.valor}</span>}</Dato>
                ))}
              </dl>
            )}
          </section>

          {/* Novedad IGSI */}
          {n && (
            <section className="rounded-xl border border-blue-200 bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-500">Novedad IGSI</p>
              <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                <Dato label="Documento">{docLabel} {n.numero_documento ?? <span className="text-slate-400">(sin número)</span>}</Dato>
                <Dato label="Documentos relacionados">{n.documentos_relacionados}</Dato>
                <Dato label="Servicio / modalidad">{n.servicio} · {n.modalidad}</Dato>
                <Dato label="Acción">{ACCIONES_IGSI.find(a => a.value === n.accion)?.label ?? n.accion}</Dato>
                <div className="sm:col-span-2"><Dato label="Qué pasó"><span className="whitespace-pre-wrap">{n.que_paso}</span></Dato></div>
                <div className="sm:col-span-2"><Dato label="Qué esperaba"><span className="whitespace-pre-wrap">{n.que_esperaba}</span></Dato></div>
                {n.mensaje_error && (
                  <div className="sm:col-span-2">
                    <Dato label="Mensaje de error"><code className="block whitespace-pre-wrap rounded bg-slate-50 p-2 text-xs">{n.mensaje_error}</code></Dato>
                  </div>
                )}
                <Dato label="Impacto en la operación">{IMPACTOS_OPERACION_IGSI.find(i => i.value === n.impacto_operacion)?.label}</Dato>
                <Dato label="Validación previa">{n.validacion_previa ? 'Revisó los datos antes de reportar' : 'No'}</Dato>
              </dl>
            </section>
          )}

          {/* Adjuntos */}
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Adjuntos ({t.adjuntos.length})</p>
            {t.adjuntos.length === 0 ? (
              <p className="mt-2 text-sm text-slate-400">Sin adjuntos</p>
            ) : (
              <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {t.adjuntos.map(a => (
                  <li key={a.id} className="overflow-hidden rounded-lg border border-slate-200">
                    <a href={a.url} target="_blank" rel="noopener noreferrer" className="block hover:opacity-90">
                      {a.es_imagen ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={a.url} alt={a.nombre_archivo} className="h-28 w-full object-cover" />
                      ) : (
                        <div className="flex h-28 items-center justify-center bg-slate-50"><FileText size={28} className="text-red-500" /></div>
                      )}
                      <div className="px-2 py-1.5">
                        <p className="truncate text-xs font-medium text-slate-700">{a.nombre_archivo}</p>
                        <p className="text-[10px] text-slate-400">{a.cargado_por ?? ''} · {fechaHora(a.fecha)}</p>
                      </div>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Comentar */}
          {t.estado !== 'CERRADO' && (
            <section className={cn('rounded-xl border bg-white p-5', t.estado === 'ESPERA_USUARIO' ? 'border-amber-300' : 'border-slate-200')}>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                {t.estado === 'ESPERA_USUARIO' ? 'Responder a TIN' : 'Comentar o adjuntar'}
              </p>
              <ComentarYAdjuntar ticketId={t.id} estado={t.estado} />
            </section>
          )}

          {/* Historial */}
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Seguimiento</p>
            <ol className="mt-4 space-y-4 border-l-2 border-slate-100 pl-4">
              {t.historial.map(e => (
                <li key={e.id} className="relative">
                  <span className={cn(
                    'absolute -left-[23px] top-1 h-3 w-3 rounded-full ring-2 ring-white',
                    e.tipo_evento === 'CAMBIO_ESTADO' ? 'bg-blue-500'
                      : e.tipo_evento === 'COMENTARIO' ? 'bg-slate-400'
                      : e.tipo_evento === 'REAPERTURA' || e.tipo_evento === 'RECHAZO' ? 'bg-amber-500'
                      : e.tipo_evento === 'CIERRE' || e.tipo_evento === 'APROBACION' ? 'bg-emerald-500'
                      : 'bg-slate-300',
                  )} />
                  <p className="text-xs text-slate-400">
                    {fechaHora(e.fecha)} · {e.usuario ?? 'Sistema'}
                  </p>
                  <p className="text-sm font-medium text-slate-700">{textoEvento(e)}</p>
                  {e.comentario && (
                    <p className={cn(
                      'mt-1 whitespace-pre-wrap rounded-lg px-3 py-2 text-sm',
                      e.es_mio ? 'bg-blue-50 text-blue-950' : 'bg-slate-50 text-slate-700',
                    )}>
                      {e.comentario}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          </section>
        </div>

        {/* Columna de datos */}
        <aside className="space-y-5">
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <dl className="space-y-3">
              <Dato label="Estado"><EstadoChip estado={t.estado} /></Dato>
              <Dato label="Responsable">{t.responsable ?? <span className="text-slate-400">Sin asignar</span>}</Dato>
              {t.requiere_aprobacion && <Dato label="Aprobador">{t.aprobador ?? 'Coordinador TIN'}</Dato>}
              <Dato label="Impacto">{LABEL_IMPACTO_TICKET[t.impacto]}</Dato>
              <Dato label="Área / sede">{[t.area, t.sede].filter(Boolean).join(' · ')}</Dato>
              <Dato label="Canal">{t.canal === 'CORREO' ? 'Correo' : 'Formulario TIN-FLOW'}</Dato>
            </dl>
          </section>
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400"><Clock size={12} /> Fechas</p>
            <dl className="space-y-3">
              <Dato label="Creado">{fechaHora(t.fecha_creacion)}</Dato>
              {t.fecha_requerida && <Dato label="Fecha requerida">{fechaSolo(t.fecha_requerida)}</Dato>}
              {t.fecha_asignacion && <Dato label="Asignado">{fechaHora(t.fecha_asignacion)}</Dato>}
              {t.fecha_primera_respuesta && <Dato label="Primera respuesta">{fechaHora(t.fecha_primera_respuesta)}</Dato>}
              {t.fecha_resuelto && <Dato label="Resuelto">{fechaHora(t.fecha_resuelto)}</Dato>}
              {t.fecha_cierre && <Dato label="Cerrado">{fechaHora(t.fecha_cierre)}{t.cierre_automatico ? ' (automático)' : ''}</Dato>}
              {t.reaperturas > 0 && <Dato label="Reaperturas">{t.reaperturas}</Dato>}
            </dl>
          </section>
          {(t.padre || t.hijos.length > 0) && (
            <section className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Tickets relacionados</p>
              {t.padre && (
                <Link href={`/mis-tickets/${t.padre.id}`} className="block rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50">
                  <span className="text-[11px] text-slate-400">Ticket padre</span>
                  <p><span className="font-mono text-xs text-blue-700">{t.padre.codigo}</span> {t.padre.asunto}</p>
                </Link>
              )}
              {t.hijos.map(h => (
                <Link key={h.id} href={`/mis-tickets/${h.id}`} className="flex items-start gap-1.5 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50">
                  <CornerDownRight size={13} className="mt-1 shrink-0 text-slate-400" />
                  <span className="flex-1">
                    <span className="font-mono text-xs text-blue-700">{h.codigo}</span> {h.asunto}
                    <span className="mt-0.5 block"><EstadoChip estado={h.estado} className="text-[10px]" /></span>
                  </span>
                </Link>
              ))}
            </section>
          )}
          {t.estado === 'CERRADO' && (
            <p className="flex gap-1.5 text-xs text-slate-500">
              <AlertCircle size={13} className="mt-0.5 shrink-0" />
              Si la novedad vuelve a ocurrir, crea un ticket nuevo.
            </p>
          )}
        </aside>
      </div>
    </div>
  )
}
