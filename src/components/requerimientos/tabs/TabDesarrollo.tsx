'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Plus, Trash2, UserPlus, UserMinus, Pencil, Check, X, Brain, Cpu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  crearTarea, actualizarTarea, eliminarTarea, toggleTarea, actualizarRama,
} from '@/actions/tareas'
import { asignarDesarrollador, desasignarDesarrollador } from '@/actions/desarrolladores-req'
import { formatFechaRelativa } from '@/lib/utils'
import type { TareaTecnica, RequerimientoDesarrollador, Perfil } from '@/lib/supabase/types'

// ─── Avatares ─────────────────────────────────────────────────────────────────
function Avatar({ nombre, size = 7 }: { nombre: string; size?: number }) {
  const initials = nombre.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
  const cls = `flex h-${size} w-${size} shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700`
  return <div className={cls}>{initials}</div>
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
  requerimientoId: string
  rama: 'TIN' | 'IA' | null
  tareas: TareaTecnica[]
  desarrolladores: RequerimientoDesarrollador[]
  perfilesDisponibles: Perfil[]
  isAdmin: boolean
  currentUserId?: string
}

// ─── Tarea row ────────────────────────────────────────────────────────────────
function TareaRow({
  tarea, isAdmin, onToggle, onDelete, onEdit,
}: {
  tarea: TareaTecnica
  isAdmin: boolean
  onToggle: (id: string, completada: boolean) => void
  onDelete: (id: string) => void
  onEdit: (tarea: TareaTecnica) => void
}) {
  return (
    <div className={`flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors ${
      tarea.completada ? 'bg-emerald-50' : 'bg-slate-50'
    }`}>
      <button
        onClick={() => onToggle(tarea.id, !tarea.completada)}
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors ${
          tarea.completada
            ? 'border-emerald-500 bg-emerald-500 text-white'
            : 'border-slate-300 bg-white hover:border-blue-400'
        }`}
      >
        {tarea.completada && <Check size={11} />}
      </button>

      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${tarea.completada ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
          {tarea.titulo}
        </p>
        {tarea.descripcion && (
          <p className="text-xs text-slate-400 mt-0.5">{tarea.descripcion}</p>
        )}
        {tarea.completada && tarea.completada_at && (
          <p className="text-xs text-emerald-600 mt-0.5">
            Completada {formatFechaRelativa(tarea.completada_at)}
          </p>
        )}
      </div>

      {isAdmin && (
        <div className="flex items-center gap-1">
          <button onClick={() => onEdit(tarea)} className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600">
            <Pencil size={12} />
          </button>
          <button onClick={() => onDelete(tarea.id)} className="rounded p-1 text-slate-400 hover:bg-red-100 hover:text-red-600">
            <Trash2 size={12} />
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────
export function TabDesarrollo({
  requerimientoId, rama: ramaInicial, tareas: tareasIniciales,
  desarrolladores: devIniciales, perfilesDisponibles, isAdmin, currentUserId,
}: Props) {
  const [isPending, startTransition] = useTransition()

  // State local
  const [tareas, setTareas] = useState<TareaTecnica[]>(tareasIniciales)
  const [devs, setDevs] = useState<RequerimientoDesarrollador[]>(devIniciales)
  const [rama, setRama] = useState<'TIN' | 'IA' | null>(ramaInicial)

  // Nueva tarea
  const [showNewTarea, setShowNewTarea] = useState(false)
  const [newTitulo, setNewTitulo] = useState('')
  const [newDesc, setNewDesc] = useState('')

  // Editar tarea
  const [editingTarea, setEditingTarea] = useState<TareaTecnica | null>(null)
  const [editTitulo, setEditTitulo] = useState('')

  // Asignar desarrollador
  const [selectedDev, setSelectedDev] = useState('')

  // ── Calcular progreso ──────────────────────────────────────────────────────
  const totalTareas = tareas.length
  const tareasCompletadas = tareas.filter(t => t.completada).length
  const progreso = totalTareas > 0 ? Math.round((tareasCompletadas / totalTareas) * 100) : 0

  // Devs no asignados aún
  const asignadosIds = new Set(devs.map(d => d.perfil_id))
  const disponibles = perfilesDisponibles.filter(p => !asignadosIds.has(p.id))

  // ── Acciones ───────────────────────────────────────────────────────────────

  const handleRama = (val: string | null) => {
    const r = (val as 'TIN' | 'IA' | null) ?? null
    setRama(r)
    startTransition(async () => {
      const res = await actualizarRama(requerimientoId, r)
      if (!res.ok) toast.error(res.error ?? 'Error al actualizar rama')
      else toast.success('Rama actualizada')
    })
  }

  const handleToggleTarea = (id: string, completada: boolean) => {
    // Optimistic update
    setTareas(prev => prev.map(t => t.id === id ? { ...t, completada, completada_at: completada ? new Date().toISOString() : null } : t))
    startTransition(async () => {
      const res = await toggleTarea(id, completada)
      if (!res.ok) {
        toast.error(res.error ?? 'Error al actualizar tarea')
        setTareas(prev => prev.map(t => t.id === id ? { ...t, completada: !completada } : t))
      }
    })
  }

  const handleCrearTarea = () => {
    if (!newTitulo.trim()) return
    startTransition(async () => {
      const res = await crearTarea({
        requerimiento_id: requerimientoId,
        titulo: newTitulo.trim(),
        descripcion: newDesc.trim() || undefined,
        created_by: currentUserId,
      })
      if (!res.ok) {
        toast.error(res.error ?? 'Error al crear tarea')
      } else {
        setTareas(prev => [...prev, res.tarea!])
        setNewTitulo('')
        setNewDesc('')
        setShowNewTarea(false)
        toast.success('Tarea creada')
      }
    })
  }

  const handleEliminarTarea = (id: string) => {
    setTareas(prev => prev.filter(t => t.id !== id))
    startTransition(async () => {
      const res = await eliminarTarea(id)
      if (!res.ok) {
        toast.error(res.error ?? 'Error al eliminar')
        // Revert not implemented — page refresh will restore
      }
    })
  }

  const handleEditarTarea = async () => {
    if (!editingTarea || !editTitulo.trim()) return
    const res = await actualizarTarea(editingTarea.id, { titulo: editTitulo.trim() })
    if (!res.ok) { toast.error(res.error ?? 'Error al editar'); return }
    setTareas(prev => prev.map(t => t.id === editingTarea.id ? { ...t, titulo: editTitulo } : t))
    setEditingTarea(null)
    toast.success('Tarea actualizada')
  }

  const handleAsignar = () => {
    if (!selectedDev) return
    const perfil = perfilesDisponibles.find(p => p.id === selectedDev)
    if (!perfil) return

    const newDev: RequerimientoDesarrollador = {
      requerimiento_id: requerimientoId,
      perfil_id: selectedDev,
      asignado_at: new Date().toISOString(),
      perfil,
    }
    setDevs(prev => [...prev, newDev])
    setSelectedDev('')

    startTransition(async () => {
      const res = await asignarDesarrollador(requerimientoId, selectedDev, currentUserId)
      if (!res.ok) {
        toast.error(res.error ?? 'Error al asignar')
        setDevs(prev => prev.filter(d => d.perfil_id !== selectedDev))
      } else {
        toast.success(`${perfil.nombre_completo} asignado`)
      }
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

      {/* ── RAMA ─────────────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Rama del desarrollo</p>
        <div className="flex items-center gap-3">
          {isAdmin ? (
            <Select value={rama ?? ''} onValueChange={handleRama}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Sin definir" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TIN">
                  <span className="flex items-center gap-2"><Cpu size={13} /> TIN</span>
                </SelectItem>
                <SelectItem value="IA">
                  <span className="flex items-center gap-2"><Brain size={13} /> IA</span>
                </SelectItem>
              </SelectContent>
            </Select>
          ) : (
            rama ? (
              <Badge className={rama === 'IA' ? 'bg-purple-100 text-purple-700 hover:bg-purple-100' : 'bg-blue-100 text-blue-700 hover:bg-blue-100'}>
                {rama === 'IA' ? <><Brain size={11} className="mr-1" />IA</> : <><Cpu size={11} className="mr-1" />TIN</>}
              </Badge>
            ) : (
              <span className="text-sm text-slate-400">Sin definir</span>
            )
          )}
        </div>
      </div>

      {/* ── DESARROLLADORES ──────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Desarrolladores asignados ({devs.length})
          </p>
        </div>

        {devs.length === 0 ? (
          <p className="text-sm text-slate-400 italic">Sin desarrolladores asignados</p>
        ) : (
          <div className="space-y-2 mb-3">
            {devs.map(d => (
              <div key={d.perfil_id} className="flex items-center gap-2.5 rounded-lg bg-slate-50 px-3 py-2">
                <Avatar nombre={d.perfil?.nombre_completo ?? '?'} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700">{d.perfil?.nombre_completo}</p>
                  <p className="text-xs text-slate-400">{d.perfil?.email}</p>
                </div>
                {d.perfil?.cargo && (
                  <span className="text-xs text-slate-400 hidden sm:block">{d.perfil.cargo}</span>
                )}
                {isAdmin && (
                  <button
                    onClick={() => handleDesasignar(d.perfil_id)}
                    className="rounded p-1 text-slate-400 hover:bg-red-100 hover:text-red-600"
                  >
                    <UserMinus size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {isAdmin && disponibles.length > 0 && (
          <div className="flex gap-2">
            <Select value={selectedDev} onValueChange={(v: string | null) => setSelectedDev(v ?? '')}>
              <SelectTrigger className="flex-1 text-sm">
                <SelectValue placeholder="Seleccionar desarrollador..." />
              </SelectTrigger>
              <SelectContent>
                {disponibles.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nombre_completo} {p.cargo ? `— ${p.cargo}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={handleAsignar} disabled={!selectedDev || isPending} className="gap-1.5">
              <UserPlus size={14} /> Asignar
            </Button>
          </div>
        )}
      </div>

      {/* ── TAREAS TÉCNICAS ──────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Tareas técnicas
            </p>
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

        {/* Progreso */}
        {totalTareas > 0 && (
          <div className="mb-4 space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Progreso</span>
              <span className={`font-bold ${progreso === 100 ? 'text-emerald-600' : 'text-blue-600'}`}>
                {progreso}%
              </span>
            </div>
            <Progress value={progreso} className="h-2" />
          </div>
        )}

        {/* Lista de tareas */}
        {tareas.length === 0 && !showNewTarea ? (
          <p className="text-sm text-slate-400 italic">Sin tareas técnicas definidas</p>
        ) : (
          <div className="space-y-1.5">
            {tareas.map(tarea => (
              editingTarea?.id === tarea.id ? (
                <div key={tarea.id} className="flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2">
                  <Input
                    value={editTitulo}
                    onChange={e => setEditTitulo(e.target.value)}
                    className="flex-1 h-7 text-sm"
                    onKeyDown={e => { if (e.key === 'Enter') handleEditarTarea(); if (e.key === 'Escape') setEditingTarea(null) }}
                    autoFocus
                  />
                  <button onClick={handleEditarTarea} className="text-emerald-600 hover:text-emerald-700"><Check size={15} /></button>
                  <button onClick={() => setEditingTarea(null)} className="text-slate-400 hover:text-slate-600"><X size={15} /></button>
                </div>
              ) : (
                <TareaRow
                  key={tarea.id}
                  tarea={tarea}
                  isAdmin={isAdmin}
                  onToggle={handleToggleTarea}
                  onDelete={handleEliminarTarea}
                  onEdit={t => { setEditingTarea(t); setEditTitulo(t.titulo) }}
                />
              )
            ))}
          </div>
        )}

        {/* Formulario nueva tarea */}
        {showNewTarea && (
          <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3 space-y-2">
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
            <div className="flex gap-2">
              <Button size="sm" onClick={handleCrearTarea} disabled={!newTitulo.trim() || isPending} className="bg-blue-600 hover:bg-blue-700">
                Agregar
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setShowNewTarea(false); setNewTitulo(''); setNewDesc('') }}>
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
