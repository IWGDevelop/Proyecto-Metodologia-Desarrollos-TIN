'use client'

import type { UseFormReturn } from 'react-hook-form'
import type { WizardData } from '@/lib/schemas/requerimiento'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { X } from 'lucide-react'
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

interface Props {
  form: UseFormReturn<WizardData>
  usuarios?: Perfil[]
}

export function Paso2Solicitante({ form, usuarios = [] }: Props) {
  const { register, watch, setValue, formState: { errors } } = form

  const alcanceActual   = watch('alcance')
  const prioridadActual = watch('prioridad')
  const partes          = watch('partes_interesadas') ?? []
  const nombreDesarrollo = watch('nombre_desarrollo') ?? ''
  const responsableActual = watch('responsable') ?? ''

  // Emails ya seleccionados en partes interesadas
  const partesSet = new Set(partes)

  // Agregar/quitar parte interesada por email
  const toggleParte = (email: string) => {
    if (partesSet.has(email)) {
      setValue('partes_interesadas', partes.filter(p => p !== email))
    } else {
      setValue('partes_interesadas', [...partes, email])
    }
  }

  // Usuarios disponibles para partes (excluye al responsable seleccionado)
  const usuariosPartes = usuarios.filter(u => u.email !== responsableActual)

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

      {/* Sucursal — lista desplegable */}
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

      {/* Responsable — select de usuarios del sistema */}
      <div className="space-y-1.5">
        <Label>Responsable de la solicitud <span className="text-red-500">*</span></Label>
        {usuarios.length > 0 ? (
          <Select
            value={responsableActual}
            onValueChange={(v: string | null) => setValue('responsable', v ?? '', { shouldValidate: true })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecciona el responsable..." />
            </SelectTrigger>
            <SelectContent>
              {usuarios.map(u => (
                <SelectItem key={u.id} value={u.email}>
                  <div className="flex flex-col">
                    <span className="font-medium">{u.nombre_completo}</span>
                    <span className="text-xs text-slate-400">{u.email}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Input
            placeholder="Correo o nombre del responsable"
            {...register('responsable')}
          />
        )}
        {errors.responsable && <p className="text-xs text-red-500">{errors.responsable.message}</p>}
      </div>

      {/* Partes interesadas — multi-select de usuarios */}
      <div className="space-y-1.5">
        <Label>Partes interesadas</Label>

        {/* Chips seleccionados */}
        {partes.length > 0 && (
          <div className="flex flex-wrap gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
            {partes.map(email => {
              const u = usuarios.find(u => u.email === email)
              return (
                <Badge key={email} variant="secondary" className="flex items-center gap-1 py-0.5 text-xs">
                  {u?.nombre_completo ?? email}
                  <button type="button" onClick={() => toggleParte(email)}>
                    <X size={11} />
                  </button>
                </Badge>
              )
            })}
          </div>
        )}

        {/* Dropdown para agregar */}
        {usuarios.length > 0 ? (
          <Select
            value=""
            onValueChange={(v: string | null) => { if (v) toggleParte(v) }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Agregar parte interesada..." />
            </SelectTrigger>
            <SelectContent>
              {usuariosPartes.map(u => (
                <SelectItem key={u.id} value={u.email}>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'h-1.5 w-1.5 rounded-full',
                      partesSet.has(u.email) ? 'bg-blue-500' : 'bg-transparent'
                    )} />
                    <div className="flex flex-col">
                      <span className="font-medium">{u.nombre_completo}</span>
                      <span className="text-xs text-slate-400">{u.email}</span>
                    </div>
                    {partesSet.has(u.email) && (
                      <span className="ml-auto text-xs text-blue-600">✓ seleccionado</span>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <p className="text-xs text-slate-400 italic">Sin usuarios registrados en el sistema</p>
        )}
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
        <Input
          id="nombre_desarrollo"
          placeholder="Nombre descriptivo y claro del desarrollo solicitado"
          maxLength={300}
          {...register('nombre_desarrollo')}
        />
        {errors.nombre_desarrollo && <p className="text-xs text-red-500">{errors.nombre_desarrollo.message}</p>}
      </div>

      {/* Prioridad */}
      <div className="space-y-2">
        <Label>Prioridad <span className="text-red-500">*</span></Label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[1, 2, 3, 4].map(p => {
            const cfg = PRIORIDADES[p]
            const seleccionado = prioridadActual === p
            return (
              <button
                key={p}
                type="button"
                onClick={() => setValue('prioridad', p, { shouldValidate: true })}
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
                <p className="mt-0.5 text-xs text-slate-500">
                  Respuesta en {SLA_DIAS[p]} días
                </p>
              </button>
            )
          })}
        </div>
        {errors.prioridad && <p className="text-xs text-red-500">{errors.prioridad.message}</p>}
      </div>
    </div>
  )
}
