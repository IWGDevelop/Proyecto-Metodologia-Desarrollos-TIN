'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, useFieldArray } from 'react-hook-form'
import {
  Brain, Clock, DollarSign, ChevronRight, Plus, Trash2,
  Sparkles, Zap, TrendingUp,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { crearRegistroUsoIA } from '@/actions/registros-uso-ia'
import type { Perfil } from '@/lib/supabase/types'

const HERRAMIENTAS = [
  'ChatGPT', 'Microsoft Copilot', 'Claude (Anthropic)', 'Gemini (Google)',
  'GitHub Copilot', 'Perplexity', 'Midjourney', 'Canva AI', 'Otter.ai',
  'Notion AI', 'Grammarly AI', 'Dall-E', 'Adobe Firefly', 'Otro',
]

const PASOS = [
  { num: 1, label: '¿Qué usé?',     icon: Brain },
  { num: 2, label: 'Cómo lo usé',   icon: Zap },
  { num: 3, label: 'Impacto',        icon: TrendingUp },
]

type Actividad = {
  actividad: string
  min_sin_ia: number
  min_con_ia: number
  veces_mes: number
}

type FormValues = {
  cedula: string
  fecha: string
  herramienta: string
  herramienta_otra: string
  proceso: string
  descripcion: string
  actividades: Actividad[]
  salario_mensual_cop: string
  beneficios_cualitativos: { descripcion: string }[]
}

function calcHoras(a: Actividad): number {
  const diff = Math.max(0, (a.min_sin_ia || 0) - (a.min_con_ia || 0))
  return Math.round(((diff * (a.veces_mes || 0)) / 60) * 10) / 10
}

function fmtCOP(n: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)
}

interface Props { perfil: Perfil | null }

