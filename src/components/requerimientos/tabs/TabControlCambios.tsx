'use client'

import { useMemo, useRef, useState, useTransition } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage'
import { toast } from 'sonner'
import {
  FileDiff, Plus, ChevronDown, ChevronRight, Pencil, Trash2, Upload, Download, FileText,
  Image as ImageIcon, File, CalendarClock, Clock, DollarSign, User, History, ArrowRight, Search,
} from 'lucide-react'
import { storage } from '@/lib/firebase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn, formatCOP } from '@/lib/utils'
import {
  ESTADOS_CAMBIO, ESTADOS_DECISION, TIPOS_CAMBIO, TRANSICIONES_CAMBIO,
  type EstadoCambio, type TipoCambio,
} from '@/lib/control-cambios'
import {
  getControlCambios, crearControlCambio, actualizarControlCambio, cambiarEstadoControlCambio,
  eliminarControlCambio, registrarAnexoControlCambio, eliminarAnexoControlCambio,
  type ControlCambio, type DatosCambio, type AnexoCambio,
} from '@/actions/control-cambios'

interface Props {
  requerimientoId: string
  canCreate: boolean
  canEdit: boolean
  isAdmin: boolean
  userName: string | null
}

const TIPOS_ARCHIVO = [
  'application/pdf', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
]

const hoyISO = () => new Date().toISOString().slice(0, 10)

function formatFecha(d: string | null) {
  if (!d) return '—'
  const fecha = d.length === 10 ? new Date(d + 'T12:00:00') : new Date(d)
  return fecha.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatFechaHora(d: string) {
  return new Date(d).toLocaleString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function formatBytes(bytes: number | null) {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function IconoArchivo({ tipo }: { tipo: string | null }) {
  if (tipo?.startsWith('image/')) return <ImageIcon size={15} className="text-blue-500" />
  if (tipo?.includes('pdf')) return <FileText size={15} className="text-red-500" />
  return <File size={15} className="text-slate-400" />
}

function BadgeEstado({ estado }: { estado: EstadoCambio }) {
  const cfg = ESTADOS_CAMBIO[estado]
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold', cfg.clase)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', cfg.punto)} /> {cfg.label}
    </span>
  )
}

function BadgeTipo({ tipo }: { tipo: TipoCambio }) {
  const cfg = TIPOS_CAMBIO[tipo]
  return (
    <span className={cn('rounded border px-1.5 py-0.5 text-[10px] font-semibold', cfg.clase)} title={cfg.descripcion}>
      {cfg.label}
    </span>
  )
}

function ResumenImpacto({ c }: { c: Pick<ControlCambio, 'impacto_dias' | 'impacto_horas' | 'impacto_costo'> }) {
  const partes = [
    c.impacto_dias ? { Icon: CalendarClock, texto: `${c.impacto_dias > 0 ? '+' : ''}${c.impacto_dias} días` } : null,
    c.impacto_horas ? { Icon: Clock, texto: `${c.impacto_horas} h` } : null,
    c.impacto_costo ? { Icon: DollarSign, texto: formatCOP(c.impacto_costo) } : null,
  ].filter(Boolean) as { Icon: React.ElementType; texto: string }[]
  if (partes.length === 0) return <span className="text-xs text-slate-400">Sin impacto registrado</span>
  return (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
      {partes.map(({ Icon, texto }) => (
        <span key={texto} className="flex items-center gap-1"><Icon size={12} className="text-slate-400" />{texto}</span>
      ))}
    </span>
  )
}

/* ── Formulario de la ficha del cambio ─────────────────────────────────── */
function datosIniciales(c: ControlCambio | null, userName: string | null): DatosCambio {
  return {
    titulo:               c?.titulo ?? '',
    tipo:                 c?.tipo ?? 'FUNCIONAL',
    descripcion:          c?.descripcion ?? '',
    justificacion:        c?.justificacion ?? '',
    solicitado_por:       c?.solicitado_por ?? userName ?? '',
    fecha_solicitud:      c?.fecha_solicitud ?? hoyISO(),
    impacto_descripcion:  c?.impacto_descripcion ?? '',
    impacto_dias:         c?.impacto_dias ?? null,
    impacto_horas:        c?.impacto_horas ?? null,
    impacto_costo:        c?.impacto_costo ?? null,
    version:              c?.version ?? '',
    fecha_implementacion: c?.fecha_implementacion ?? null,
  }
}

