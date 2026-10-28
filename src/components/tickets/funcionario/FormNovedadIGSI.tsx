'use client'

import { Controller, useFormContext, useWatch } from 'react-hook-form'
import { ChevronRight } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { ACCIONES_IGSI, CADENA_IGSI, IMPACTOS_OPERACION_IGSI } from '@/lib/tickets/constantes'
import type { ServiciosIGSI } from '@/lib/tickets/types'
import { cn } from '@/lib/utils'
import { CADENA_VISUAL, SELECT_CLASS, type FormularioTicket } from './formulario-ticket'

const labelDoc = (v: string) => CADENA_IGSI.find(c => c.value === v)?.label ?? v

function MsgError({ msg }: { msg?: string }) {
  return msg ? <p className="text-xs text-red-600">{msg}</p> : null
}

function Req() {
  return <span className="ml-0.5 text-red-500">*</span>
}

/** Formulario propio de Novedades IGSI (tabla tIgsiReporte de la especificación) */
export function FormNovedadIGSI({ servicios }: { servicios: ServiciosIGSI }) {
  const { register, control, setValue, formState: { errors } } = useFormContext<FormularioTicket>()
  const e = errors.igsi
  const tipoDoc = useWatch({ control, name: 'igsi.tipo_documento' })
  const sinNumero = useWatch({ control, name: 'igsi.sin_numero' })
  const servicio = useWatch({ control, name: 'igsi.servicio' })
  const nombresServicio = Object.keys(servicios)
  const hayCatalogo = nombresServicio.length > 0
  const modalidades = servicio ? (servicios[servicio] ?? []) : []

  const idxDoc = CADENA_VISUAL.indexOf(tipoDoc as (typeof CADENA_VISUAL)[number])
  const anteriores = idxDoc > 0 ? CADENA_VISUAL.slice(0, idxDoc) : []

  const elegirDoc = (v: string) => {
    setValue('igsi.tipo_documento', v, { shouldValidate: true, shouldDirty: true })
    setValue('igsi.relacionados', {}, { shouldDirty: true })
  }

  return (
    <div className="space-y-5 rounded-xl border border-blue-200 bg-blue-50/40 p-4">
      <div>
        <p className="text-sm font-semibold text-blue-900">Detalle de la novedad en IGSI</p>
        <p className="text-xs text-blue-800/80">Entre más completo el reporte, más rápido se resuelve. Incluye capturas de la pantalla completa.</p>
      </div>

      {/* Documento afectado: cadena SS → DO → Remesa → Manifiesto */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-slate-700">Documento afectado<Req /></Label>
        <div className="flex flex-wrap items-center gap-1" role="radiogroup" aria-label="Documento afectado">
          {CADENA_VISUAL.map((d, i) => {
            const activo = tipoDoc === d
            const previo = idxDoc >= 0 && i < idxDoc
            return (
              <div key={d} className="flex items-center gap-1">
                <button
                  type="button"
                  role="radio"
                  aria-checked={activo}
                  onClick={() => elegirDoc(d)}
                  className={cn(
                    'rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors',
                    activo ? 'border-blue-600 bg-blue-600 text-white'
                      : previo ? 'border-blue-300 bg-blue-100 text-blue-800'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300',
                  )}
                >
                  {labelDoc(d)}
                </button>
                {i < CADENA_VISUAL.length - 1 && <ChevronRight size={14} className="text-slate-400" />}
              </div>
            )
          })}
          <button
            type="button"
            role="radio"
            aria-checked={tipoDoc === 'OTRO'}
            onClick={() => elegirDoc('OTRO')}
            className={cn(
              'ml-2 rounded-lg border px-3 py-1.5 text-sm font-medium',
              tipoDoc === 'OTRO' ? 'border-blue-600 bg-blue-600 text-white' : 'border-dashed border-slate-300 bg-white text-slate-600',
            )}
          >
            Otro
          </button>
        </div>
        <MsgError msg={e?.tipo_documento?.message} />
      </div>

      {tipoDoc && (
        <div className="grid gap-4 sm:grid-cols-2">
          {tipoDoc === 'OTRO' && (
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="igsi-otro" className="text-sm font-medium text-slate-700">¿Cuál documento?<Req /></Label>
              <Input id="igsi-otro" aria-invalid={!!e?.tipo_documento_otro} {...register('igsi.tipo_documento_otro')} />
              <MsgError msg={e?.tipo_documento_otro?.message} />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="igsi-numero" className="text-sm font-medium text-slate-700">
              Número {tipoDoc === 'OTRO' ? 'del documento' : `de ${tipoDoc === 'REMESA' ? 'la' : 'el'} ${labelDoc(tipoDoc)}`}
              {!sinNumero && <Req />}
            </Label>
            <Input id="igsi-numero" disabled={sinNumero} aria-invalid={!!e?.numero_documento} {...register('igsi.numero_documento')} />
            <Controller
              control={control}
              name="igsi.sin_numero"
              render={({ field }) => (
                <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-600">
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={v => {
                      field.onChange(!!v)
                      if (v) setValue('igsi.numero_documento', '')
                    }}
                  />
                  No tiene número: el documento no se pudo crear
                </label>
              )}
            />
            <MsgError msg={e?.numero_documento?.message} />
          </div>

          {anteriores.length > 0 && (
            <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3 sm:col-span-2">
              <p className="text-xs font-medium text-slate-600">
                Documentos anteriores en la cadena (si los conoces): ayudan a ubicar la novedad
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                {anteriores.map(d => (
                  <div key={d} className="space-y-1">
                    <Label htmlFor={`igsi-rel-${d}`} className="text-xs text-slate-600">{labelDoc(d)}</Label>
                    <Input id={`igsi-rel-${d}`} className="h-8" {...register(`igsi.relacionados.${d}`)} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="igsi-servicio" className="text-sm font-medium text-slate-700">Servicio<Req /></Label>
          {hayCatalogo ? (
            <select
              id="igsi-servicio"
              className={SELECT_CLASS}
              aria-invalid={!!e?.servicio}
              {...register('igsi.servicio', { onChange: () => setValue('igsi.modalidad', '') })}
            >
              <option value="">Selecciona…</option>
              {nombresServicio.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          ) : (
            <Input id="igsi-servicio" aria-invalid={!!e?.servicio} {...register('igsi.servicio')} />
          )}
          <MsgError msg={e?.servicio?.message} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="igsi-modalidad" className="text-sm font-medium text-slate-700">Modalidad<Req /></Label>
          {hayCatalogo && modalidades.length > 0 ? (
            <select id="igsi-modalidad" className={SELECT_CLASS} aria-invalid={!!e?.modalidad} {...register('igsi.modalidad')}>
              <option value="">Selecciona…</option>
              {modalidades.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          ) : (
            <Input
              id="igsi-modalidad"
              disabled={hayCatalogo && !servicio}
              placeholder={hayCatalogo && !servicio ? 'Primero elige el servicio' : ''}
              aria-invalid={!!e?.modalidad}
              {...register('igsi.modalidad')}
            />
          )}
          <MsgError msg={e?.modalidad?.message} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="igsi-accion" className="text-sm font-medium text-slate-700">¿Qué estabas haciendo?<Req /></Label>
        <select id="igsi-accion" className={cn(SELECT_CLASS, 'sm:w-64')} aria-invalid={!!e?.accion} {...register('igsi.accion')}>
          <option value="">Selecciona la acción…</option>
          {ACCIONES_IGSI.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
        </select>
        <MsgError msg={e?.accion?.message} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="igsi-paso" className="text-sm font-medium text-slate-700">¿Qué pasó?<Req /></Label>
          <Textarea id="igsi-paso" rows={3} placeholder="Lo que hizo el sistema" aria-invalid={!!e?.que_paso} {...register('igsi.que_paso')} />
          <MsgError msg={e?.que_paso?.message} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="igsi-esperaba" className="text-sm font-medium text-slate-700">¿Qué esperabas?<Req /></Label>
          <Textarea id="igsi-esperaba" rows={3} placeholder="Lo que debía pasar según el proceso" aria-invalid={!!e?.que_esperaba} {...register('igsi.que_esperaba')} />
          <MsgError msg={e?.que_esperaba?.message} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="igsi-error" className="text-sm font-medium text-slate-700">Mensaje de error</Label>
        <Textarea id="igsi-error" rows={2} placeholder="Copia el texto del mensaje, si apareció" {...register('igsi.mensaje_error')} />
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm font-medium text-slate-700">Impacto en la operación<Req /></Label>
        <div className="flex flex-wrap gap-2">
          {IMPACTOS_OPERACION_IGSI.map(i => (
            <label
              key={i.value}
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50"
            >
              <input type="radio" value={i.value} className="accent-blue-600" {...register('igsi.impacto_operacion')} />
              {i.label}
            </label>
          ))}
        </div>
        <MsgError msg={e?.impacto_operacion?.message} />
      </div>

      <Controller
        control={control}
        name="igsi.validacion_previa"
        render={({ field }) => (
          <div className="space-y-1">
            <label className={cn(
              'flex cursor-pointer items-start gap-2 rounded-lg border bg-white p-3 text-sm',
              e?.validacion_previa ? 'border-red-300' : 'border-slate-200',
            )}>
              <Checkbox className="mt-0.5" checked={field.value} onCheckedChange={v => field.onChange(!!v)} />
              <span>
                <strong>Revisé los datos del documento</strong> que digité antes de reportar la novedad.<Req />
              </span>
            </label>
            <MsgError msg={e?.validacion_previa?.message} />
          </div>
        )}
      />
    </div>
  )
}
