'use client'

import { useState, useTransition } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getReuniones, crearReunion, agregarTareaReunion,
  toggleTareaReunion, eliminarTareaReunion, eliminarReunion,
} from '@/actions/reuniones'
import { getPerfilesActivos } from '@/actions/perfiles'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Video, PlayCircle, Plus, Trash2, CheckSquare, Square,
  ChevronDown, ChevronUp, CalendarCheck, UserCheck, X, Link2,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { Reunion, TareaReunion, Perfil } from '@/lib/supabase/types'

interface Props {
  requerimientoId: string
}

/* ── helpers ─────────────────────────────────────────────────────────────── */
function formatFecha(str: string | null) {
  if (!str) return '—'
  const d = new Date(str + 'T12:00:00')
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

function badgeFecha(str: string | null, completada: boolean) {
  if (!str) return null
  const hoy  = new Date(); hoy.setHours(0, 0, 0, 0)
  const date = new Date(str + 'T12:00:00')
  if (completada) return { label: formatFecha(str), cls: 'bg-emerald-50 text-emerald-700' }
  if (date < hoy) return { label: formatFecha(str), cls: 'bg-red-50 text-red-600' }
  const dias = Math.ceil((date.getTime() - hoy.getTime()) / 86400000)
  if (dias <= 3) return { label: formatFecha(str), cls: 'bg-amber-50 text-amber-700' }
  return { label: formatFecha(str), cls: 'bg-slate-100 text-slate-600' }
}

function esYoutube(url: string) {
  return url.includes('youtube.com') || url.includes('youtu.be')
}

function VideoChip({ url }: { url: string }) {
  const yt = esYoutube(url)
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
        yt
          ? 'bg-red-50 text-red-600 hover:bg-red-100'
          : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
      )}
    >
      {yt ? <PlayCircle size={11} /> : <Video size={11} />}
      {yt ? 'Ver en YouTube' : 'Ver video'}
    </a>
  )
}

/* ── Formulario de nueva tarea ───────────────────────────────────────────── */
interface TareaForm { descripcion: string; responsable_email: string; fecha_compromiso: string }
const TAREA_VACIA: TareaForm = { descripcion: '', responsable_email: '', fecha_compromiso: '' }

function FilaTareaForm({
  tarea, onChange, onRemove, perfiles, idx,
}: {
  tarea: TareaForm; onChange: (t: TareaForm) => void
  onRemove?: () => void; perfiles: Perfil[]; idx: number
}) {
  return (
    <div className="grid grid-cols-1 gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:grid-cols-[1fr_auto_auto_auto]">
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
        {perfiles.map(p => (
          <option key={p.id} value={p.email}>{p.nombre_completo}</option>
        ))}
      </select>
      <input
        type="date"
        value={tarea.fecha_compromiso}
        onChange={e => onChange({ ...tarea, fecha_compromiso: e.target.value })}
        className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700 outline-none focus:border-blue-400"
      />
      {onRemove && (
        <button type="button" onClick={onRemove} className="text-slate-300 hover:text-red-400">
          <X size={14} />
        </button>
      )}
    </div>
  )
}