function DialogFicha({
  abierto, onClose, requerimientoId, cambio, userName, onGuardado,
}: {
  abierto: boolean
  onClose: () => void
  requerimientoId: string
  cambio: ControlCambio | null
  userName: string | null
  onGuardado: () => void
}) {
  const [datos, setDatos] = useState<DatosCambio>(() => datosIniciales(cambio, userName))
  const [isPending, startTransition] = useTransition()
  const set = <K extends keyof DatosCambio>(campo: K, valor: DatosCambio[K]) => setDatos(d => ({ ...d, [campo]: valor }))
  const numero = (v: string) => (v === '' ? null : Number(v))

  const guardar = (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      const res = cambio
        ? await actualizarControlCambio(cambio.id, requerimientoId, datos)
        : await crearControlCambio(requerimientoId, datos)
      if (!res.ok) { toast.error(res.error ?? 'No se pudo guardar'); return }
      toast.success(cambio ? 'Cambio actualizado' : `Cambio ${'codigo' in res ? res.codigo : ''} registrado`)
      onGuardado()
      onClose()
    })
  }

  return (
    <Dialog open={abierto} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileDiff size={16} className="text-blue-600" />
            {cambio ? `Editar ${cambio.codigo}` : 'Registrar solicitud de cambio'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={guardar} className="space-y-5 pt-1">
          {/* Identificación */}
          <section className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Título del cambio <span className="text-red-500">*</span></Label>
              <Input value={datos.titulo} onChange={e => set('titulo', e.target.value)} placeholder="Ej. Agregar validación de NIT en el formulario de proveedores" />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Tipo de cambio</Label>
                <select
                  value={datos.tipo}
                  onChange={e => set('tipo', e.target.value as TipoCambio)}
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
                >
                  {Object.entries(TIPOS_CAMBIO).map(([valor, t]) => <option key={valor} value={valor}>{t.label}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Solicitado por</Label>
                <Input value={datos.solicitado_por ?? ''} onChange={e => set('solicitado_por', e.target.value)} placeholder="Nombre o área" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Fecha de solicitud <span className="text-red-500">*</span></Label>
                <Input type="date" value={datos.fecha_solicitud} onChange={e => set('fecha_solicitud', e.target.value)} />
              </div>
            </div>
          </section>

          {/* Descripción */}
          <section className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Descripción del cambio <span className="text-red-500">*</span></Label>
              <Textarea rows={4} value={datos.descripcion} onChange={e => set('descripcion', e.target.value)} placeholder="Qué cambia respecto a lo definido inicialmente" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Justificación</Label>
              <Textarea rows={3} value={datos.justificacion ?? ''} onChange={e => set('justificacion', e.target.value)} placeholder="Por qué se necesita el cambio y qué pasa si no se hace" />
            </div>
          </section>

          {/* Impacto */}
          <section className="space-y-3 rounded-lg border border-slate-100 bg-slate-50/60 p-3">
            <p className="text-xs font-semibold text-slate-600">Impacto estimado</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Días en el cronograma</Label>
                <Input type="number" value={datos.impacto_dias ?? ''} onChange={e => set('impacto_dias', numero(e.target.value))} placeholder="0" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Horas de esfuerzo</Label>
                <Input type="number" min="0" step="0.5" value={datos.impacto_horas ?? ''} onChange={e => set('impacto_horas', numero(e.target.value))} placeholder="0" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Costo (COP)</Label>
                <Input type="number" min="0" value={datos.impacto_costo ?? ''} onChange={e => set('impacto_costo', numero(e.target.value))} placeholder="0" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Descripción del impacto</Label>
              <Textarea rows={2} value={datos.impacto_descripcion ?? ''} onChange={e => set('impacto_descripcion', e.target.value)} placeholder="Módulos, procesos o usuarios afectados" />
            </div>
          </section>

          {/* Implementación */}
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Versión que incorpora el cambio</Label>
              <Input value={datos.version ?? ''} onChange={e => set('version', e.target.value)} placeholder="Ej. v1.3" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Fecha de implementación</Label>
              <Input type="date" value={datos.fecha_implementacion ?? ''} onChange={e => set('fecha_implementacion', e.target.value || null)} />
            </div>
          </section>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>Cancelar</Button>
            <Button type="submit" disabled={isPending || !datos.titulo.trim() || !datos.descripcion.trim()} className="bg-blue-600 hover:bg-blue-700">
              {isPending ? 'Guardando...' : cambio ? 'Guardar cambios' : 'Registrar cambio'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/* ── Cambio de estado con comentario ───────────────────────────────────── */
function DialogEstado({
  cambio, nuevoEstado, requerimientoId, onClose, onGuardado,
}: {
  cambio: ControlCambio
  nuevoEstado: EstadoCambio
  requerimientoId: string
  onClose: () => void
  onGuardado: () => void
}) {
  const [comentario, setComentario] = useState('')
  const [isPending, startTransition] = useTransition()
  const esDecision = ESTADOS_DECISION.includes(nuevoEstado)

  const confirmar = () => {
    startTransition(async () => {
      const res = await cambiarEstadoControlCambio(cambio.id, requerimientoId, nuevoEstado, comentario)
      if (!res.ok) { toast.error(res.error ?? 'No se pudo cambiar el estado'); return }
      toast.success(`${cambio.codigo} → ${ESTADOS_CAMBIO[nuevoEstado].label}`)
      onGuardado()
      onClose()
    })
  }

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">{cambio.codigo} · cambiar estado</DialogTitle>
        </DialogHeader>
        <div className="flex items-center gap-2">
          <BadgeEstado estado={cambio.estado} />
          <ArrowRight size={14} className="text-slate-400" />
          <BadgeEstado estado={nuevoEstado} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">
            {esDecision ? 'Observaciones de la decisión' : 'Comentario'}
            {esDecision && <span className="text-red-500"> *</span>}
          </Label>
          <Textarea
            rows={3}
            value={comentario}
            onChange={e => setComentario(e.target.value)}
            placeholder={esDecision ? 'Motivo de la aprobación o el rechazo, condiciones acordadas…' : 'Opcional'}
          />
          {esDecision && <p className="text-[11px] text-slate-400">Quedará registrado tu nombre como responsable de la decisión.</p>}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={isPending}>Cancelar</Button>
          <Button onClick={confirmar} disabled={isPending || (esDecision && !comentario.trim())} className="bg-blue-600 hover:bg-blue-700">
            {isPending ? 'Guardando...' : 'Confirmar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ── Anexos de soporte ─────────────────────────────────────────────────── */
function AnexosCambio({
  cambio, requerimientoId, canEdit, onCambio,
}: {
  cambio: ControlCambio
  requerimientoId: string
  canEdit: boolean
  onCambio: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [subiendo, setSubiendo] = useState<string[]>([])

  const subir = (file: File) => {
    if (!TIPOS_ARCHIVO.includes(file.type)) { toast.error(`Tipo no permitido: ${file.name}`); return }
    if (file.size > 20 * 1024 * 1024) { toast.error(`Supera 20MB: ${file.name}`); return }
    const ext = file.name.split('.').pop()
    const path = `igsi-requerimientos/${requerimientoId}/control-cambios/${cambio.id}/${Date.now()}.${ext}`
    setSubiendo(s => [...s, file.name])
    const task = uploadBytesResumable(ref(storage, path), file, { contentType: file.type })
    task.on('state_changed', null,
      err => { toast.error(`Error al subir: ${err.message}`); setSubiendo(s => s.filter(n => n !== file.name)) },
      async () => {
        try {
          const url = await getDownloadURL(task.snapshot.ref)
          const res = await registrarAnexoControlCambio(cambio.id, {
            nombre_archivo: file.name, url_storage: url, tipo_archivo: file.type, tamanio_bytes: file.size,
          })
          if (!res.ok) throw new Error(res.error)
          toast.success(`${file.name} adjuntado`)
          onCambio()
        } catch (e: any) {
          toast.error(`Error al registrar el archivo: ${e?.message ?? ''}`)
        } finally {
          setSubiendo(s => s.filter(n => n !== file.name))
        }
      },
    )
  }

  const eliminar = async (a: AnexoCambio) => {
    await deleteObject(ref(storage, a.url_storage)).catch(() => {})
    const res = await eliminarAnexoControlCambio(a.id)
    if (res.ok) { toast.success('Anexo eliminado'); onCambio() }
    else toast.error(res.error ?? 'Error al eliminar el anexo')
  }

  return (
    <div className="space-y-2">
      {cambio.anexos.length === 0 && subiendo.length === 0 && (
        <p className="text-xs text-slate-400">Sin anexos de soporte</p>
      )}
      <ul className="space-y-1">
        {cambio.anexos.map(a => (
          <li key={a.id} className="flex items-center gap-2 rounded-md border border-slate-100 bg-white px-2.5 py-1.5">
            <IconoArchivo tipo={a.tipo_archivo} />
            <a href={a.url_storage} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate text-xs font-medium text-slate-700 hover:text-blue-600">
              {a.nombre_archivo}
            </a>
            <span className="shrink-0 text-[10px] text-slate-400">{formatBytes(a.tamanio_bytes)}</span>
            <a href={a.url_storage} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-blue-500" title="Descargar">
              <Download size={13} />
            </a>
            {canEdit && (
              <button onClick={() => eliminar(a)} className="text-slate-300 hover:text-red-500" title="Eliminar">
                <Trash2 size={13} />
              </button>
            )}
          </li>
        ))}
        {subiendo.map(n => (
          <li key={n} className="flex items-center gap-2 rounded-md bg-blue-50 px-2.5 py-1.5 text-xs text-blue-700">
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" /> Subiendo {n}...
          </li>
        ))}
      </ul>
      {canEdit && (
        <>
          <button
            onClick={() => inputRef.current?.click()}
            className="flex items-center gap-1.5 rounded-md border border-dashed border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-600"
          >
            <Upload size={13} /> Adjuntar soporte
          </button>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={TIPOS_ARCHIVO.join(',')}
            className="hidden"
            onChange={e => { Array.from(e.target.files ?? []).forEach(subir); e.target.value = '' }}
          />
        </>
      )}
    </div>
  )
}

/* ── Tarjeta de un cambio ──────────────────────────────────────────────── */
function TarjetaCambio({
  cambio, requerimientoId, canEdit, isAdmin, onEditar, onEstado, onCambio,
}: {
  cambio: ControlCambio
  requerimientoId: string
  canEdit: boolean
  isAdmin: boolean
  onEditar: () => void
  onEstado: (estado: EstadoCambio) => void
  onCambio: () => void
}) {
  const [abierto, setAbierto] = useState(false)
  const [eliminando, startEliminar] = useTransition()

  const eliminar = () => {
    if (!confirm(`¿Eliminar ${cambio.codigo}? Se borrarán también su bitácora y anexos.`)) return
    startEliminar(async () => {
      const res = await eliminarControlCambio(cambio.id, requerimientoId)
      if (res.ok) { toast.success(`${cambio.codigo} eliminado`); onCambio() }
      else toast.error(res.error ?? 'No se pudo eliminar')
    })
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <button onClick={() => setAbierto(a => !a)} className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-slate-50/60">
        {abierto ? <ChevronDown size={15} className="mt-0.5 shrink-0 text-slate-400" /> : <ChevronRight size={15} className="mt-0.5 shrink-0 text-slate-400" />}
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs font-bold text-slate-500">{cambio.codigo}</span>
            <span className="text-sm font-semibold text-slate-800">{cambio.titulo}</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <BadgeTipo tipo={cambio.tipo} />
            <span className="flex items-center gap-1 text-xs text-slate-500">
              <User size={11} /> {cambio.solicitado_por ?? 'Sin solicitante'} · {formatFecha(cambio.fecha_solicitud)}
            </span>
            <ResumenImpacto c={cambio} />
            {cambio.anexos.length > 0 && (
              <span className="text-xs text-slate-400">{cambio.anexos.length} anexo{cambio.anexos.length !== 1 ? 's' : ''}</span>
            )}
          </div>
        </div>
        <BadgeEstado estado={cambio.estado} />
      </button>

      {abierto && (
        <div className="space-y-4 border-t border-slate-100 px-4 py-4 sm:pl-11">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Descripción del cambio</p>
              <p className="whitespace-pre-wrap text-sm text-slate-700">{cambio.descripcion}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Justificación</p>
              <p className="whitespace-pre-wrap text-sm text-slate-700">{cambio.justificacion ?? '—'}</p>
            </div>
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Impacto</p>
              <ResumenImpacto c={cambio} />
              {cambio.impacto_descripcion && <p className="whitespace-pre-wrap text-sm text-slate-700">{cambio.impacto_descripcion}</p>}
            </div>
            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Decisión e implementación</p>
              {cambio.decision_por ? (
                <p className="text-sm text-slate-700">
                  <span className="font-medium">{ESTADOS_CAMBIO[cambio.estado === 'IMPLEMENTADO' ? 'APROBADO' : cambio.estado]?.label ?? 'Decidido'}</span>
                  {' '}por {cambio.decision_por} · {formatFecha(cambio.fecha_decision)}
                </p>
              ) : <p className="text-sm text-slate-400">Pendiente de decisión</p>}
              {cambio.observaciones_decision && <p className="whitespace-pre-wrap text-sm text-slate-600">“{cambio.observaciones_decision}”</p>}
              {(cambio.version || cambio.fecha_implementacion) && (
                <p className="text-sm text-slate-700">
                  {cambio.version && <>Versión <span className="font-medium">{cambio.version}</span></>}
                  {cambio.version && cambio.fecha_implementacion && ' · '}
                  {cambio.fecha_implementacion && <>Implementado el {formatFecha(cambio.fecha_implementacion)}</>}
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Anexos de soporte</p>
              <AnexosCambio cambio={cambio} requerimientoId={requerimientoId} canEdit={canEdit} onCambio={onCambio} />
            </div>
            <div className="space-y-2">
              <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400"><History size={11} /> Bitácora</p>
              <ol className="space-y-2">
                {cambio.eventos.map(ev => (
                  <li key={ev.id} className="flex gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" />
                    <div className="min-w-0 text-xs">
                      <p className="text-slate-700">
                        {ev.accion === 'CREADO' && 'Solicitud registrada'}
                        {ev.accion === 'EDITADO' && (ev.comentario ?? 'Ficha actualizada')}
                        {ev.accion === 'ESTADO' && (
                          <>
                            {ESTADOS_CAMBIO[ev.estado_anterior as EstadoCambio]?.label ?? ev.estado_anterior}
                            {' → '}
                            <span className="font-semibold">{ESTADOS_CAMBIO[ev.estado_nuevo as EstadoCambio]?.label ?? ev.estado_nuevo}</span>
                          </>
                        )}
                      </p>
                      {ev.accion === 'ESTADO' && ev.comentario && <p className="text-slate-500">“{ev.comentario}”</p>}
                      <p className="text-slate-400">{ev.usuario ?? 'Sistema'} · {formatFechaHora(ev.created_at)}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>

          {(canEdit || isAdmin) && (
            <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
              {canEdit && TRANSICIONES_CAMBIO[cambio.estado].map(estado => (
                <Button key={estado} size="sm" variant="outline" onClick={() => onEstado(estado)} className="gap-1.5 text-xs">
                  <span className={cn('h-1.5 w-1.5 rounded-full', ESTADOS_CAMBIO[estado].punto)} />
                  {estado === 'SOLICITADO' ? 'Devolver a solicitado' : ESTADOS_CAMBIO[estado].label}
                </Button>
              ))}
              <span className="flex-1" />
              {canEdit && (
                <Button size="sm" variant="ghost" onClick={onEditar} className="gap-1.5 text-xs">
                  <Pencil size={12} /> Editar ficha
                </Button>
              )}
              {isAdmin && (
                <Button size="sm" variant="ghost" onClick={eliminar} disabled={eliminando} className="gap-1.5 text-xs text-red-600 hover:bg-red-50 hover:text-red-700">
                  <Trash2 size={12} /> Eliminar
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ── Tab ───────────────────────────────────────────────────────────────── */
export function TabControlCambios({ requerimientoId, canCreate, canEdit, isAdmin, userName }: Props) {
  const qc = useQueryClient()
  const [ficha, setFicha] = useState<{ cambio: ControlCambio | null } | null>(null)
  const [estadoPendiente, setEstadoPendiente] = useState<{ cambio: ControlCambio; estado: EstadoCambio } | null>(null)
  const [filtroEstado, setFiltroEstado] = useState<EstadoCambio | ''>('')
  const [busqueda, setBusqueda] = useState('')

  const { data: cambios = [], isLoading } = useQuery<ControlCambio[]>({
    queryKey: ['control-cambios', requerimientoId],
    queryFn: () => getControlCambios(requerimientoId),
    staleTime: 30_000,
  })
  const refrescar = () => qc.invalidateQueries({ queryKey: ['control-cambios', requerimientoId] })

  const conteo = useMemo(() => {
    const porEstado = Object.fromEntries(Object.keys(ESTADOS_CAMBIO).map(e => [e, 0])) as Record<EstadoCambio, number>
    for (const c of cambios) porEstado[c.estado]++
    return porEstado
  }, [cambios])

  // Impacto acumulado de los cambios aprobados o implementados
  const impactoAprobado = useMemo(() => {
    const vigentes = cambios.filter(c => c.estado === 'APROBADO' || c.estado === 'IMPLEMENTADO')
    return {
      impacto_dias: vigentes.reduce((s, c) => s + (c.impacto_dias ?? 0), 0) || null,
      impacto_horas: vigentes.reduce((s, c) => s + Number(c.impacto_horas ?? 0), 0) || null,
      impacto_costo: vigentes.reduce((s, c) => s + Number(c.impacto_costo ?? 0), 0) || null,
    }
  }, [cambios])

  const visibles = cambios.filter(c => {
    const q = busqueda.trim().toLowerCase()
    return (!filtroEstado || c.estado === filtroEstado) &&
      (!q || c.titulo.toLowerCase().includes(q) || c.codigo.toLowerCase().includes(q) || c.descripcion.toLowerCase().includes(q))
  })

  return (
    <div className="mt-4 space-y-4">
      {/* Encabezado */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-bold text-slate-800">
            <FileDiff size={17} className="text-blue-600" /> Control de cambios
          </h2>
          <p className="text-xs text-slate-500">Registro de las solicitudes de cambio del requerimiento: qué cambia, por qué, su impacto y la decisión tomada</p>
        </div>
        {canCreate && (
          <Button onClick={() => setFicha({ cambio: null })} className="gap-1.5 bg-blue-600 hover:bg-blue-700">
            <Plus size={15} /> Registrar cambio
          </Button>
        )}
      </div>

      {/* Resumen */}
      {cambios.length > 0 && (
        <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFiltroEstado('')}
              className={cn(
                'rounded-lg border px-3 py-2 text-left transition-colors',
                !filtroEstado ? 'border-slate-400 bg-slate-800 text-white' : 'border-slate-200 bg-white hover:bg-slate-50'
              )}
            >
              <p className={cn('text-[11px]', !filtroEstado ? 'text-slate-300' : 'text-slate-500')}>Total</p>
              <p className="text-lg font-bold tabular-nums">{cambios.length}</p>
            </button>
            {(Object.keys(ESTADOS_CAMBIO) as EstadoCambio[]).map(e => (
              <button
                key={e}
                onClick={() => setFiltroEstado(filtroEstado === e ? '' : e)}
                className={cn(
                  'rounded-lg border px-3 py-2 text-left transition-colors',
                  filtroEstado === e ? 'border-blue-400 bg-blue-50' : 'border-slate-200 bg-white hover:bg-slate-50'
                )}
              >
                <p className="flex items-center gap-1.5 text-[11px] text-slate-500">
                  <span className={cn('h-1.5 w-1.5 rounded-full', ESTADOS_CAMBIO[e].punto)} /> {ESTADOS_CAMBIO[e].label}
                </p>
                <p className="text-lg font-bold tabular-nums text-slate-800">{conteo[e]}</p>
              </button>
            ))}
          </div>
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
            <p className="text-[11px] text-slate-500">Impacto acumulado (aprobados e implementados)</p>
            <div className="mt-1"><ResumenImpacto c={impactoAprobado} /></div>
          </div>
        </div>
      )}

      {cambios.length > 3 && (
        <div className="flex max-w-sm items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2">
          <Search size={13} className="text-slate-400" />
          <input
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por código, título o descripción..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
          />
        </div>
      )}

      {/* Lista */}
      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}</div>
      ) : cambios.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white py-14 text-center">
          <FileDiff size={30} className="mx-auto mb-3 text-slate-200" />
          <p className="text-sm font-medium text-slate-500">Aún no hay cambios documentados</p>
          <p className="mt-1 text-xs text-slate-400">Registra aquí cada cambio que surja sobre lo definido para este requerimiento</p>
        </div>
      ) : visibles.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">Ningún cambio coincide con el filtro</p>
      ) : (
        <div className="space-y-2">
          {visibles.map(c => (
            <TarjetaCambio
              key={c.id}
              cambio={c}
              requerimientoId={requerimientoId}
              canEdit={canEdit}
              isAdmin={isAdmin}
              onEditar={() => setFicha({ cambio: c })}
              onEstado={estado => setEstadoPendiente({ cambio: c, estado })}
              onCambio={refrescar}
            />
          ))}
        </div>
      )}

      {ficha && (
        <DialogFicha
          key={ficha.cambio?.id ?? 'nuevo'}
          abierto
          onClose={() => setFicha(null)}
          requerimientoId={requerimientoId}
          cambio={ficha.cambio}
          userName={userName}
          onGuardado={refrescar}
        />
      )}
      {estadoPendiente && (
        <DialogEstado
          cambio={estadoPendiente.cambio}
          nuevoEstado={estadoPendiente.estado}
          requerimientoId={requerimientoId}
          onClose={() => setEstadoPendiente(null)}
          onGuardado={refrescar}
        />
      )}
    </div>
  )
}
