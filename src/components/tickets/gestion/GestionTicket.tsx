'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  ArrowLeft, Bug, CheckCircle2, Clock, Eye, EyeOff, FileText, Flag, GitBranch, History, Loader2, Lock, Mail,
  MessageSquare, Paperclip, PauseCircle, Play, RotateCcw, Send, ShieldCheck, ShieldX, Tag, Truck, UserCheck, UserPlus, XCircle,
} from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { useProcesos } from '@/context/ProcesosContext'
import {
  ACCIONES_IGSI, CADENA_IGSI, CLASIFICACIONES_BUG, ESTADOS_BUG, IMPACTOS_OPERACION_IGSI, LABEL_IMPACTO_TICKET,
  MEDICIONES, PRIORIDADES_TICKET, SEVERIDADES_BUG, TIPOS_GESTION, TRANSICIONES,
} from '@/lib/tickets/constantes'
import type { EstadoTicket, PrioridadTicket } from '@/lib/tickets/types'
import type { ResponsableOpcion, TicketGestion, TipologiaOpcion } from '@/actions/tickets/bandeja'
import {
  agregarComentarioTicket, cambiarEstadoTicket, cambiarPrioridadTicket, decidirAprobacionTicket,
  reabrirTicket, reclasificarTicket, tomarTicket,
} from '@/actions/tickets/flujo'
import { registrarAdjuntos } from '@/actions/tickets/adjuntos'
import { SubirAdjuntos, type AdjuntoNuevo } from '@/components/tickets/SubirAdjuntos'
import { AsignarDialog } from './AsignarDialog'
import { ResolverDialog } from './ResolverDialog'
import { HistorialTicket } from './HistorialTicket'
import { EstadoBadge, PrioridadBadge, Semaforo, btnPrimario, btnSecundario, formatFechaCorta, formatFechaHora, inputCls } from './ui'

type Resultado = { ok: boolean; error?: string }

