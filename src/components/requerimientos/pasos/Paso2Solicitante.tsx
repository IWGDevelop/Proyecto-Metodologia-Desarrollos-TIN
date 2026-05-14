'use client'

import { useState, KeyboardEvent } from 'react'
import type { UseFormReturn } from 'react-hook-form'
import type { WizardData } from '@/lib/schemas/requerimiento'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { X } from 'lucide-react'
import { PRIORIDADES, PROCESOS_INTERNOS, SLA_DIAS } from '@/lib/constants'
import { cn } from '@/lib/utils'

const ALCANCES = [
  { value: 'IWF' as const, color: 'border-blue-300 bg-blue-50 text-blue-700' },
  { value: 'ILT' as const, color: 'border-green-300 bg-green-50 text-green-700' },
  { value: 'IWG' as const, color: 'border-purple-300 bg-purple-50 text-purple-700' },
]

interface Props {
  form: UseFormReturn<WizardData>
}

export function Paso2Solicitante({ form }: Props) {
  const { register, watch, setValue, formState: { errors } } = form
  const [chipInput, setChipInput] = useState('')

  const alcanceActual = watch('alcance')
  const prioridadActual = watch('prioridad')
  const partes = watch('partes_interesadas') ?? []
  const nombreDesarrollo = watch('nombre_desarrollo') ?? ''

  const agregarChip = () => {
    const v = chipInput.trim()
    if (v && !partes.includes(v)) {
      setValue('partes_interesadas', [...partes, v])
    }
    setChipInput('')
  }

  const handleChipKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); agregarChip() }
    if (e.key === 'Backspace' && !chipInput && partes.length) {
      setValue('partes_interesadas', partes.slice(0, -1))
    }
  }

  const quitarChip = (chip: string) =>
    setValue('partes_interesadas', partes.filter(p => p !== chip))

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
        <Label htmlFor="sucursal">Sucursal <span className="text-red-500">*</span></Label>
        <Input id="sucursal" placeholder="Ej: Bogotá, Medellín, Barranquilla..." {...register('sucursal')} />
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

      {/* Responsable */}
      <div className="space-y-1.5">
        <Label htmlFor="responsable">Responsable de la solicitud <span className="text-red-500">*</span></Label>
        <Input id="responsable" placeholder="Nombre completo del responsable" {...register('responsable')} />
        {errors.responsable && <p className="text-xs text-red-500">{errors.responsable.message}</p>}
      </div>

      {/* Partes interesadas (chips) */}
      <div className="space-y-1.5">
        <Label>Partes interesadas</Label>
        <div className="min-h-[42px] flex flex-wrap items-center gap-1.5 rounded-md border border-input bg-white px-3 py-2 focus-within:ring-2 focus-within:ring-ring">
          {partes.map(p => (
            <Badge key={p} variant="secondary" className="flex items-center gap-1 py-0.5 text-xs">
              {p}
              <button type="button" onClick={() => quitarChip(p)}>
                <X size={11} />
              </button>
            </Badge>
          ))}
          <input
            value={chipInput}
            onChange={e => setChipInput(e.target.value)}
            onKeyDown={handleChipKey}
            onBlur={agregarChip}
            placeholder={partes.length === 0 ? 'Escribe un nombre y presiona Enter...' : ''}
            className="min-w-[120px] flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
          />
        </div>
        <p className="text-xs text-slate-400">Presiona Enter para agregar cada persona</p>
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
