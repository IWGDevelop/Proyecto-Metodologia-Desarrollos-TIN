'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { Brain, Building2, ChevronRight, Database, Sparkles, Server, FileQuestion, Timer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { crearCasoUsoIA, type NuevoCasoUsoIAInput } from '@/actions/casos-uso-ia'
import type { Alcance, FrecuenciaUsoIA, FuenteDatosIA, TipoRegistroCasoIA } from '@/lib/supabase/types'
import {
  TIPOS_REGISTRO_CASO_IA, FUENTES_DATOS_IA, FRECUENCIAS_USO_IA,
  labelFuenteDatosIA, minutosAhorradosMes, fmtMinutos,
} from '@/lib/casos-uso-ia'

type FormValues = {
  tipo_registro: TipoRegistroCasoIA
  proceso_solicitante: string
  alcance: Alcance
  proposito: string
  herramienta_proveedor: string
  herramienta_producto: string
  herramienta_modelo: string
  herramienta_modalidad_acceso: string
  fuentes_datos: FuenteDatosIA[]
  fuentes_datos_detalle: string
  tipo_datos: string
  sistemas_conectar: string
  usuarios_previstos: string
  beneficios_esperados: string
  minutos_ahorrados: string
  frecuencia_uso: FrecuenciaUsoIA
}

const MODALIDADES = ['API', 'SaaS', 'On-Premise', 'Acceso web directo', 'Plugin / extensión', 'Otro']

const SELECT_CLS = 'w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500'

interface Props {
  /** Ruta base a la que se redirige tras crear el registro (`{basePath}/{id}`) */
  basePath?: string
}