/* ── Diálogo genérico con texto ────────────────────────────────────────── */
function AccionDialog({
  open, onOpenChange, titulo, descripcion, etiqueta, requerido, placeholder, textoBoton, colorBoton, onConfirmar, children, listo = true,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  titulo: string
  descripcion?: string
  etiqueta: string
  requerido: boolean
  placeholder?: string
  textoBoton: string
  colorBoton?: string
  onConfirmar: (texto: string) => Promise<Resultado>
  children?: React.ReactNode
  listo?: boolean
}) {
  const [texto, setTexto] = useState('')
  const [pending, startT] = useTransition()
  const confirmar = () => {
    if (requerido && !texto.trim()) { toast.error(`${etiqueta} es obligatorio`); return }
    if (!listo) { toast.error('Completa los datos'); return }
    startT(async () => {
      const res = await onConfirmar(texto.trim())
      if (!res.ok) { toast.error(res.error ?? 'No se pudo completar la acción'); return }
      setTexto('')
      onOpenChange(false)
    })
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          {descripcion && <DialogDescription>{descripcion}</DialogDescription>}
        </DialogHeader>
        <div className="space-y-3">
          {children}
          <label className="block text-xs font-semibold text-slate-600">
            {etiqueta}{requerido ? '' : ' (opcional)'}
            <textarea value={texto} onChange={e => setTexto(e.target.value)} rows={4} className={`${inputCls} mt-1`} placeholder={placeholder} />
          </label>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => onOpenChange(false)} className={btnSecundario}>Cancelar</button>
            <button type="button" onClick={confirmar} disabled={pending} className={cn(btnPrimario, colorBoton)}>
              {pending && <Loader2 size={14} className="animate-spin" />} {textoBoton}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/* ── Piezas ────────────────────────────────────────────────────────────── */
function Seccion({ titulo, icon: Icon, children, accion }: { titulo: string; icon: typeof FileText; children: React.ReactNode; accion?: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-2.5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700"><Icon size={15} className="text-slate-400" /> {titulo}</h2>
        {accion}
      </div>
      <div className="p-4">{children}</div>
    </section>
  )
}

function Dato({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-800">{children || <span className="text-slate-300">—</span>}</dd>
    </div>
  )
}

function CadenaDocumentos({ tipo }: { tipo: string }) {
  const cadena = CADENA_IGSI.filter(c => c.value !== 'OTRO')
  const idx = cadena.findIndex(c => c.value === tipo)
  return (
    <div className="flex flex-wrap items-center gap-1" aria-label={`Documento afectado: ${tipo}`}>
      {cadena.map((c, i) => (
        <span key={c.value} className="flex items-center gap-1">
          <span className={cn(
            'rounded-md px-2 py-0.5 text-xs font-semibold',
            i === idx ? 'bg-blue-600 text-white' : idx >= 0 && i < idx ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-400',
          )}>
            {c.label}
          </span>
          {i < cadena.length - 1 && <span className="text-slate-300">→</span>}
        </span>
      ))}
      {tipo === 'OTRO' && <span className="ml-1 rounded-md bg-blue-600 px-2 py-0.5 text-xs font-semibold text-white">Otro</span>}
    </div>
  )
}

function horas(v: number | null | undefined) {
  return v == null ? '—' : `${Number(v).toFixed(1)} h`
}

type Dialogo =
  | null | 'asignar' | 'resolver' | 'espera_usuario' | 'espera_proveedor' | 'espera_aprobacion' | 'en_proceso'
  | 'cerrar' | 'reabrir' | 'prioridad' | 'reclasificar' | 'aprobar' | 'rechazar'

/* ── Vista de gestión ──────────────────────────────────────────────────── */
export function GestionTicket({
  ticket: t, responsables, tipologias,
}: {
  ticket: TicketGestion
  responsables: ResponsableOpcion[]
  tipologias: TipologiaOpcion[]
}) {
  const router = useRouter()
  const { label: labelArea } = useProcesos()
  const [dialogo, setDialogo] = useState<Dialogo>(null)
  const [comentario, setComentario] = useState('')
  const [visible, setVisible] = useState(true)
  const [nuevosAdjuntos, setNuevosAdjuntos] = useState<AdjuntoNuevo[]>([])
  const [prioridad, setPrioridad] = useState<PrioridadTicket>(t.prioridad)
  const [tipologiaId, setTipologiaId] = useState('')
  const [pending, startT] = useTransition()

  const p = t.permisos
  const transiciones = TRANSICIONES[t.estado] ?? []
  const puede = (e: EstadoTicket) => p.gestionar && transiciones.includes(e)
  const abierto = t.estado !== 'CERRADO'
  const refrescar = () => router.refresh()
  const cerrarDialogo = (o: boolean) => { if (!o) setDialogo(null) }

  const ejecutar = (fn: () => Promise<Resultado>, exito: string) =>
    startT(async () => {
      const res = await fn()
      if (!res.ok) { toast.error(res.error ?? 'No se pudo completar la acción'); return }
      toast.success(exito)
      refrescar()
    })

  const enviarComentario = () => {
    if (!comentario.trim()) { toast.error('Escribe el comentario'); return }
    startT(async () => {
      const res = await agregarComentarioTicket(t.id, comentario, visible)
      if (!res.ok) { toast.error(res.error ?? 'No se pudo guardar'); return }
      toast.success(visible ? 'Comentario enviado al usuario' : 'Nota interna guardada')
      setComentario('')
      refrescar()
    })
  }

  const guardarAdjuntos = () => {
    if (nuevosAdjuntos.length === 0) return
    startT(async () => {
      const res = await registrarAdjuntos(t.id, nuevosAdjuntos)
      if (!res.ok) { toast.error(res.error ?? 'No se pudieron guardar los adjuntos'); return }
      toast.success('Adjuntos guardados')
      setNuevosAdjuntos([])
      refrescar()
    })
  }

  const puedeTomar = !t.responsable && (p.atender || p.coordinar) && t.estado !== 'ESPERA_APROBACION' && abierto
  const enProcesoNormal = puede('EN_PROCESO') && t.estado !== 'RESUELTO' && t.estado !== 'CERRADO'
  const puedeReabrir = (p.gestionar || p.esSolicitante) && (t.estado === 'RESUELTO' || t.estado === 'CERRADO') && !!t.responsable
  const puedeCerrar = puede('CERRADO') && t.estado !== 'ESPERA_APROBACION'
  const pctConsumido = t.tiempos?.t_consumido != null && t.objetivo
    ? Math.round((Number(t.tiempos.t_consumido) / (t.fechaPrimeraRespuesta ? t.objetivo.solucion : t.objetivo.respuesta)) * 100)
    : null
  const abiertoParaReloj = !['RESUELTO', 'CERRADO'].includes(t.estado)

  const tipologiasAgrupadas = tipologias.reduce<Record<string, TipologiaOpcion[]>>((acc, x) => {
    (acc[x.categoria] ??= []).push(x)
    return acc
  }, {})

  return (
    <div className="space-y-4">
      {/* Encabezado */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href="/admin/tickets" className="mb-1 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-blue-600">
            <ArrowLeft size={12} /> Bandeja de tickets
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-bold text-blue-700">{t.codigo}</span>
            <EstadoBadge estado={t.estado} />
            <PrioridadBadge prioridad={t.prioridad} />
            {t.tipologia.restringida && <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600"><Lock size={10} /> Restringida</span>}
            {(t.respuestaVencida || t.solucionVencida) && abiertoParaReloj && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700">{t.solucionVencida ? 'Solución vencida' : 'Respuesta vencida'}</span>
            )}
            {t.reaperturas > 0 && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] text-amber-800">Reabierto {t.reaperturas}×</span>}
          </div>
          <h1 className="mt-1 text-xl font-bold text-slate-800">{t.asunto}</h1>
          <p className="text-sm text-slate-500">{t.categoria.nombre} · {t.tipologia.nombre}</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* Columna principal */}
        <div className="space-y-4">
          <Seccion titulo="Descripción" icon={FileText}>
            <p className="whitespace-pre-wrap text-sm text-slate-800">{t.descripcion}</p>
            {t.campos.length > 0 && (
              <dl className="mt-4 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2">
                {t.campos.map((c, i) => <Dato key={i} label={c.etiqueta}>{c.valor}</Dato>)}
              </dl>
            )}
          </Seccion>

          {t.novedad && (
            <Seccion titulo="Novedad en IGSI" icon={GitBranch}>
              <div className="space-y-4">
                <div>
                  <p className="mb-1.5 text-[11px] uppercase tracking-wide text-slate-400">Documento afectado</p>
                  <CadenaDocumentos tipo={t.novedad.tipo_documento} />
                </div>
                <dl className="grid gap-3 sm:grid-cols-2">
                  <Dato label="Número del documento">{t.novedad.numero_documento}{t.novedad.tipo_documento === 'OTRO' && t.novedad.tipo_documento_otro ? ` (${t.novedad.tipo_documento_otro})` : ''}</Dato>
                  <Dato label="Documentos relacionados">{t.novedad.documentos_relacionados}</Dato>
                  <Dato label="Servicio">{t.novedad.servicio}</Dato>
                  <Dato label="Modalidad">{t.novedad.modalidad}</Dato>
                  <Dato label="Acción que intentaba">{ACCIONES_IGSI.find(a => a.value === t.novedad!.accion)?.label ?? t.novedad.accion}</Dato>
                  <Dato label="Impacto">{IMPACTOS_OPERACION_IGSI.find(a => a.value === t.novedad!.impacto_operacion)?.label ?? t.novedad.impacto_operacion}</Dato>
                </dl>
                <dl className="grid gap-3">
                  <Dato label="Qué pasó"><span className="whitespace-pre-wrap">{t.novedad.que_paso}</span></Dato>
                  <Dato label="Qué esperaba"><span className="whitespace-pre-wrap">{t.novedad.que_esperaba}</span></Dato>
                  {t.novedad.mensaje_error && <Dato label="Mensaje de error"><code className="whitespace-pre-wrap rounded bg-slate-50 px-1.5 py-0.5 text-xs">{t.novedad.mensaje_error}</code></Dato>}
                  <Dato label="Validación previa">{t.novedad.validacion_previa ? 'Sí, revisó los datos del documento' : 'No'}</Dato>
                </dl>
              </div>
            </Seccion>
          )}

          {t.cierre && (
            <Seccion titulo="Solución registrada" icon={CheckCircle2}>
              <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded bg-teal-50 px-2 py-0.5 font-semibold text-teal-700">{t.cierre.tipo_causa}</span>
                <span className="text-slate-600">{t.cierre.subcausa}</span>
                {t.cierre.requiere_capacitacion && <span className="rounded bg-violet-100 px-1.5 text-violet-700">Requiere capacitación</span>}
                {t.cierre.requiere_ajuste && <span className="rounded bg-rose-100 px-1.5 text-rose-700">Requiere ajuste IGSI</span>}
                <span className="ml-auto text-slate-400">{t.cierre.cerrado_por} · {formatFechaHora(t.cierre.fecha)}</span>
              </div>
              <p className="whitespace-pre-wrap text-sm text-slate-800">{t.cierre.respuesta}</p>
            </Seccion>
          )}

          <Seccion titulo={`Adjuntos (${t.adjuntos.length})`} icon={Paperclip}>
            {t.adjuntos.length > 0 && (
              <ul className="mb-3 grid gap-2 sm:grid-cols-2">
                {t.adjuntos.map(a => (
                  <li key={a.id}>
                    <a href={a.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-lg border border-slate-200 p-2 hover:bg-slate-50">
                      {a.es_imagen
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={a.url} alt={a.nombre_archivo} className="h-12 w-12 shrink-0 rounded object-cover" />
                        : <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded bg-slate-100"><FileText size={18} className="text-slate-400" /></span>}
                      <span className="min-w-0">
                        <span className="line-clamp-1 text-xs font-medium text-slate-700">{a.nombre_archivo}</span>
                        <span className="block text-[11px] text-slate-400">{a.autor ?? '—'} · {formatFechaCorta(a.fecha)}</span>
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
            {(p.gestionar || p.esSolicitante) && (
              <div className="space-y-2">
                <SubirAdjuntos carpeta={t.id} value={nuevosAdjuntos} onChange={setNuevosAdjuntos} disabled={pending} />
                {nuevosAdjuntos.length > 0 && (
                  <button type="button" onClick={guardarAdjuntos} disabled={pending} className={btnPrimario}>
                    <Paperclip size={14} /> Guardar {nuevosAdjuntos.length} adjunto{nuevosAdjuntos.length !== 1 ? 's' : ''}
                  </button>
                )}
              </div>
            )}
          </Seccion>

          <Seccion titulo="Historial" icon={History}>
            {(p.gestionar || p.esSolicitante) && (
              <div className="mb-5 space-y-2 rounded-xl border border-slate-200 bg-slate-50/50 p-3">
                <textarea
                  value={comentario}
                  onChange={e => setComentario(e.target.value)}
                  rows={3}
                  placeholder={visible ? 'Comentario para el usuario (lo verá en su ticket)…' : 'Nota interna de TIN (el usuario no la ve)…'}
                  className={cn(inputCls, !visible && 'border-amber-200 bg-amber-50/40')}
                />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {p.gestionar ? (
                    <div className="flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs" role="radiogroup" aria-label="Visibilidad del comentario">
                      <button type="button" role="radio" aria-checked={visible} onClick={() => setVisible(true)}
                        className={cn('flex items-center gap-1 rounded-md px-2.5 py-1 font-medium', visible ? 'bg-blue-600 text-white' : 'text-slate-600')}>
                        <Eye size={12} /> Visible al usuario
                      </button>
                      <button type="button" role="radio" aria-checked={!visible} onClick={() => setVisible(false)}
                        className={cn('flex items-center gap-1 rounded-md px-2.5 py-1 font-medium', !visible ? 'bg-amber-500 text-white' : 'text-slate-600')}>
                        <EyeOff size={12} /> Interno
                      </button>
                    </div>
                  ) : <span className="text-xs text-slate-400">Tu comentario es visible para TIN</span>}
                  <button type="button" onClick={enviarComentario} disabled={pending || !comentario.trim()} className={btnPrimario}>
                    {pending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Comentar
                  </button>
                </div>
              </div>
            )}
            <HistorialTicket eventos={[...t.historial].reverse()} />
          </Seccion>
        </div>

        {/* Columna lateral */}
        <div className="space-y-4">
          {/* Acciones */}
          {(p.gestionar || puedeTomar || p.puedeAprobar || puedeReabrir) && (
            <Seccion titulo="Acciones" icon={Play}>
              <div className="grid gap-2">
                {p.puedeAprobar && (
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setDialogo('aprobar')} className={cn(btnPrimario, 'bg-emerald-600 hover:bg-emerald-700')}><ShieldCheck size={14} /> Aprobar</button>
                    <button type="button" onClick={() => setDialogo('rechazar')} className={cn(btnPrimario, 'bg-red-600 hover:bg-red-700')}><ShieldX size={14} /> Rechazar</button>
                  </div>
                )}
                {puedeTomar && (
                  <button type="button" disabled={pending} onClick={() => ejecutar(() => tomarTicket(t.id), 'Tomaste el ticket')} className={btnPrimario}>
                    <UserCheck size={14} /> Tomar ticket
                  </button>
                )}
                {p.coordinar && abierto && t.estado !== 'ESPERA_APROBACION' && (
                  <button type="button" onClick={() => setDialogo('asignar')} className={btnSecundario}>
                    <UserPlus size={14} /> {t.responsable ? 'Reasignar' : 'Asignar'}
                  </button>
                )}
                {enProcesoNormal && (
                  <button type="button" disabled={pending} onClick={() => ejecutar(() => cambiarEstadoTicket(t.id, 'EN_PROCESO'), 'Ticket en proceso')} className={btnSecundario}>
                    <Play size={14} /> Pasar a En proceso
                  </button>
                )}
                {puede('ESPERA_USUARIO') && (
                  <button type="button" onClick={() => setDialogo('espera_usuario')} className={btnSecundario}>
                    <Mail size={14} /> Pedir información al usuario
                  </button>
                )}
                {puede('ESPERA_PROVEEDOR') && (
                  <button type="button" onClick={() => setDialogo('espera_proveedor')} className={btnSecundario}>
                    <Truck size={14} /> Espera de proveedor
                  </button>
                )}
                {puede('ESPERA_APROBACION') && t.estado !== 'ABIERTO' && (
                  <button type="button" onClick={() => setDialogo('espera_aprobacion')} className={btnSecundario}>
                    <PauseCircle size={14} /> Solicitar aprobación
                  </button>
                )}
                {puede('RESUELTO') && (
                  <button type="button" onClick={() => setDialogo('resolver')} className={cn(btnPrimario, 'bg-emerald-600 hover:bg-emerald-700')}>
                    <CheckCircle2 size={14} /> Resolver
                  </button>
                )}
                {puedeCerrar && (
                  <button type="button" onClick={() => setDialogo('cerrar')} className={btnSecundario}>
                    <XCircle size={14} /> Cerrar ticket
                  </button>
                )}
                {puedeReabrir && (
                  <button type="button" onClick={() => setDialogo('reabrir')} className={btnSecundario}>
                    <RotateCcw size={14} /> Reabrir
                  </button>
                )}
                {p.gestionar && abierto && (
                  <div className="grid grid-cols-2 gap-2 border-t border-slate-100 pt-2">
                    <button type="button" onClick={() => { setPrioridad(t.prioridad); setDialogo('prioridad') }} className={btnSecundario}>
                      <Flag size={14} /> Prioridad
                    </button>
                    <button type="button" onClick={() => { setTipologiaId(''); setDialogo('reclasificar') }} className={btnSecundario}>
                      <Tag size={14} /> Reclasificar
                    </button>
                  </div>
                )}
                {!p.gestionar && !puedeTomar && !p.puedeAprobar && (
                  <p className="text-xs text-slate-400">Solo el responsable o la Coordinación TIN pueden gestionar este ticket.</p>
                )}
              </div>
            </Seccion>
          )}

          <Seccion titulo="Datos del ticket" icon={MessageSquare}>
            <dl className="grid gap-3">
              <Dato label="Responsable">{t.responsable?.nombre_completo ?? <span className="italic text-slate-400">Sin asignar</span>}</Dato>
              <Dato label="Solicitante">
                {t.solicitante && (
                  <span>
                    {t.solicitante.nombre_completo}
                    {t.solicitante.cargo && <span className="block text-xs text-slate-500">{t.solicitante.cargo}</span>}
                    {t.solicitante.email && <span className="block text-xs text-slate-400">{t.solicitante.email}</span>}
                  </span>
                )}
              </Dato>
              <div className="grid grid-cols-2 gap-3">
                <Dato label="Área">{labelArea(t.area ?? t.solicitante?.proceso_interno)}</Dato>
                <Dato label="Sede">{t.sede ?? t.solicitante?.sede}</Dato>
              </div>
              <Dato label="Jefe inmediato">{t.solicitante?.jefe}</Dato>
              {t.aprobador && <Dato label="Aprobador">{t.aprobador.nombre_completo}</Dato>}
              <div className="grid grid-cols-2 gap-3">
                <Dato label="Canal">{t.canal === 'CORREO' ? 'Correo' : 'Formulario TIN-FLOW'}</Dato>
                <Dato label="Impacto">{LABEL_IMPACTO_TICKET[t.impacto]}</Dato>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Dato label="Tipo">{TIPOS_GESTION.find(x => x.value === t.tipologia.tipoGestion)?.label}</Dato>
                <Dato label="Se mide contra">{MEDICIONES.find(x => x.value === t.tipologia.seMideContra)?.label}</Dato>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Dato label="Creado">{formatFechaHora(t.fechaCreacion)}</Dato>
                <Dato label="Fecha requerida">{t.fechaRequerida ? formatFechaCorta(t.fechaRequerida) : null}</Dato>
              </div>
            </dl>
          </Seccion>

          <Seccion titulo="Tiempos (horas hábiles)" icon={Clock}>
            <dl className="grid grid-cols-2 gap-3">
              {abiertoParaReloj && (
                <div className="col-span-2">
                  <dt className="text-[11px] uppercase tracking-wide text-slate-400">Consumido ({t.fechaPrimeraRespuesta ? 'solución' : 'primera respuesta'})</dt>
                  <dd className="mt-0.5 flex items-center gap-2 text-sm">
                    <Semaforo porcentaje={pctConsumido} vencido={t.respuestaVencida || t.solucionVencida} />
                    {t.tiempos?.t_consumido != null && t.objetivo && (
                      <span className="text-xs text-slate-500">
                        {horas(t.tiempos.t_consumido)} de {t.fechaPrimeraRespuesta ? t.objetivo.solucion : t.objetivo.respuesta} h
                      </span>
                    )}
                  </dd>
                </div>
              )}
              <Dato label="Asignado">{t.fechaAsignacion ? formatFechaHora(t.fechaAsignacion) : null}</Dato>
              <Dato label="Primera respuesta">{t.fechaPrimeraRespuesta ? formatFechaHora(t.fechaPrimeraRespuesta) : null}</Dato>
              <Dato label="Resuelto">{t.fechaResuelto ? formatFechaHora(t.fechaResuelto) : null}</Dato>
              <Dato label="Cerrado">{t.fechaCierre ? `${formatFechaHora(t.fechaCierre)}${t.cierreAutomatico ? ' (automático)' : ''}` : null}</Dato>
              {t.tiempos && (
                <>
                  <Dato label="T. respuesta">{horas(t.tiempos.t_primera_respuesta)}</Dato>
                  <Dato label="T. solución">{horas(t.tiempos.t_solucion)}</Dato>
                  <Dato label="Espera usuario">{horas(t.tiempos.t_espera_usuario)}</Dato>
                  <Dato label="Espera proveedor">{horas(t.tiempos.t_espera_proveedor)}</Dato>
                  <Dato label="Espera aprobación">{horas(t.tiempos.t_espera_aprobacion)}</Dato>
                  <Dato label="Total">{horas(t.tiempos.t_total)}</Dato>
                </>
              )}
              {t.objetivo && (
                <p className="col-span-2 text-[11px] text-slate-400">Objetivo {PRIORIDADES_TICKET.find(x => x.value === t.prioridad)?.label}: respuesta {t.objetivo.respuesta} h · solución {t.objetivo.solucion} h</p>
              )}
            </dl>
          </Seccion>

          {(t.padre || t.hijos.length > 0) && (
            <Seccion titulo="Tickets relacionados" icon={GitBranch}>
              <ul className="space-y-2 text-sm">
                {t.padre && (
                  <li>
                    <p className="text-[11px] uppercase tracking-wide text-slate-400">Ticket padre</p>
                    <Link href={`/admin/tickets/${t.padre.id}`} className="flex items-center gap-2 hover:text-blue-700">
                      <span className="font-mono text-xs font-semibold text-blue-700">{t.padre.codigo}</span>
                      <span className="line-clamp-1 flex-1">{t.padre.asunto}</span>
                      <EstadoBadge estado={t.padre.estado} />
                    </Link>
                  </li>
                )}
                {t.hijos.length > 0 && <li className="text-[11px] uppercase tracking-wide text-slate-400">Tickets hijos</li>}
                {t.hijos.map(h => (
                  <li key={h.id}>
                    <Link href={`/admin/tickets/${h.id}`} className="flex items-center gap-2 hover:text-blue-700">
                      <span className="font-mono text-xs font-semibold text-blue-700">{h.codigo}</span>
                      <span className="line-clamp-1 flex-1">{h.asunto}</span>
                      <EstadoBadge estado={h.estado} />
                    </Link>
                  </li>
                ))}
              </ul>
            </Seccion>
          )}

          {t.bugs.length > 0 && (
            <Seccion titulo="Bugs enlazados" icon={Bug}>
              <ul className="space-y-2">
                {t.bugs.map(b => (
                  <li key={b.id} className="text-sm">
                    <Link href={`/admin/tickets-bugs?bug=${b.id}`} className="flex items-start gap-2 hover:text-blue-700">
                      <span className="font-mono text-xs font-semibold text-rose-700">{b.codigo}</span>
                      <span className="flex-1">
                        <span className="line-clamp-2">{b.titulo}</span>
                        <span className="block text-[11px] text-slate-400">
                          {CLASIFICACIONES_BUG.find(c => c.value === b.clasificacion)?.label} · {SEVERIDADES_BUG.find(s => s.value === b.severidad)?.label} · {ESTADOS_BUG.find(e => e.value === b.estado)?.label}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Seccion>
          )}
        </div>
      </div>

      {/* Diálogos */}
      {dialogo === 'asignar' && (
        <AsignarDialog
          open onOpenChange={cerrarDialogo}
          ticketId={t.id} codigo={t.codigo} responsableActualId={t.responsable?.id ?? null}
          responsables={responsables} onDone={refrescar}
        />
      )}
      {dialogo === 'resolver' && (
        <ResolverDialog
          open onOpenChange={cerrarDialogo}
          ticketId={t.id} codigo={t.codigo} esNovedadIGSI={t.tipologia.esNovedadIGSI} causas={t.causas}
          conceptuales30d={t.conceptuales30d} umbralCapacitacion={t.umbralCapacitacion}
          solicitante={t.solicitante?.nombre_completo ?? ''} tipoDocumento={t.novedad?.tipo_documento ?? null} asunto={t.asunto}
        />
      )}
      <AccionDialogEstado ticketId={t.id} abierto={dialogo === 'espera_usuario'} onOpenChange={cerrarDialogo} estado="ESPERA_USUARIO" onDone={refrescar} />
      <AccionDialogEstado ticketId={t.id} abierto={dialogo === 'espera_proveedor'} onOpenChange={cerrarDialogo} estado="ESPERA_PROVEEDOR" onDone={refrescar} />
      <AccionDialogEstado ticketId={t.id} abierto={dialogo === 'espera_aprobacion'} onOpenChange={cerrarDialogo} estado="ESPERA_APROBACION" onDone={refrescar} />
      <AccionDialogEstado ticketId={t.id} abierto={dialogo === 'cerrar'} onOpenChange={cerrarDialogo} estado="CERRADO" onDone={refrescar} />
      <AccionDialog
        open={dialogo === 'reabrir'} onOpenChange={cerrarDialogo}
        titulo={`Reabrir ${t.codigo}`}
        descripcion="Vuelve a En proceso con el mismo responsable. Conserva su reloj original y suma una reapertura."
        etiqueta="Motivo de la reapertura" requerido textoBoton="Reabrir"
        onConfirmar={async texto => { const r = await reabrirTicket(t.id, texto); if (r.ok) { toast.success('Ticket reabierto'); refrescar() } return r }}
      />
      <AccionDialog
        open={dialogo === 'aprobar'} onOpenChange={cerrarDialogo}
        titulo={`Aprobar ${t.codigo}`}
        descripcion="La solicitud pasa a la mesa de ayuda de TIN y el solicitante recibe el resultado por correo."
        etiqueta="Observación" requerido={false} textoBoton="Aprobar" colorBoton="bg-emerald-600 hover:bg-emerald-700"
        onConfirmar={async texto => { const r = await decidirAprobacionTicket(t.id, true, texto); if (r.ok) { toast.success('Solicitud aprobada'); refrescar() } return r }}
      />
      <AccionDialog
        open={dialogo === 'rechazar'} onOpenChange={cerrarDialogo}
        titulo={`Rechazar ${t.codigo}`}
        descripcion="El ticket queda cerrado y el solicitante recibe el motivo por correo."
        etiqueta="Motivo del rechazo" requerido textoBoton="Rechazar" colorBoton="bg-red-600 hover:bg-red-700"
        onConfirmar={async texto => { const r = await decidirAprobacionTicket(t.id, false, texto); if (r.ok) { toast.success('Solicitud rechazada'); refrescar() } return r }}
      />
      <AccionDialog
        open={dialogo === 'prioridad'} onOpenChange={cerrarDialogo}
        titulo="Cambiar prioridad"
        descripcion="Se registra la prioridad anterior y la nueva con el motivo; el reloj se recalcula con el nuevo objetivo."
        etiqueta="Motivo" requerido textoBoton="Cambiar prioridad" listo={prioridad !== t.prioridad}
        onConfirmar={async texto => { const r = await cambiarPrioridadTicket(t.id, prioridad, texto); if (r.ok) { toast.success('Prioridad actualizada'); refrescar() } return r }}
      >
        <div className="grid grid-cols-2 gap-2">
          {PRIORIDADES_TICKET.map(x => (
            <button
              key={x.value} type="button" onClick={() => setPrioridad(x.value)} title={x.regla}
              className={cn('rounded-lg border-2 px-3 py-2 text-left text-sm font-semibold', prioridad === x.value ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600')}
            >
              {x.label}
              <span className="block text-[10px] font-normal text-slate-500">{x.regla}</span>
            </button>
          ))}
        </div>
      </AccionDialog>
      <AccionDialog
        open={dialogo === 'reclasificar'} onOpenChange={cerrarDialogo}
        titulo="Reclasificar ticket"
        descripcion="Cambia la tipología (y su categoría). La prioridad se recalcula con la nueva tipología y el impacto que marcó el usuario."
        etiqueta="Motivo" requerido textoBoton="Reclasificar" listo={!!tipologiaId}
        onConfirmar={async texto => { const r = await reclasificarTicket(t.id, tipologiaId, texto); if (r.ok) { toast.success('Ticket reclasificado'); refrescar() } return r }}
      >
        <label className="block text-xs font-semibold text-slate-600">
          Nueva tipología
          <select value={tipologiaId} onChange={e => setTipologiaId(e.target.value)} className={`${inputCls} mt-1`}>
            <option value="">Selecciona…</option>
            {Object.entries(tipologiasAgrupadas).map(([cat, items]) => (
              <optgroup key={cat} label={cat}>
                {items.filter(x => x.id !== t.tipologia.id).map(x => <option key={x.id} value={x.id}>{x.nombre}</option>)}
              </optgroup>
            ))}
          </select>
        </label>
      </AccionDialog>
    </div>
  )
}

/* ── Cambios de estado con comentario ──────────────────────────────────── */
const CFG_ESTADO: Partial<Record<EstadoTicket, { titulo: string; descripcion: string; etiqueta: string; requerido: boolean; boton: string; placeholder?: string }>> = {
  ESPERA_USUARIO: {
    titulo: 'Pedir información al usuario',
    descripcion: 'El ticket pasa a En espera de usuario (el reloj se detiene) y el solicitante recibe un correo con tu mensaje. Cuando responda, vuelve a En proceso.',
    etiqueta: 'Qué información, captura o validación necesitas',
    requerido: true,
    boton: 'Enviar solicitud',
  },
  ESPERA_PROVEEDOR: {
    titulo: 'Espera de proveedor',
    descripcion: 'El ticket depende de un tercero (garantía, compra, operador). El reloj se detiene mientras tanto.',
    etiqueta: 'Proveedor, número de caso y qué se espera',
    requerido: true,
    boton: 'Pasar a espera',
  },
  ESPERA_APROBACION: {
    titulo: 'Solicitar aprobación',
    descripcion: 'Se pide aprobación al jefe inmediato del solicitante (o a la Coordinación TIN si no tiene). El reloj se detiene.',
    etiqueta: 'Qué se debe aprobar',
    requerido: false,
    boton: 'Solicitar aprobación',
  },
  CERRADO: {
    titulo: 'Cerrar ticket',
    descripcion: 'El solicitante recibe el correo de cierre. Podrá reabrirlo si el problema continúa.',
    etiqueta: 'Comentario de cierre',
    requerido: false,
    boton: 'Cerrar ticket',
  },
}

function AccionDialogEstado({ ticketId, abierto, onOpenChange, estado, onDone }: {
  ticketId: string; abierto: boolean; onOpenChange: (o: boolean) => void; estado: EstadoTicket; onDone: () => void
}) {
  const cfg = CFG_ESTADO[estado]
  if (!cfg) return null
  return (
    <AccionDialog
      open={abierto} onOpenChange={onOpenChange}
      titulo={cfg.titulo} descripcion={cfg.descripcion} etiqueta={cfg.etiqueta} requerido={cfg.requerido} textoBoton={cfg.boton}
      onConfirmar={async texto => {
        const r = await cambiarEstadoTicket(ticketId, estado, texto || undefined)
        if (r.ok) { toast.success('Estado actualizado'); onDone() }
        return r
      }}
    />
  )
}
