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
import {
  Plus, Trash2, Clock, DollarSign,
  TrendingUp, Info, HelpCircle, CheckCircle2,
} from 'lucide-react'
import { formatCOP, cn } from '@/lib/utils'
import {
  calcularActividad, calcValorAnual, calcTotalCualitativos,
  FRECUENCIA_MENSUAL, BENEFICIOS_CONFIG,
} from '@/lib/schemas/requerimiento'

// ─── Input COP con formato en tiempo real ────────────────────────────────────
function InputCOP({
  value, onChange, placeholder = '0', className,
}: {
  value: number | undefined
  onChange: (n: number) => void
  placeholder?: string
  className?: string
}) {
  const display = value && value > 0
    ? new Intl.NumberFormat('es-CO').format(value)
    : ''

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '')
    onChange(raw ? parseInt(raw, 10) : 0)
  }

  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">$</span>
      <Input
        value={display}
        onChange={handleChange}
        placeholder={placeholder}
        className={cn('pl-7', className)}
        inputMode="numeric"
      />
    </div>
  )
}

const FRECUENCIAS = [
  { value: 'DIARIA',    label: 'Diaria (22 veces/mes)' },
  { value: 'SEMANAL',   label: 'Semanal (4 veces/mes)' },
  { value: 'QUINCENAL', label: 'Quincenal (2 veces/mes)' },
  { value: 'MENSUAL',   label: 'Mensual (1 vez/mes)' },
]

const PERIODICIDADES = [
  { value: 'UNICO',   label: 'Único — se da una sola vez' },
  { value: 'MENSUAL', label: 'Mensual — se repite cada mes' },
  { value: 'ANUAL',   label: 'Anual — se repite cada año' },
]

interface Props {
  form: UseFormReturn<WizardData>
}

