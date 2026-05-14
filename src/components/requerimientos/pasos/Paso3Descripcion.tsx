'use client'

import { useState } from 'react'
import type { UseFormReturn } from 'react-hook-form'
import type { WizardData } from '@/lib/schemas/requerimiento'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { SubirAnexos, type AnexoLocal } from '../SubirAnexos'
import { cn } from '@/lib/utils'

const OPERACIONES = [
  { value: 'CONSULTA', label: 'Consulta' },
  { value: 'INSERTA', label: 'Inserta' },
  { value: 'MODIFICA', label: 'Modifica' },
  { value: 'ELIMINA', label: 'Elimina' },
]

interface FieldProps {
  label: string
  helper?: string
  error?: string
  children: React.ReactNode
  required?: boolean
}

function Campo({ label, helper, error, children, required }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <div>
        <Label className="text-sm font-medium text-slate-700">
          {label} {required && <span className="text-red-500">*</span>}
        </Label>
        {helper && <p className="mt-0.5 text-xs text-slate-400">{helper}</p>}
      </div>
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}

interface Props {
  form: UseFormReturn<WizardData>
  anexos: AnexoLocal[]
  onAnexosChange: (a: AnexoLocal[]) => void
  carpetaTemporal: string
}

export function Paso3Descripcion({ form, anexos, onAnexosChange, carpetaTemporal }: Props) {
  const { register, watch, setValue, formState: { errors } } = form
  const integra = watch('integra_otros_aplicativos')
  const operaciones = watch('tipo_operacion_integracion') ?? []

  const toggleOperacion = (op: string) => {
    const next = operaciones.includes(op)
      ? operaciones.filter(o => o !== op)
      : [...operaciones, op]
    setValue('tipo_operacion_integracion', next)
  }

  return (
    <div className="space-y-6">
      {/* a) Situación actual */}
      <Campo
        label="Situación actual / Requerimiento"
        helper="¿Qué problema existe hoy? ¿Por qué se necesita este desarrollo?"
        error={errors.descripcion_situacion_actual?.message}
        required
      >
        <Textarea rows={4} placeholder="Describe la situación actual que motiva esta solicitud..." {...register('descripcion_situacion_actual')} />
      </Campo>

      {/* b) Definición */}
      <Campo
        label="Definición del requerimiento — ¿Qué necesito?"
        helper="Describe detalladamente qué debe hacer el sistema. Ej: Necesito que el sistema permita... / Quiero que..."
        error={errors.definicion_requerimiento?.message}
        required
      >
        <Textarea rows={5} placeholder="Describe con detalle lo que necesitas que haga el sistema..." {...register('definicion_requerimiento')} />
      </Campo>

      {/* c) Objetivo */}
      <Campo
        label="Objetivo — ¿Para qué?"
        helper="¿Qué se logrará con este desarrollo? Ej: Para eliminar la doble digitación de información..."
        error={errors.objetivo?.message}
        required
      >
        <Textarea rows={3} placeholder="¿Cuál es el objetivo principal de este desarrollo?" {...register('objetivo')} />
      </Campo>

      {/* d) Criterios de validación */}
      <Campo
        label="Criterios de validación / Restricciones"
        helper="¿Cómo sabrás que el desarrollo está correcto? Lista las condiciones que DEBE cumplir la solución."
        error={errors.criterios_validacion?.message}
        required
      >
        <Textarea rows={4} placeholder="Liste los criterios que se deben cumplir para aprobar el desarrollo..." {...register('criterios_validacion')} />
      </Campo>

      {/* e) Integración */}
      <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-700">¿Afecta o se integra con otro sistema?</p>
            <p className="text-xs text-slate-400">Activa si este desarrollo requiere interactuar con otro aplicativo</p>
          </div>
          <Switch
            checked={integra}
            onCheckedChange={v => setValue('integra_otros_aplicativos', v)}
          />
        </div>

        {integra && (
          <div className="space-y-3 border-t border-slate-200 pt-3">
            <div className="space-y-1.5">
              <Label className="text-sm">¿Con qué sistema o aplicativo?</Label>
              <Input placeholder="Ej: SAP, Portal Web, App Móvil, ERP..." {...register('detalle_integracion')} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Tipo de operación</Label>
              <div className="flex flex-wrap gap-3">
                {OPERACIONES.map(op => (
                  <label key={op.value} className="flex cursor-pointer items-center gap-2 text-sm">
                    <Checkbox
                      checked={operaciones.includes(op.value)}
                      onCheckedChange={() => toggleOperacion(op.value)}
                    />
                    {op.label}
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* f) Definición de usuarios */}
      <Campo
        label="Definición de usuarios / Roles"
        helper="¿Quiénes usarán esta funcionalidad? Indica perfiles, roles y áreas."
      >
        <Textarea rows={3} placeholder="Ej: Coordinadores de operaciones, analistas del área comercial..." {...register('definicion_usuarios')} />
      </Campo>

      {/* g) Anexos */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium text-slate-700">Anexos y soportes</Label>
        <p className="text-xs text-slate-400">
          Adjunta documentos de soporte, capturas, ejemplos o cualquier archivo relevante
        </p>
        <SubirAnexos
          anexos={anexos}
          onAnexosChange={onAnexosChange}
          carpeta={carpetaTemporal}
        />
      </div>
    </div>
  )
}