export function FormRegistroUsoIA({ perfil }: Props) {
  const router = useRouter()
  const [paso, setPaso] = useState(1)
  const [isPending, startTransition] = useTransition()

  const { register, control, handleSubmit, watch, trigger, getValues, formState: { errors } } = useForm<FormValues>({
    defaultValues: {
      cedula:                  perfil?.cedula ?? '',
      fecha:                   new Date().toISOString().split('T')[0],
      herramienta:             HERRAMIENTAS[0],
      herramienta_otra:        '',
      proceso:                 perfil?.proceso_interno ?? '',
      descripcion:             '',
      actividades:             [{ actividad: '', min_sin_ia: 0, min_con_ia: 0, veces_mes: 0 }],
      salario_mensual_cop:     '',
      beneficios_cualitativos: [],
    },
  })

  const { fields: actFields, append: appendAct, remove: removeAct } = useFieldArray({ control, name: 'actividades' })
  const { fields: benefFields, append: appendBenef, remove: removeBenef } = useFieldArray({ control, name: 'beneficios_cualitativos' })

  const watchedActs = watch('actividades')
  const watchedSalario = watch('salario_mensual_cop')
  const herramientaSel = watch('herramienta')

  const totalHoras = watchedActs.reduce((sum, a) => sum + calcHoras(a as Actividad), 0)
  const salario = parseFloat(watchedSalario) || 0
  const valorHora = salario > 0 ? salario / 160 : 0
  const ahorro_mensual = Math.round(totalHoras * valorHora)
  const ahorro_anual = ahorro_mensual * 12

  const camposPorPaso: (keyof FormValues)[][] = [
    ['cedula', 'fecha', 'herramienta', 'proceso'],
    ['descripcion'],
    [],
  ]

  async function avanzar() {
    const ok = await trigger(camposPorPaso[paso - 1])
    if (ok) setPaso(p => Math.min(p + 1, 3))
  }
  function retroceder() { setPaso(p => Math.max(p - 1, 1)) }

  function onSubmit(values: FormValues) {
    startTransition(async () => {
      const herramientaFinal = values.herramienta === 'Otro' ? values.herramienta_otra || 'Otro' : values.herramienta
      const actividades = (values.actividades ?? []).map(a => ({
        ...a,
        min_sin_ia:       Number(a.min_sin_ia),
        min_con_ia:       Number(a.min_con_ia),
        veces_mes:        Number(a.veces_mes),
        horas_mes_ahorradas: calcHoras({ ...a, min_sin_ia: Number(a.min_sin_ia), min_con_ia: Number(a.min_con_ia), veces_mes: Number(a.veces_mes) }),
      }))
      const salMensual = parseFloat(values.salario_mensual_cop) || null

      const res = await crearRegistroUsoIA({
        cedula:           values.cedula,
        fecha:            values.fecha,
        herramienta:      herramientaFinal,
        proceso:          values.proceso,
        descripcion:      values.descripcion,
        actividades,
        salario_mensual_cop:     salMensual,
        beneficios_cualitativos: values.beneficios_cualitativos,
      })

      if (!res.ok) { toast.error(res.error ?? 'Error al guardar'); return }
      toast.success('¡Registro guardado! Gracias por reportar tu uso de IA 🎉')
      router.push('/cultura-ia')
      router.refresh()
    })
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Brain size={14} className="text-violet-500" />
          <span>Cultura IA — Registrar uso</span>
        </div>
        <h1 className="mt-1 text-xl font-bold text-slate-900">¿Cómo usé la IA hoy?</h1>
        <p className="mt-0.5 text-sm text-slate-500">Registra tu uso de inteligencia artificial y el ahorro que está generando en tu trabajo.</p>
      </div>

      {/* Stepper */}
      <div className="mb-6 flex items-center">
        {PASOS.map((s, i) => (
          <div key={s.num} className="flex flex-1 items-center">
            <div className="flex flex-col items-center gap-1 flex-1">
              {i > 0 && <div className={`mb-1 h-0.5 w-full ${paso > i ? 'bg-violet-500' : 'bg-slate-200'}`} />}
              <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold
                ${paso === s.num ? 'bg-violet-600 text-white' : paso > s.num ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-400'}`}>
                {s.num}
              </div>
              <span className={`hidden text-[10px] font-medium sm:block ${paso === s.num ? 'text-violet-700' : 'text-slate-400'}`}>
                {s.label}
              </span>
            </div>
            {i < PASOS.length - 1 && (
              <div className={`h-0.5 flex-1 ${paso > s.num ? 'bg-violet-500' : 'bg-slate-200'}`} />
            )}
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

          {/* ── PASO 1 ── */}
          {paso === 1 && (
            <div className="space-y-5">
              <h2 className="text-base font-semibold text-slate-800">¿Qué herramienta de IA usaste?</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Cédula <span className="text-red-500">*</span></Label>
                  <Input
                    {...register('cedula', { required: 'Cédula requerida' })}
                    placeholder="Número de cédula"
                  />
                  {errors.cedula && <p className="text-xs text-red-500">{errors.cedula.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>Fecha <span className="text-red-500">*</span></Label>
                  <Input type="date" {...register('fecha', { required: true })} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Herramienta de IA <span className="text-red-500">*</span></Label>
                <select
                  {...register('herramienta')}
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                >
                  {HERRAMIENTAS.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
              {herramientaSel === 'Otro' && (
                <div className="space-y-1.5">
                  <Label>¿Cuál herramienta?</Label>
                  <Input {...register('herramienta_otra')} placeholder="Nombre de la herramienta" />
                </div>
              )}
              <div className="space-y-1.5">
                <Label>Proceso / área de trabajo <span className="text-red-500">*</span></Label>
                <Input
                  {...register('proceso', { required: 'Proceso requerido' })}
                  placeholder="Ej: Operaciones, Comercial, Financiero..."
                />
                {errors.proceso && <p className="text-xs text-red-500">{errors.proceso.message}</p>}
              </div>
            </div>
          )}

          {/* ── PASO 2 ── */}
          {paso === 2 && (
            <div className="space-y-5">
              <h2 className="text-base font-semibold text-slate-800">¿Cómo lo usaste y qué actividades optimizaste?</h2>

              <div className="space-y-1.5">
                <Label>Describe cómo usaste la IA <span className="text-red-500">*</span></Label>
                <Textarea
                  {...register('descripcion', { required: 'Requerido', minLength: { value: 10, message: 'Mínimo 10 caracteres' } })}
                  rows={3}
                  placeholder="Ej: Usé ChatGPT para redactar correos de seguimiento a clientes, resumir actas de reunión y traducir documentos del proveedor..."
                />
                {errors.descripcion && <p className="text-xs text-red-500">{errors.descripcion.message}</p>}
              </div>

              {/* Actividades con cálculo de tiempo */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <Label>Actividades optimizadas con IA</Label>
                  <button
                    type="button"
                    onClick={() => appendAct({ actividad: '', min_sin_ia: 0, min_con_ia: 0, veces_mes: 0 })}
                    className="flex items-center gap-1 text-xs font-medium text-violet-600 hover:text-violet-800"
                  >
                    <Plus size={13} /> Agregar actividad
                  </button>
                </div>

                {/* Header de columnas */}
                <div className="mb-1 grid grid-cols-[1fr_80px_80px_70px_70px_28px] gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  <span>Actividad</span>
                  <span className="text-center">Sin IA (min)</span>
                  <span className="text-center">Con IA (min)</span>
                  <span className="text-center">Veces/mes</span>
                  <span className="text-center">Hrs/mes</span>
                  <span />
                </div>

                <div className="space-y-1.5">
                  {actFields.map((field, idx) => {
                    const a = watchedActs[idx] as Actividad
                    const horas = calcHoras({ ...a, min_sin_ia: Number(a?.min_sin_ia), min_con_ia: Number(a?.min_con_ia), veces_mes: Number(a?.veces_mes) })
                    return (
                      <div key={field.id} className="grid grid-cols-[1fr_80px_80px_70px_70px_28px] gap-1.5 items-center">
                        <Input
                          {...register(`actividades.${idx}.actividad`)}
                          placeholder="Ej: Redactar correos"
                          className="text-sm"
                        />
                        <Input
                          type="number" min="0"
                          {...register(`actividades.${idx}.min_sin_ia`, { valueAsNumber: true })}
                          className="text-center text-sm"
                        />
                        <Input
                          type="number" min="0"
                          {...register(`actividades.${idx}.min_con_ia`, { valueAsNumber: true })}
                          className="text-center text-sm"
                        />
                        <Input
                          type="number" min="0"
                          {...register(`actividades.${idx}.veces_mes`, { valueAsNumber: true })}
                          className="text-center text-sm"
                        />
                        <div className={`rounded-md px-2 py-1.5 text-center text-sm font-semibold ${horas > 0 ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'}`}>
                          {horas > 0 ? `+${horas}h` : '—'}
                        </div>
                        <button type="button" onClick={() => removeAct(idx)} className="text-slate-300 hover:text-red-400">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )
                  })}
                </div>

                {/* Total */}
                {totalHoras > 0 && (
                  <div className="mt-3 flex items-center gap-2 rounded-xl bg-violet-50 px-4 py-3">
                    <Clock size={16} className="text-violet-500" />
                    <span className="text-sm font-medium text-violet-800">
                      Total ahorrado: <strong>{totalHoras} horas/mes</strong> gracias a la IA
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── PASO 3 ── */}
          {paso === 3 && (
            <div className="space-y-5">
              <h2 className="text-base font-semibold text-slate-800">Impacto económico y cualitativo</h2>

              {/* Impacto económico */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <DollarSign size={15} className="text-emerald-500" /> Calcular ahorro en pesos (opcional)
                </div>
                <div className="space-y-1.5">
                  <Label>Salario mensual COP (bruto aproximado)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="100000"
                    {...register('salario_mensual_cop')}
                    placeholder="Ej: 3500000"
                  />
                  <p className="text-xs text-slate-400">Esta información es privada y se usa solo para calcular el impacto económico.</p>
                </div>

                {totalHoras > 0 && salario > 0 && (
                  <div className="grid grid-cols-3 gap-3 mt-2">
                    <div className="rounded-lg bg-white border border-emerald-200 p-3 text-center">
                      <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">Horas/mes</p>
                      <p className="mt-0.5 text-lg font-bold text-emerald-700">{totalHoras}h</p>
                    </div>
                    <div className="rounded-lg bg-white border border-emerald-200 p-3 text-center">
                      <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">Ahorro/mes</p>
                      <p className="mt-0.5 text-base font-bold text-emerald-700">{fmtCOP(ahorro_mensual)}</p>
                    </div>
                    <div className="rounded-lg bg-white border border-emerald-200 p-3 text-center">
                      <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">Ahorro/año</p>
                      <p className="mt-0.5 text-base font-bold text-emerald-700">{fmtCOP(ahorro_anual)}</p>
                    </div>
                  </div>
                )}

                {totalHoras > 0 && !salario && (
                  <p className="text-xs text-amber-600">💡 Ingresa tu salario para calcular el ahorro en pesos colombianos.</p>
                )}
              </div>

              {/* Beneficios cualitativos */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-1.5">
                    <Sparkles size={13} className="text-violet-500" /> Beneficios cualitativos (opcional)
                  </Label>
                  <button
                    type="button"
                    onClick={() => appendBenef({ descripcion: '' })}
                    className="flex items-center gap-1 text-xs font-medium text-violet-600 hover:text-violet-800"
                  >
                    <Plus size={13} /> Agregar
                  </button>
                </div>
                {benefFields.map((f, idx) => (
                  <div key={f.id} className="flex gap-2">
                    <Input
                      {...register(`beneficios_cualitativos.${idx}.descripcion`)}
                      placeholder="Ej: Mejoró la calidad de los correos, redujo errores en traducción..."
                    />
                    <button type="button" onClick={() => removeBenef(idx)} className="text-slate-300 hover:text-red-400">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                {benefFields.length === 0 && (
                  <p className="text-xs text-slate-400">Puedes agregar beneficios como mejora de calidad, reducción de errores, mayor satisfacción, etc.</p>
                )}
              </div>

              {/* Resumen antes de enviar */}
              <div className="rounded-xl border border-violet-100 bg-violet-50 p-4 text-sm space-y-2">
                <p className="font-semibold text-violet-800">Resumen de tu registro</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  <span className="text-slate-500">Herramienta:</span>
                  <span className="font-medium text-slate-700">
                    {getValues('herramienta') === 'Otro' ? getValues('herramienta_otra') || 'Otro' : getValues('herramienta')}
                  </span>
                  <span className="text-slate-500">Proceso:</span>
                  <span className="font-medium text-slate-700">{getValues('proceso')}</span>
                  <span className="text-slate-500">Horas ahorradas:</span>
                  <span className="font-bold text-emerald-700">{totalHoras} h/mes</span>
                  {ahorro_mensual > 0 && <>
                    <span className="text-slate-500">Ahorro mensual:</span>
                    <span className="font-bold text-emerald-700">{fmtCOP(ahorro_mensual)}</span>
                  </>}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Navegación */}
        <div className="mt-5 flex items-center justify-between">
          <Button type="button" variant="outline" onClick={retroceder} disabled={paso === 1}>Atrás</Button>
          <span className="text-xs text-slate-400">Paso {paso} de {PASOS.length}</span>
          {paso < 3 ? (
            <Button type="button" onClick={avanzar} className="gap-1.5 bg-violet-600 hover:bg-violet-700">
              Siguiente <ChevronRight size={15} />
            </Button>
          ) : (
            <Button type="submit" disabled={isPending} className="gap-1.5 bg-violet-600 hover:bg-violet-700">
              {isPending ? 'Guardando...' : 'Guardar registro'}
            </Button>
          )}
        </div>
      </form>
    </div>
  )
}