export function Paso5ImpactoHH({ form }: Props) {
  const { register, watch, setValue, control } = form
  const { fields, append, remove } = useFieldArray({ control, name: 'actividades' })

  const actividades    = watch('actividades') ?? []
  const salarioGlobal  = watch('salario_promedio_cargo') ?? 0
  const horasLaborales = watch('horas_laborales_mes') ?? 160
  const beneficios     = watch('beneficios') ?? []

  // ─── Cálculo por actividad con salario individual o global ───────────────
  const calcActividad = (act: typeof actividades[0]) => {
    let horas_mes = 0
    try { horas_mes = calcularActividad(act).horas_mes } catch {}
    const salario    = (act.salario_cargo && act.salario_cargo > 0) ? act.salario_cargo : salarioGlobal
    const valorHora  = salario && horasLaborales ? salario / horasLaborales : 0
    const ahorroMes  = horas_mes * valorHora
    return { horas_mes, valorHora, ahorroMes, usaSalarioPropio: !!(act.salario_cargo && act.salario_cargo > 0) }
  }

  const totalHorasMes    = actividades.reduce((s, a) => s + calcActividad(a).horas_mes, 0)
  const totalHorasAnio   = totalHorasMes * 12
  const ahorroMensualHH  = actividades.reduce((s, a) => s + calcActividad(a).ahorroMes, 0)
  const ahorroAnualHH    = ahorroMensualHH * 12
  const valorHoraGlobal  = salarioGlobal && horasLaborales ? salarioGlobal / horasLaborales : 0

  // ─── Cálculos cualitativos ────────────────────────────────────────────────
  const beneficiosMarcados     = beneficios.filter(b => b.marcado)
  const totalAnualCualitativos = calcTotalCualitativos(beneficios)
  const impactoTotal           = ahorroAnualHH + totalAnualCualitativos

  const sumPorPeriodicidad = (p: string) =>
    beneficiosMarcados
      .filter(b => b.periodicidad === p)
      .reduce((s, b) => s + (b.valor_anual_calculado ?? 0), 0)

  const agregarActividad = () =>
    append({
      actividad: '', cargo_ejecuta: '', frecuencia: 'DIARIA',
      tiempo_sin_mejora: 0, tiempo_sin_mejora_unidad: 'MINUTOS',
      tiempo_con_mejora: 0, tiempo_con_mejora_unidad: 'MINUTOS',
    })

  // ─── Toggle de beneficio y recálculo ─────────────────────────────────────
  const toggleBeneficio = (i: number, checked: boolean) => {
    setValue(`beneficios.${i}.marcado`, checked)
    if (!checked) {
      setValue(`beneficios.${i}.valor_anual_calculado`, 0)
    }
  }

  const actualizarValorAnual = (i: number) => {
    const b = beneficios[i]
    if (!b?.marcado || !b.valor_cop || !b.periodicidad) return
    const anual = calcValorAnual(b.valor_cop, b.periodicidad)
    setValue(`beneficios.${i}.valor_anual_calculado`, anual)
  }

  return (
    <div className="space-y-8">
      {/* Card explicativa */}
      <div className="flex gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4">
        <Info size={18} className="mt-0.5 shrink-0 text-blue-500" />
        <p className="text-sm text-blue-700">
          <strong>Calcula el impacto económico</strong> comparando el tiempo actual vs. con la mejora,
          y cuantifica los beneficios adicionales que no se miden en horas hombre.
        </p>
      </div>

      {/* ══ SUB-SECCIÓN A: Actividades ══════════════════════════════════════ */}
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
            <p>Agrega las actividades que se optimizarán o eliminarán con este desarrollo</p>
          </div>
        ) : (
          <div className="space-y-3">
            {fields.map((field, i) => {
              const act  = actividades[i]
              const calc = calcActividad(act)

              return (
                <div key={field.id} className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-500">Actividad #{i + 1}</span>
                    <button type="button" onClick={() => remove(i)} className="text-slate-300 hover:text-red-500">
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <Label className="text-xs">Actividad</Label>
                      <Input placeholder="Ej: Notificación manual al cliente por correo" {...register(`actividades.${i}.actividad`)} />
                    </div>
                    <div>
                      <Label className="text-xs">Cargo que ejecuta</Label>
                      <Input placeholder="Ej: Coordinador Operativo" {...register(`actividades.${i}.cargo_ejecuta`)} />
                    </div>
                    <div>
                      <Label className="text-xs">
                        Salario del cargo (COP)
                        <span className="ml-1 font-normal text-slate-400">
                          {calc.usaSalarioPropio ? '— propio' : salarioGlobal > 0 ? '— usa global' : '— sin salario'}
                        </span>
                      </Label>
                      <InputCOP
                        value={watch(`actividades.${i}.salario_cargo`)}
                        onChange={v => setValue(`actividades.${i}.salario_cargo`, v || undefined)}
                        placeholder={salarioGlobal > 0 ? new Intl.NumberFormat('es-CO').format(salarioGlobal) : 'Salario global'}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Frecuencia</Label>
                      <Select
                        value={watch(`actividades.${i}.frecuencia`) ?? 'DIARIA'}
                        onValueChange={(v: string | null) => v && setValue(`actividades.${i}.frecuencia`, v as 'DIARIA'|'SEMANAL'|'QUINCENAL'|'MENSUAL')}
                      >
                        <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {FRECUENCIAS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Tiempo actual SIN mejora</Label>
                      <div className="flex gap-1.5">
                        <Input type="number" min="0" step="0.5" placeholder="0" className="flex-1"
                          {...register(`actividades.${i}.tiempo_sin_mejora`, { valueAsNumber: true })} />
                        <Select
                          value={watch(`actividades.${i}.tiempo_sin_mejora_unidad`) ?? 'MINUTOS'}
                          onValueChange={(v: string | null) => v && setValue(`actividades.${i}.tiempo_sin_mejora_unidad`, v as 'MINUTOS'|'HORAS')}
                        >
                          <SelectTrigger className="h-9 w-28 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="MINUTOS">Minutos</SelectItem>
                            <SelectItem value="HORAS">Horas</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">Tiempo estimado CON mejora</Label>
                      <div className="flex gap-1.5">
                        <Input type="number" min="0" step="0.5" placeholder="0" className="flex-1"
                          {...register(`actividades.${i}.tiempo_con_mejora`, { valueAsNumber: true })} />
                        <Select
                          value={watch(`actividades.${i}.tiempo_con_mejora_unidad`) ?? 'MINUTOS'}
                          onValueChange={(v: string | null) => v && setValue(`actividades.${i}.tiempo_con_mejora_unidad`, v as 'MINUTOS'|'HORAS')}
                        >
                          <SelectTrigger className="h-9 w-28 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="MINUTOS">Minutos</SelectItem>
                            <SelectItem value="HORAS">Horas</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Resultado por actividad */}
                    <div className="sm:col-span-2 grid grid-cols-3 gap-2">
                      <div className="rounded-lg bg-slate-50 p-2.5 text-xs text-slate-600">
                        <p className="text-slate-400">Valor hora</p>
                        <p className="font-bold">{formatCOP(calc.valorHora)}</p>
                      </div>
                      <div className="rounded-lg bg-emerald-50 p-2.5 text-xs text-emerald-700">
                        <p className="text-emerald-500">Horas / mes</p>
                        <p className="font-bold">{calc.horas_mes.toFixed(2)} h</p>
                      </div>
                      <div className={cn('rounded-lg p-2.5 text-xs', calc.ahorroMes > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-50 text-slate-400')}>
                        <p className={calc.ahorroMes > 0 ? 'text-emerald-600' : ''}>Ahorro / mes</p>
                        <p className="font-bold">{calc.ahorroMes > 0 ? formatCOP(calc.ahorroMes) : '—'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}

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

      {/* ══ SUB-SECCIÓN B: Valorización ═════════════════════════════════════ */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-700">Valorización económica</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-3 rounded-xl border border-slate-200 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Salario global (por defecto)</p>
            <p className="text-xs text-slate-400">Se aplica a las actividades que no tengan salario propio definido.</p>
            <div className="space-y-1.5">
              <Label className="text-xs">Salario mensual por defecto (COP)</Label>
              <Input type="number" min="0" placeholder="Ej: 3500000"
                {...register('salario_promedio_cargo', { valueAsNumber: true })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Horas laborales al mes</Label>
              <Input type="number" min="1" placeholder="160"
                {...register('horas_laborales_mes', { valueAsNumber: true })} />
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Valor hora global calculado</p>
              <p className="text-lg font-bold text-slate-700">{formatCOP(valorHoraGlobal)}</p>
            </div>
          </div>
          <div className="space-y-3 rounded-xl border border-slate-200 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Proyección ahorro HH</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-slate-500">
                <span>Horas ahorradas / mes</span>
                <span className="font-medium text-blue-600">{totalHorasMes.toFixed(1)} h</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Ahorro por actividades</span>
                <span className="text-xs text-slate-400">(salario individual o global)</span>
              </div>
              <div className="border-t border-slate-200 pt-2" />
              <div className="flex justify-between">
                <span className="font-semibold text-slate-700">Ahorro mensual HH</span>
                <span className="text-lg font-bold text-emerald-600">{formatCOP(ahorroMensualHH)}</span>
              </div>
              <div className="flex justify-between rounded-lg bg-emerald-50 px-3 py-2">
                <span className="font-semibold text-slate-700">Ahorro anual HH</span>
                <span className="text-xl font-bold text-emerald-700">{formatCOP(ahorroAnualHH)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ══ SUB-SECCIÓN C: Beneficios cualitativos con cuantificación ═══════ */}
      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-700">
            Beneficios adicionales — Cuantificación económica
          </h3>
          <p className="mt-0.5 text-xs text-slate-400">
            Para cada beneficio identificado, estime el valor económico aproximado que representaría
            para la empresa y justifique cómo llegó a ese valor.
          </p>
        </div>

        <div className="space-y-2">
          {BENEFICIOS_CONFIG.map((cfg, i) => {
            const b = beneficios[i]
            const marcado = b?.marcado ?? false
            const esOtro  = cfg.id === 'otro'

            return (
              <div
                key={cfg.id}
                className={cn(
                  'overflow-hidden rounded-xl border-2 transition-all duration-300',
                  marcado
                    ? 'border-blue-400 bg-blue-50 shadow-sm'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                )}
              >
                {/* Header siempre visible */}
                <label className="flex cursor-pointer items-center gap-3 px-4 py-3">
                  <Checkbox
                    checked={marcado}
                    onCheckedChange={v => toggleBeneficio(i, !!v)}
                  />
                  <span className="text-base">{cfg.icono}</span>
                  <span className={cn('flex-1 text-sm font-medium', marcado ? 'text-blue-800' : 'text-slate-700')}>
                    {esOtro && marcado && b?.nombre_beneficio
                      ? b.nombre_beneficio
                      : cfg.nombre}
                  </span>
                  {marcado && (
                    <CheckCircle2 size={16} className="shrink-0 text-blue-500" />
                  )}
                </label>

                {/* Contenido expandible */}
                <div className={cn(
                  'overflow-hidden transition-all duration-300',
                  marcado ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0'
                )}>
                  <div className="space-y-4 border-t border-blue-200 px-4 pb-4 pt-3">
                    {/* Nombre personalizado (solo "Otro") */}
                    {esOtro && (
                      <div className="space-y-1">
                        <Label className="text-xs font-medium">
                          Nombre del beneficio <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          placeholder="Ej: Reducción de tiempo de onboarding de clientes"
                          {...register(`beneficios.${i}.nombre_beneficio`)}
                        />
                      </div>
                    )}

                    {/* Descripción */}
                    <div className="space-y-1">
                      <Label className="text-xs font-medium">
                        Descripción del beneficio <span className="text-red-500">*</span>
                      </Label>
                      <Textarea
                        rows={2}
                        placeholder="¿En qué consiste este beneficio para la empresa? ¿Cómo impacta la operación o al cliente?"
                        {...register(`beneficios.${i}.descripcion`)}
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      {/* Valor COP */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <Label className="text-xs font-medium">
                            Valor económico estimado (COP) <span className="text-red-500">*</span>
                          </Label>
                          <div className="group relative">
                            <HelpCircle size={12} className="cursor-help text-slate-400" />
                            <div className="absolute bottom-full left-1/2 z-10 mb-1 hidden w-56 -translate-x-1/2 rounded-lg border border-slate-200 bg-white p-2.5 text-xs text-slate-600 shadow-lg group-hover:block">
                              Estime el beneficio en pesos. No necesita ser exacto,
                              un aproximado bien justificado es suficiente para priorizar el desarrollo.
                            </div>
                          </div>
                        </div>
                        <InputCOP
                          value={b?.valor_cop}
                          onChange={v => {
                            setValue(`beneficios.${i}.valor_cop`, v)
                            const periodo = beneficios[i]?.periodicidad
                            if (periodo) setValue(`beneficios.${i}.valor_anual_calculado`, calcValorAnual(v, periodo))
                          }}
                        />
                        <p className="text-xs text-slate-400">Ingrese el valor en pesos colombianos</p>
                      </div>

                      {/* Periodicidad */}
                      <div className="space-y-1">
                        <Label className="text-xs font-medium">
                          Periodicidad del beneficio <span className="text-red-500">*</span>
                        </Label>
                        <div className="space-y-1.5">
                          {PERIODICIDADES.map(p => (
                            <label key={p.value} className="flex cursor-pointer items-center gap-2 text-xs">
                              <input
                                type="radio"
                                name={`periodicidad_${i}`}
                                value={p.value}
                                checked={b?.periodicidad === p.value}
                                onChange={() => {
                                  setValue(`beneficios.${i}.periodicidad`, p.value as 'UNICO' | 'MENSUAL' | 'ANUAL')
                                  const cop = beneficios[i]?.valor_cop ?? 0
                                  setValue(`beneficios.${i}.valor_anual_calculado`, calcValorAnual(cop, p.value))
                                }}
                                className="accent-blue-600"
                              />
                              <span className="text-slate-600">{p.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Valor anual calculado */}
                    {b?.valor_cop && b?.periodicidad && (
                      <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-2.5">
                        <span className="text-sm text-emerald-700">Valor proyectado anual:</span>
                        <span className="text-lg font-bold text-emerald-700">
                          {formatCOP(calcValorAnual(b.valor_cop, b.periodicidad))} COP
                        </span>
                        <span className="text-emerald-400">🟢</span>
                      </div>
                    )}

                    {/* Justificación */}
                    <div className="space-y-1">
                      <Label className="text-xs font-medium">
                        Justificación del valor estimado <span className="text-red-500">*</span>
                      </Label>
                      <Textarea
                        rows={3}
                        placeholder={`Explique cómo llegó a este valor.\nEj: Se estima evitar 3 multas anuales de $2M c/u por incumplimiento regulatorio. Fuente: historial de sanciones 2023.`}
                        {...register(`beneficios.${i}.justificacion`)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Totalizador de beneficios cualitativos */}
        {beneficiosMarcados.length > 0 && (
          <div className="rounded-xl border border-emerald-200 bg-white p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Total beneficios cualitativos
            </p>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-slate-500">
                <span>Beneficios identificados</span>
                <span className="font-semibold text-slate-700">{beneficiosMarcados.length}</span>
              </div>
              {sumPorPeriodicidad('UNICO') > 0 && (
                <div className="flex justify-between text-slate-500">
                  <span>Beneficios únicos</span>
                  <span className="font-medium">{formatCOP(sumPorPeriodicidad('UNICO'))}</span>
                </div>
              )}
              {sumPorPeriodicidad('MENSUAL') > 0 && (
                <div className="flex justify-between text-slate-500">
                  <span>Beneficios mensuales × 12</span>
                  <span className="font-medium">{formatCOP(sumPorPeriodicidad('MENSUAL'))}</span>
                </div>
              )}
              {sumPorPeriodicidad('ANUAL') > 0 && (
                <div className="flex justify-between text-slate-500">
                  <span>Beneficios anuales</span>
                  <span className="font-medium">{formatCOP(sumPorPeriodicidad('ANUAL'))}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-slate-200 pt-2 text-base">
                <span className="font-semibold text-slate-700">Total anual cualitativos</span>
                <span className="font-bold text-emerald-700">{formatCOP(totalAnualCualitativos)}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ══ SUB-SECCIÓN D: Resumen ROI total ════════════════════════════════ */}
      <div className="rounded-xl bg-gradient-to-br from-emerald-700 to-emerald-900 p-5 text-white">
        <p className="mb-4 text-sm font-semibold uppercase tracking-wide text-emerald-200">
          Resumen de impacto total
        </p>

        {/* Bloque HH */}
        <div className="mb-3">
          <p className="mb-2 text-xs font-medium text-emerald-300">── Ahorro en horas hombre ──</p>
          <div className="grid grid-cols-3 gap-2">
            {[
              { icon: Clock,      label: 'Horas / mes',    valor: `${totalHorasMes.toFixed(1)} h` },
              { icon: DollarSign, label: 'Ahorro mensual', valor: formatCOP(ahorroMensualHH) },
              { icon: TrendingUp, label: 'Ahorro anual',   valor: formatCOP(ahorroAnualHH) },
            ].map(({ icon: Icon, label, valor }) => (
              <div key={label} className="rounded-lg bg-white/10 p-2.5">
                <Icon size={13} className="mb-1 text-emerald-300" />
                <p className="text-[10px] text-emerald-300">{label}</p>
                <p className="text-sm font-bold">{valor}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Bloque cualitativos */}
        {beneficiosMarcados.length > 0 && (
          <div className="mb-3">
            <p className="mb-2 text-xs font-medium text-emerald-300">── Beneficios cualitativos cuantificados ──</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-white/10 p-2.5">
                <CheckCircle2 size={13} className="mb-1 text-emerald-300" />
                <p className="text-[10px] text-emerald-300">Beneficios identificados</p>
                <p className="text-sm font-bold">{beneficiosMarcados.length}</p>
              </div>
              <div className="rounded-lg bg-white/10 p-2.5">
                <DollarSign size={13} className="mb-1 text-emerald-300" />
                <p className="text-[10px] text-emerald-300">Valor anual cualitativos</p>
                <p className="text-sm font-bold">{formatCOP(totalAnualCualitativos)}</p>
              </div>
            </div>
          </div>
        )}

        {/* Total */}
        <div className="rounded-xl border border-emerald-400/50 bg-white/15 px-4 py-3">
          <p className="text-xs text-emerald-300">🏆 IMPACTO ECONÓMICO TOTAL ANUAL</p>
          <p className="text-2xl font-extrabold">{formatCOP(impactoTotal)}</p>
          {beneficiosMarcados.length > 0 && (
            <p className="mt-0.5 text-xs text-emerald-400">
              Ahorro HH + Beneficios cualitativos
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
