'use client'

import { Controller, useFormContext } from 'react-hook-form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import type { TicketCampoTipologia } from '@/lib/tickets/types'
import { claveCampo, SELECT_CLASS, type FormularioTicket } from './formulario-ticket'

interface Props {
  campo: TicketCampoTipologia
  usuarios: { id: string; nombre_completo: string }[]
}

/** Campo específico de la tipología, renderizado según su tipo_dato */
export function CampoDinamico({ campo, usuarios }: Props) {
  const { register, control, formState: { errors } } = useFormContext<FormularioTicket>()
  const nombre = `valores.${claveCampo(campo.id)}` as const
  const error = (errors.valores as Record<string, { message?: string }> | undefined)?.[claveCampo(campo.id)]?.message
  const id = `campo-${campo.id}`

  const etiqueta = (
    <Label htmlFor={id} className="text-sm font-medium text-slate-700">
      {campo.etiqueta}
      {campo.obligatorio && campo.tipo_dato !== 'CASILLA' && <span className="ml-0.5 text-red-500">*</span>}
    </Label>
  )

  let control_: React.ReactNode
  switch (campo.tipo_dato) {
    case 'TEXTO_LARGO':
      control_ = <Textarea id={id} rows={3} aria-invalid={!!error} {...register(nombre)} />
      break
    case 'NUMERO':
      control_ = <Input id={id} type="number" inputMode="decimal" step="any" aria-invalid={!!error} {...register(nombre)} />
      break
    case 'FECHA':
      control_ = <Input id={id} type="date" aria-invalid={!!error} {...register(nombre)} />
      break
    case 'LISTA':
      control_ = (
        <select id={id} className={SELECT_CLASS} aria-invalid={!!error} {...register(nombre)}>
          <option value="">Selecciona…</option>
          {(campo.opciones ?? []).map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      )
      break
    case 'USUARIO':
      control_ = (
        <select id={id} className={SELECT_CLASS} aria-invalid={!!error} {...register(nombre)}>
          <option value="">Selecciona un funcionario…</option>
          {usuarios.map(u => <option key={u.id} value={u.id}>{u.nombre_completo}</option>)}
        </select>
      )
      break
    case 'CASILLA':
      return (
        <div className="space-y-1">
          <Controller
            control={control}
            name={nombre}
            render={({ field }) => (
              <label htmlFor={id} className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                <Checkbox
                  id={id}
                  checked={field.value === 'true'}
                  onCheckedChange={v => field.onChange(v ? 'true' : 'false')}
                />
                {campo.etiqueta}
              </label>
            )}
          />
          {campo.ayuda && <p className="text-xs text-slate-400">{campo.ayuda}</p>}
        </div>
      )
    default:
      control_ = <Input id={id} aria-invalid={!!error} {...register(nombre)} />
  }

  return (
    <div className="space-y-1.5">
      {etiqueta}
      {control_}
      {campo.ayuda && <p className="text-xs text-slate-400">{campo.ayuda}</p>}
      {campo.es_fecha_requerida && <p className="text-xs text-blue-600">Esta fecha se usa como fecha requerida del ticket</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
