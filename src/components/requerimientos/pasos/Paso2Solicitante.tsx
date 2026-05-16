'use client'

import { useState, useRef } from 'react'
import type { UseFormReturn } from 'react-hook-form'
import type { WizardData } from '@/lib/schemas/requerimiento'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { X, Search, UserCheck } from 'lucide-react'
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { PRIORIDADES, PROCESOS_INTERNOS, SLA_DIAS, SUCURSALES } from '@/lib/constants'
import { cn } from '@/lib/utils'
import type { Perfil } from '@/lib/supabase/types'

const ALCANCES = [
  { value: 'IWF' as const, color: 'border-blue-300 bg-blue-50 text-blue-700' },
  { value: 'ILT' as const, color: 'border-green-300 bg-green-50 text-green-700' },
  { value: 'IWG' as const, color: 'border-purple-300 bg-purple-50 text-purple-700' },
]

/* ── Iniciales avatar ────────────────────────────────────────────────────── */
function Iniciales({ nombre }: { nombre: string }) {
  const ini = nombre.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase()
  return (
    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-600">
      {ini}
    </div>
  )
}

/* ── Combobox single-select (Responsable) ────────────────────────────────── */
function BuscadorUsuario({
  usuarios, value, onChange, placeholder, error,
}: {
  usuarios: Perfil[]
  value: string
  onChange: (val: string) => void
  placeholder: string
  error?: string
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen]   = useState(false)
  const inputRef          = useRef<HTMLInputElement>(null)

  const selected = usuarios.find(u => u.email === value)

  const filtered = query.trim().length > 0
    ? usuarios
        .filter(u =>
          u.nombre_completo.toLowerCase().includes(query.toLowerCase()) ||
          u.email.toLowerCase().includes(query.toLowerCase())
        )
        .slice(0, 8)
    : []

  const handleSelect = (u: Perfil) => {
    onChange(u.email)
    setQuery('')
    setOpen(false)
  }

  const handleClear = () => {
    onChange('')
    setQuery('')
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  return (
    <div className="relative">
      {selected ? (
        /* Usuario seleccionado — mostrar chip */
        <div className={cn(
          'flex items-center gap-2.5 rounded-md border bg-white px-3 py-2',
          error ? 'border-red-300' : 'border-slate-200'
        )}>
          <Iniciales nombre={selected.nombre_completo} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-700 leading-tight">{selected.nombre_completo}</p>
            <p className="text-xs text-slate-400 truncate">{selected.email}</p>
          </div>
          <button
            type="button"
            onClick={handleClear}
            className="shrink-0 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-red-400"
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        /* Input de búsqueda */
        <>
          <div className="relative">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              autoComplete="off"
              onChange={e => { setQuery(e.target.value); setOpen(true) }}
              onFocus={() => setOpen(true)}
              onBlur={() => setTimeout(() => setOpen(false), 150)}
              placeholder={placeholder}
              className={cn(
                'w-full rounded-md border bg-white py-2 pl-9 pr-3 text-sm outline-none transition',
                'focus:ring-1',
                error
                  ? 'border-red-300 focus:border-red-400 focus:ring-red-200'
                  : 'border-slate-200 focus:border-blue-400 focus:ring-blue-200'
              )}
            />
          </div>

          {open && (
            <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden">
              {filtered.length > 0 ? (
                <ul className="max-h-52 overflow-y-auto">
                  {filtered.map(u => (
                    <li key={u.id}>
                      <button
                        type="button"
                        onMouseDown={() => handleSelect(u)}
                        className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left hover:bg-blue-50 transition-colors"
                      >
                        <Iniciales nombre={u.nombre_completo} />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-700">{u.nombre_completo}</p>
                          <p className="text-xs text-slate-400 truncate">{u.email}</p>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : query.trim().length > 0 ? (
                <p className="px-4 py-3 text-sm text-slate-400">
                  Sin resultados para <span className="font-medium">"{query}"</span>
                </p>
              ) : null}
            </div>
          )}
        </>
      )}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  )
}

/* ── Combobox multi-select (Partes interesadas) ──────────────────────────── */
function BuscadorMultiUsuario({
  usuarios, values, onChange, placeholder, exclude,
}: {
  usuarios: Perfil[]
  values: string[]
  onChange: (emails: string[]) => void
  placeholder: string
  exclude?: string
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen]   = useState(false)
  const inputRef          = useRef<HTMLInputElement>(null)

  const valuesSet  = new Set(values)
  const disponibles = usuarios.filter(u => u.email !== exclude)

  const filtered = query.trim().length > 0
    ? disponibles
        .filter(u =>
          u.nombre_completo.toLowerCase().includes(query.toLowerCase()) ||
          u.email.toLowerCase().includes(query.toLowerCase())
        )
        .slice(0, 8)
    : []

  const handleSelect = (u: Perfil) => {
    if (valuesSet.has(u.email)) {
      onChange(values.filter(e => e !== u.email))
    } else {
      onChange([...values, u.email])
    }
    setQuery('')
    inputRef.current?.focus()
  }

  const handleRemove = (email: string) => {
    onChange(values.filter(e => e !== email))
  }

  return (
    <div className="space-y-2">
      {/* Chips de seleccionados */}
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
          {values.map(email => {
            const u = usuarios.find(u => u.email === email)
            return (
              <Badge key={email} variant="secondary" className="flex items-center gap-1 py-0.5 text-xs font-medium">
                <UserCheck size={10} className="text-blue-500" />
                {u?.nombre_completo ?? email}
                <button type="button" onClick={() => handleRemove(email)}
                  className="ml-0.5 rounded-full hover:bg-slate-200">
                  <X size={10} />
                </button>
              </Badge>
            )
          })}
        </div>
      )}

      {/* Input de búsqueda */}
      <div className="relative">
        <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          autoComplete="off"
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={placeholder}
          className="w-full rounded-md border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none transition focus:border-blue-400 focus:ring-1 focus:ring-blue-200"
        />

        {open && (
          <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden">
            {filtered.length > 0 ? (
              <ul className="max-h-52 overflow-y-auto">
                {filtered.map(u => {
                  const isSelected = valuesSet.has(u.email)
                  return (
                    <li key={u.id}>
                      <button
                        type="button"
                        onMouseDown={() => handleSelect(u)}
                        className={cn(
                          'flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors',
                          isSelected ? 'bg-blue-50' : 'hover:bg-slate-50'
                        )}
                      >
                        <div className={cn(
                          'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors',
                          isSelected ? 'bg-blue-500 text-white' : 'bg-blue-100 text-blue-600'
                        )}>
                          {u.nombre_completo.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-700">{u.nombre_completo}</p>
                          <p className="text-xs text-slate-400 truncate">{u.email}</p>
                        </div>
                        {isSelected && (
                          <span className="text-xs font-semibold text-blue-500">✓</span>
                        )}
                      </button>
                    </li>
                  )
                })}
              </ul>
            ) : query.trim().length > 0 ? (
              <p className="px-4 py-3 text-sm text-slate-400">
                Sin resultados para <span className="font-medium">"{query}"</span>
              </p>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Paso 2 ──────────────────────────────────────────────────────────────── */
interface Props {
  form: UseFormReturn<WizardData>
  usuarios?: Perfil[]
  isAdmin?: boolean
}

export function Paso2Solicitante({ form, usuarios = [], isAdmin = false }: Props) {
  const { register, watch, setValue, formState: { errors } } = form

  const alcanceActual    = watch('alcance')
  const prioridadActual  = watch('prioridad')
  const partes           = watch('partes_interesadas') ?? []
  const nombreDesarrollo = watch('nombre_desarrollo') ?? ''
  const responsableActual = watch('responsable') ?? ''

  return (
    <div className="space-y-5">

      {/* Empresa / Alcance */}
      <div className="space-y-2">
        <Label>Empresa / Alcance <span className="text-red-500">*</span></Label>
        <div className="flex gap-2">
          {ALCANCES.map(a => (
            <button
              key={a.value}
              type="button"
              onClick={() => setValue('alcance', a.value, { shouldValidate: true })}
              className={cn(
                'rounded-lg border-2 px-5 py-2.5 text-sm font-semibold transition-all',
                alcanceActual === a.value
                  ? cn(a.color, 'ring-2 ring-offset-1')
                  : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
              )}
            >
              {a.value}
            </button>
          ))}
        </div>
        {errors.alcance && <p className="text-xs text-red-500">{errors.alcance.message}</p>}
      </div>

      {/* Sucursal */}
      <div className="space-y-1.5">
        <Label>Sucursal <span className="text-red-500">*</span></Label>
        <Select
          value={watch('sucursal') ?? ''}
          onValueChange={(v: string | null) => setValue('sucursal', v ?? '', { shouldValidate: true })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecciona la sucursal..." />
          </SelectTrigger>
          <SelectContent>
            {SUCURSALES.map(s => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.sucursal && <p className="text-xs text-red-500">{errors.sucursal.message}</p>}
      </div>

      {/* Proceso interno */}
      <div className="space-y-1.5">
        <Label>Proceso interno <span className="text-red-500">*</span></Label>
        <Select
          value={watch('proceso_interno') ?? ''}
          onValueChange={v => setValue('proceso_interno', v as WizardData['proceso_interno'], { shouldValidate: true })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecciona el proceso..." />
          </SelectTrigger>
          <SelectContent>
            {PROCESOS_INTERNOS.map(p => (
              <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.proceso_interno && <p className="text-xs text-red-500">{errors.proceso_interno.message}</p>}
      </div>

      {/* Responsable — combobox con búsqueda */}
      <div className="space-y-1.5">
        <Label>Responsable de la solicitud <span className="text-red-500">*</span></Label>
        <BuscadorUsuario
          usuarios={usuarios}
          value={responsableActual}
          onChange={v => setValue('responsable', v, { shouldValidate: true })}
          placeholder="Buscar por nombre o correo..."
          error={errors.responsable?.message}
        />
      </div>

      {/* Partes interesadas — combobox multi-select */}
      <div className="space-y-1.5">
        <Label>Partes interesadas</Label>
        <BuscadorMultiUsuario
          usuarios={usuarios}
          values={partes}
          onChange={v => setValue('partes_interesadas', v)}
          placeholder="Buscar y agregar partes interesadas..."
          exclude={responsableActual}
        />
        <p className="text-xs text-slate-400">Se usarán para notificaciones automáticas</p>
      </div>

      {/* Nombre del desarrollo */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="nombre_desarrollo">
            Nombre del desarrollo <span className="text-red-500">*</span>
          </Label>
          <span className={cn('text-xs', nombreDesarrollo.length > 280 ? 'text-red-500' : 'text-slate-400')}>
            {nombreDesarrollo.length}/300
          </span>
        </div>
        <input
          id="nombre_desarrollo"
          placeholder="Nombre descriptivo y claro del desarrollo solicitado"
          maxLength={300}
          {...register('nombre_desarrollo')}
          className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-400 focus:ring-1 focus:ring-blue-200"
        />
        {errors.nombre_desarrollo && <p className="text-xs text-red-500">{errors.nombre_desarrollo.message}</p>}
      </div>

      {/* Prioridad — solo admin */}
      {isAdmin && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Prioridad</Label>
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-600 font-medium">
              Solo admin · basada en impacto económico
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[1, 2, 3, 4].map(p => {
              const cfg        = PRIORIDADES[p]
              const seleccionado = prioridadActual === p
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => setValue('prioridad', seleccionado ? null : p, { shouldValidate: false })}
                  className={cn(
                    'rounded-xl border-2 p-3 text-left transition-all',
                    seleccionado
                      ? cn(cfg.bgColor, cfg.borderColor, 'ring-2 ring-offset-1')
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  )}
                >
                  <p className={cn('text-sm font-bold', seleccionado ? cfg.textColor : 'text-slate-600')}>
                    P{p} {cfg.label}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">SLA {SLA_DIAS[p]} días</p>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
