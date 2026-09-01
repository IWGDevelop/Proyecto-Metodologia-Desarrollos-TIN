'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { Brain, Building2, ChevronRight, Database, Users, Sparkles, Server } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { crearCasoUsoIA, type NuevoCasoUsoIAInput } from '@/actions/casos-uso-ia'
import type { Alcance } from '@/lib/supabase/types'

const SECCIONES = [
  { num: 1, titulo: 'Proceso solicitante', icono: Building2 },
  { num: 2, titulo: 'Caso de uso',         icono: Brain },
  { num: 3, titulo: 'Herramienta',         icono: Server },
  { num: 4, titulo: 'Datos y usuarios',    icono: Database },
  { num: 5, titulo: 'Beneficios',          icono: Sparkles },
]

type FormValues = {
  proceso_solicitante: string
  alcance: Alcance
  proposito: string
  herramienta_proveedor: string
  herramienta_producto: string
  herramienta_modelo: string
  herramienta_modalidad_acceso: string
  tipo_datos: string
  sistemas_conectar: string
  usuarios_previstos: string
  beneficios_esperados: string
}

const MODALIDADES = ['API', 'SaaS', 'On-Premise', 'Acceso web directo', 'Plugin / extensión', 'Otro']

export function FormNuevoCasoUsoIA() {
  const router = useRouter()
  const [paso, setPaso] = useState(1)
  const [isPending, startTransition] = useTransition()

  const { register, handleSubmit, formState: { errors }, trigger, getValues } = useForm<FormValues>({
    defaultValues: { alcance: 'IWF', herramienta_modalidad_acceso: 'SaaS' },
  })

  const camposPorPaso: (keyof FormValues)[][] = [
    ['proceso_solicitante', 'alcance'],
    ['proposito'],
    ['herramienta_proveedor', 'herramienta_producto', 'herramienta_modelo', 'herramienta_modalidad_acceso'],
    ['tipo_datos', 'sistemas_conectar', 'usuarios_previstos'],
    ['beneficios_esperados'],
  ]

  async function avanzar() {
    const ok = await trigger(camposPorPaso[paso - 1])
    if (ok) setPaso(p => Math.min(p + 1, 5))
  }

  function retroceder() { setPaso(p => Math.max(p - 1, 1)) }

  function onSubmit(values: FormValues) {
    startTransition(async () => {
      const input: NuevoCasoUsoIAInput = {
        proceso_solicitante:         values.proceso_solicitante,
        alcance:                     values.alcance,
        proposito:                   values.proposito,
        herramienta_proveedor:       values.herramienta_proveedor,
        herramienta_producto:        values.herramienta_producto,
        herramienta_modelo:          values.herramienta_modelo || undefined,
        herramienta_modalidad_acceso:values.herramienta_modalidad_acceso || undefined,
        tipo_datos:                  values.tipo_datos,
        sistemas_conectar:           values.sistemas_conectar || undefined,
        usuarios_previstos:          values.usuarios_previstos,
        beneficios_esperados:        values.beneficios_esperados,
      }
      const res = await crearCasoUsoIA(input)
      if (!res.ok) { toast.error(res.error ?? 'Error al radicar la solicitud'); return }
      toast.success('Solicitud radicada correctamente')
      router.push(`/admin/casos-uso-ia/${res.id}`)
    })
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Brain size={15} className="text-violet-500" />
          <span>Nueva solicitud de autorización de uso de IA</span>
        </div>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">Solicitud de Caso de Uso IA</h1>
        <p className="mt-1 text-sm text-slate-500">
          Complete el formulario conforme al Procedimiento TIN-P-008. La solicitud quedará en estado <strong>RECIBIDO</strong>.
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

          {/* Paso 1: Proceso solicitante */}
          {paso === 1 && (
            <div className="space-y-5">
              <h2 className="text-base font-semibold text-slate-800">Información del proceso solicitante</h2>
              <p className="text-sm text-slate-500">
                Indica el proceso que requiere la autorización y la empresa de aplicación.
              </p>
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
                <select
                  {...register('alcance', { required: 'Campo requerido' })}
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                >
                  <option value="IWF">IWF — Interworld Freight S.A.S.</option>
                  <option value="ILT">ILT — Interworld Land Transport S.A.S.</option>
                  <option value="IWG">IWG — Interworld Group (ambas)</option>
                </select>
                {errors.alcance && <p className="text-xs text-red-500">{errors.alcance.message}</p>}
              </div>
            </div>
          )}

          {/* Paso 2: Caso de uso */}
          {paso === 2 && (
            <div className="space-y-5">
              <h2 className="text-base font-semibold text-slate-800">Descripción del caso de uso</h2>
              <p className="text-sm text-slate-500">
                Describe con claridad el propósito del caso de uso de IA que requieres autorizar.
              </p>
              <div className="space-y-2">
                <Label>Propósito del caso de uso <span className="text-red-500">*</span></Label>
                <Textarea
                  {...register('proposito', { required: 'Campo requerido', minLength: { value: 30, message: 'Mínimo 30 caracteres' } })}
                  rows={5}
                  placeholder="Describe el propósito concreto del caso de uso: qué problema resuelve, qué proceso apoya, cuál es el objetivo..."
                />
                {errors.proposito && <p className="text-xs text-red-500">{errors.proposito.message}</p>}
              </div>
            </div>
          )}

          {/* Paso 3: Herramienta */}
          {paso === 3 && (
            <div className="space-y-5">
              <h2 className="text-base font-semibold text-slate-800">Herramienta propuesta</h2>
              <p className="text-sm text-slate-500">
                Especifica la herramienta de IA que se utilizará, incluyendo proveedor, producto y modalidad de acceso.
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
                  <select
                    {...register('herramienta_modalidad_acceso')}
                    className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                  >
                    {MODALIDADES.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Paso 4: Datos y usuarios */}
          {paso === 4 && (
            <div className="space-y-5">
              <h2 className="text-base font-semibold text-slate-800">Datos y usuarios</h2>
              <p className="text-sm text-slate-500">
                Indica qué tipo de datos se procesarán, qué sistemas se conectarán y quiénes serán los usuarios del caso de uso.
              </p>
              <div className="space-y-2">
                <Label>Tipo de datos a procesar <span className="text-red-500">*</span></Label>
                <Textarea
                  {...register('tipo_datos', { required: 'Campo requerido', minLength: { value: 10, message: 'Mínimo 10 caracteres' } })}
                  rows={3}
                  placeholder="Describe qué clase de información se enviará a la herramienta: datos de clientes, datos operativos, información financiera, etc."
                />
                {errors.tipo_datos && <p className="text-xs text-red-500">{errors.tipo_datos.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Sistemas a los que se conectaría <span className="text-slate-400 text-xs">(opcional)</span></Label>
                <Textarea
                  {...register('sistemas_conectar')}
                  rows={2}
                  placeholder="Ej: TMS, ERP, CRM, base de datos X... Si no requiere integración técnica, dejar en blanco."
                />
              </div>
              <div className="space-y-2">
                <Label>Usuarios previstos <span className="text-red-500">*</span></Label>
                <Textarea
                  {...register('usuarios_previstos', { required: 'Campo requerido' })}
                  rows={2}
                  placeholder="Ej: Coordinadores de operaciones IWF (aprox. 8 personas), analistas del área comercial..."
                />
                {errors.usuarios_previstos && <p className="text-xs text-red-500">{errors.usuarios_previstos.message}</p>}
              </div>
            </div>
          )}

          {/* Paso 5: Beneficios */}
          {paso === 5 && (
            <div className="space-y-5">
              <h2 className="text-base font-semibold text-slate-800">Beneficios esperados</h2>
              <p className="text-sm text-slate-500">
                Describe los beneficios que justifican la incorporación de este caso de uso de IA a la operación.
              </p>
              <div className="space-y-2">
                <Label>Beneficios esperados <span className="text-red-500">*</span></Label>
                <Textarea
                  {...register('beneficios_esperados', { required: 'Campo requerido', minLength: { value: 20, message: 'Mínimo 20 caracteres' } })}
                  rows={6}
                  placeholder="Describe los beneficios operativos, de eficiencia, de calidad o económicos que se esperan obtener con este caso de uso..."
                />
                {errors.beneficios_esperados && <p className="text-xs text-red-500">{errors.beneficios_esperados.message}</p>}
              </div>

              {/* Resumen */}
              <div className="rounded-xl border border-violet-100 bg-violet-50 p-4 text-sm space-y-2">
                <p className="font-semibold text-violet-800">Resumen de la solicitud</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  <span className="text-slate-500">Proceso:</span>
                  <span className="font-medium text-slate-700">{getValues('proceso_solicitante')}</span>
                  <span className="text-slate-500">Alcance:</span>
                  <span className="font-medium text-slate-700">{getValues('alcance')}</span>
                  <span className="text-slate-500">Herramienta:</span>
                  <span className="font-medium text-slate-700">{getValues('herramienta_proveedor')} — {getValues('herramienta_producto')}</span>
                  <span className="text-slate-500">Modalidad:</span>
                  <span className="font-medium text-slate-700">{getValues('herramienta_modalidad_acceso')}</span>
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
              {isPending ? 'Radicando...' : 'Radicar solicitud'}
            </Button>
          )}
        </div>
      </form>
    </div>
  )
}
