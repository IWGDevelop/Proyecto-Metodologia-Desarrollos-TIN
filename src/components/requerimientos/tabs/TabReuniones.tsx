'use client'

import { useState, useTransition, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getReuniones, crearReunion, agregarTareaReunion,
  toggleTareaReunion, eliminarTareaReunion, eliminarReunion,
  guardarRespuestaTarea, registrarAnexoTarea, eliminarAnexoTarea,
} from '@/actions/reuniones'
import { getPerfilesActivos } from '@/actions/perfiles'
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage'
import { storage } from '@/lib/firebase'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Video, PlayCircle, Plus, Trash2, CheckSquare, Square, Lock,
  ChevronDown, ChevronUp, CalendarCheck, UserCheck, X, Link2,
  Paperclip, MessageSquare, AlertCircle, FileText, Image, File,
  Download,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { Reunion, TareaReunion, AnexoTareaReunion, Perfil } from '@/lib/supabase/types'

interface Props { requerimientoId: string }

const TIPOS_PERMITIDOS = [
  'application/pdf', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
]

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
  if (completada) return { label: formatFecha(str), cls: 'bg-emerald-50 text-emerald-700' }
  if (date < hoy) return { label: formatFecha(str), cls: 'bg-red-50 text-red-600' }
  if (Math.ceil((date.getTime() - hoy.getTime()) / 86400000) <= 3)
    return { label: formatFecha(str), cls: 'bg-amber-50 text-amber-700' }
  return { label: formatFecha(str), cls: 'bg-slate-100 text-slate-600' }
}

function formatBytes(bytes: number | null) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

function IconoTipo({ tipo }: { tipo: string | null }) {
  if (tipo?.startsWith('image/')) return <Image size={13} className="text-blue-500 shrink-0" />
  if (tipo?.includes('pdf'))      return <FileText size={13} className="text-red-500 shrink-0" />
  return <File size={13} className="text-slate-400 shrink-0" />
}

function VideoChip({ url }: { url: string }) {
  const yt = url.includes('youtube.com') || url.includes('youtu.be')
  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
        yt ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
      )}>
      {yt ? <PlayCircle size={11} /> : <Video size={11} />}
      {yt ? 'Ver en YouTube' : 'Ver video'}
    </a>
  )
}

