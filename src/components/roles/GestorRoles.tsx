'use client'

import { useState, useTransition, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ShieldCheck, Plus, Pencil, Trash2, Check, X,
  LayoutDashboard, ClipboardList, Kanban, BarChart2,
  Star, Users, Settings2, Lock, Eye, FilePen, FolderPlus,
  ChevronDown, ChevronUp, Power,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  getRoles, crearRol, actualizarRol, eliminarRol,
  getPermisosRol, guardarPermisosRol,
} from '@/actions/roles-permisos'
import { CATEGORIAS_RECURSOS, LABELS_PERMISO, type TipoPermiso } from '@/lib/recursos-sistema'
import type { RolPersonalizado, PermisosMap } from '@/actions/roles-permisos'

const ICONOS_MENU: Record<string, React.ElementType> = {
  'menu:dashboard':             LayoutDashboard,
  'menu:requerimientos':        ClipboardList,
  'menu:kanban':               Kanban,
  'menu:reportes':             BarChart2,
  'menu:reporte-presidencial': Star,
  'menu:usuarios':             Users,
  'menu:configuracion':        Settings2,
  'menu:roles':               ShieldCheck,
}

const ICONOS_PERMISO: Record<TipoPermiso, React.ElementType> = {
  puede_ver:    Eye,
  puede_editar: FilePen,
  puede_crear:  FolderPlus,
}

const COLOR_PERMISO: Record<TipoPermiso, string> = {
  puede_ver:    'text-blue-600 bg-blue-50 border-blue-200',
  puede_editar: 'text-violet-600 bg-violet-50 border-violet-200',
  puede_crear:  'text-emerald-600 bg-emerald-50 border-emerald-200',
}

/* ── Formulario inline para crear/editar rol ─────────────────────────────── */
function FormRol({
  inicial, onGuardar, onCancelar,
}: {
  inicial?: { nombre: string; descripcion: string }
  onGuardar: (datos: { nombre: string; descripcion: string }) => void
  onCancelar: () => void
}) {
  const [nombre,      setNombre]      = useState(inicial?.nombre      ?? '')
  const [descripcion, setDescripcion] = useState(inicial?.descripcion ?? '')

  return (
    <div className="space-y-3 rounded-xl border border-blue-200 bg-blue-50/40 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-500">
            Nombre del rol <span className="text-red-400">*</span>
          </label>
          <input
            value={nombre}
            onChange={e => setNombre(e.target.value)}
            placeholder="Ej: SUPERVISOR"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
          />
          <p className="text-[10px] text-slate-400">Se guardará en mayúsculas con guión bajo</p>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-500">Descripción</label>
          <input
            value={descripcion}
            onChange={e => setDescripcion(e.target.value)}
            placeholder="Breve descripción del rol..."
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
          />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={onCancelar}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50">
          Cancelar
        </button>
        <button onClick={() => onGuardar({ nombre, descripcion })}
          disabled={!nombre.trim()}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50">
          <Check size={12} /> Guardar
        </button>
      </div>
    </div>
  )
}

/* ── Checkbox de permiso ─────────────────────────────────────────────────── */
function CheckPermiso({
  tipo, checked, disabled, onChange,
}: {
  tipo: TipoPermiso; checked: boolean; disabled: boolean; onChange: (v: boolean) => void
}) {
  const Icon = ICONOS_PERMISO[tipo]
  if (disabled) {
    return (
      <div className="flex items-center justify-center">
        <div className="h-6 w-6 rounded border border-slate-100 bg-slate-50 flex items-center justify-center" title="No aplica">
          <span className="text-slate-200 text-xs">—</span>
        </div>
      </div>
    )
  }
  return (
    <div className="flex items-center justify-center">
      <button
        onClick={() => onChange(!checked)}
        title={`${LABELS_PERMISO[tipo]}: ${checked ? 'Desactivar' : 'Activar'}`}
        className={cn(
          'flex h-7 w-7 items-center justify-center rounded-lg border transition-all',
          checked
            ? COLOR_PERMISO[tipo]
            : 'border-slate-200 bg-white text-slate-300 hover:border-slate-300 hover:text-slate-400'
        )}
      >
        <Icon size={13} />
      </button>
    </div>
  )
}

