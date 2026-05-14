'use client'

import { useFieldArray } from 'react-hook-form'
import type { UseFormReturn } from 'react-hook-form'
import type { WizardData } from '@/lib/schemas/requerimiento'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Plus, Trash2, Users, Building2, Globe } from 'lucide-react'
import { cn } from '@/lib/utils'

const IMPACTA_OPCIONES = [
  { value: 'FUNCIONARIOS' as const, icon: Users, titulo: 'Solo funcionarios internos', desc: 'Aplica únicamente al personal de la empresa' },
  { value: 'CLIENTES' as const, icon: Building2, titulo: 'Clientes externos', desc: 'Afecta directamente a los clientes' },
  { value: 'AMBOS' as const, icon: Globe, titulo: 'Ambos', desc: 'Funcionarios internos y clientes externos' },
]

const TIPOS_CLIENTE = [
  'Importadores', 'Exportadores', 'Carga terrestre',
  'OTM', 'Todos los tipos',
]

const NIVELES_IMPACTO = ['ALTO', 'MEDIO', 'BAJO']

interface Props {
  form: UseFormReturn<WizardData>
}

export function Paso4Alcance({ form }: Props) {
  const { register, watch, setValue, control, formState: { errors } } = form
  const impacta = watch('impacta')
  const tiposCliente = watch('tipos_cliente') ?? []

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'procesos_cargos',
  })

  const toggleTipoCliente = (tipo: string) => {
    const next = tiposCliente.includes(tipo)
      ? tiposCliente.filter(t => t !== tipo)
      : [...tiposCliente, tipo]
    setValue('tipos_cliente', next)
  }

  const mostrarClientes = impacta === 'CLIENTES' || impacta === 'AMBOS'
  const mostrarFuncionarios = impacta === 'FUNCIONARIOS' || impacta === 'AMBOS'

  return (
    <div className="space-y-6">
      {/* a) Impacta */}
      <div className="space-y-2">
        <Label>¿A quién impacta este desarrollo? <span className="text-red-500">*</span></Label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {IMPACTA_OPCIONES.map(({ value, icon: Icon, titulo, desc }) => {
            const sel = impacta === value
            return (
              <button
                key={value}
                type="button"
                onClick={() => setValue('impacta', value, { shouldValidate: true })}
                className={cn(
                  'flex flex-col items-center gap-2 rounded-xl border-2 p-4 text-center transition-all',
                  sel
                    ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                )}
              >
                <div className={cn('rounded-lg p-2', sel ? 'bg-blue-100' : 'bg-slate-100')}>
                  <Icon size={20} className={sel ? 'text-blue-600' : 'text-slate-400'} />
                </div>
                <div>
                  <p className={cn('text-sm font-semibold', sel ? 'text-blue-700' : 'text-slate-700')}>
                    {titulo}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">{desc}</p>
                </div>
              </button>
            )
          })}
        </div>
        {errors.impacta && <p className="text-xs text-red-500">{errors.impacta.message}</p>}
      </div>

      {/* b) Tipos de cliente */}
      {mostrarClientes && (
        <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <Label>Tipo de clientes impactados</Label>
          <div className="flex flex-wrap gap-3">
            {TIPOS_CLIENTE.map(tipo => (
              <label key={tipo} className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox
                  checked={tiposCliente.includes(tipo)}
                  onCheckedChange={() => toggleTipoCliente(tipo)}
                />
                {tipo}
              </label>
            ))}
          </div>
          <div className="mt-2">
            <Input placeholder="Especifica otro tipo de cliente si aplica..." {...register('detalle_integracion')} />
          </div>
        </div>
      )}

      {/* c) Procesos y cargos */}
      {mostrarFuncionarios && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Procesos y cargos impactados</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => append({ proceso: '', cargo: '', nivel_impacto: 'MEDIO' })}
              className="gap-1.5 text-xs"
            >
              <Plus size={13} /> Agregar fila
            </Button>
          </div>

          {fields.length === 0 ? (
            <div
              className="cursor-pointer rounded-xl border-2 border-dashed border-slate-200 p-6 text-center text-sm text-slate-400 hover:border-blue-300 hover:text-blue-500"
              onClick={() => append({ proceso: '', cargo: '', nivel_impacto: 'MEDIO' })}
            >
              <Plus size={18} className="mx-auto mb-1" />
              Agrega los procesos y cargos que se verán afectados
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Proceso</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Cargo</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Nivel de impacto</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {fields.map((field, i) => (
                    <tr key={field.id}>
                      <td className="px-3 py-2">
                        <Input placeholder="Ej: Coordinación de exportaciones" {...register(`procesos_cargos.${i}.proceso`)} />
                      </td>
                      <td className="px-3 py-2">
                        <Input placeholder="Ej: Coordinador logístico" {...register(`procesos_cargos.${i}.cargo`)} />
                      </td>
                      <td className="px-3 py-2">
                        <Select
                          value={watch(`procesos_cargos.${i}.nivel_impacto`) ?? 'MEDIO'}
                          onValueChange={v => setValue(`procesos_cargos.${i}.nivel_impacto`, v as 'ALTO' | 'MEDIO' | 'BAJO')}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {NIVELES_IMPACTO.map(n => (
                              <SelectItem key={n} value={n}>{n}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-2">
                        <button
                          type="button"
                          onClick={() => remove(i)}
                          className="text-slate-300 hover:text-red-500"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* d) Ventajas y beneficios */}
      <div className="space-y-1.5">
        <Label>
          Ventajas, beneficios y valor agregado <span className="text-red-500">*</span>
        </Label>
        <p className="text-xs text-slate-400">
          ¿Qué mejoras concretas se lograrán? ¿Qué valor agrega a la operación o al cliente?
        </p>
        <Textarea
          rows={4}
          placeholder="Describe los beneficios esperados del desarrollo..."
          {...register('ventajas_beneficios')}
        />
        {errors.ventajas_beneficios && (
          <p className="text-xs text-red-500">{errors.ventajas_beneficios.message}</p>
        )}
      </div>
    </div>
  )
}