/* ── Panel nueva reunión ─────────────────────────────────────────────────── */
function FormNuevaReunion({
  requerimientoId, perfiles, onCreated, onCancel,
}: {
  requerimientoId: string; perfiles: Perfil[]
  onCreated: () => void; onCancel: () => void
}) {
  const [titulo, setTitulo]       = useState('')
  const [fecha, setFecha]         = useState('')
  const [urlVideo, setUrlVideo]   = useState('')
  const [notas, setNotas]         = useState('')
  const [tareas, setTareas]       = useState<TareaForm[]>([{ ...TAREA_VACIA }])
  const [isPending, startT]       = useTransition()

  const updateTarea = (i: number, t: TareaForm) =>
    setTareas(prev => prev.map((p, idx) => idx === i ? t : p))

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
      if (res.ok) {
        toast.success('Reunión registrada')
        onCreated()
      } else {
        toast.error(res.error ?? 'Error al guardar')
      }
    })
  }

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4 space-y-4">
      <p className="text-sm font-semibold text-slate-700">Nueva reunión</p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-500">Título <span className="text-red-500">*</span></label>
          <input
            placeholder="Reunión de levantamiento..."
            value={titulo}
            onChange={e => setTitulo(e.target.value)}
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-500">Fecha <span className="text-red-500">*</span></label>
          <input
            type="date"
            value={fecha}
            onChange={e => setFecha(e.target.value)}
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-slate-500 flex items-center gap-1">
          <Link2 size={11} /> URL del video (YouTube o Google Drive)
        </label>
        <input
          placeholder="https://youtube.com/... o https://drive.google.com/..."
          value={urlVideo}
          onChange={e => setUrlVideo(e.target.value)}
          className="w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-slate-500">Notas / resumen</label>
        <textarea
          placeholder="Puntos tratados, decisiones, acuerdos..."
          value={notas}
          onChange={e => setNotas(e.target.value)}
          rows={2}
          className="w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 resize-none"
        />
      </div>

      {/* Tareas */}
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
              onChange={updated => updateTarea(i, updated)}
              onRemove={tareas.length > 1 ? () => setTareas(prev => prev.filter((_, j) => j !== i)) : undefined}
            />
          ))}
        </div>
        <p className="text-xs text-slate-400">Descripción · Responsable · Fecha de compromiso</p>
      </div>

      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-slate-200 bg-white px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isPending}
          className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isPending ? 'Guardando...' : 'Guardar reunión'}
        </button>
      </div>
    </div>
  )
}

