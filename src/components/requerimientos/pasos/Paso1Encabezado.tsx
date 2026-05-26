'use client'

import type { UseFormReturn } from 'react-hook-form'
import type { WizardData } from '@/lib/schemas/requerimiento'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { Hammer, Wrench, Link2, BarChart2, ClipboardList, Sparkles, Globe } from 'lucide-react'
import { ORIGENES_REQUERIMIENTO } from '@/lib/constants'

const TIPOS = [
  {
    value: 'NUEVO_DESARROLLO' as const,
    icono: Hammer,
    titulo: 'Nuevo Desarrollo',
    descripcion: 'Funcionalidad que no existe actualmente en el sistema',
    color: 'border-blue-300 bg-blue-50',
    iconColor: 'text-blue-600',
  },
  {
    value: 'MEJORA' as const,
    icono: Wrench,
    titulo: 'Mejora',
    descripcion: 'Optimización o ajuste de algo que ya existe',
    color: 'border-indigo-300 bg-indigo-50',
    iconColor: 'text-indigo-600',
  },
  {
    value: 'INTEGRACION' as const,
    icono: Link2,
    titulo: 'Integración',
    descripcion: 'Conexión con otro sistema o aplicativo externo',
    color: 'border-violet-300 bg-violet-50',
    iconColor: 'text-violet-600',
  },
  {
    value: 'INFORME' as const,
    icono: BarChart2,
    titulo: 'Informe / Superset',
    descripcion: 'Reporte, dashboard o visualización de información',
    color: 'border-cyan-300 bg-cyan-50',
    iconColor: 'text-cyan-600',
  },
]

interface Props {
  form: UseFormReturn<WizardData>
}

const ICONOS_ORIGEN = {
  LISTA_MEJORAS_PENDIENTES: ClipboardList,
  TIN_NOVA:                 Sparkles,
  DESARROLLO_EXTERNO:       Globe,
}

export function Paso1Encabezado({ form }: Props) {
  const { register, watch, setValue, formState: { errors } } = form
  const tipoActual   = watch('tipo_solicitud')
  const origenActual = watch('origen_requerimiento')

  return (
    <div className="space-y-6">
      {/* Fecha */}
      <div className="space-y-1.5">
        <Label htmlFor="fecha_solicitud">
          Fecha de solicitud <span className="text-red-500">*</span>
        </Label>
        <Input
          id="fecha_solicitud"
          type="date"
          {...register('fecha_solicitud')}
          className="max-w-xs"
        />
        {errors.fecha_solicitud && (
          <p className="text-xs text-red-500">{errors.fecha_solicitud.message}</p>
        )}
      </div>

      {/* Tipo de solicitud */}
      <div className="space-y-3">
        <Label>
          Tipo de solicitud <span className="text-red-500">*</span>
        </Label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {TIPOS.map(({ value, icono: Icono, titulo, descripcion, color, iconColor }) => {
            const seleccionado = tipoActual === value
            return (
              <button
                key={value}
                type="button"
                onClick={() => setValue('tipo_solicitud', value, { shouldValidate: true })}
                className={cn(
                  'flex items-start gap-4 rounded-xl border-2 p-4 text-left transition-all hover:shadow-sm',
                  seleccionado
                    ? 'border-blue-500 bg-blue-50 shadow-sm ring-2 ring-blue-200'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                )}
              >
                <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', seleccionado ? color : 'bg-slate-100')}>
                  <Icono size={20} className={seleccionado ? iconColor : 'text-slate-400'} />
                </div>
                <div>
                  <p className={cn('text-sm font-semibold', seleccionado ? 'text-blue-700' : 'text-slate-700')}>
                    {titulo}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">{descripcion}</p>
                </div>
              </button>
            )
          })}
        </div>
        {errors.tipo_solicitud && (
          <p className="text-xs text-red-500">{errors.tipo_solicitud.message}</p>
        )}
      </div>

      {/* Origen del requerimiento */}
      <div className="space-y-3">
        <Label>
          Origen del requerimiento <span className="text-slate-400 text-xs font-normal">(opcional)</span>
        </Label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {ORIGENES_REQUERIMIENTO.map(({ value, label, color, iconColor }) => {
            const Icono = ICONOS_ORIGEN[value]
            const seleccionado = origenActual === value
            return (
              <button
                key={value}
                type="button"
                onClick={() => setValue(
                  'origen_requerimiento',
                  seleccionado ? null : value as WizardData['origen_requerimiento'],
                  { shouldValidate: true }
                )}
                className={cn(
                  'flex items-start gap-3 rounded-xl border-2 p-4 text-left transition-all hover:shadow-sm',
                  seleccionado
                    ? 'border-blue-500 bg-blue-50 shadow-sm ring-2 ring-blue-200'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                )}
              >
                <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', seleccionado ? color : 'bg-slate-100')}>
                  <Icono size={18} className={seleccionado ? iconColor : 'text-slate-400'} />
                </div>
                <p className={cn('text-sm font-medium leading-snug', seleccionado ? 'text-blue-700' : 'text-slate-700')}>
                  {label}
                </p>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
