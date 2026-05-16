'use client'

import { useState, useTransition, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertOctagon, Plus, Trash2, Pencil, Save, X,
  DollarSign, MessageSquare, Shield, Users, Search,
  UserCheck, ChevronDown, ChevronUp,
} from 'lucide-react'
import { toast } from 'sonner'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { cn, formatCOP } from '@/lib/utils'
import { getPerfilesActivos } from '@/actions/perfiles'
import {
  getPenalizaciones, crearPenalizacion, actualizarPenalizacion,
  actualizarComentarios, eliminarPenalizacion,
} from '@/actions/penalizaciones'
import type { PenalizacionRequerimiento, TipoPenalizacion } from '@/actions/penalizaciones'
import type { Perfil } from '@/lib/supabase/types'

/* ── Catálogo de tipos ───────────────────────────────────────────────────── */
export const TIPOS_PENALIZACION = [
  { value: 'DOCUMENTACION_DESTIEMPO' as TipoPenalizacion, label: 'Documentación a destiempo', cls: 'bg-orange-100 text-orange-700 border-orange-200' },
  { value: 'MALA_DEFINICION'         as TipoPenalizacion, label: 'Mala definición',            cls: 'bg-red-100 text-red-700 border-red-200' },
  { value: 'FALTA_RESPUESTA'         as TipoPenalizacion, label: 'Falta de respuesta',         cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  { value: 'INFORMACION_INCORRECTA'  as TipoPenalizacion, label: 'Información incorrecta',     cls: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  { value: 'CAMBIO_ALCANCE'          as TipoPenalizacion, label: 'Cambio de alcance',          cls: 'bg-purple-100 text-purple-700 border-purple-200' },
  { value: 'RETRASO_ENTREGA'         as TipoPenalizacion, label: 'Retraso en entrega',         cls: 'bg-rose-100 text-rose-700 border-rose-200' },
  { value: 'OTRO'                    as TipoPenalizacion, label: 'Otro',                       cls: 'bg-slate-100 text-slate-600 border-slate-200' },
]

function TipoBadge({ tipo }: { tipo: TipoPenalizacion }) {
  const cfg = TIPOS_PENALIZACION.find(t => t.value === tipo)
  return (
    <span className={cn('rounded-full border px-2.5 py-0.5 text-xs font-semibold', cfg?.cls ?? 'bg-slate-100 text-slate-600 border-slate-200')}>
      {cfg?.label ?? tipo}
    </span>
  )
}

function formatFecha(str: string) {
  return new Date(str).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

/* ── Combobox multi-email ────────────────────────────────────────────────── */
function BuscadorResponsables({
  perfiles, values, onChange, placeholder,
}: {
  perfiles: Perfil[]
  values: string[]    // emails
  onChange: (emails: string[]) => void
  placeholder: string
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen]   = useState(false)
  const inputRef          = useRef<HTMLInputElement>(null)
  const valuesSet         = new Set(values)

  const filtered = query.trim().length > 0
    ? perfiles
        .filter(p =>
          p.nombre_completo.toLowerCase().includes(query.toLowerCase()) ||
          p.email.toLowerCase().includes(query.toLowerCase())
        )
        .slice(0, 8)
    : []

  const handleSelect = (p: Perfil) => {
    if (valuesSet.has(p.email)) {
      onChange(values.filter(e => e !== p.email))
    } else {
      onChange([...values, p.email])
    }
    setQuery('')
    inputRef.current?.focus()
  }

  return (
    <div className="space-y-2">
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
          {values.map(email => {
            const p = perfiles.find(u => u.email === email)
            return (
              <Badge key={email} variant="secondary" className="flex items-center gap-1 py-0.5 text-xs">
                <UserCheck size={10} className="text-blue-500" />
                {p?.nombre_completo ?? email}
                <button type="button" onClick={() => onChange(values.filter(e => e !== email))}
                  className="ml-0.5 rounded-full hover:bg-slate-300">
                  <X size={10} />
                </button>
              </Badge>
            )
          })}
        </div>
      )}
      <div className="relative">
        <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          autoComplete="off"
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={placeholder}
          className="w-full rounded-md border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200"
        />
        {open && (
          <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
            {filtered.length > 0 ? filtered.map(p => {
              const sel = valuesSet.has(p.email)
              return (
                <button key={p.id} type="button" onMouseDown={() => handleSelect(p)}
                  className={cn('flex w-full items-center gap-2.5 px-3 py-2 text-left', sel ? 'bg-blue-50' : 'hover:bg-slate-50')}>
                  <div className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                    sel ? 'bg-blue-500 text-white' : 'bg-blue-100 text-blue-600')}>
                    {p.nombre_completo.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-700">{p.nombre_completo}</p>
                    <p className="text-xs text-slate-400 truncate">{p.email}</p>
                  </div>
                  {sel && <span className="text-xs font-bold text-blue-500">✓</span>}
                </button>
              )
            }) : query.trim().length > 0 ? (
              <p className="px-3 py-2.5 text-sm text-slate-400">Sin resultados para "{query}"</p>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Sección de comentario (admin o usuario) ─────────────────────────────── */
function SeccionComentario({
  label, icono, value, onSave, colorCls, editable,
}: {
  label: string
  icono: React.ReactNode
  value: string | null
  onSave: (texto: string) => Promise<void>
  colorCls: string
  editable: boolean
}) {
  const [editando, setEditando] = useState(false)
  const [texto, setTexto]       = useState(value ?? '')
  const [isPending, startT]     = useTransition()

  const handleSave = () => {
    startT(async () => {
      await onSave(texto)
      setEditando(false)
    })
  }

  return (
    <div className={cn('rounded-xl border p-3 space-y-2', colorCls)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-semibold">
          {icono} {label}
        </div>
        {editable && !editando && (
          <button onClick={() => setEditando(true)}
            className="rounded p-1 text-slate-400 hover:bg-white/60 hover:text-slate-600">
            <Pencil size={11} />
          </button>
        )}
      </div>

      {editando ? (
        <div className="space-y-2">
          <textarea
            value={texto}
            onChange={e => setTexto(e.target.value)}
            rows={3}
            placeholder="Escribe el comentario..."
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 resize-none"
          />
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={isPending}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              <Save size={11} /> {isPending ? 'Guardando...' : 'Guardar'}
            </button>
            <button onClick={() => { setEditando(false); setTexto(value ?? '') }}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-500 hover:bg-slate-50">
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="min-h-[28px]">
          {value?.trim() ? (
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{value}</p>
          ) : (
            <p className="text-xs italic text-slate-400">
              {editable ? 'Sin comentario — haz clic en ✏️ para agregar' : 'Sin comentario'}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

/* ── Formulario nueva/editar penalización ────────────────────────────────── */
function FormPenalizacion({
  requerimientoId, perfiles, penalizacion, onSaved, onCancel,
}: {
  requerimientoId: string
  perfiles: Perfil[]
  penalizacion?: PenalizacionRequerimiento   // si existe → modo edición
  onSaved: () => void
  onCancel: () => void
}) {
  const [tipo, setTipo]               = useState<TipoPenalizacion>(penalizacion?.tipo ?? 'DOCUMENTACION_DESTIEMPO')
  const [descripcion, setDescripcion] = useState(penalizacion?.descripcion ?? '')
  const [responsables, setResponsables] = useState<string[]>(penalizacion?.responsables ?? [])
  const [monto, setMonto]             = useState<number>(penalizacion?.monto_cop ?? 0)
  const [isPending, startT]           = useTransition()

  const esEdicion = !!penalizacion

  const handleSubmit = () => {
    if (responsables.length === 0) { toast.error('Selecciona al menos un responsable'); return }
    if (monto <= 0)                { toast.error('El monto debe ser mayor a 0');        return }

    startT(async () => {
      const payload = {
        tipo,
        descripcion: descripcion.trim() || null,
        responsables,
        monto_cop: monto,
      }
      const res = esEdicion
        ? await actualizarPenalizacion(penalizacion.id, payload)
        : await crearPenalizacion({ requerimiento_id: requerimientoId, ...payload })

      if (res.ok) {
        toast.success(esEdicion ? 'Penalización actualizada' : 'Penalización registrada')
        onSaved()
      } else {
        toast.error((res as any).error ?? 'Error')
      }
    })
  }

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50/30 p-4 space-y-4">
      <p className="text-sm font-semibold text-slate-700">
        {esEdicion ? 'Editar penalización' : 'Nueva penalización'}
      </p>

      {/* Tipo */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-slate-600">Tipo de penalización <span className="text-red-500">*</span></label>
        <div className="flex flex-wrap gap-2">
          {TIPOS_PENALIZACION.map(t => (
            <button
              key={t.value}
              type="button"
              onClick={() => setTipo(t.value)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-semibold transition-all',
                tipo === t.value ? cn(t.cls, 'ring-2 ring-offset-1') : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Descripción */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-slate-600">Descripción / detalle (opcional)</label>
        <textarea
          value={descripcion}
          onChange={e => setDescripcion(e.target.value)}
          placeholder="Describe brevemente qué ocurrió..."
          rows={2}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 resize-none"
        />
      </div>

      {/* Responsables */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-slate-600">
          Responsables <span className="text-red-500">*</span>
          <span className="ml-1 text-xs font-normal text-slate-400">(funcionarios que generaron la desatención)</span>
        </label>
        <BuscadorResponsables
          perfiles={perfiles}
          values={responsables}
          onChange={setResponsables}
          placeholder="Buscar funcionario por nombre o correo..."
        />
      </div>

      {/* Monto */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-slate-600">Monto de penalización (COP) <span className="text-red-500">*</span></label>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 focus-within:border-orange-400 focus-within:ring-1 focus-within:ring-orange-200">
            <DollarSign size={14} className="text-orange-500 shrink-0" />
            <input
              type="number"
              min={0}
              step={1000}
              value={monto || ''}
              onChange={e => setMonto(parseFloat(e.target.value) || 0)}
              placeholder="0"
              className="w-40 text-sm font-semibold text-slate-700 outline-none"
            />
            <span className="text-xs text-slate-400">COP</span>
          </div>
          {monto > 0 && (
            <span className="text-sm font-bold text-orange-600">{formatCOP(monto)}</span>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        <button onClick={handleSubmit} disabled={isPending}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
          <Save size={13} /> {isPending ? 'Guardando...' : esEdicion ? 'Actualizar' : 'Registrar'}
        </button>
        <button onClick={onCancel}
          className="rounded-lg border border-slate-200 bg-white px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-50">
          Cancelar
        </button>
      </div>
    </div>
  )
}

/* ── Card de una penalización ────────────────────────────────────────────── */
function CardPenalizacion({
  pen, perfiles, isAdmin, onRefresh,
}: {
  pen: PenalizacionRequerimiento
  perfiles: Perfil[]
  isAdmin: boolean
  onRefresh: () => void
}) {
  const [editando, setEditando]       = useState(false)
  const [expanded, setExpanded]       = useState(false)
  const [isPending, startT]           = useTransition()

  const handleEliminar = () => {
    if (!confirm('¿Eliminar esta penalización?')) return
    startT(async () => {
      await eliminarPenalizacion(pen.id)
      onRefresh()
      toast.success('Penalización eliminada')
    })
  }

  const handleComentarioAdmin = async (texto: string) => {
    const res = await actualizarComentarios(pen.id, { comentario_admin: texto.trim() || null })
    if (res.ok) { onRefresh(); toast.success('Comentario guardado') }
    else toast.error(res.error ?? 'Error')
  }

  const handleComentarioUsuario = async (texto: string) => {
    const res = await actualizarComentarios(pen.id, { comentario_usuario: texto.trim() || null })
    if (res.ok) { onRefresh(); toast.success('Comentario guardado') }
    else toast.error(res.error ?? 'Error')
  }

  if (editando) {
    return (
      <FormPenalizacion
        requerimientoId={pen.requerimiento_id}
        perfiles={perfiles}
        penalizacion={pen}
        onSaved={() => { setEditando(false); onRefresh() }}
        onCancel={() => setEditando(false)}
      />
    )
  }

  const tieneComentarios = pen.comentario_admin || pen.comentario_usuario
  const responsablesNombres = pen.responsables.map(
    email => perfiles.find(p => p.email === email)?.nombre_completo ?? email
  )

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-start gap-3 px-4 py-3">
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <TipoBadge tipo={pen.tipo} />
            <span className="flex items-center gap-1 rounded-full bg-orange-50 px-2.5 py-0.5 text-xs font-bold text-orange-600">
              <DollarSign size={10} /> {formatCOP(pen.monto_cop)}
            </span>
            <span className="text-xs text-slate-400">{formatFecha(pen.created_at)}</span>
          </div>

          {pen.descripcion && (
            <p className="text-sm text-slate-600">{pen.descripcion}</p>
          )}

          {/* Responsables */}
          {pen.responsables.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <Users size={11} className="text-slate-400 shrink-0" />
              {responsablesNombres.map((nombre, i) => (
                <span key={i} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                  {nombre}
                </span>
              ))}
            </div>
          )}

          {/* Indicador comentarios */}
          {tieneComentarios && (
            <div className="flex gap-2 text-xs">
              {pen.comentario_admin && (
                <span className="flex items-center gap-1 text-blue-500">
                  <Shield size={10} /> Admin
                </span>
              )}
              {pen.comentario_usuario && (
                <span className="flex items-center gap-1 text-emerald-500">
                  <MessageSquare size={10} /> Usuario
                </span>
              )}
            </div>
          )}
        </div>

        {/* Acciones */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setExpanded(e => !e)}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
            title="Comentarios"
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {isAdmin && (
            <>
              <button onClick={() => setEditando(true)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                <Pencil size={13} />
              </button>
              <button onClick={handleEliminar} disabled={isPending}
                className="rounded-lg p-1.5 text-slate-300 hover:bg-red-50 hover:text-red-500">
                <Trash2 size={13} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Sección de comentarios */}
      {expanded && (
        <div className="border-t border-slate-100 px-4 py-3 space-y-3">
          <SeccionComentario
            label="Comentario del administrador"
            icono={<Shield size={12} className="text-blue-500" />}
            value={pen.comentario_admin}
            onSave={handleComentarioAdmin}
            colorCls="border-blue-100 bg-blue-50/50"
            editable={isAdmin}
          />
          <SeccionComentario
            label="Comentario del usuario / funcionario"
            icono={<MessageSquare size={12} className="text-emerald-500" />}
            value={pen.comentario_usuario}
            onSave={handleComentarioUsuario}
            colorCls="border-emerald-100 bg-emerald-50/50"
            editable={true}
          />
        </div>
      )}
    </div>
  )
}

/* ── Componente principal ────────────────────────────────────────────────── */
export function TabPenalizaciones({
  requerimientoId, isAdmin,
}: {
  requerimientoId: string
  isAdmin: boolean
}) {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)

  const { data: penalizaciones = [], isLoading: loadingPens } = useQuery<PenalizacionRequerimiento[]>({
    queryKey: ['penalizaciones', requerimientoId],
    queryFn: () => getPenalizaciones(requerimientoId),
    staleTime: 30_000,
  })

  const { data: perfiles = [], isLoading: loadingPerfiles } = useQuery<Perfil[]>({
    queryKey: ['perfiles-activos'],
    queryFn: () => getPerfilesActivos(),
    staleTime: 300_000,
  })

  const isLoading = loadingPens || loadingPerfiles
  const refresh   = () => qc.invalidateQueries({ queryKey: ['penalizaciones', requerimientoId] })

  const montoTotal        = penalizaciones.reduce((s, p) => s + p.monto_cop, 0)
  const responsablesUnicos = new Set(penalizaciones.flatMap(p => p.responsables)).size

  return (
    <div className="space-y-4">
      {/* Header + botón */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertOctagon size={18} className="text-red-500" />
          <h2 className="text-base font-bold text-slate-800">Penalizaciones</h2>
        </div>
        {isAdmin && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
          >
            <Plus size={14} /> Nueva penalización
          </button>
        )}
      </div>

      {/* Formulario nueva */}
      {showForm && (
        <FormPenalizacion
          requerimientoId={requerimientoId}
          perfiles={perfiles}
          onSaved={() => { setShowForm(false); refresh() }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* Resumen */}
      {penalizaciones.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-red-100 bg-red-50/60 px-4 py-3">
            <p className="text-xs font-medium text-red-400">Total registros</p>
            <p className="text-2xl font-bold text-red-600 mt-0.5">{penalizaciones.length}</p>
          </div>
          <div className="rounded-xl border border-orange-100 bg-orange-50/60 px-4 py-3">
            <p className="text-xs font-medium text-orange-400">Funcionarios afectados</p>
            <p className="text-2xl font-bold text-orange-600 mt-0.5">{responsablesUnicos}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-xs font-medium text-slate-400">Penalización total</p>
            <p className="text-lg font-bold text-slate-800 mt-0.5">
              {montoTotal > 0 ? formatCOP(montoTotal) : '—'}
            </p>
          </div>
        </div>
      )}

      {/* Lista */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
        </div>
      ) : penalizaciones.length === 0 && !showForm ? (
        <div className="rounded-xl border border-slate-200 bg-white py-14 text-center">
          <AlertOctagon size={30} className="mx-auto mb-2 text-slate-200" />
          <p className="text-sm font-semibold text-slate-500">Sin penalizaciones registradas</p>
          <p className="text-xs text-slate-400 mt-1">
            {isAdmin ? 'Usa el botón "Nueva penalización" para registrar una.' : 'No se han registrado penalizaciones para este requerimiento.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {penalizaciones.map(p => (
            <CardPenalizacion
              key={p.id}
              pen={p}
              perfiles={perfiles}
              isAdmin={isAdmin}
              onRefresh={refresh}
            />
          ))}
        </div>
      )}
    </div>
  )
}