/* ── Tarjeta de una reunión ──────────────────────────────────────────────── */
function CardReunion({
  reunion, perfiles, onRefresh,
}: {
  reunion: Reunion; perfiles: Perfil[]; onRefresh: () => void
}) {
  const [expanded, setExpanded]   = useState(true)
  const [addingTask, setAddingTask] = useState(false)
  const [nuevaTarea, setNuevaTarea] = useState<TareaForm>({ ...TAREA_VACIA })
  const [isPending, startT]        = useTransition()

  const tareasCompletadas = reunion.tareas.filter(t => t.completada).length
  const total             = reunion.tareas.length

  const handleToggle = (t: TareaReunion) => {
    startT(async () => {
      await toggleTareaReunion(t.id, !t.completada)
      onRefresh()
    })
  }

  const handleEliminarTarea = (t: TareaReunion) => {
    startT(async () => {
      await eliminarTareaReunion(t.id)
      onRefresh()
    })
  }

  const handleEliminarReunion = () => {
    if (!confirm('¿Eliminar esta reunión y todas sus tareas?')) return
    startT(async () => {
      await eliminarReunion(reunion.id)
      onRefresh()
    })
  }

  const handleAgregarTarea = () => {
    if (!nuevaTarea.descripcion.trim()) { toast.error('Escribe la descripción'); return }
    startT(async () => {
      const res = await agregarTareaReunion(reunion.id, {
        descripcion: nuevaTarea.descripcion.trim(),
        responsable_email: nuevaTarea.responsable_email || undefined,
        fecha_compromiso: nuevaTarea.fecha_compromiso || undefined,
      })
      if (res.ok) {
        setNuevaTarea({ ...TAREA_VACIA })
        setAddingTask(false)
        onRefresh()
      } else {
        toast.error(res.error ?? 'Error al agregar tarea')
      }
    })
  }

  const nombreResponsable = (email: string | null) => {
    if (!email) return null
    return perfiles.find(p => p.email === email)?.nombre_completo ?? email
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-start gap-3 px-4 py-3 bg-slate-50 border-b border-slate-100">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-slate-800">{reunion.titulo}</span>
            {reunion.url_video && <VideoChip url={reunion.url_video} />}
          </div>
          <div className="mt-1 flex items-center gap-3 text-xs text-slate-400">
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
                {tareasCompletadas}/{total} tareas
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setExpanded(e => !e)}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200"
          >
            {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
          <button
            onClick={handleEliminarReunion}
            disabled={isPending}
            className="rounded-lg p-1.5 text-slate-300 hover:text-red-500"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Body */}
      {expanded && (
        <div className="px-4 py-3 space-y-3">
          {/* Notas */}
          {reunion.notas && (
            <p className="text-xs text-slate-500 whitespace-pre-wrap bg-slate-50 rounded-lg p-2.5 border border-slate-100">
              {reunion.notas}
            </p>
          )}

          {/* Lista de tareas */}
          {reunion.tareas.length === 0 && !addingTask ? (
            <p className="text-xs text-slate-400 italic">Sin tareas registradas</p>
          ) : (
            <ul className="space-y-1.5">
              {reunion.tareas.map(t => {
                const badge = badgeFecha(t.fecha_compromiso, t.completada)
                const nombre = nombreResponsable(t.responsable_email)
                return (
                  <li key={t.id} className={cn(
                    'flex items-start gap-2 rounded-lg p-2 transition-colors',
                    t.completada ? 'bg-emerald-50/60' : 'bg-white border border-slate-100'
                  )}>
                    <button
                      onClick={() => handleToggle(t)}
                      disabled={isPending}
                      className="mt-0.5 shrink-0 text-slate-300 hover:text-emerald-500"
                    >
                      {t.completada
                        ? <CheckSquare size={15} className="text-emerald-500" />
                        : <Square size={15} />}
                    </button>
                    <div className="flex-1 min-w-0 text-xs">
                      <p className={cn('font-medium', t.completada ? 'line-through text-slate-400' : 'text-slate-700')}>
                        {t.descripcion}
                      </p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2">
                        {nombre && (
                          <span className="flex items-center gap-1 text-slate-500">
                            <UserCheck size={10} /> {nombre}
                          </span>
                        )}
                        {badge && (
                          <span className={cn('rounded-full px-2 py-0.5 font-medium', badge.cls)}>
                            {badge.label}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleEliminarTarea(t)}
                      disabled={isPending}
                      className="mt-0.5 shrink-0 text-slate-200 hover:text-red-400"
                    >
                      <X size={12} />
                    </button>
                  </li>
                )
              })}
            </ul>
          )}

          {/* Inline add task */}
          {addingTask ? (
            <div className="space-y-2">
              <FilaTareaForm
                idx={0} tarea={nuevaTarea} perfiles={perfiles}
                onChange={setNuevaTarea}
              />
              <div className="flex gap-2">
                <button
                  onClick={() => { setAddingTask(false); setNuevaTarea({ ...TAREA_VACIA }) }}
                  className="text-xs text-slate-400 hover:text-slate-600"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleAgregarTarea}
                  disabled={isPending}
                  className="text-xs font-medium text-blue-600 hover:text-blue-800 disabled:opacity-50"
                >
                  {isPending ? 'Guardando...' : 'Agregar tarea'}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setAddingTask(true)}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-blue-600 transition-colors"
            >
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
      {/* Botón superior */}
      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-white px-4 py-3 text-sm text-slate-500 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-600 transition-colors w-full"
        >
          <Plus size={15} /> Registrar reunión
        </button>
      )}

      {/* Formulario */}
      {showForm && (
        <FormNuevaReunion
          requerimientoId={requerimientoId}
          perfiles={perfiles}
          onCreated={() => { setShowForm(false); refresh() }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* Lista */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      ) : reuniones.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white py-12 text-center">
          <CalendarCheck size={28} className="mx-auto mb-2 text-slate-200" />
          <p className="text-sm text-slate-400">Sin reuniones registradas</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reuniones.map(r => (
            <CardReunion
              key={r.id} reunion={r} perfiles={perfiles} onRefresh={refresh}
            />
          ))}
        </div>
      )}
    </div>
  )
}
