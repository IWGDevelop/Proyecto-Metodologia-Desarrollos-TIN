'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  Plus, Trash2, UserPlus, UserMinus, Pencil, Check, X,
  Brain, Cpu, ChevronDown, ChevronUp, Clock, Calendar,
  User, AlertTriangle, Save,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  crearTarea, actualizarTarea, eliminarTarea, toggleTarea, actualizarRama,
  agregarRegistroHoras, eliminarRegistroHoras,
} from '@/actions/tareas'
import { asignarDesarrollador, desasignarDesarrollador } from '@/actions/desarrolladores-req'
import { formatFechaRelativa, cn } from '@/lib/utils'
import type { TareaTecnica, RequerimientoDesarrollador, Perfil, RegistroHorasTarea } from '@/lib/supabase/types'

function formatFecha(str: string | null) {
  if (!str) return '—'
  return new Date(str + 'T12:00:00').toLocaleDateString('es-CO', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

function badgeFechaCompromiso(fecha: string | null, completada: boolean) {
  if (!fecha) return null
  const hoy  = new Date(); hoy.setHours(0, 0, 0, 0)
  const date = new Date(fecha + 'T12:00:00')
  if (completada) return { label: formatFecha(fecha), cls: 'bg-emerald-50 text-emerald-700' }
  if (date < hoy) return { label: `${formatFecha(fecha)} · Vencida`, cls: 'bg-red-50 text-red-600 font-semibold' }
  const dias = Math.ceil((date.getTime() - hoy.getTime()) / 86400000)
  if (dias <= 3) return { label: formatFecha(fecha), cls: 'bg-amber-50 text-amber-700' }
  return { label: formatFecha(fecha), cls: 'bg-slate-100 text-slate-600' }
}

function Avatar({ nombre, size = 7 }: { nombre: string; size?: number }) {
  const initials = nombre.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
  return (
    <div className={`flex h-${size} w-${size} shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700`}>
      {initials}
    </div>
  )
}

/* ── Dialog de confirmación ──────────────────────────────────────────────── */
function DialogConfirmar({ open, titulo, descripcion, peligro, onConfirm, onCancel }: {
  open: boolean; titulo: string; descripcion: string; peligro?: boolean
  onConfirm: () => void; onCancel: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={o => !o && onCancel()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle size={16} className={peligro ? 'text-red-500' : 'text-amber-500'} />
            {titulo}
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-slate-600">{descripcion}</p>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button
            onClick={onConfirm}
            className={peligro ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}
          >
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ── Fila de tarea ───────────────────────────────────────────────────────── */
function TareaRow({
  tarea, perfiles, isAdmin,
  onToggle, onDelete, onHoraAdded, onHoraDeleted, onTareaActualizada,
}: {
  tarea: TareaTecnica
  perfiles: Perfil[]
  isAdmin: boolean
  onToggle: (id: string, completada: boolean) => void
  onDelete: (id: string) => void
  onHoraAdded: (tareaId: string, r: RegistroHorasTarea) => void
  onHoraDeleted: (tareaId: string, registroId: string) => void
  onTareaActualizada: (id: string, campos: Partial<TareaTecnica>) => void
}) {
  const [expanded, setExpanded]       = useState(false)
  const [editando, setEditando]       = useState(false)
  const [showAddHoras, setShowAddHoras] = useState(false)
  const [pendingConfirm, setPendingConfirm] = useState<'completar' | 'descompletar' | 'eliminar' | null>(null)
  const [isPending, startT]           = useTransition()

  // Edit fields
  const [editTitulo, setEditTitulo]           = useState(tarea.titulo)
  const [editDesc, setEditDesc]               = useState(tarea.descripcion ?? '')
  const [editResponsable, setEditResponsable] = useState(tarea.responsable_id ?? '')
  const [editFecha, setEditFecha]             = useState(tarea.fecha_compromiso ?? '')

  // Horas form
  const [horaFecha, setHoraFecha] = useState(() => new Date().toISOString().split('T')[0])
  const [horasVal, setHorasVal]   = useState('')
  const [horasNotas, setHorasNotas] = useState('')

  const totalHoras = (tarea.registros_horas ?? []).reduce((s, r) => s + r.horas, 0)
  const responsable = perfiles.find(p => p.id === tarea.responsable_id)
  const badge = badgeFechaCompromiso(tarea.fecha_compromiso, tarea.completada)

  const confirmarAccion = () => {
    if (!pendingConfirm) return
    if (pendingConfirm === 'eliminar') onDelete(tarea.id)
    else onToggle(tarea.id, pendingConfirm === 'completar')
    setPendingConfirm(null)
  }

  const handleGuardarEdicion = () => {
    if (!editTitulo.trim()) { toast.error('El título es obligatorio'); return }
    startT(async () => {
      const res = await actualizarTarea(tarea.id, {
        titulo:          editTitulo.trim(),
        descripcion:     editDesc.trim() || null,
        responsable_id:  editResponsable || null,
        fecha_compromiso: editFecha || null,
      })
      if (res.ok) {
        onTareaActualizada(tarea.id, {
          titulo: editTitulo.trim(),
          descripcion: editDesc.trim() || null,
          responsable_id: editResponsable || null,
          fecha_compromiso: editFecha || null,
        })
        setEditando(false)
        toast.success('Tarea actualizada')
      } else {
        toast.error(res.error ?? 'Error al actualizar')
      }
    })
  }

  const handleAgregarHoras = () => {
    const h = parseFloat(horasVal)
    if (!h || h <= 0) { toast.error('Ingresa un valor de horas mayor a 0'); return }
    startT(async () => {
      const res = await agregarRegistroHoras(tarea.id, {
        fecha: horaFecha, horas: h, notas: horasNotas.trim() || undefined,
      })
      if (res.ok && res.registro) {
        onHoraAdded(tarea.id, res.registro)
        setHorasVal('')
        setHorasNotas('')
        toast.success('Horas registradas')
      } else {
        toast.error(res.error ?? 'Error')
      }
    })
  }

  const handleEliminarHora = (registroId: string) => {
    startT(async () => {
      const res = await eliminarRegistroHoras(registroId)
      if (res.ok) onHoraDeleted(tarea.id, registroId)
      else toast.error('Error al eliminar registro')
    })
  }

  return (
    <>
      <DialogConfirmar
        open={pendingConfirm !== null}
        titulo={
          pendingConfirm === 'eliminar'      ? 'Eliminar tarea' :
          pendingConfirm === 'completar'     ? 'Marcar como completada' :
                                               'Reabrir tarea'
        }
        descripcion={
          pendingConfirm === 'eliminar'
            ? `¿Eliminar "${tarea.titulo}"? Se eliminarán todos sus registros de horas. Esta acción es irreversible.`
            : pendingConfirm === 'completar'
              ? `¿Marcar "${tarea.titulo}" como completada? La tarea quedará bloqueada para edición.`
              : `¿Reabrir "${tarea.titulo}"? Volverá al estado en progreso.`
        }
        peligro={pendingConfirm === 'eliminar'}
        onConfirm={confirmarAccion}
        onCancel={() => setPendingConfirm(null)}
      />

      <div className={cn(
        'rounded-xl border transition-colors',
        tarea.completada ? 'border-emerald-100 bg-emerald-50/30' : 'border-slate-200 bg-white'
      )}>
        {/* Fila principal */}
        <div className="flex items-start gap-2.5 px-3 py-2.5">
          {/* Checkbox */}
          <button
            disabled={isPending}
            onClick={() => setPendingConfirm(tarea.completada ? 'descompletar' : 'completar')}
            className={cn(
              'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors',
              tarea.completada
                ? 'border-emerald-500 bg-emerald-500 text-white'
                : 'border-slate-300 bg-white hover:border-emerald-400'
            )}
          >
            {tarea.completada && <Check size={11} />}
          </button>

          <div className="flex-1 min-w-0">
            <p className={cn('text-sm font-medium leading-snug', tarea.completada && 'text-slate-400 line-through')}>
              {tarea.titulo}
            </p>
            <div className="mt-0.5 flex flex-wrap items-center gap-2">
              {responsable && (
                <span className="flex items-center gap-1 text-xs text-slate-500">
                  <User size={10} /> {responsable.nombre_completo}
                </span>
              )}
              {badge && (
                <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs', badge.cls)}>
                  <Calendar size={9} /> {badge.label}
                </span>
              )}
              {totalHoras > 0 && (
                <span className="flex items-center gap-1 text-xs font-medium text-blue-600">
                  <Clock size={10} /> {totalHoras.toFixed(1)} h
                </span>
              )}
              {tarea.completada && tarea.completada_at && (
                <span className="text-xs text-emerald-600">✓ {formatFechaRelativa(tarea.completada_at)}</span>
              )}
            </div>
          </div>

          {/* Acciones */}
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              onClick={() => { setExpanded(e => !e); setEditando(false) }}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
              title="Ver detalle y horas"
            >
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {isAdmin && !tarea.completada && (
              <button
                onClick={() => { setEditando(e => !e); setExpanded(true) }}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <Pencil size={12} />
              </button>
            )}
            {isAdmin && (
              <button
                onClick={() => setPendingConfirm('eliminar')}
                disabled={isPending}
                className="rounded-lg p-1.5 text-slate-300 hover:bg-red-50 hover:text-red-500"
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Panel expandido */}
        {expanded && (
          <div className="border-t border-slate-100 px-3 pb-3 pt-2.5 space-y-4">
            {/* Formulario de edición */}
            {editando ? (
              <div className="space-y-2 rounded-lg border border-blue-100 bg-blue-50/40 p-3">
                <p className="text-xs font-semibold text-slate-600">Editar tarea</p>
                <Input
                  value={editTitulo}
                  onChange={e => setEditTitulo(e.target.value)}
                  placeholder="Título *"
                  className="text-sm"
                />
                <Textarea
                  value={editDesc}
                  onChange={e => setEditDesc(e.target.value)}
                  placeholder="Descripción (opcional)"
                  rows={2}
                  className="text-sm resize-none"
                />
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-xs text-slate-500">Responsable</label>
                    <select
                      value={editResponsable}
                      onChange={e => setEditResponsable(e.target.value)}
                      className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-blue-400"
                    >
                      <option value="">Sin responsable</option>
                      {perfiles.map(p => (
                        <option key={p.id} value={p.id}>{p.nombre_completo}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-slate-500">Fecha compromiso</label>
                    <input
                      type="date"
                      value={editFecha}
                      onChange={e => setEditFecha(e.target.value)}
                      className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-blue-400"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleGuardarEdicion} disabled={isPending}
                    className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    <Save size={12} /> {isPending ? 'Guardando...' : 'Guardar'}
                  </button>
                  <button
                    onClick={() => setEditando(false)}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-100"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              tarea.descripcion && (
                <p className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2 whitespace-pre-wrap">
                  {tarea.descripcion}
                </p>
              )
            )}

            {/* Registro de horas */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                  <Clock size={11} className="text-blue-500" />
                  Registro de horas
                  {totalHoras > 0 && (
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-700">
                      {totalHoras.toFixed(1)} h total
                    </span>
                  )}
                </p>
                {!showAddHoras && !tarea.completada && (
                  <button
                    onClick={() => setShowAddHoras(true)}
                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
                  >
                    <Plus size={11} /> Registrar horas
                  </button>
                )}
              </div>

              {/* Tabla de registros */}
              {(tarea.registros_horas ?? []).length > 0 ? (
                <div className="rounded-lg border border-slate-100 overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50">
                      <tr>
                        {['Fecha', 'Horas', 'Notas', ''].map(h => (
                          <th key={h} className="px-3 py-2 text-left font-medium text-slate-400">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {(tarea.registros_horas ?? []).map(r => (
                        <tr key={r.id} className="hover:bg-slate-50/50">
                          <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{formatFecha(r.fecha)}</td>
                          <td className="px-3 py-2 font-bold text-blue-700 whitespace-nowrap">{r.horas.toFixed(1)} h</td>
                          <td className="px-3 py-2 text-slate-400 max-w-[180px] truncate">{r.notas || '—'}</td>
                          <td className="px-3 py-2">
                            <button
                              onClick={() => handleEliminarHora(r.id)}
                              disabled={isPending}
                              className="text-slate-200 hover:text-red-400"
                            >
                              <X size={12} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    {(tarea.registros_horas ?? []).length > 1 && (
                      <tfoot className="bg-slate-50">
                        <tr>
                          <td className="px-3 py-2 text-xs font-semibold text-slate-500">Total</td>
                          <td className="px-3 py-2 text-xs font-bold text-blue-700">{totalHoras.toFixed(1)} h</td>
                          <td colSpan={2} />
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              ) : (
                !showAddHoras && (
                  <p className="text-xs italic text-slate-400">Sin registros de horas aún</p>
                )
              )}

              {/* Formulario agregar horas */}
              {showAddHoras && (
                <div className="space-y-2 rounded-lg border border-blue-100 bg-blue-50/50 p-2.5">
                  <p className="text-xs font-medium text-slate-600">Nuevo registro de horas</p>
                  <div className="grid gap-2 sm:grid-cols-[auto_auto_1fr]">
                    <div className="space-y-1">
                      <label className="text-xs text-slate-500">Fecha</label>
                      <input
                        type="date"
                        value={horaFecha}
                        onChange={e => setHoraFecha(e.target.value)}
                        className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-blue-400"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-slate-500">Horas</label>
                      <input
                        type="number" min={0.5} max={24} step={0.5}
                        placeholder="ej. 3.5"
                        value={horasVal}
                        onChange={e => setHorasVal(e.target.value)}
                        className="w-24 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-blue-400"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-slate-500">Notas (opcional)</label>
                      <input
                        placeholder="¿Qué se trabajó?"
                        value={horasNotas}
                        onChange={e => setHorasNotas(e.target.value)}
                        className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-blue-400"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleAgregarHoras} disabled={isPending}
                      className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      <Clock size={11} /> {isPending ? 'Guardando...' : 'Agregar'}
                    </button>
                    <button
                      onClick={() => { setShowAddHoras(false); setHorasVal(''); setHorasNotas('') }}
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-500 hover:bg-slate-100"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  )
}

/* ── Props del componente principal ──────────────────────────────────────── */
interface Props {
  requerimientoId: string
  rama: 'TIN' | 'IA' | null
  tareas: TareaTecnica[]
  desarrolladores: RequerimientoDesarrollador[]
  perfilesDisponibles: Perfil[]
  isAdmin: boolean
  currentUserId?: string
}

/* ── Componente principal ────────────────────────────────────────────────── */
export function TabDesarrollo({
  requerimientoId, rama: ramaInicial, tareas: tareasIniciales,
  desarrolladores: devIniciales, perfilesDisponibles, isAdmin, currentUserId,
}: Props) {
  const [isPending, startTransition] = useTransition()

  const [tareas, setTareas] = useState<TareaTecnica[]>(tareasIniciales)
  const [devs, setDevs]     = useState<RequerimientoDesarrollador[]>(devIniciales)
  const [rama, setRama]     = useState<'TIN' | 'IA' | null>(ramaInicial)

  // Nueva tarea
  const [showNewTarea, setShowNewTarea]       = useState(false)
  const [newTitulo, setNewTitulo]             = useState('')
  const [newDesc, setNewDesc]                 = useState('')
  const [newResponsable, setNewResponsable]   = useState('')
  const [newFechaComp, setNewFechaComp]       = useState('')

  // Asignar dev
  const [selectedDev, setSelectedDev] = useState('')

  const totalTareas      = tareas.length
  const tareasCompletadas = tareas.filter(t => t.completada).length
  const progreso         = totalTareas > 0 ? Math.round((tareasCompletadas / totalTareas) * 100) : 0
  const asignadosIds     = new Set(devs.map(d => d.perfil_id))
  const disponibles      = perfilesDisponibles.filter(p => !asignadosIds.has(p.id))

  // ── Acciones sobre tareas ────────────────────────────────────────────────
  const handleToggleTarea = (id: string, completada: boolean) => {
    setTareas(prev => prev.map(t =>
      t.id === id ? { ...t, completada, completada_at: completada ? new Date().toISOString() : null } : t
    ))
    startTransition(async () => {
      const res = await toggleTarea(id, completada)
      if (!res.ok) {
        toast.error(res.error ?? 'Error al actualizar')
        setTareas(prev => prev.map(t => t.id === id ? { ...t, completada: !completada } : t))
      }
    })
  }

  const handleEliminarTarea = (id: string) => {
    setTareas(prev => prev.filter(t => t.id !== id))
    startTransition(async () => {
      const res = await eliminarTarea(id)
      if (!res.ok) toast.error(res.error ?? 'Error al eliminar')
    })
  }

  const handleTareaActualizada = (id: string, campos: Partial<TareaTecnica>) => {
    setTareas(prev => prev.map(t => t.id === id ? { ...t, ...campos } : t))
  }

  const handleHoraAdded = (tareaId: string, registro: RegistroHorasTarea) => {
    setTareas(prev => prev.map(t =>
      t.id === tareaId
        ? { ...t, registros_horas: [...(t.registros_horas ?? []), registro].sort((a, b) => a.fecha.localeCompare(b.fecha)) }
        : t
    ))
  }

  const handleHoraDeleted = (tareaId: string, registroId: string) => {
    setTareas(prev => prev.map(t =>
      t.id === tareaId
        ? { ...t, registros_horas: (t.registros_horas ?? []).filter(r => r.id !== registroId) }
        : t
    ))
  }

  const handleCrearTarea = () => {
    if (!newTitulo.trim()) return
    startTransition(async () => {
      const res = await crearTarea({
        requerimiento_id: requerimientoId,
        titulo:           newTitulo.trim(),
        descripcion:      newDesc.trim() || undefined,
        responsable_id:   newResponsable || null,
        fecha_compromiso: newFechaComp || null,
        created_by:       currentUserId,
      })
      if (!res.ok) {
        toast.error(res.error ?? 'Error al crear tarea')
      } else {
        setTareas(prev => [...prev, res.tarea!])
        setNewTitulo(''); setNewDesc(''); setNewResponsable(''); setNewFechaComp('')
        setShowNewTarea(false)
        toast.success('Tarea creada')
      }
    })
  }

  // ── Acciones sobre desarrolladores ──────────────────────────────────────
  const handleRama = (val: string | null) => {
    const r = (val as 'TIN' | 'IA' | null) ?? null
    setRama(r)
    startTransition(async () => {
      const res = await actualizarRama(requerimientoId, r)
      if (!res.ok) toast.error(res.error ?? 'Error al actualizar rama')
      else toast.success('Rama actualizada')
    })
  }

  const handleAsignar = () => {
    if (!selectedDev) return
    const perfil = perfilesDisponibles.find(p => p.id === selectedDev)
    if (!perfil) return
    const newDev: RequerimientoDesarrollador = {
      requerimiento_id: requerimientoId, perfil_id: selectedDev,
      asignado_at: new Date().toISOString(), perfil,
    }
    setDevs(prev => [...prev, newDev])
    setSelectedDev('')
    startTransition(async () => {
      const res = await asignarDesarrollador(requerimientoId, selectedDev, currentUserId)
      if (!res.ok) { toast.error(res.error ?? 'Error al asignar'); setDevs(prev => prev.filter(d => d.perfil_id !== selectedDev)) }
      else toast.success(`${perfil.nombre_completo} asignado`)
    })
  }

  const handleDesasignar = (perfilId: string) => {
    setDevs(prev => prev.filter(d => d.perfil_id !== perfilId))
    startTransition(async () => {
      const res = await desasignarDesarrollador(requerimientoId, perfilId)
      if (!res.ok) toast.error(res.error ?? 'Error al desasignar')
    })
  }

  return (
    <div className="space-y-6">

      {/* ── RAMA ─────────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Rama del desarrollo</p>
        <div className="flex items-center gap-3">
          {isAdmin ? (
            <Select value={rama ?? ''} onValueChange={handleRama}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Sin definir" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TIN"><span className="flex items-center gap-2"><Cpu size={13} /> TIN</span></SelectItem>
                <SelectItem value="IA"><span className="flex items-center gap-2"><Brain size={13} /> IA</span></SelectItem>
              </SelectContent>
            </Select>
          ) : (
            rama ? (
              <Badge className={rama === 'IA' ? 'bg-purple-100 text-purple-700 hover:bg-purple-100' : 'bg-blue-100 text-blue-700 hover:bg-blue-100'}>
                {rama === 'IA' ? <><Brain size={11} className="mr-1" />IA</> : <><Cpu size={11} className="mr-1" />TIN</>}
              </Badge>
            ) : <span className="text-sm text-slate-400">Sin definir</span>
          )}
        </div>
      </div>

      {/* ── DESARROLLADORES ──────────────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Desarrolladores asignados ({devs.length})
        </p>
        {devs.length > 0 && (
          <div className="space-y-2 mb-3">
            {devs.map(d => (
              <div key={d.perfil_id} className="flex items-center gap-2.5 rounded-lg bg-slate-50 px-3 py-2">
                <Avatar nombre={d.perfil?.nombre_completo ?? '?'} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700">{d.perfil?.nombre_completo}</p>
                  <p className="text-xs text-slate-400">{d.perfil?.email}</p>
                </div>
                {d.perfil?.cargo && <span className="text-xs text-slate-400 hidden sm:block">{d.perfil.cargo}</span>}
                {isAdmin && (
                  <button onClick={() => handleDesasignar(d.perfil_id)} className="rounded p-1 text-slate-400 hover:bg-red-100 hover:text-red-600">
                    <UserMinus size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        {devs.length === 0 && <p className="mb-3 text-sm text-slate-400 italic">Sin desarrolladores asignados</p>}
        {isAdmin && disponibles.length > 0 && (
          <div className="flex gap-2">
            <Select value={selectedDev} onValueChange={(v: string | null) => setSelectedDev(v ?? '')}>
              <SelectTrigger className="flex-1 text-sm">
                <SelectValue placeholder="Seleccionar desarrollador..." />
              </SelectTrigger>
              <SelectContent>
                {disponibles.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.nombre_completo}{p.cargo ? ` — ${p.cargo}` : ''}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={handleAsignar} disabled={!selectedDev || isPending} className="gap-1.5">
              <UserPlus size={14} /> Asignar
            </Button>
          </div>
        )}
      </div>

      {/* ── TAREAS TÉCNICAS ──────────────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Tareas técnicas</p>
            {totalTareas > 0 && (
              <p className="text-xs text-slate-500 mt-0.5">{tareasCompletadas} de {totalTareas} completadas</p>
            )}
          </div>
          {isAdmin && (
            <Button size="sm" variant="outline" onClick={() => setShowNewTarea(true)} className="gap-1.5 text-xs">
              <Plus size={13} /> Nueva tarea
            </Button>
          )}
        </div>

        {totalTareas > 0 && (
          <div className="mb-4 space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Progreso</span>
              <span className={`font-bold ${progreso === 100 ? 'text-emerald-600' : 'text-blue-600'}`}>{progreso}%</span>
            </div>
            <Progress value={progreso} className="h-2" />
          </div>
        )}

        {tareas.length === 0 && !showNewTarea ? (
          <p className="text-sm text-slate-400 italic">Sin tareas técnicas definidas</p>
        ) : (
          <div className="space-y-2">
            {tareas.map(tarea => (
              <TareaRow
                key={tarea.id}
                tarea={tarea}
                perfiles={perfilesDisponibles}
                isAdmin={isAdmin}
                onToggle={handleToggleTarea}
                onDelete={handleEliminarTarea}
                onHoraAdded={handleHoraAdded}
                onHoraDeleted={handleHoraDeleted}
                onTareaActualizada={handleTareaActualizada}
              />
            ))}
          </div>
        )}

        {/* Formulario nueva tarea */}
        {showNewTarea && (
          <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50/40 p-3 space-y-3">
            <p className="text-xs font-semibold text-slate-700">Nueva tarea técnica</p>
            <Input
              placeholder="Título de la tarea *"
              value={newTitulo}
              onChange={e => setNewTitulo(e.target.value)}
              className="text-sm"
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') handleCrearTarea() }}
            />
            <Textarea
              placeholder="Descripción (opcional)"
              value={newDesc}
              onChange={e => setNewDesc(e.target.value)}
              className="text-sm resize-none"
              rows={2}
            />
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-xs text-slate-500">Responsable</label>
                <select
                  value={newResponsable}
                  onChange={e => setNewResponsable(e.target.value)}
                  className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-blue-400"
                >
                  <option value="">Sin responsable</option>
                  {perfilesDisponibles.map(p => (
                    <option key={p.id} value={p.id}>{p.nombre_completo}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-500">Fecha compromiso</label>
                <input
                  type="date"
                  value={newFechaComp}
                  onChange={e => setNewFechaComp(e.target.value)}
                  className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-blue-400"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleCrearTarea} disabled={!newTitulo.trim() || isPending} className="bg-blue-600 hover:bg-blue-700">
                Agregar tarea
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setShowNewTarea(false); setNewTitulo(''); setNewDesc(''); setNewResponsable(''); setNewFechaComp('') }}>
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
