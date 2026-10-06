'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useFieldArray, useForm } from 'react-hook-form'
import { Brain, Building2, ChevronRight, Database, Sparkles, Server, FileQuestion, Timer, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { crearCasoUsoIA, type NuevoCasoUsoIAInput } from '@/actions/casos-uso-ia'
import { getPerfilesActivos } from '@/actions/perfiles'
import { BuscadorMultiUsuario } from '@/components/requerimientos/pasos/Paso2Solicitante'
import { formatCOP } from '@/lib/utils'
import type {
  Alcance, FrecuenciaUsoIA, FuenteDatosIA, ImpactoIndirectoIA, Perfil, TipoRegistroCasoIA,
} from '@/lib/supabase/types'
import {
  TIPOS_REGISTRO_CASO_IA, FUENTES_DATOS_IA, FRECUENCIAS_USO_IA, HERRAMIENTAS_IA, PROCESOS_CASO_IA,
  HORAS_LABORALES_MES, labelFuenteDatosIA, labelProcesoCasoIA, minutosAhorradosMes, ahorroMensualCOP, fmtMinutos,
} from '@/lib/casos-uso-ia'

type FormValues = {
  tipo_registro: TipoRegistroCasoIA
  proceso_solicitante: string
  alcance: Alcance
  proposito: string
  herramienta: string
  herramienta_otra: string
  fuentes_datos: FuenteDatosIA[]
  fuentes_datos_detalle: string
  tipo_datos: string
  sistemas_conectar: string
  usuarios_emails: string[]
  beneficios_esperados: string
  minutos_ahorrados: string
  frecuencia_uso: FrecuenciaUsoIA
  cargo_ahorro: string
  salario_cargo: number
  impactos_indirectos: ImpactoIndirectoIA[]
}

const SELECT_CLS = 'w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500'

/** Campo de pesos con separador de miles mientras se escribe */
function InputCOP({ value, onChange, placeholder = '0' }: { value?: number; onChange: (v: number) => void; placeholder?: string }) {
  const display = value && value > 0 ? new Intl.NumberFormat('es-CO').format(value) : ''
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">$</span>
      <Input
        value={display}
        onChange={e => {
          const raw = e.target.value.replace(/\D/g, '')
          onChange(raw ? parseInt(raw, 10) : 0)
        }}
        placeholder={placeholder}
        inputMode="numeric"
        className="pl-7"
      />
    </div>
  )
}

interface Props {
  /** Ruta base a la que se redirige tras crear el registro (`{basePath}/{id}`) */
  basePath?: string
}