/* ── Panel de evidencia (respuesta + anexos) de una tarea ────────────────── */
function PanelEvidencia({
  tarea, onRefresh,
}: {
  tarea: TareaReunion; onRefresh: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [respuesta, setRespuesta]   = useState(tarea.respuesta ?? '')
  const [uploading, setUploading]   = useState<string[]>([])
  const [isPending, startT]         = useTransition()
  const respuestaCambiada = respuesta.trim() !== (tarea.respuesta ?? '').trim()

  const guardarRespuesta = () => {
    startT(async () => {
      const res = await guardarRespuestaTarea(tarea.id, respuesta)
      if (res.ok) { toast.success('Respuesta guardada'); onRefresh() }
      else toast.error(res.error ?? 'Error al guardar')
    })
  }

  const subirAnexo = async (file: File) => {
    if (!TIPOS_PERMITIDOS.includes(file.type)) { toast.error(`Tipo no permitido: ${file.name}`); return }
    if (file.size > 20 * 1024 * 1024) { toast.error(`Supera 20MB: ${file.name}`); return }

    const ext  = file.name.split('.').pop()
    const path = `igsi-reuniones-tareas/${tarea.id}/${Date.now()}.${ext}`
    const storageRef = ref(storage, path)

    setUploading(prev => [...prev, file.name])
    const task = uploadBytesResumable(storageRef, file, { contentType: file.type })

    task.on('state_changed', null,
      err => { toast.error(err.message); setUploading(prev => prev.filter(n => n !== file.name)) },
      async () => {
        const url = await getDownloadURL(task.snapshot.ref)
        const res = await registrarAnexoTarea(tarea.id, {
          nombre_archivo: file.name, url_storage: url,
          tipo_archivo: file.type, tamanio_bytes: file.size,
        })
        setUploading(prev => prev.filter(n => n !== file.name))
        if (res.ok) { onRefresh(); toast.success(`${file.name} adjuntado`) }
        else toast.error(res.error ?? 'Error al guardar anexo')
      }
    )
  }

  const handleEliminarAnexo = async (a: AnexoTareaReunion) => {
    try {
      await deleteObject(ref(storage, a.url_storage)).catch(() => {})
      await eliminarAnexoTarea(a.id)
      onRefresh()
    } catch { toast.error('Error al eliminar') }
  }

  return (
    <div className="ml-7 mt-2 space-y-3 rounded-xl border border-slate-200 bg-white p-3">
      {/* Respuesta */}
      <div className="space-y-1.5">
        <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
          <MessageSquare size={12} /> Respuesta de la tarea
        </label>
        <textarea
          value={respuesta}
          onChange={e => setRespuesta(e.target.value)}
          placeholder="Describe qué se hizo, resultado obtenido, enlace, etc."
          rows={3}
          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 resize-none"
        />
        {respuestaCambiada && (
          <button
            onClick={guardarRespuesta}
            disabled={isPending}
            className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isPending ? 'Guardando...' : 'Guardar respuesta'}
          </button>
        )}
        {tarea.respuesta && !respuestaCambiada && (
          <p className="text-xs text-emerald-600">✓ Respuesta guardada</p>
        )}
      </div>

      {/* Separador */}
      <div className="border-t border-slate-100" />

      {/* Anexos de evidencia */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
            <Paperclip size={12} /> Anexos de evidencia
            {tarea.anexos.length > 0 && (
              <span className="ml-1 rounded-full bg-blue-100 px-1.5 py-0.5 text-xs font-bold text-blue-600">
                {tarea.anexos.length}
              </span>
            )}
          </label>
          <button
            onClick={() => inputRef.current?.click()}
            className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600"
          >
            <Plus size={11} /> Adjuntar
          </button>
        </div>

        <input
          ref={inputRef} type="file" multiple
          accept={TIPOS_PERMITIDOS.join(',')}
          className="hidden"
          onChange={e => Array.from(e.target.files ?? []).forEach(subirAnexo)}
        />

        {/* Subiendo */}
        {uploading.map(nombre => (
          <div key={nombre} className="flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-1.5 text-xs text-blue-700">
            <div className="h-3 w-3 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
            Subiendo {nombre}...
          </div>
        ))}

        {/* Lista de anexos */}
        {tarea.anexos.length > 0 ? (
          <ul className="space-y-1">
            {tarea.anexos.map(a => (
              <li key={a.id} className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-1.5">
                <IconoTipo tipo={a.tipo_archivo} />
                <span className="flex-1 truncate text-xs font-medium text-slate-700">{a.nombre_archivo}</span>
                <span className="shrink-0 text-xs text-slate-400">{formatBytes(a.tamanio_bytes)}</span>
                <a href={a.url_storage} target="_blank" rel="noopener noreferrer"
                  className="shrink-0 text-slate-400 hover:text-blue-500">
                  <Download size={13} />
                </a>
                <button onClick={() => handleEliminarAnexo(a)}
                  className="shrink-0 text-slate-300 hover:text-red-400">
                  <X size={12} />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          !uploading.length && (
            <p className="text-xs text-slate-400 italic">Sin anexos adjuntos</p>
          )
        )}
      </div>

      {/* Aviso sin evidencia */}
      {!tarea.respuesta?.trim() && tarea.anexos.length === 0 && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
          <AlertCircle size={13} className="mt-0.5 shrink-0" />
          Agrega una respuesta escrita o al menos un anexo para poder marcar esta tarea como completada.
        </div>
      )}
    </div>
  )
}

/* ── Fila de una tarea individual ────────────────────────────────────────── */
function FilaTarea({
  tarea, perfiles, onRefresh,
}: {
  tarea: TareaReunion; perfiles: Perfil[]; onRefresh: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [isPending, startT]     = useTransition()

  const tieneEvidencia = !!(tarea.respuesta?.trim() || tarea.anexos.length > 0)
  const badge          = badgeFecha(tarea.fecha_compromiso, tarea.completada)
  const nombre         = perfiles.find(p => p.email === tarea.responsable_email)?.nombre_completo
                         ?? tarea.responsable_email

  const handleToggle = () => {
    if (!tarea.completada && !tieneEvidencia) {
      toast.error('Agrega una respuesta o anexo antes de marcar como completada')
      setExpanded(true)
      return
    }
    startT(async () => {
      const res = await toggleTareaReunion(tarea.id, !tarea.completada)
      if (res.ok) onRefresh()
      else toast.error(res.error ?? 'Error')
    })
  }

  const handleEliminar = () => {
    startT(async () => {
      await eliminarTareaReunion(tarea.id)
      onRefresh()
    })
  }

  return (
    <li className={cn(
      'rounded-xl border transition-colors',
      tarea.completada ? 'border-emerald-100 bg-emerald-50/40' : 'border-slate-100 bg-white'
    )}>
      {/* Fila principal */}
      <div className="flex items-start gap-2 px-3 py-2.5">
        {/* Checkbox / lock */}
        <button
          onClick={handleToggle}
          disabled={isPending}
          title={!tieneEvidencia && !tarea.completada ? 'Sin evidencia — agrega respuesta o anexo' : undefined}
          className="mt-0.5 shrink-0"
        >
          {tarea.completada
            ? <CheckSquare size={16} className="text-emerald-500" />
            : tieneEvidencia
              ? <Square size={16} className="text-slate-400 hover:text-emerald-500" />
              : <Lock size={14} className="text-slate-300" />
          }
        </button>

        <div className="flex-1 min-w-0">
          <p className={cn(
            'text-sm font-medium leading-snug',
            tarea.completada ? 'line-through text-slate-400' : 'text-slate-700'
          )}>
            {tarea.descripcion}
          </p>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-400">
            {nombre && (
              <span className="flex items-center gap-1">
                <UserCheck size={10} /> {nombre}
              </span>
            )}
            {badge && (
              <span className={cn('rounded-full px-2 py-0.5 font-medium', badge.cls)}>
                {badge.label}
              </span>
            )}
            {tarea.anexos.length > 0 && (
              <span className="flex items-center gap-0.5 text-blue-500">
                <Paperclip size={10} /> {tarea.anexos.length}
              </span>
            )}
            {!tieneEvidencia && !tarea.completada && (
              <span className="flex items-center gap-0.5 text-amber-500 font-medium">
                <AlertCircle size={10} /> Pendiente evidencia
              </span>
            )}
          </div>
        </div>

        {/* Acciones */}
        <button
          onClick={() => setExpanded(e => !e)}
          className="mt-0.5 shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-100"
          title={expanded ? 'Cerrar panel' : 'Respuesta y anexos'}
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        <button
          onClick={handleEliminar}
          disabled={isPending}
          className="mt-0.5 shrink-0 text-slate-200 hover:text-red-400"
        >
          <X size={13} />
        </button>
      </div>

      {/* Panel de evidencia */}
      {expanded && (
        <div className="pb-3 px-3">
          <PanelEvidencia tarea={tarea} onRefresh={onRefresh} />
        </div>
      )}
    </li>
  )
}

/* ── Formulario tarea fila ───────────────────────────────────────────────── */
interface TareaForm { descripcion: string; responsable_email: string; fecha_compromiso: string }
const TAREA_VACIA: TareaForm = { descripcion: '', responsable_email: '', fecha_compromiso: '' }

function FilaTareaForm({ tarea, onChange, onRemove, perfiles, idx }: {
  tarea: TareaForm; onChange: (t: TareaForm) => void
  onRemove?: () => void; perfiles: Perfil[]; idx: number
}) {
  return (
    <div className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5 sm:grid-cols-[1fr_auto_auto_auto]">
      <input
        placeholder={`Tarea ${idx + 1}...`}
        value={tarea.descripcion}
        onChange={e => onChange({ ...tarea, descripcion: e.target.value })}
        className="w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
      />
      <select
        value={tarea.responsable_email}
        onChange={e => onChange({ ...tarea, responsable_email: e.target.value })}
        className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700 outline-none focus:border-blue-400"
      >
        <option value="">Sin responsable</option>
        {perfiles.map(p => <option key={p.id} value={p.email}>{p.nombre_completo}</option>)}
      </select>
      <input
        type="date" value={tarea.fecha_compromiso}
        onChange={e => onChange({ ...tarea, fecha_compromiso: e.target.value })}
        className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-blue-400"
      />
      {onRemove && (
        <button type="button" onClick={onRemove} className="text-slate-300 hover:text-red-400">
          <X size={14} />
        </button>
      )}
    </div>
  )
}

/* ── Formulario nueva reunión ────────────────────────────────────────────── */
function FormNuevaReunion({ requerimientoId, perfiles, onCreated, onCancel }: {
  requerimientoId: string; perfiles: Perfil[]
  onCreated: () => void; onCancel: () => void
}) {
  const [titulo, setTitulo]     = useState('')
  const [fecha, setFecha]       = useState('')
  const [urlVideo, setUrlVideo] = useState('')
  const [notas, setNotas]       = useState('')
  const [tareas, setTareas]     = useState<TareaForm[]>([{ ...TAREA_VACIA }])
  const [isPending, startT]     = useTransition()

  const handleSubmit = () => {
    if (!titulo.trim()) { toast.error('El título es obligatorio'); return }
    if (!fecha)         { toast.error('La fecha es obligatoria'); return }
    const tareasValidas = tareas.filter(t => t.descripcion.trim())
    startT(async () => {
      const res = await crearReunion(
        requerimientoId,
        { titulo: titulo.trim(), fecha_reunion: fecha, url_video: urlVideo || undefined, notas: notas || undefined },
        tareasValidas.map(t => ({
          descripcion: t.descripcion.trim(),
          responsable_email: t.responsable_email || undefined,
          fecha_compromiso: t.fecha_compromiso || undefined,
        }))
      )
      if (res.ok) { toast.success('Reunión registrada'); onCreated() }
      else toast.error(res.error ?? 'Error al guardar')
    })
  }

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4 space-y-4">
      <p className="text-sm font-semibold text-slate-700">Nueva reunión</p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-500">Título <span className="text-red-500">*</span></label>
          <input
            placeholder="Reunión de levantamiento..."
            value={titulo} onChange={e => setTitulo(e.target.value)}
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-500">Fecha <span className="text-red-500">*</span></label>
          <input
            type="date" value={fecha} onChange={e => setFecha(e.target.value)}
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="flex items-center gap-1 text-xs font-medium text-slate-500">
          <Link2 size={11} /> URL del video (YouTube o Google Drive)
        </label>
        <input
          placeholder="https://youtube.com/... o https://drive.google.com/..."
          value={urlVideo} onChange={e => setUrlVideo(e.target.value)}
          className="w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-slate-500">Notas / resumen</label>
        <textarea
          placeholder="Puntos tratados, decisiones, acuerdos..."
          value={notas} onChange={e => setNotas(e.target.value)}
          rows={2}
          className="w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 resize-none"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-slate-600">
            Tareas generadas ({tareas.filter(t => t.descripcion.trim()).length})
          </label>
          <button
            type="button"
            onClick={() => setTareas(prev => [...prev, { ...TAREA_VACIA }])}
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
          >
            <Plus size={12} /> Agregar tarea
          </button>
        </div>
        <div className="space-y-2">
          {tareas.map((t, i) => (
            <FilaTareaForm
              key={i} idx={i} tarea={t} perfiles={perfiles}
              onChange={u => setTareas(prev => prev.map((p, j) => j === i ? u : p))}
              onRemove={tareas.length > 1 ? () => setTareas(prev => prev.filter((_, j) => j !== i)) : undefined}
            />
          ))}
        </div>
        <p className="text-xs text-slate-400">Descripción · Responsable · Fecha compromiso</p>
      </div>

      <div className="flex justify-end gap-2">
        <button
          type="button" onClick={onCancel}
          className="rounded-lg border border-slate-200 bg-white px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
        >
          Cancelar
        </button>
        <button
          type="button" onClick={handleSubmit} disabled={isPending}
          className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isPending ? 'Guardando...' : 'Guardar reunión'}
        </button>
      </div>
    </div>
  )
}

/* ── Tarjeta de una reunión ──────────────────────────────────────────────── */
function CardReunion({ reunion, perfiles, onRefresh }: {
  reunion: Reunion; perfiles: Perfil[]; onRefresh: () => void
}) {
  const [expanded, setExpanded]     = useState(true)
  const [addingTask, setAddingTask] = useState(false)
  const [nuevaTarea, setNuevaTarea] = useState<TareaForm>({ ...TAREA_VACIA })
  const [isPending, startT]         = useTransition()

  const total             = reunion.tareas.length
  const tareasCompletadas = reunion.tareas.filter(t => t.completada).length

  const handleEliminarReunion = () => {
    if (!confirm('¿Eliminar esta reunión y todas sus tareas?')) return
    startT(async () => { await eliminarReunion(reunion.id); onRefresh() })
  }

  const handleAgregarTarea = () => {
    if (!nuevaTarea.descripcion.trim()) { toast.error('Escribe la descripción'); return }
    startT(async () => {
      const res = await agregarTareaReunion(reunion.id, {
        descripcion: nuevaTarea.descripcion.trim(),
        responsable_email: nuevaTarea.responsable_email || undefined,
        fecha_compromiso: nuevaTarea.fecha_compromiso || undefined,
      })
      if (res.ok) { setNuevaTarea({ ...TAREA_VACIA }); setAddingTask(false); onRefresh() }
      else toast.error(res.error ?? 'Error al agregar tarea')
    })
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 overflow-hidden">
      {/* Header */}
      <div className="flex items-start gap-3 px-4 py-3 border-b border-slate-100">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-slate-800">{reunion.titulo}</span>
            {reunion.url_video && <VideoChip url={reunion.url_video} />}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-400">
            <span className="flex items-center gap-1">
              <CalendarCheck size={11} /> {formatFecha(reunion.fecha_reunion)}
            </span>
            {total > 0 && (
              <span className={cn(
                'rounded-full px-2 py-0.5 font-medium',
                tareasCompletadas === total
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-blue-50 text-blue-600'
              )}>
                {tareasCompletadas}/{total} tareas completadas
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => setExpanded(e => !e)}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200">
            {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
          <button onClick={handleEliminarReunion} disabled={isPending}
            className="rounded-lg p-1.5 text-slate-300 hover:text-red-500">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Body */}
      {expanded && (
        <div className="px-4 py-3 space-y-3 bg-white">
          {reunion.notas && (
            <p className="whitespace-pre-wrap rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-500">
              {reunion.notas}
            </p>
          )}

          {/* Tareas */}
          {reunion.tareas.length === 0 && !addingTask ? (
            <p className="text-xs italic text-slate-400">Sin tareas registradas</p>
          ) : (
            <ul className="space-y-2">
              {reunion.tareas.map(t => (
                <FilaTarea key={t.id} tarea={t} perfiles={perfiles} onRefresh={onRefresh} />
              ))}
            </ul>
          )}

          {/* Inline add task */}
          {addingTask ? (
            <div className="space-y-2 pt-1">
              <FilaTareaForm
                idx={0} tarea={nuevaTarea} perfiles={perfiles}
                onChange={setNuevaTarea}
              />
              <div className="flex gap-3">
                <button onClick={() => { setAddingTask(false); setNuevaTarea({ ...TAREA_VACIA }) }}
                  className="text-xs text-slate-400 hover:text-slate-600">
                  Cancelar
                </button>
                <button onClick={handleAgregarTarea} disabled={isPending}
                  className="text-xs font-medium text-blue-600 hover:text-blue-800 disabled:opacity-50">
                  {isPending ? 'Guardando...' : 'Agregar tarea'}
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setAddingTask(true)}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-blue-600 transition-colors">
              <Plus size={12} /> Agregar tarea
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/* ── Componente principal ────────────────────────────────────────────────── */
export function TabReuniones({ requerimientoId }: Props) {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)

  const { data: reuniones = [], isLoading } = useQuery<Reunion[]>({
    queryKey: ['reuniones', requerimientoId],
    queryFn: () => getReuniones(requerimientoId),
    staleTime: 30_000,
  })

  const { data: perfiles = [] } = useQuery<Perfil[]>({
    queryKey: ['perfiles-activos'],
    queryFn: () => getPerfilesActivos(),
    staleTime: 300_000,
  })

  const refresh = () => qc.invalidateQueries({ queryKey: ['reuniones', requerimientoId] })

  return (
    <div className="space-y-4">
      {!showForm && (
        <button onClick={() => setShowForm(true)}
          className="flex w-full items-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-white px-4 py-3 text-sm text-slate-500 transition-colors hover:border-blue-400 hover:bg-blue-50 hover:text-blue-600">
          <Plus size={15} /> Registrar reunión
        </button>
      )}

      {showForm && (
        <FormNuevaReunion
          requerimientoId={requerimientoId} perfiles={perfiles}
          onCreated={() => { setShowForm(false); refresh() }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}
        </div>
      ) : reuniones.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white py-12 text-center">
          <CalendarCheck size={28} className="mx-auto mb-2 text-slate-200" />
          <p className="text-sm text-slate-400">Sin reuniones registradas</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reuniones.map(r => (
            <CardReunion key={r.id} reunion={r} perfiles={perfiles} onRefresh={refresh} />
          ))}
        </div>
      )}
    </div>
  )
}