/* ── Grupo de recursos colapsable ────────────────────────────────────────── */
function GrupoRecursos({
  categoria, permisos, onChange, readOnly,
}: {
  categoria: (typeof CATEGORIAS_RECURSOS)[0]
  permisos: PermisosMap
  onChange: (recurso: string, tipo: TipoPermiso, valor: boolean) => void
  readOnly: boolean
}) {
  const [open, setOpen] = useState(true)
  const TIPOS: TipoPermiso[] = ['puede_ver', 'puede_editar', 'puede_crear']

  const totalActivos = categoria.recursos.reduce((s, r) => {
    return s + TIPOS.filter(t => permisos[r.id]?.[t]).length
  }, 0)

  const marcarTodos = (valor: boolean) => {
    categoria.recursos.forEach(r => {
      r.permisos.forEach(t => onChange(r.id, t, valor))
    })
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between bg-slate-50 px-4 py-3 text-left hover:bg-slate-100"
      >
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-slate-700">{categoria.label}</p>
          {totalActivos > 0 && (
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-700">
              {totalActivos} activos
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {!readOnly && open && (
            <div className="flex gap-1.5" onClick={e => e.stopPropagation()}>
              <button onClick={() => marcarTodos(true)}
                className="rounded px-2 py-0.5 text-[10px] font-medium text-blue-600 hover:bg-blue-50">
                Todo
              </button>
              <button onClick={() => marcarTodos(false)}
                className="rounded px-2 py-0.5 text-[10px] font-medium text-slate-400 hover:bg-slate-100">
                Nada
              </button>
            </div>
          )}
          {open ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
        </div>
      </button>

      {open && (
        <div className="divide-y divide-slate-50 bg-white">
          {/* Header de columnas */}
          <div className="grid grid-cols-[1fr_80px_80px_80px] items-center border-b border-slate-100 bg-slate-50/50 px-4 py-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Recurso</span>
            {TIPOS.map(t => (
              <div key={t} className="flex items-center justify-center gap-1">
                <span className={cn('text-[10px] font-semibold uppercase tracking-wide',
                  t === 'puede_ver' ? 'text-blue-400' : t === 'puede_editar' ? 'text-violet-400' : 'text-emerald-400')}>
                  {LABELS_PERMISO[t]}
                </span>
              </div>
            ))}
          </div>

          {categoria.recursos.map(recurso => {
            const IconoMenu = ICONOS_MENU[recurso.id]
            return (
              <div key={recurso.id} className="grid grid-cols-[1fr_80px_80px_80px] items-center px-4 py-2.5 hover:bg-slate-50/60">
                <div className="flex items-center gap-2 min-w-0">
                  {IconoMenu
                    ? <IconoMenu size={13} className="shrink-0 text-slate-400" />
                    : <div className="h-3 w-3 shrink-0 rounded-full bg-slate-200" />
                  }
                  <span className="text-sm text-slate-700 truncate">{recurso.label}</span>
                </div>
                {TIPOS.map(tipo => (
                  <CheckPermiso
                    key={tipo}
                    tipo={tipo}
                    checked={permisos[recurso.id]?.[tipo] ?? false}
                    disabled={!recurso.permisos.includes(tipo)}
                    onChange={v => !readOnly && onChange(recurso.id, tipo, v)}
                  />
                ))}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ── Panel de permisos de un rol ─────────────────────────────────────────── */
function PanelPermisos({ rol }: { rol: RolPersonalizado }) {
  const qc = useQueryClient()
  const [isPending, startT] = useTransition()
  const [localPermisos, setLocalPermisos] = useState<PermisosMap | null>(null)
  const [modificado, setModificado] = useState(false)

  const { data: permisosDB = {}, isLoading } = useQuery({
    queryKey: ['permisos-rol', rol.id],
    queryFn: () => getPermisosRol(rol.id),
    staleTime: 30_000,
  })

  const permisos: PermisosMap = localPermisos ?? permisosDB
  const readOnly = rol.es_sistema && rol.nombre === 'ADMIN_TIN'

  const handleChange = useCallback((recurso: string, tipo: TipoPermiso, valor: boolean) => {
    setLocalPermisos(prev => {
      const base = prev ?? permisosDB
      return {
        ...base,
        [recurso]: {
          puede_ver:    base[recurso]?.puede_ver    ?? false,
          puede_editar: base[recurso]?.puede_editar ?? false,
          puede_crear:  base[recurso]?.puede_crear  ?? false,
          [tipo]: valor,
        },
      }
    })
    setModificado(true)
  }, [permisosDB])

  const guardar = () => {
    if (!localPermisos) return
    startT(async () => {
      const res = await guardarPermisosRol(rol.id, localPermisos)
      if (res.ok) {
        toast.success('Permisos guardados')
        setModificado(false)
        setLocalPermisos(null)
        qc.invalidateQueries({ queryKey: ['permisos-rol', rol.id] })
      } else toast.error(res.error ?? 'Error al guardar')
    })
  }

  const descartar = () => { setLocalPermisos(null); setModificado(false) }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-400 text-sm">
        Cargando permisos...
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-700">
            Permisos del rol: <span className="text-blue-700">{rol.nombre}</span>
          </p>
          {rol.descripcion && <p className="text-xs text-slate-400 mt-0.5">{rol.descripcion}</p>}
        </div>
        <div className="flex items-center gap-2">
          {readOnly && (
            <span className="flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-500">
              <Lock size={11} /> Administrador — acceso completo
            </span>
          )}
          {modificado && !readOnly && (
            <>
              <button onClick={descartar} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-50">
                Descartar
              </button>
              <button onClick={guardar} disabled={isPending}
                className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                <Check size={12} /> {isPending ? 'Guardando...' : 'Guardar permisos'}
              </button>
            </>
          )}
        </div>
      </div>

      {readOnly ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-6 text-center">
          <ShieldCheck size={28} className="mx-auto mb-2 text-emerald-500" />
          <p className="text-sm font-semibold text-emerald-700">Rol de administrador — acceso total</p>
          <p className="text-xs text-emerald-600 mt-1">
            El rol ADMIN_TIN tiene acceso completo a todos los módulos del sistema y no puede ser restringido.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {CATEGORIAS_RECURSOS.map(cat => (
            <GrupoRecursos
              key={cat.id}
              categoria={cat}
              permisos={permisos}
              onChange={handleChange}
              readOnly={readOnly}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Componente principal ────────────────────────────────────────────────── */
export function GestorRoles() {
  const qc = useQueryClient()
  const [rolSeleccionado, setRolSeleccionado] = useState<RolPersonalizado | null>(null)
  const [creando, setCreando]               = useState(false)
  const [editando, setEditando]             = useState<RolPersonalizado | null>(null)
  const [isPending, startT]                 = useTransition()

  const { data: roles = [], isLoading } = useQuery({
    queryKey: ['roles-personalizados'],
    queryFn: getRoles,
    staleTime: 30_000,
  })

  const refresh = () => qc.invalidateQueries({ queryKey: ['roles-personalizados'] })

  const handleCrear = (datos: { nombre: string; descripcion: string }) => {
    startT(async () => {
      const res = await crearRol(datos)
      if (res.ok) {
        toast.success('Rol creado')
        setCreando(false)
        await refresh()
        const nuevoRol = roles.find(r => r.id === res.id)
        if (nuevoRol) setRolSeleccionado(nuevoRol)
      } else toast.error(res.error ?? 'Error')
    })
  }

  const handleActualizar = (datos: { nombre: string; descripcion: string }) => {
    if (!editando) return
    startT(async () => {
      const res = await actualizarRol(editando.id, datos)
      if (res.ok) {
        toast.success('Rol actualizado')
        setEditando(null)
        refresh()
      } else toast.error(res.error ?? 'Error')
    })
  }

  const handleToggleActivo = (rol: RolPersonalizado) => {
    startT(async () => {
      const res = await actualizarRol(rol.id, { activo: !rol.activo })
      if (res.ok) { toast.success(rol.activo ? 'Rol desactivado' : 'Rol activado'); refresh() }
      else toast.error(res.error ?? 'Error')
    })
  }

  const handleEliminar = (rol: RolPersonalizado) => {
    if (!confirm(`¿Eliminar el rol "${rol.nombre}"? Esta acción no se puede deshacer.`)) return
    startT(async () => {
      const res = await eliminarRol(rol.id)
      if (res.ok) {
        toast.success('Rol eliminado')
        if (rolSeleccionado?.id === rol.id) setRolSeleccionado(null)
        refresh()
      } else toast.error(res.error ?? 'Error')
    })
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
      {/* ── Panel izquierdo: lista de roles ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Roles ({roles.length})</p>
          <button
            onClick={() => { setCreando(true); setEditando(null) }}
            className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
          >
            <Plus size={12} /> Nuevo rol
          </button>
        </div>

        {creando && (
          <FormRol
            onGuardar={handleCrear}
            onCancelar={() => setCreando(false)}
          />
        )}

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {roles.map(rol => (
              <div key={rol.id}>
                {editando?.id === rol.id ? (
                  <FormRol
                    inicial={{ nombre: rol.nombre, descripcion: rol.descripcion ?? '' }}
                    onGuardar={handleActualizar}
                    onCancelar={() => setEditando(null)}
                  />
                ) : (
                  <button
                    onClick={() => setRolSeleccionado(r => r?.id === rol.id ? null : rol)}
                    className={cn(
                      'w-full rounded-xl border p-3 text-left transition-all',
                      rolSeleccionado?.id === rol.id
                        ? 'border-blue-300 bg-blue-50 shadow-sm'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50',
                      !rol.activo && 'opacity-60'
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-slate-800 truncate">{rol.nombre}</p>
                          {rol.es_sistema && (
                            <span className="rounded-full border border-slate-200 bg-slate-100 px-1.5 py-px text-[10px] font-medium text-slate-500">
                              Sistema
                            </span>
                          )}
                          {!rol.activo && (
                            <span className="rounded-full border border-orange-200 bg-orange-50 px-1.5 py-px text-[10px] font-medium text-orange-500">
                              Inactivo
                            </span>
                          )}
                        </div>
                        {rol.descripcion && (
                          <p className="mt-0.5 text-xs text-slate-400 line-clamp-2">{rol.descripcion}</p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-0.5" onClick={e => e.stopPropagation()}>
                        {!rol.es_sistema && (
                          <>
                            <button
                              onClick={() => handleToggleActivo(rol)}
                              title={rol.activo ? 'Desactivar' : 'Activar'}
                              className={cn(
                                'rounded p-1 transition-colors',
                                rol.activo
                                  ? 'text-emerald-400 hover:bg-emerald-50 hover:text-emerald-600'
                                  : 'text-slate-300 hover:bg-slate-100 hover:text-slate-500'
                              )}
                            >
                              <Power size={13} />
                            </button>
                            <button
                              onClick={() => { setEditando(rol); setCreando(false) }}
                              className="rounded p-1 text-slate-300 hover:bg-slate-100 hover:text-slate-600"
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              onClick={() => handleEliminar(rol)}
                              disabled={isPending}
                              className="rounded p-1 text-slate-300 hover:bg-red-50 hover:text-red-500"
                            >
                              <Trash2 size={13} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Panel derecho: matriz de permisos ── */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        {rolSeleccionado ? (
          <PanelPermisos key={rolSeleccionado.id} rol={rolSeleccionado} />
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <ShieldCheck size={40} className="mb-3 text-slate-200" />
            <p className="text-sm font-semibold text-slate-500">Selecciona un rol para configurar sus permisos</p>
            <p className="mt-1 text-xs text-slate-400">
              Haz clic en cualquier rol de la lista para ver y editar su matriz de permisos.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