export function FormNuevoCasoUsoIA({ basePath = '/admin/casos-uso-ia' }: Props) {
  const router = useRouter()
  const [paso, setPaso] = useState(1)
  const [isPending, startTransition] = useTransition()

  const { register, handleSubmit, formState: { errors }, trigger, getValues, watch } = useForm<FormValues>({
    defaultValues: {
      tipo_registro: 'SOLICITUD',
      alcance: 'IWF',
      herramienta_modalidad_acceso: 'SaaS',
      fuentes_datos: [],
      frecuencia_uso: 'DIARIA',
    },
  })

  const tipo = watch('tipo_registro')
  const esUso = tipo === 'USO_EXISTENTE'
  const fuentesSel = watch('fuentes_datos') ?? []
  const minutosMes = esUso ? minutosAhorradosMes(Number(watch('minutos_ahorrados')) || 0, watch('frecuencia_uso')) : null

  const SECCIONES = [
    { num: 1, titulo: 'Tipo y proceso',   icono: Building2 },
    { num: 2, titulo: esUso ? 'Actividad' : 'Caso de uso', icono: Brain },
    { num: 3, titulo: 'Herramienta',      icono: Server },
    { num: 4, titulo: 'Fuentes y datos',  icono: Database },
    { num: 5, titulo: esUso ? 'Aporte e impacto' : 'Beneficios', icono: esUso ? Timer : Sparkles },
  ]

  const camposPorPaso: (keyof FormValues)[][] = [
    ['tipo_registro', 'proceso_solicitante', 'alcance'],
    ['proposito'],
    ['herramienta_proveedor', 'herramienta_producto', 'herramienta_modelo', 'herramienta_modalidad_acceso'],
    ['fuentes_datos', 'fuentes_datos_detalle', 'tipo_datos', 'sistemas_conectar', 'usuarios_previstos'],
    ['beneficios_esperados', 'minutos_ahorrados', 'frecuencia_uso'],
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
        tipo_registro:               values.tipo_registro,
        proceso_solicitante:         values.proceso_solicitante,
        alcance:                     values.alcance,
        proposito:                   values.proposito,
        herramienta_proveedor:       values.herramienta_proveedor,
        herramienta_producto:        values.herramienta_producto,
        herramienta_modelo:          values.herramienta_modelo || undefined,
        herramienta_modalidad_acceso:values.herramienta_modalidad_acceso || undefined,
        fuentes_datos:               values.fuentes_datos,
        fuentes_datos_detalle:       values.fuentes_datos_detalle || undefined,
        tipo_datos:                  values.tipo_datos,
        sistemas_conectar:           values.sistemas_conectar || undefined,
        usuarios_previstos:          values.usuarios_previstos,
        beneficios_esperados:        values.beneficios_esperados,
        minutos_ahorrados:           usoExistente ? Number(values.minutos_ahorrados) : undefined,
        frecuencia_uso:              usoExistente ? values.frecuencia_uso : undefined,
      }
      const res = await crearCasoUsoIA(input)
      if (!res.ok) { toast.error(res.error ?? 'Error al radicar el registro'); return }
      toast.success(usoExistente ? 'Uso de IA registrado correctamente' : 'Solicitud radicada correctamente')
      router.push(`${basePath}/${res.id}`)
    })
  }

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
                <Input
                  {...register('proceso_solicitante', { required: 'Campo requerido' })}
                  placeholder="Ej: Operaciones, Comercial, Financiero..."
                />
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
                {esUso ? 'Herramienta en uso' : 'Herramienta propuesta'}
              </h2>
              <p className="text-sm text-slate-500">
                Especifica la herramienta de IA, incluyendo proveedor, producto y modalidad de acceso.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Proveedor <span className="text-red-500">*</span></Label>
                  <Input
                    {...register('herramienta_proveedor', { required: 'Campo requerido' })}
                    placeholder="Ej: OpenAI, Google, Anthropic, Microsoft..."
                  />
                  {errors.herramienta_proveedor && <p className="text-xs text-red-500">{errors.herramienta_proveedor.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Producto / aplicación <span className="text-red-500">*</span></Label>
                  <Input
                    {...register('herramienta_producto', { required: 'Campo requerido' })}
                    placeholder="Ej: ChatGPT, Gemini, Copilot, Claude..."
                  />
                  {errors.herramienta_producto && <p className="text-xs text-red-500">{errors.herramienta_producto.message}</p>}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Modelo específico <span className="text-slate-400 text-xs">(opcional)</span></Label>
                  <Input
                    {...register('herramienta_modelo')}
                    placeholder="Ej: GPT-4o, Gemini 1.5 Pro, Claude 3.5..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Modalidad de acceso</Label>
                  <select {...register('herramienta_modalidad_acceso')} className={SELECT_CLS}>
                    {MODALIDADES.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Paso 4: Fuentes de datos, datos y usuarios */}
          {paso === 4 && (
            <div className="space-y-5">
              <h2 className="text-base font-semibold text-slate-800">Fuentes de datos, datos y usuarios</h2>
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
                <Label>
                  Detalle de las fuentes{' '}
                  {fuentesSel.includes('OTRO')
                    ? <span className="text-red-500">*</span>
                    : <span className="text-slate-400 text-xs">(opcional)</span>}
                </Label>
                <Textarea
                  {...register('fuentes_datos_detalle', {
                    validate: v => !getValues('fuentes_datos')?.includes('OTRO') || !!v?.trim() || 'Describe la fuente "Otro"',
                  })}
                  rows={2}
                  placeholder="Ej: Carpeta de Drive 'Operaciones/Facturas 2026', bandeja de Gmail de servicio al cliente, Excel local de tarifas..."
                />
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
                <Label>{esUso ? 'Usuarios que la utilizan' : 'Usuarios previstos'} <span className="text-red-500">*</span></Label>
                <Textarea
                  {...register('usuarios_previstos', { required: 'Campo requerido' })}
                  rows={2}
                  placeholder="Ej: Coordinadores de operaciones IWF (aprox. 8 personas), analistas del área comercial..."
                />
                {errors.usuarios_previstos && <p className="text-xs text-red-500">{errors.usuarios_previstos.message}</p>}
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
                  ? 'Explica cómo la herramienta te ayuda a optimizar tus actividades y cuánto tiempo ahorra.'
                  : 'Describe los beneficios que justifican la incorporación de este caso de uso de IA a la operación.'}
              </p>
              <div className="space-y-2">
                <Label>
                  {esUso ? '¿Cómo aporta a optimizar tus actividades?' : 'Beneficios esperados'} <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  {...register('beneficios_esperados', { required: 'Campo requerido', minLength: { value: 20, message: 'Mínimo 20 caracteres' } })}
                  rows={5}
                  placeholder={esUso
                    ? 'Ej: Antes revisaba cada correo manualmente; ahora obtengo un resumen y un borrador de respuesta, lo que reduce errores y tiempos de respuesta...'
                    : 'Describe los beneficios operativos, de eficiencia, de calidad o económicos que se esperan obtener con este caso de uso...'}
                />
                {errors.beneficios_esperados && <p className="text-xs text-red-500">{errors.beneficios_esperados.message}</p>}
              </div>

              {esUso && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Minutos ahorrados por ejecución <span className="text-red-500">*</span></Label>
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      {...register('minutos_ahorrados', {
                        validate: v => {
                          if (!esUso) return true
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
                    <select {...register('frecuencia_uso', { required: esUso ? 'Campo requerido' : false })} className={SELECT_CLS}>
                      {FRECUENCIAS_USO_IA.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                    </select>
                  </div>
                  {minutosMes != null && (
                    <p className="col-span-2 rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                      Impacto estimado: <strong>{fmtMinutos(minutosMes)}</strong> ahorrados al mes por usuario
                    </p>
                  )}
                </div>
              )}

              {/* Resumen */}
              <div className="rounded-xl border border-violet-100 bg-violet-50 p-4 text-sm space-y-2">
                <p className="font-semibold text-violet-800">Resumen del registro</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  <span className="text-slate-500">Tipo:</span>
                  <span className="font-medium text-slate-700">{esUso ? 'Uso existente' : 'Solicitud de uso'}</span>
                  <span className="text-slate-500">Proceso:</span>
                  <span className="font-medium text-slate-700">{getValues('proceso_solicitante')}</span>
                  <span className="text-slate-500">Alcance:</span>
                  <span className="font-medium text-slate-700">{getValues('alcance')}</span>
                  <span className="text-slate-500">Herramienta:</span>
                  <span className="font-medium text-slate-700">{getValues('herramienta_proveedor')} — {getValues('herramienta_producto')}</span>
                  <span className="text-slate-500">Modalidad:</span>
                  <span className="font-medium text-slate-700">{getValues('herramienta_modalidad_acceso')}</span>
                  <span className="text-slate-500">Fuentes de datos:</span>
                  <span className="font-medium text-slate-700">{fuentesSel.map(labelFuenteDatosIA).join(', ')}</span>
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