export function FormNuevoCasoUsoIA({ basePath = '/admin/casos-uso-ia' }: Props) {
  const router = useRouter()
  const [paso, setPaso] = useState(1)
  const [isPending, startTransition] = useTransition()
  const [usuarios, setUsuarios] = useState<Perfil[]>([])

  useEffect(() => { getPerfilesActivos().then(setUsuarios) }, [])

  const {
    register, handleSubmit, formState: { errors }, trigger, getValues, setValue, watch, control,
  } = useForm<FormValues>({
    defaultValues: {
      tipo_registro: 'SOLICITUD',
      proceso_solicitante: '',
      alcance: 'IWF',
      herramienta: '',
      fuentes_datos: [],
      usuarios_emails: [],
      frecuencia_uso: 'DIARIA',
      salario_cargo: 0,
      impactos_indirectos: [],
    },
  })

  const impactos = useFieldArray({ control, name: 'impactos_indirectos' })

  // Campos controlados manualmente (no son inputs nativos)
  register('usuarios_emails', { validate: v => (v?.length ?? 0) > 0 || 'Selecciona al menos un usuario' })
  register('salario_cargo', {
    validate: v => getValues('tipo_registro') !== 'USO_EXISTENTE' || v > 0 || 'Ingresa el salario aproximado del cargo',
  })

  const tipo = watch('tipo_registro')
  const esUso = tipo === 'USO_EXISTENTE'
  const fuentesSel = watch('fuentes_datos') ?? []
  const herramientaSel = watch('herramienta')
  const usuariosSel = watch('usuarios_emails') ?? []
  const salario = watch('salario_cargo')
  const minutosMes = esUso ? minutosAhorradosMes(Number(watch('minutos_ahorrados')) || 0, watch('frecuencia_uso')) : null
  const ahorroMes = esUso ? ahorroMensualCOP(minutosMes, salario) : null
  const impactosValues = watch('impactos_indirectos') ?? []
  const totalIndirectos = impactosValues.reduce((s, i) => s + (i.valor_anual_cop || 0), 0)

  const SECCIONES = [
    { num: 1, titulo: 'Tipo y proceso',   icono: Building2 },
    { num: 2, titulo: esUso ? 'Actividad' : 'Caso de uso', icono: Brain },
    { num: 3, titulo: 'Herramienta',      icono: Server },
    { num: 4, titulo: 'Fuentes y usuarios', icono: Database },
    { num: 5, titulo: esUso ? 'Aporte e impacto' : 'Beneficios', icono: esUso ? Timer : Sparkles },
  ]

  const camposPorPaso: (keyof FormValues)[][] = [
    ['tipo_registro', 'proceso_solicitante', 'alcance'],
    ['proposito'],
    ['herramienta', 'herramienta_otra'],
    ['fuentes_datos', 'fuentes_datos_detalle', 'tipo_datos', 'sistemas_conectar', 'usuarios_emails'],
    ['beneficios_esperados', 'minutos_ahorrados', 'frecuencia_uso', 'cargo_ahorro', 'salario_cargo'],
  ]

  async function avanzar() {
    const ok = await trigger(camposPorPaso[paso - 1])
    if (ok) setPaso(p => Math.min(p + 1, 5))
  }

  function retroceder() { setPaso(p => Math.max(p - 1, 1)) }

  function onSubmit(values: FormValues) {
    startTransition(async () => {
      const usoExistente = values.tipo_registro === 'USO_EXISTENTE'
      const input: NuevoCasoUsoIAInput = {
        tipo_registro:         values.tipo_registro,
        proceso_solicitante:   values.proceso_solicitante,
        alcance:               values.alcance,
        proposito:             values.proposito,
        herramienta:           values.herramienta,
        herramienta_otra:      values.herramienta === 'OTRO' ? values.herramienta_otra : undefined,
        fuentes_datos:         values.fuentes_datos,
        fuentes_datos_detalle: values.fuentes_datos_detalle,
        tipo_datos:            values.tipo_datos,
        sistemas_conectar:     values.sistemas_conectar || undefined,
        usuarios_emails:       values.usuarios_emails,
        beneficios_esperados:  values.beneficios_esperados,
        minutos_ahorrados:     usoExistente ? Number(values.minutos_ahorrados) : undefined,
        frecuencia_uso:        usoExistente ? values.frecuencia_uso : undefined,
        cargo_ahorro:          usoExistente ? values.cargo_ahorro : undefined,
        salario_cargo:         usoExistente ? values.salario_cargo : undefined,
        impactos_indirectos:   values.impactos_indirectos,
      }
      const res = await crearCasoUsoIA(input)
      if (!res.ok) { toast.error(res.error ?? 'Error al radicar el registro'); return }
      toast.success(usoExistente ? 'Uso de IA registrado correctamente' : 'Solicitud radicada correctamente')
      router.push(`${basePath}/${res.id}`)
    })
  }

  const herramientaLabel = herramientaSel === 'OTRO'
    ? getValues('herramienta_otra')
    : HERRAMIENTAS_IA.find(h => h.value === herramientaSel)?.label

  return (
    <div className="mx-auto max-w-3xl p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Brain size={15} className="text-violet-500" />
          <span>{esUso ? 'Registro de uso existente de IA' : 'Nueva solicitud de autorización de uso de IA'}</span>
        </div>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">
          {esUso ? 'Registro de Uso de IA' : 'Solicitud de Caso de Uso IA'}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Complete el formulario conforme al Procedimiento TIN-P-008. El registro quedará en estado <strong>RECIBIDO</strong>.
        </p>
      </div>

      {/* Stepper */}
      <div className="mb-8 flex items-center gap-0">
        {SECCIONES.map((s, idx) => {
          const activo = paso === s.num
          const completado = paso > s.num
          return (
            <div key={s.num} className="flex flex-1 items-center">
              <div className={`flex flex-col items-center gap-1 ${idx > 0 ? 'flex-1' : ''}`}>
                {idx > 0 && (
                  <div className={`mb-1 h-0.5 w-full ${completado || activo ? 'bg-violet-500' : 'bg-slate-200'}`} />
                )}
                <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-colors
                  ${activo ? 'bg-violet-600 text-white' : completado ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-400'}`}>
                  {s.num}
                </div>
                <span className={`hidden text-center text-[10px] font-medium sm:block ${activo ? 'text-violet-700' : 'text-slate-400'}`}>
                  {s.titulo}
                </span>
              </div>
              {idx < SECCIONES.length - 1 && (
                <div className={`h-0.5 flex-1 ${paso > s.num ? 'bg-violet-500' : 'bg-slate-200'}`} />
              )}
            </div>
          )
        })}
      </div>

      {/* Form card */}
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

          {/* Paso 1: Tipo de registro y proceso */}
          {paso === 1 && (
            <div className="space-y-5">
              <h2 className="text-base font-semibold text-slate-800">¿Qué deseas registrar?</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {TIPOS_REGISTRO_CASO_IA.map(t => {
                  const Icono = t.value === 'USO_EXISTENTE' ? Timer : FileQuestion
                  const sel = tipo === t.value
                  return (
                    <label
                      key={t.value}
                      className={`flex cursor-pointer gap-3 rounded-xl border p-4 transition-colors
                        ${sel ? 'border-violet-500 bg-violet-50 ring-1 ring-violet-500' : 'border-slate-200 hover:border-violet-300'}`}
                    >
                      <input type="radio" value={t.value} {...register('tipo_registro')} className="sr-only" />
                      <Icono size={20} className={sel ? 'text-violet-600' : 'text-slate-400'} />
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{t.label}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{t.descripcion}</p>
                      </div>
                    </label>
                  )
                })}
              </div>

              <div className="space-y-2">
                <Label>Proceso solicitante <span className="text-red-500">*</span></Label>
                <select {...register('proceso_solicitante', { required: 'Selecciona el proceso' })} className={SELECT_CLS}>
                  <option value="">Selecciona el proceso...</option>
                  {PROCESOS_CASO_IA.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
                {errors.proceso_solicitante && <p className="text-xs text-red-500">{errors.proceso_solicitante.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Alcance (empresa) <span className="text-red-500">*</span></Label>
                <select {...register('alcance', { required: 'Campo requerido' })} className={SELECT_CLS}>
                  <option value="IWF">IWF — Interworld Freight S.A.S.</option>
                  <option value="ILT">ILT — Interworld Land Transport S.A.S.</option>
                  <option value="IWG">IWG — Interworld Group (ambas)</option>
                </select>
                {errors.alcance && <p className="text-xs text-red-500">{errors.alcance.message}</p>}
              </div>
            </div>
          )}

          {/* Paso 2: Caso de uso / actividad */}
          {paso === 2 && (
            <div className="space-y-5">
              <h2 className="text-base font-semibold text-slate-800">
                {esUso ? 'Actividad que se apoya con IA' : 'Descripción del caso de uso'}
              </h2>
              <p className="text-sm text-slate-500">
                {esUso
                  ? 'Describe la actividad o tarea en la que ya estás usando la herramienta de IA y cómo la utilizas.'
                  : 'Describe con claridad el propósito del caso de uso de IA que requieres autorizar.'}
              </p>
              <div className="space-y-2">
                <Label>
                  {esUso ? 'Actividad y forma de uso' : 'Propósito del caso de uso'} <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  {...register('proposito', { required: 'Campo requerido', minLength: { value: 30, message: 'Mínimo 30 caracteres' } })}
                  rows={5}
                  placeholder={esUso
                    ? 'Ej: Uso Gemini para resumir los correos de clientes y redactar las respuestas de seguimiento de embarques...'
                    : 'Describe el propósito concreto del caso de uso: qué problema resuelve, qué proceso apoya, cuál es el objetivo...'}
                />
                {errors.proposito && <p className="text-xs text-red-500">{errors.proposito.message}</p>}
              </div>
            </div>
          )}

          {/* Paso 3: Herramienta */}
          {paso === 3 && (
            <div className="space-y-5">
              <h2 className="text-base font-semibold text-slate-800">
                {esUso ? '¿Qué herramienta de IA usas?' : '¿Qué herramienta de IA quieres usar?'}
              </h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {HERRAMIENTAS_IA.map(h => {
                  const sel = herramientaSel === h.value
                  return (
                    <label
                      key={h.value}
                      className={`flex cursor-pointer items-center justify-center rounded-xl border px-3 py-4 text-sm font-semibold transition-colors
                        ${sel ? 'border-violet-500 bg-violet-50 text-violet-800 ring-1 ring-violet-500' : 'border-slate-200 text-slate-700 hover:border-violet-300'}`}
                    >
                      <input
                        type="radio"
                        value={h.value}
                        {...register('herramienta', { required: 'Selecciona una herramienta' })}
                        className="sr-only"
                      />
                      {h.label}
                    </label>
                  )
                })}
              </div>
              {errors.herramienta && <p className="text-xs text-red-500">{errors.herramienta.message}</p>}

              {herramientaSel === 'OTRO' && (
                <div className="space-y-2">
                  <Label>Nombre de la herramienta <span className="text-red-500">*</span></Label>
                  <Input
                    {...register('herramienta_otra', {
                      validate: v => getValues('herramienta') !== 'OTRO' || !!v?.trim() || 'Indica el nombre de la herramienta',
                    })}
                    placeholder="Ej: Perplexity, Midjourney, Notion AI..."
                  />
                  {errors.herramienta_otra && <p className="text-xs text-red-500">{errors.herramienta_otra.message}</p>}
                </div>
              )}
            </div>
          )}

          {/* Paso 4: Fuentes de datos, datos y usuarios */}
          {paso === 4 && (
            <div className="space-y-5">
              <h2 className="text-base font-semibold text-slate-800">Fuentes de datos y usuarios</h2>
              <p className="text-sm text-slate-500">
                Indica de dónde toma la información la herramienta para ejecutar las tareas, qué tipo de datos procesa y quiénes la usan.
              </p>

              <div className="space-y-2">
                <Label>Fuentes de datos <span className="text-red-500">*</span></Label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {FUENTES_DATOS_IA.map(f => (
                    <label
                      key={f.value}
                      className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors
                        ${fuentesSel.includes(f.value) ? 'border-violet-400 bg-violet-50 text-violet-800' : 'border-slate-200 text-slate-700 hover:border-violet-300'}`}
                    >
                      <input
                        type="checkbox"
                        value={f.value}
                        {...register('fuentes_datos', {
                          validate: v => (v?.length ?? 0) > 0 || 'Selecciona al menos una fuente de datos',
                        })}
                        className="accent-violet-600"
                      />
                      {f.label}
                    </label>
                  ))}
                </div>
                {errors.fuentes_datos && <p className="text-xs text-red-500">{errors.fuentes_datos.message}</p>}
              </div>

              <div className="space-y-2">
                <Label>Link o ruta de la fuente de datos <span className="text-red-500">*</span></Label>
                <Textarea
                  {...register('fuentes_datos_detalle', {
                    validate: v => !!v?.trim() || 'Indica el link o la ruta de cada fuente de datos',
                  })}
                  rows={3}
                  placeholder={'Pega el link o escribe la ruta de cada fuente, una por línea. Ej:\nhttps://drive.google.com/drive/folders/...\nC:\\Usuarios\\operaciones\\Tarifas 2026.xlsx\nGmail: bandeja servicio.cliente@empresa.com'}
                />
                <p className="text-xs text-slate-400">
                  Para carpetas o archivos de Drive/SharePoint copia el enlace; para archivos locales escribe la ruta completa; para correo indica la cuenta o etiqueta.
                </p>
                {errors.fuentes_datos_detalle && <p className="text-xs text-red-500">{errors.fuentes_datos_detalle.message}</p>}
              </div>

              <div className="space-y-2">
                <Label>Tipo de datos a procesar <span className="text-red-500">*</span></Label>
                <Textarea
                  {...register('tipo_datos', { required: 'Campo requerido', minLength: { value: 10, message: 'Mínimo 10 caracteres' } })}
                  rows={3}
                  placeholder="Describe qué clase de información se envía a la herramienta: datos de clientes, datos operativos, información financiera, etc."
                />
                {errors.tipo_datos && <p className="text-xs text-red-500">{errors.tipo_datos.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Sistemas a los que se conecta <span className="text-slate-400 text-xs">(opcional)</span></Label>
                <Textarea
                  {...register('sistemas_conectar')}
                  rows={2}
                  placeholder="Ej: TMS, ERP, CRM, base de datos X... Si no requiere integración técnica, dejar en blanco."
                />
              </div>
              <div className="space-y-2">
                <Label>{esUso ? 'Usuarios que la utilizan' : 'Usuarios que la utilizarán'} <span className="text-red-500">*</span></Label>
                <BuscadorMultiUsuario
                  usuarios={usuarios}
                  values={usuariosSel}
                  onChange={v => setValue('usuarios_emails', v, { shouldValidate: true })}
                  placeholder="Buscar y agregar usuarios..."
                />
                {errors.usuarios_emails && <p className="text-xs text-red-500">{errors.usuarios_emails.message}</p>}
              </div>
            </div>
          )}

          {/* Paso 5: Beneficios / Aporte e impacto */}
          {paso === 5 && (
            <div className="space-y-5">
              <h2 className="text-base font-semibold text-slate-800">
                {esUso ? 'Aporte e impacto' : 'Beneficios esperados'}
              </h2>
              <p className="text-sm text-slate-500">
                {esUso
                  ? 'Explica cómo la herramienta te ayuda a optimizar tus actividades, cuánto tiempo ahorra y qué otros impactos genera.'
                  : 'Describe los beneficios que justifican la incorporación de este caso de uso de IA a la operación.'}
              </p>
              <div className="space-y-2">
                <Label>
                  {esUso ? '¿Cómo aporta a optimizar tus actividades?' : 'Beneficios esperados'} <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  {...register('beneficios_esperados', { required: 'Campo requerido', minLength: { value: 20, message: 'Mínimo 20 caracteres' } })}
                  rows={4}
                  placeholder={esUso
                    ? 'Ej: Antes revisaba cada correo manualmente; ahora obtengo un resumen y un borrador de respuesta, lo que reduce errores y tiempos de respuesta...'
                    : 'Describe los beneficios operativos, de eficiencia, de calidad o económicos que se esperan obtener con este caso de uso...'}
                />
                {errors.beneficios_esperados && <p className="text-xs text-red-500">{errors.beneficios_esperados.message}</p>}
              </div>

              {esUso && (
                <div className="space-y-4 rounded-xl border border-slate-200 p-4">
                  <p className="text-sm font-semibold text-slate-700">Impacto directo en horas hombre</p>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Minutos ahorrados por ejecución <span className="text-red-500">*</span></Label>
                      <Input
                        type="number"
                        min={1}
                        step={1}
                        {...register('minutos_ahorrados', {
                          validate: v => {
                            if (getValues('tipo_registro') !== 'USO_EXISTENTE') return true
                            const n = Number(v)
                            return (Number.isInteger(n) && n > 0) || 'Ingresa un número entero de minutos mayor a 0'
                          },
                        })}
                        placeholder="Ej: 15"
                      />
                      {errors.minutos_ahorrados && <p className="text-xs text-red-500">{errors.minutos_ahorrados.message}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label>Frecuencia de la actividad <span className="text-red-500">*</span></Label>
                      <select {...register('frecuencia_uso')} className={SELECT_CLS}>
                        {FRECUENCIAS_USO_IA.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>Cargo que ahorra las horas <span className="text-red-500">*</span></Label>
                      <Input
                        {...register('cargo_ahorro', {
                          validate: v => getValues('tipo_registro') !== 'USO_EXISTENTE' || !!v?.trim() || 'Indica el cargo',
                        })}
                        placeholder="Ej: Coordinador de operaciones"
                      />
                      {errors.cargo_ahorro && <p className="text-xs text-red-500">{errors.cargo_ahorro.message}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label>Salario mensual aproximado del cargo <span className="text-red-500">*</span></Label>
                      <InputCOP
                        value={salario}
                        onChange={v => setValue('salario_cargo', v, { shouldValidate: true })}
                        placeholder="Ej: 3.500.000"
                      />
                      {errors.salario_cargo && <p className="text-xs text-red-500">{errors.salario_cargo.message}</p>}
                    </div>
                  </div>

                  {minutosMes != null && (
                    <div className="grid grid-cols-1 gap-2 rounded-md bg-emerald-50 p-3 text-xs text-emerald-800 sm:grid-cols-3">
                      <div>
                        <p className="text-emerald-600">Tiempo ahorrado / mes</p>
                        <p className="text-sm font-bold">{fmtMinutos(minutosMes)}</p>
                      </div>
                      <div>
                        <p className="text-emerald-600">Valor hora ({HORAS_LABORALES_MES} h/mes)</p>
                        <p className="text-sm font-bold">{salario > 0 ? formatCOP(Math.round(salario / HORAS_LABORALES_MES)) : '—'}</p>
                      </div>
                      <div>
                        <p className="text-emerald-600">Ahorro mensual / anual</p>
                        <p className="text-sm font-bold">
                          {ahorroMes != null ? `${formatCOP(ahorroMes)} / ${formatCOP(ahorroMes * 12)}` : '—'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Impactos indirectos */}
              <div className="space-y-3 rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-700">Impactos indirectos <span className="text-xs font-normal text-slate-400">(opcional)</span></p>
                    <p className="text-xs text-slate-500">
                      Ej: menos errores, mejor experiencia del cliente, menos reprocesos. Si puedes, estima su valor anual.
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="gap-1"
                    onClick={() => impactos.append({ descripcion: '', valor_anual_cop: 0 })}
                  >
                    <Plus size={14} /> Agregar
                  </Button>
                </div>
                {impactos.fields.map((field, i) => (
                  <div key={field.id} className="flex items-start gap-2">
                    <Input
                      {...register(`impactos_indirectos.${i}.descripcion` as const)}
                      placeholder="Describe el impacto indirecto"
                      className="flex-1"
                    />
                    <div className="w-40 shrink-0">
                      <InputCOP
                        value={impactosValues[i]?.valor_anual_cop}
                        onChange={v => setValue(`impactos_indirectos.${i}.valor_anual_cop`, v)}
                        placeholder="Valor anual"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => impactos.remove(i)}
                      className="mt-2 rounded-md p-1 text-slate-400 hover:bg-red-50 hover:text-red-500"
                      aria-label="Quitar impacto"
                    >
                      <X size={15} />
                    </button>
                  </div>
                ))}
                {totalIndirectos > 0 && (
                  <p className="text-xs text-slate-600">Total impactos indirectos: <strong>{formatCOP(totalIndirectos)}</strong> / año</p>
                )}
              </div>

              {/* Resumen */}
              <div className="rounded-xl border border-violet-100 bg-violet-50 p-4 text-sm space-y-2">
                <p className="font-semibold text-violet-800">Resumen del registro</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  <span className="text-slate-500">Tipo:</span>
                  <span className="font-medium text-slate-700">{esUso ? 'Uso existente' : 'Solicitud de uso'}</span>
                  <span className="text-slate-500">Proceso:</span>
                  <span className="font-medium text-slate-700">{labelProcesoCasoIA(getValues('proceso_solicitante'))}</span>
                  <span className="text-slate-500">Alcance:</span>
                  <span className="font-medium text-slate-700">{getValues('alcance')}</span>
                  <span className="text-slate-500">Herramienta:</span>
                  <span className="font-medium text-slate-700">{herramientaLabel || '—'}</span>
                  <span className="text-slate-500">Fuentes de datos:</span>
                  <span className="font-medium text-slate-700">{fuentesSel.map(labelFuenteDatosIA).join(', ')}</span>
                  <span className="text-slate-500">Usuarios:</span>
                  <span className="font-medium text-slate-700">
                    {usuariosSel.map(e => usuarios.find(u => u.email === e)?.nombre_completo ?? e).join(', ')}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Navegación */}
        <div className="mt-6 flex items-center justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={retroceder}
            disabled={paso === 1}
          >
            Atrás
          </Button>
          <span className="text-xs text-slate-400">Paso {paso} de {SECCIONES.length}</span>
          {paso < 5 ? (
            <Button type="button" onClick={avanzar} className="gap-1.5 bg-violet-600 hover:bg-violet-700">
              Siguiente <ChevronRight size={15} />
            </Button>
          ) : (
            <Button type="submit" disabled={isPending} className="gap-1.5 bg-violet-600 hover:bg-violet-700">
              {isPending ? 'Radicando...' : esUso ? 'Registrar uso' : 'Radicar solicitud'}
            </Button>
          )}
        </div>
      </form>
    </div>
  )
}
