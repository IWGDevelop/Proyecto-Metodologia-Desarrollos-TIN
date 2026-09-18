'use client'

import { useState, useTransition } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { agregarComentario, getComentarios } from '@/actions/requerimientos'
import {
  getTareasSolicitud, crearTareaSolicitud, toggleTareaSolicitud,
  eliminarTareaSolicitud, actualizarMotivoYPenalizacionSolicitud,
} from '@/actions/tareas-solicitud'
import { getPerfilesActivos } from '@/actions/perfiles'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { formatFechaRelativa, formatCOP, cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  MessageSquare, CheckSquare, Square, Plus, Trash2,
  CalendarCheck, UserCheck, AlertCircle, DollarSign, ChevronDown, ChevronUp,
} from 'lucide-react'
import type { Comentario, Perfil } from '@/lib/supabase/types'
import type { TareaSolicitud } from '@/actions/tareas-solicitud'

interface Props { requerimientoId: string; isAdmin?: boolean }

/* ── helpers ─────────────────────────────────────────────────────────────── */
function formatFecha(str: string | null) {
  if (!str) return '—'
  return new Date(str + 'T12:00:00').toLocaleDateString('es-CO', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

function badgeFecha(str: string | null, completada: boolean) {
  if (!str) return null
  const hoy  = new Date(); hoy.setHours(0, 0, 0, 0)
  const date = new Date(str + 'T12:00:00')
  if (completada) return { label: `Compromiso: ${formatFecha(str)}`, cls: 'bg-slate-100 text-slate-500' }
  if (date < hoy) return { label: `Vencida: ${formatFecha(str)}`, cls: 'bg-red-50 text-red-600' }
  const dias = Math.ceil((date.getTime() - hoy.getTime()) / 86400000)
  if (dias <= 3) return { label: formatFecha(str), cls: 'bg-amber-50 text-amber-700' }
  return { label: formatFecha(str), cls: 'bg-slate-100 text-slate-600' }
}

/* ── Formulario modal nueva tarea ────────────────────────────────────────── */
function ModalNuevaTarea({
  open, onClose, requerimientoId, perfiles, onCreated,
}: {
  open: boolean
  onClose: () => void
  requerimientoId: string
  perfiles: Perfil[]
  onCreated: () => void
}) {
  const [descripcion, setDescripcion]           = useState('')
  const [responsableEmail, setResponsableEmail] = useState('')
  const [fechaCompromiso, setFechaCompromiso]   = useState('')
  const [penalizacion, setPenalizacion]         = useState('')
  const [isPending, startT]                     = useTransition()

  const reset = () => {
    setDescripcion(''); setResponsableEmail(''); setFechaCompromiso(''); setPenalizacion('')
  }

  const handleClose = () => { reset(); onClose() }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!descripcion.trim()) return
    startT(async () => {
      const res = await crearTareaSolicitud(requerimientoId, {
        descripcion: descripcion.trim(),
        responsable_email: responsableEmail || null,
        fecha_compromiso:  fechaCompromiso  || null,
        penalizacion_cop:  penalizacion ? Number(penalizacion) : null,
      })
      if (res.ok) {
        toast.success('Tarea creada')
        reset()
        onCreated()
        onClose()
      } else {
        toast.error(res.error ?? 'Error al crear tarea')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={o => !o && handleClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckSquare size={16} className="text-blue-600" />
            Nueva tarea / solicitud
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label className="text-xs">Descripción <span className="text-red-500">*</span></Label>
            <Textarea
              rows={3}
              placeholder="Describe la tarea o solicitud..."
              value={descripcion}
              onChange={e => setDescripcion(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Responsable</Label>
              <select
                value={responsableEmail}
                onChange={e => setResponsableEmail(e.target.value)}
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                <option value="">Sin asignar</option>
                {perfiles.map(p => (
                  <option key={p.id} value={p.email}>{p.nombre_completo}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Fecha compromiso</Label>
              <Input
                type="date"
                value={fechaCompromiso}
                onChange={e => setFechaCompromiso(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Penalización (COP)</Label>
            <Input
              type="number"
              min="0"
              placeholder="0"
              value={penalizacion}
              onChange={e => setPenalizacion(e.target.value)}
            />
          </div>

          <DialogFooter className="gap-2 pt-1">
            <Button type="button" variant="outline" onClick={handleClose} disabled={isPending}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isPending || !descripcion.trim()}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isPending ? 'Creando...' : 'Crear tarea'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/* ── Fila de tarea ───────────────────────────────────────────────────────── */
function FilaTarea({
  tarea, requerimientoId, isAdmin, onRefresh,
}: {
  tarea: TareaSolicitud
  requerimientoId: string
  isAdmin: boolean
  onRefresh: () => void
}) {
  const [expandido, setExpandido]   = useState(false)
  const [motivo, setMotivo]         = useState(tarea.motivo_incumplimiento ?? '')
  const [penalizacion, setPen]      = useState<number | null>(tarea.penalizacion_cop ?? null)
  const [isPendingT, startT]        = useTransition()
  const [isPendingG, startG]        = useTransition()
  const [isPendingD, startD]        = useTransition()

  const fechaBadge = badgeFecha(tarea.fecha_compromiso, tarea.completada)

  const hoy   = new Date(); hoy.setHours(0, 0, 0, 0)
  const fecha = tarea.fecha_compromiso ? new Date(tarea.fecha_compromiso + 'T12:00:00') : null
  const vencida = !tarea.completada && fecha && fecha < hoy

  const handleToggle = () => {
    startT(async () => {
      const res = await toggleTareaSolicitud(tarea.id, requerimientoId, !tarea.completada)
      if (res.ok) { toast.success(tarea.completada ? 'Tarea reabierta' : 'Tarea completada'); onRefresh() }
      else toast.error(res.error ?? 'Error')
    })
  }

  const handleGuardarDetalle = () => {
    startG(async () => {
      const res = await actualizarMotivoYPenalizacionSolicitud(tarea.id, requerimientoId, motivo, penalizacion)
      if (res.ok) { toast.success('Guardado'); onRefresh() }
      else toast.error(res.error ?? 'Error')
    })
  }

  const handleEliminar = () => {
    if (!confirm('¿Eliminar esta tarea?')) return
    startD(async () => {
      const res = await eliminarTareaSolicitud(tarea.id, requerimientoId)
      if (res.ok) { toast.success('Tarea eliminada'); onRefresh() }
      else toast.error(res.error ?? 'Error')
    })
  }

  const motivoCambiado = motivo.trim() !== (tarea.motivo_incumplimiento ?? '').trim()
  const penCambiada    = penalizacion !== (tarea.penalizacion_cop ?? null)

  return (
    <div className={cn(
      'rounded-xl border bg-white transition-all',
      tarea.completada ? 'border-green-200 bg-green-50/30' : vencida ? 'border-red-200' : 'border-slate-200',
    )}>
      {/* Fila principal */}
      <div className="flex items-start gap-3 p-4">
        {/* Toggle completada */}
        <button
          onClick={handleToggle}
          disabled={isPendingT}
          className="mt-0.5 shrink-0 text-slate-400 hover:text-blue-500 transition-colors disabled:opacity-50"
        >
          {tarea.completada
            ? <CheckSquare size={18} className="text-green-500" />
            : <Square size={18} />}
        </button>

        {/* Contenido */}
        <div className="min-w-0 flex-1">
          <p className={cn('text-sm font-medium leading-snug', tarea.completada && 'line-through text-slate-400')}>
            {tarea.descripcion}
          </p>

          {/* Chips de metadata */}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {tarea.responsable_email && (
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] text-blue-700">
                <UserCheck size={10} /> {tarea.responsable_email}
              </span>
            )}
            {fechaBadge && (
              <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px]', fechaBadge.cls)}>
                <CalendarCheck size={10} /> {fechaBadge.label}
              </span>
            )}
            {tarea.completada && tarea.fecha_cumplimiento && (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[11px] text-green-700">
                <CalendarCheck size={10} /> Completada {formatFecha(tarea.fecha_cumplimiento)}
              </span>
            )}
            {vencida && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-600">
                <AlertCircle size={10} /> VENCIDA
              </span>
            )}
            {tarea.penalizacion_cop && tarea.penalizacion_cop > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] text-red-500 border border-red-200">
                <DollarSign size={10} /> {formatCOP(tarea.penalizacion_cop)}
              </span>
            )}
            <span className="text-[10px] text-slate-400 ml-auto">{tarea.created_by} · {formatFechaRelativa(tarea.created_at)}</span>
          </div>
        </div>

        {/* Acciones */}
        <div className="shrink-0 flex items-center gap-1">
          {isAdmin && (
            <>
              <button
                onClick={() => setExpandido(v => !v)}
                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                title="Detalle / penalización"
              >
                {expandido ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              <button
                onClick={handleEliminar}
                disabled={isPendingD}
                className="rounded p-1 text-slate-300 hover:bg-red-50 hover:text-red-500 transition-colors"
                title="Eliminar tarea"
              >
                <Trash2 size={14} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Panel de detalle (admin) */}
      {expandido && isAdmin && (
        <div className="border-t border-slate-100 bg-slate-50 px-4 py-3 space-y-3 rounded-b-xl">
          <div className="space-y-1.5">
            <Label className="text-xs">Motivo de incumplimiento (si aplica)</Label>
            <Textarea
              rows={2}
              placeholder="Describe el motivo si la tarea se incumplió o requiere justificación..."
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
              className="text-sm"
            />
          </div>
          <div className="flex items-end gap-3">
            <div className="flex-1 space-y-1.5">
              <Label className="text-xs">Penalización COP</Label>
              <Input
                type="number"
                min="0"
                placeholder="0"
                value={penalizacion ?? ''}
                onChange={e => setPen(e.target.value ? Number(e.target.value) : null)}
              />
            </div>
            <Button
              size="sm"
              onClick={handleGuardarDetalle}
              disabled={isPendingG || (!motivoCambiado && !penCambiada)}
              className="bg-slate-700 hover:bg-slate-800"
            >
              {isPendingG ? 'Guardando...' : 'Guardar'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Componente principal ────────────────────────────────────────────────── */
type Seccion = 'comentarios' | 'tareas'

export function TabComentarios({ requerimientoId, isAdmin = false }: Props) {
  const [seccion, setSeccion]           = useState<Seccion>('comentarios')
  const [texto, setTexto]               = useState('')
  const [modalTarea, setModalTarea]     = useState(false)
  const [isPending, startTransition]    = useTransition()
  const qc = useQueryClient()

  const { data: comentarios = [], isLoading: loadingC } = useQuery<Comentario[]>({
    queryKey: ['comentarios', requerimientoId],
    queryFn:  () => getComentarios(requerimientoId),
    retry: 1,
  })

  const { data: tareas = [], isLoading: loadingT, refetch: refetchTareas } = useQuery<TareaSolicitud[]>({
    queryKey: ['tareas-solicitud', requerimientoId],
    queryFn:  () => getTareasSolicitud(requerimientoId),
    retry: 1,
  })

  const { data: perfiles = [] } = useQuery<Perfil[]>({
    queryKey: ['perfiles-activos'],
    queryFn:  () => getPerfilesActivos(),
    staleTime: 1000 * 60 * 5,
  })

  const pendientes  = tareas.filter(t => !t.completada).length
  const completadas = tareas.filter(t => t.completada).length

  const handleSubmitComentario = (e: React.FormEvent) => {
    e.preventDefault()
    if (!texto.trim()) return
    startTransition(async () => {
      try {
        await agregarComentario(requerimientoId, texto.trim())
        setTexto('')
        qc.invalidateQueries({ queryKey: ['comentarios', requerimientoId] })
        toast.success('Comentario agregado')
      } catch { toast.error('Error al agregar comentario') }
    })
  }

  return (
    <div className="space-y-4">
      {/* Selector de sección */}
      <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 w-fit">
        <button
          onClick={() => setSeccion('comentarios')}
          className={cn(
            'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
            seccion === 'comentarios'
              ? 'bg-slate-700 text-white'
              : 'text-slate-500 hover:text-slate-700'
          )}
        >
          <MessageSquare size={14} />
          Comentarios
          {comentarios.length > 0 && (
            <span className={cn(
              'rounded-full px-1.5 py-0.5 text-[10px] font-bold',
              seccion === 'comentarios' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
            )}>
              {comentarios.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setSeccion('tareas')}
          className={cn(
            'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
            seccion === 'tareas'
              ? 'bg-blue-600 text-white'
              : 'text-slate-500 hover:text-slate-700'
          )}
        >
          <CheckSquare size={14} />
          Tareas / Solicitudes
          {tareas.length > 0 && (
            <span className={cn(
              'rounded-full px-1.5 py-0.5 text-[10px] font-bold',
              seccion === 'tareas' ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-700'
            )}>
              {pendientes > 0 ? `${pendientes} pendientes` : `${completadas} ✓`}
            </span>
          )}
        </button>
      </div>

      {/* ── COMENTARIOS ─────────────────────────────────────────────────── */}
      {seccion === 'comentarios' && (
        <>
          <form onSubmit={handleSubmitComentario} className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
            <p className="text-sm font-semibold text-slate-700">Agregar comentario</p>
            <div className="space-y-1.5">
              <Label className="text-xs">Comentario</Label>
              <Textarea
                rows={3}
                placeholder="Escribe tu comentario..."
                value={texto}
                onChange={e => setTexto(e.target.value)}
              />
            </div>
            <Button type="submit" size="sm" disabled={isPending || !texto.trim()} className="bg-blue-600 hover:bg-blue-700">
              {isPending ? 'Guardando...' : 'Agregar comentario'}
            </Button>
          </form>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            {loadingC ? (
              <p className="py-8 text-center text-sm text-slate-400">Cargando comentarios...</p>
            ) : !comentarios.length ? (
              <p className="py-8 text-center text-sm text-slate-400">Sin comentarios aún</p>
            ) : (
              <ol className="divide-y divide-slate-100">
                {comentarios.map(c => (
                  <li key={c.id} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[11px] font-bold text-slate-600">
                          {(c.usuario ?? '?').charAt(0).toUpperCase()}
                        </div>
                        <p className="text-sm font-semibold text-slate-700 truncate">{c.usuario ?? 'Usuario'}</p>
                      </div>
                      <span className="shrink-0 text-xs text-slate-400">{formatFechaRelativa(c.created_at)}</span>
                    </div>
                    <p className="mt-2 ml-9 text-sm text-slate-600 whitespace-pre-wrap">{c.comentario}</p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </>
      )}

      {/* ── TAREAS / SOLICITUDES ─────────────────────────────────────────── */}
      {seccion === 'tareas' && (
        <>
          {/* Cabecera con botón */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-sm text-slate-500">
              {tareas.length > 0 && (
                <>
                  <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
                    {pendientes} pendiente{pendientes !== 1 ? 's' : ''}
                  </span>
                  <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700">
                    {completadas} completada{completadas !== 1 ? 's' : ''}
                  </span>
                </>
              )}
            </div>
            <Button
              size="sm"
              onClick={() => setModalTarea(true)}
              className="bg-blue-600 hover:bg-blue-700 gap-1.5"
            >
              <Plus size={14} /> Nueva tarea
            </Button>
          </div>

          {loadingT ? (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">
              Cargando tareas...
            </div>
          ) : !tareas.length ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-white p-10 text-center">
              <CheckSquare size={28} className="mx-auto mb-2 text-slate-300" />
              <p className="text-sm text-slate-400">No hay tareas aún. Crea la primera.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Pendientes primero */}
              {tareas.filter(t => !t.completada).map(t => (
                <FilaTarea
                  key={t.id}
                  tarea={t}
                  requerimientoId={requerimientoId}
                  isAdmin={isAdmin}
                  onRefresh={() => refetchTareas()}
                />
              ))}
              {/* Completadas al final, si las hay */}
              {completadas > 0 && pendientes > 0 && (
                <div className="flex items-center gap-2 py-1">
                  <div className="h-px flex-1 bg-slate-100" />
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Completadas</span>
                  <div className="h-px flex-1 bg-slate-100" />
                </div>
              )}
              {tareas.filter(t => t.completada).map(t => (
                <FilaTarea
                  key={t.id}
                  tarea={t}
                  requerimientoId={requerimientoId}
                  isAdmin={isAdmin}
                  onRefresh={() => refetchTareas()}
                />
              ))}
            </div>
          )}

          <ModalNuevaTarea
            open={modalTarea}
            onClose={() => setModalTarea(false)}
            requerimientoId={requerimientoId}
            perfiles={perfiles}
            onCreated={() => refetchTareas()}
          />
        </>
      )}
    </div>
  )
}
