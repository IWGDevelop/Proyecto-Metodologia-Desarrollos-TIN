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
import { Plus, Trash2, Clock, DollarSign, TrendingUp, Info } from 'lucide-react'
import { formatCOP, cn } from '@/lib/utils'
import { calcularActividad, FRECUENCIA_MENSUAL, BENEFICIOS_OPCIONES } from '@/lib/schemas/requerimiento'

const FRECUENCIAS = [
  { value: 'DIARIA', label: 'Diaria (22 veces/mes)' },
  { value: 'SEMANAL', label: 'Semanal (4 veces/mes)' },
  { value: 'QUINCENAL', label: 'Quincenal (2 veces/mes)' },
  { value: 'MENSUAL', label: 'Mensual (1 vez/mes)' },
]

interface Props {
  form: UseFormReturn<WizardData>
}

export function Paso5ImpactoHH({ form }: Props) {
  const { register, watch, setValue, control } = form
  const { fields, append, remove } = useFieldArray({ control, name: 'actividades' })

  const actividades = watch('actividades') ?? []
  const salario = watch('salario_promedio_cargo') ?? 0
  const horasLaborales = watch('horas_laborales_mes') ?? 192
  const beneficios = watch('beneficios') ?? []

  // Cálculos en tiempo real
  const totalHorasMes = actividades.reduce((sum, act) => {
    try { return sum + calcularActividad(act).horas_mes } catch { return sum }
  }, 0)
  const totalHorasAnio = totalHorasMes * 12
  const valorHoraHombre = salario && horasLaborales ? salario / horasLaborales : 0
  const ahorroMensual = totalHorasMes * valorHoraHombre
  const ahorroAnual = ahorroMensual * 12
  const beneficiosSeleccionados = beneficios.filter(b => b.seleccionado).length

  const agregarActividad = () =>
    append({
      actividad: '', cargo_ejecuta: '', frecuencia: 'DIARIA',
      tiempo_sin_mejora: 0, tiempo_sin_mejora_unidad: 'MINUTOS',
      tiempo_con_mejora: 0, tiempo_con_mejora_unidad: 'MINUTOS',
    })

  return (
    <div className="space-y-8">
      {/* Card explicativa */}
      <div className="flex gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4">
        <Info size={18} className="mt-0.5 shrink-0 text-blue-500" />
        <p className="text-sm text-blue-700">
          <strong>Calcula el impacto económico</strong> comparando el tiempo que se invierte hoy vs. con la mejora implementada. Esta información es clave para priorizar el desarrollo.
        </p>
      </div>

      {/* ── SUB-SECCIÓN A: Actividades ───────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-700">Actividades impactadas</h3>
            <p className="text-xs text-slate-400">Actividades que se optimizarán con este desarrollo</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={agregarActividad} className="gap-1.5 text-xs">
            <Plus size={13} /> Agregar actividad
          </Button>
        </div>

        {fields.length === 0 ? (
          <div
            className="cursor-pointer rounded-xl border-2 border-dashed border-slate-200 p-8 text-center text-sm text-slate-400 hover:border-blue-300"
            onClick={agregarActividad}
          >
            <Clock size={24} className="mx-auto mb-2" />
            <p>Agrega las actividades que se ahorrarán o mejorarán con este desarrollo</p>
          </div>
        ) : (
          <div className="space-y-3">
            {fields.map((field, i) => {
              const act = actividades[i]
              let horasMes = 0
              try { horasMes = calcularActividad(act).horas_mes } catch {}

              return (
                <div key={field.id} className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-500">Actividad #{i + 1}</span>
                    <button type="button" onClick={() => remove(i)} className="text-slate-300 hover:text-red-500">
                      <Trash2 size={14} />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {/* Actividad */}
                    <div className="sm:col-span-2">
                      <Label className="text-xs">Actividad</Label>
                      <Input
                        placeholder="Ej: Notificación manual al cliente por correo"
                        {...register(`actividades.${i}.actividad`)}
                      />
                    </div>

                    {/* Cargo y Frecuencia */}
                    <div>
                      <Label className="text-xs">Cargo que ejecuta</Label>
                      <Input placeholder="Ej: Coordinador Operativo" {...register(`actividades.${i}.cargo_ejecuta`)} />
                    </div>
                    <div>
                      <Label className="text-xs">Frecuencia</Label>
                      <Select
                        value={watch(`actividades.${i}.frecuencia`) ?? 'DIARIA'}
                        onValueChange={v => setValue(`actividades.${i}.frecuencia`, v as 'DIARIA'|'SEMANAL'|'QUINCENAL'|'MENSUAL')}
                      >
                        <SelectTrigger className="h-9 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FRECUENCIAS.map(f => (
                            <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Tiempo sin mejora */}
                    <div>
                      <Label className="text-xs">Tiempo actual SIN mejora</Label>
                      <div className="flex gap-1.5">
                        <Input
                          type="number" min="0" step="0.5"
                          placeholder="0"
                          className="flex-1"
                          {...register(`actividades.${i}.tiempo_sin_mejora`, { valueAsNumber: true })}
                        />
                        <Select
                          value={watch(`actividades.${i}.tiempo_sin_mejora_unidad`) ?? 'MINUTOS'}
                          onValueChange={v => setValue(`actividades.${i}.tiempo_sin_mejora_unidad`, v as 'MINUTOS'|'HORAS')}
                        >
                          <SelectTrigger className="h-9 w-28 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="MINUTOS">Minutos</SelectItem>
                            <SelectItem value="HORAS">Horas</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Tiempo con mejora */}
                    <div>
                      <Label className="text-xs">Tiempo estimado CON mejora</Label>
                      <div className="flex gap-1.5">
                        <Input
                          type="number" min="0" step="0.5"
                          placeholder="0"
                          className="flex-1"
                          {...register(`actividades.${i}.tiempo_con_mejora`, { valueAsNumber: true })}
                        />
                        <Select
                          value={watch(`actividades.${i}.tiempo_con_mejora_unidad`) ?? 'MINUTOS'}
                          onValueChange={v => setValue(`actividades.${i}.tiempo_con_mejora_unidad`, v as 'MINUTOS'|'HORAS')}
                        >
                          <SelectTrigger className="h-9 w-28 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="MINUTOS">Minutos</SelectItem>
                            <SelectItem value="HORAS">Horas</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Calculados */}
                    <div className="rounded-lg bg-emerald-50 p-2.5 text-xs text-emerald-700">
                      <span className="font-medium">Horas ahorradas / mes: </span>
                      <span className="text-base font-bold">{horasMes.toFixed(2)} h</span>
                    </div>
                  </div>
                </div>
              )
            })}

            {/* Total actividades */}
            <div className="flex items-center justify-end gap-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="text-center">
                <p className="text-xs text-emerald-600">Total horas / MES</p>
                <p className="text-2xl font-bold text-emerald-700">{totalHorasMes.toFixed(1)} h</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-emerald-600">Total horas / AÑO</p>
                <p className="text-2xl font-bold text-emerald-700">{totalHorasAnio.toFixed(1)} h</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── SUB-SECCIÓN B: Valorización ─────────────────────────────────── */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-700">Valorización económica</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Columna izquierda */}
          <div className="space-y-3 rounded-xl border border-slate-200 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Valor de la hora hombre</p>
            <div className="space-y-1.5">
              <Label className="text-xs">Salario mensual promedio del cargo (COP)</Label>
              <Input
                type="number" min="0" placeholder="Ej: 3500000"
                {...register('salario_promedio_cargo', { valueAsNumber: true })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Horas laborales al mes</Label>
              <Input
                type="number" min="1" placeholder="192"
                {...register('horas_laborales_mes', { valueAsNumber: true })}
              />
            </div>
            <div className="rounded-lg bg-emerald-50 p-3">
              <p className="text-xs text-slate-500">Valor hora hombre calculado</p>
              <p className="text-lg font-bold text-emerald-700">{formatCOP(valorHoraHombre)}</p>
            </div>
          </div>

          {/* Columna derecha */}
          <div className="space-y-3 rounded-xl border border-slate-200 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Proyección de ahorro</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-slate-500">
                <span>Horas ahorradas / mes</span>
                <span className="font-medium text-blue-600">{totalHorasMes.toFixed(1)} h</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>× Valor hora hombre</span>
                <span className="font-medium">{formatCOP(valorHoraHombre)}</span>
              </div>
              <div className="border-t border-slate-200 pt-2" />
              <div className="flex justify-between">
                <span className="font-semibold text-slate-700">Ahorro mensual</span>
                <span className="text-lg font-bold text-emerald-600">{formatCOP(ahorroMensual)}</span>
              </div>
              <div className="flex justify-between rounded-lg bg-emerald-50 px-3 py-2">
                <span className="font-semibold text-slate-700">Ahorro anual</span>
                <span className="text-xl font-bold text-emerald-700">{formatCOP(ahorroAnual)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── SUB-SECCIÓN C: Beneficios cualitativos ──────────────────────── */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-700">Beneficios adicionales identificados</h3>
        <div className="space-y-2">
          {BENEFICIOS_OPCIONES.map((tipo, i) => {
            const seleccionado = beneficios[i]?.seleccionado ?? false
            return (
              <div key={tipo} className={cn(
                'rounded-lg border p-3 transition-colors',
                seleccionado ? 'border-blue-200 bg-blue-50' : 'border-slate-200 bg-white'
              )}>
                <label className="flex cursor-pointer items-center gap-3">
                  <Checkbox
                    checked={seleccionado}
                    onCheckedChange={v => setValue(`beneficios.${i}.seleccionado`, !!v)}
                  />
                  <span className="text-sm font-medium text-slate-700">{tipo}</span>
                </label>
                {seleccionado && (
                  <Textarea
                    className="mt-2 text-xs"
                    rows={2}
                    placeholder="Describe brevemente este beneficio..."
                    {...register(`beneficios.${i}.descripcion`)}
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── SUB-SECCIÓN D: Resumen ROI ──────────────────────────────────── */}
      <div className="rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-800 p-5 text-white">
        <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-emerald-200">Resumen de impacto</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { icon: Clock, label: 'Horas ahorradas/mes', valor: `${totalHorasMes.toFixed(1)} h` },
            { icon: DollarSign, label: 'Ahorro mensual', valor: formatCOP(ahorroMensual) },
            { icon: TrendingUp, label: 'Ahorro anual', valor: formatCOP(ahorroAnual) },
            { icon: Info, label: 'Beneficios adicionales', valor: `${beneficiosSeleccionados} identificados` },
          ].map(({ icon: Icon, label, valor }) => (
            <div key={label} className="rounded-lg bg-white/10 p-3">
              <Icon size={14} className="mb-1 text-emerald-300" />
              <p className="text-xs text-emerald-300">{label}</p>
              <p className="mt-0.5 text-sm font-bold">{valor}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
