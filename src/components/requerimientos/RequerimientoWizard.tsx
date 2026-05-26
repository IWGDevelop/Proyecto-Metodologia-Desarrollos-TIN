'use client'

import { useState, useEffect, useTransition, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import {
  ClipboardList, User, FileText, Target,
  DollarSign, CheckSquare, Check, Save,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { cn, formatFechaRelativa } from '@/lib/utils'
import {
  wizardSchema, defaultWizardValues, calcularActividad,
  calcValorAnual, calcTotalCualitativos,
  CAMPOS_POR_PASO, BENEFICIOS_CONFIG, type WizardData,
} from '@/lib/schemas/requerimiento'
import { crearRequerimiento, actualizarRequerimiento, guardarBorrador } from '@/actions/requerimientos'
import { registrarAnexo } from '@/actions/historial'
import { Paso1Encabezado } from './pasos/Paso1Encabezado'
import { Paso2Solicitante } from './pasos/Paso2Solicitante'
import { getPerfilesActivos } from '@/actions/perfiles'
import type { Perfil } from '@/lib/supabase/types'
import { Paso3Descripcion } from './pasos/Paso3Descripcion'
import { Paso4Alcance } from './pasos/Paso4Alcance'
import { Paso5ImpactoHH } from './pasos/Paso5ImpactoHH'
import { Paso6Revision } from './pasos/Paso6Revision'
import type { AnexoLocal } from './SubirAnexos'
import type { Requerimiento } from '@/lib/supabase/types'

const PASOS = [
  { num: 1, titulo: 'Encabezado', icono: ClipboardList },
  { num: 2, titulo: 'Solicitante', icono: User },
  { num: 3, titulo: 'Descripción', icono: FileText },
  { num: 4, titulo: 'Alcance', icono: Target },
  { num: 5, titulo: 'Impacto HH', icono: DollarSign },
  { num: 6, titulo: 'Revisión', icono: CheckSquare },
]

const STORAGE_KEY = 'requerimiento-wizard-draft'

function wizardDataToRequerimiento(data: WizardData, ahorroMensual: number, ahorroAnual: number, totalHorasMes: number) {
  const actividades_impacto = (data.actividades ?? []).map(act => {
    let horas_mes = 0
    try { horas_mes = calcularActividad(act).horas_mes } catch {}
    return {
      actividad: act.actividad,
      cargo_ejecuta: act.cargo_ejecuta,
      frecuencia: act.frecuencia,
      tiempo_sin_mejora: act.tiempo_sin_mejora,
      tiempo_sin_mejora_unidad: act.tiempo_sin_mejora_unidad,
      tiempo_con_mejora: act.tiempo_con_mejora,
      tiempo_con_mejora_unidad: act.tiempo_con_mejora_unidad,
      horas_mes,
      porcentaje_automatizable: 100,
    }
  })

  // Beneficios con nueva estructura completa
  const beneficios_cualitativos = (data.beneficios ?? [])
    .filter(b => b.marcado)
    .map(b => ({
      id: b.id,
      nombre: b.id === 'otro' ? (b.nombre_beneficio || 'Otro') : b.nombre,
      icono: b.icono,
      marcado: true,
      descripcion: b.descripcion ?? '',
      valor_cop: b.valor_cop ?? 0,
      periodicidad: b.periodicidad ?? 'UNICO',
      valor_anual_calculado: b.valor_cop && b.periodicidad
        ? calcValorAnual(b.valor_cop, b.periodicidad) : 0,
      justificacion: b.justificacion ?? '',
    }))

  const totalAnualCualitativos = calcTotalCualitativos(data.beneficios ?? [])

  return {
    identificacion: data.nombre_desarrollo,
    fecha_solicitud: data.fecha_solicitud,
    tipo_solicitud: data.tipo_solicitud,
    origen_requerimiento: data.origen_requerimiento ?? null,
    alcance: data.alcance,
    sucursal: data.sucursal,
    proceso_interno: data.proceso_interno,
    responsable: data.responsable,
    partes_interesadas: data.partes_interesadas ?? [],
    nombre_desarrollo: data.nombre_desarrollo,
    prioridad: data.prioridad,
    descripcion_situacion_actual: data.descripcion_situacion_actual,
    definicion_requerimiento: data.definicion_requerimiento,
    objetivo: data.objetivo,
    criterios_validacion: data.criterios_validacion,
    integra_otros_aplicativos: data.integra_otros_aplicativos ?? false,
    detalle_integracion: data.detalle_integracion,
    tipo_operacion_integracion: data.tipo_operacion_integracion ?? [],
    definicion_usuarios: data.definicion_usuarios,
    impacta: data.impacta,
    tipos_cliente: data.tipos_cliente ?? [],
    procesos_cargos: (data.procesos_cargos ?? []).map(p => ({
      proceso: p.proceso,
      cargo: p.cargo,
      cantidad_usuarios: 0,
    })),
    ventajas_beneficios: data.ventajas_beneficios,
    actividades_impacto,
    salario_promedio_cargo: data.salario_promedio_cargo,
    horas_laborales_mes: data.horas_laborales_mes ?? 192,
    valor_hora_hombre: data.salario_promedio_cargo && data.horas_laborales_mes
      ? data.salario_promedio_cargo / data.horas_laborales_mes : undefined,
    horas_ahorradas_mes: totalHorasMes,
    ahorro_mensual_cop: ahorroMensual,
    ahorro_anual_cop: ahorroAnual,
    beneficios_cualitativos,
    total_beneficios_cualitativos_anual: totalAnualCualitativos,
    impacto_economico_total_anual: ahorroAnual + totalAnualCualitativos,
  }
}

interface Props {
  requerimiento?: Requerimiento
  redirectBasePath?: string
  isAdmin?: boolean
}

export function RequerimientoWizard({ requerimiento, redirectBasePath = '/admin/requerimientos', isAdmin = false }: Props) {
  const router = useRouter()
  const [pasoActual, setPasoActual] = useState(1)
  const [confirmado, setConfirmado] = useState(false)
  const [anexos, setAnexos] = useState<AnexoLocal[]>([])
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [isPending, startTransition] = useTransition()
  const [usuarios, setUsuarios] = useState<Perfil[]>([])
  const carpetaTemporal = requerimiento?.id ?? `temp_${Date.now()}`

  useEffect(() => {
    getPerfilesActivos().then(setUsuarios).catch(() => {})
  }, [])

  // ─── Inicializar form ─────────────────────────────────────────────────────
  const form = useForm<WizardData>({
    resolver: zodResolver(wizardSchema) as any,
    defaultValues: requerimiento
      ? {
          ...defaultWizardValues(),
          fecha_solicitud: requerimiento.fecha_solicitud ?? new Date().toISOString().split('T')[0],
          tipo_solicitud: requerimiento.tipo_solicitud as WizardData['tipo_solicitud'],
          origen_requerimiento: (requerimiento.origen_requerimiento as WizardData['origen_requerimiento']) ?? undefined,
          alcance: requerimiento.alcance as WizardData['alcance'],
          sucursal: requerimiento.sucursal ?? '',
          proceso_interno: requerimiento.proceso_interno as WizardData['proceso_interno'],
          responsable: requerimiento.responsable ?? '',
          partes_interesadas: requerimiento.partes_interesadas ?? [],
          nombre_desarrollo: requerimiento.nombre_desarrollo ?? '',
          prioridad: requerimiento.prioridad ?? undefined,
          descripcion_situacion_actual: requerimiento.descripcion_situacion_actual ?? '',
          definicion_requerimiento: requerimiento.definicion_requerimiento ?? '',
          objetivo: requerimiento.objetivo ?? '',
          criterios_validacion: requerimiento.criterios_validacion ?? '',
          integra_otros_aplicativos: requerimiento.integra_otros_aplicativos ?? false,
          detalle_integracion: requerimiento.detalle_integracion ?? '',
          tipo_operacion_integracion: requerimiento.tipo_operacion_integracion ?? [],
          definicion_usuarios: requerimiento.definicion_usuarios ?? '',
          impacta: requerimiento.impacta as WizardData['impacta'],
          tipos_cliente: requerimiento.tipos_cliente ?? [],
          procesos_cargos: (requerimiento.procesos_cargos as any[]) ?? [],
          ventajas_beneficios: requerimiento.ventajas_beneficios ?? '',
          salario_promedio_cargo: requerimiento.salario_promedio_cargo ?? undefined,
          horas_laborales_mes: requerimiento.horas_laborales_mes ?? 192,
          beneficios: (() => {
            const saved = (requerimiento.beneficios_cualitativos as any[]) ?? []
            return BENEFICIOS_CONFIG.map(cfg => {
              const guardado = saved.find((b: any) => b.id === cfg.id)
              if (guardado) {
                return {
                  ...cfg,
                  marcado: true,
                  nombre_beneficio: guardado.nombre_beneficio ?? '',
                  descripcion: guardado.descripcion ?? '',
                  valor_cop: guardado.valor_cop ?? undefined,
                  periodicidad: guardado.periodicidad as 'UNICO'|'MENSUAL'|'ANUAL'|undefined,
                  valor_anual_calculado: guardado.valor_anual_calculado ?? 0,
                  justificacion: guardado.justificacion ?? '',
                }
              }
              return {
                ...cfg, marcado: false,
                nombre_beneficio: '', descripcion: '',
                valor_cop: undefined, periodicidad: undefined,
                valor_anual_calculado: 0, justificacion: '',
              }
            })
          })(),
        }
      : defaultWizardValues() as WizardData,
    mode: 'onChange',
  })

  // ─── Auto-save localStorage ───────────────────────────────────────────────
  const guardarLocalStorage = useCallback(() => {
    if (requerimiento) return // no guardar en localStorage en modo edición
    const data = form.getValues()
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ data, paso: pasoActual }))
    setLastSaved(new Date())
  }, [form, pasoActual, requerimiento])

  useEffect(() => {
    // Restaurar borrador si existe (solo en modo nuevo)
    if (!requerimiento) {
      try {
        const saved = localStorage.getItem(STORAGE_KEY)
        if (saved) {
          const { data, paso } = JSON.parse(saved)
          form.reset(data)
          setPasoActual(paso ?? 1)
          toast.info('Borrador restaurado', { description: 'Se recuperó tu progreso anterior' })
        }
      } catch {}
    }

    const interval = setInterval(guardarLocalStorage, 30_000)
    return () => clearInterval(interval)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Cálculos globales ────────────────────────────────────────────────────
  const actividades = form.watch('actividades') ?? []
  const totalHorasMes = actividades.reduce((sum, act) => {
    try { return sum + calcularActividad(act).horas_mes } catch { return sum }
  }, 0)
  const salario = form.watch('salario_promedio_cargo') ?? 0
  const horasLab = form.watch('horas_laborales_mes') ?? 192
  const valorHora = salario && horasLab ? salario / horasLab : 0
  const ahorroMensual = totalHorasMes * valorHora
  const ahorroAnual = ahorroMensual * 12

  // ─── Navegación entre pasos ───────────────────────────────────────────────
  const irSiguiente = async () => {
    const campos = CAMPOS_POR_PASO[pasoActual]
    if (campos.length > 0) {
      const ok = await form.trigger(campos)
      if (!ok) return
    }
    guardarLocalStorage()
    setPasoActual(p => Math.min(p + 1, 6))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const irAnterior = () => {
    setPasoActual(p => Math.max(p - 1, 1))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // ─── Submit ───────────────────────────────────────────────────────────────
  const handleSubmit = (esBorrador: boolean) => {
    if (pasoActual === 6 && !confirmado && !esBorrador) {
      toast.error('Confirma que la información es correcta antes de enviar')
      return
    }

    startTransition(async () => {
      try {
        const data = form.getValues()
        const payload = wizardDataToRequerimiento(data, ahorroMensual, ahorroAnual, totalHorasMes)

        let id: string
        if (requerimiento) {
          await actualizarRequerimiento(requerimiento.id, { ...payload, es_borrador: esBorrador })
          id = requerimiento.id
        } else {
          const result = await crearRequerimiento({ ...payload, es_borrador: esBorrador })
          id = result.id
        }

        // Guardar URLs de anexos en la tabla 'anexos' de Supabase
        if (anexos.length > 0) {
          await Promise.allSettled(
            anexos.map(a =>
              registrarAnexo(id, {
                nombre_archivo: a.nombre,
                url_storage:    a.url,
                tipo_archivo:   a.tipo,
                tamanio_bytes:  a.tamanio,
              })
            )
          )
        }

        // Limpiar localStorage
        if (!esBorrador) localStorage.removeItem(STORAGE_KEY)

        toast.success(
          esBorrador ? 'Borrador guardado' : 'Solicitud enviada correctamente',
          { description: esBorrador ? 'Puedes continuar más tarde' : 'El equipo TIN ha sido notificado' }
        )
        router.push(`${redirectBasePath}/${id}`)
      } catch (err: any) {
        toast.error('Error al guardar', { description: err?.message })
      }
    })
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      {/* Indicador de auto-guardado */}
      {lastSaved && (
        <p className="text-xs text-slate-400">
          💾 Borrador guardado {formatFechaRelativa(lastSaved)}
        </p>
      )}

      {/* Barra de progreso */}
      <div className="relative flex items-center justify-between">
        {PASOS.map((paso, idx) => {
          const completado = pasoActual > paso.num
          const activo = pasoActual === paso.num
          const Icon = paso.icono
          return (
            <div key={paso.num} className="flex flex-1 flex-col items-center">
              {/* Línea conectora */}
              {idx > 0 && (
                <div
                  className={cn(
                    'absolute h-0.5 transition-colors',
                    completado || activo ? 'bg-blue-400' : 'bg-slate-200'
                  )}
                  style={{
                    left: `${((idx - 0.5) / (PASOS.length - 1)) * 100}%`,
                    right: `${((PASOS.length - idx - 0.5) / (PASOS.length - 1)) * 100}%`,
                    top: '18px',
                  }}
                />
              )}

              {/* Círculo */}
              <div
                className={cn(
                  'relative z-10 flex h-9 w-9 items-center justify-center rounded-full border-2 transition-all',
                  completado
                    ? 'border-emerald-500 bg-emerald-500 text-white'
                    : activo
                    ? 'border-blue-500 bg-blue-500 text-white shadow-md ring-4 ring-blue-100'
                    : 'border-slate-200 bg-white text-slate-400'
                )}
              >
                {completado ? <Check size={16} /> : <Icon size={16} />}
              </div>

              {/* Label */}
              <span className={cn(
                'mt-1.5 hidden text-xs font-medium sm:block',
                activo ? 'text-blue-600' : completado ? 'text-emerald-600' : 'text-slate-400'
              )}>
                {paso.titulo}
              </span>
            </div>
          )
        })}
      </div>

      {/* Título del paso */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-1 text-base font-bold text-slate-800">
          Paso {pasoActual} de 6 — {PASOS[pasoActual - 1].titulo}
        </h2>
        <p className="mb-6 text-sm text-slate-500">
          {pasoActual === 1 && 'Selecciona el tipo de solicitud y la fecha'}
          {pasoActual === 2 && 'Información del área y persona responsable'}
          {pasoActual === 3 && 'Descripción detallada del requerimiento'}
          {pasoActual === 4 && 'Alcance e impacto del desarrollo'}
          {pasoActual === 5 && 'Cuantifica el ahorro en horas hombre'}
          {pasoActual === 6 && 'Revisa y confirma antes de enviar'}
        </p>

        {/* Contenido del paso */}
        {pasoActual === 1 && <Paso1Encabezado form={form} />}
        {pasoActual === 2 && <Paso2Solicitante form={form} usuarios={usuarios} isAdmin={isAdmin} />}
        {pasoActual === 3 && (
          <Paso3Descripcion
            form={form}
            anexos={anexos}
            onAnexosChange={setAnexos}
            carpetaTemporal={carpetaTemporal}
          />
        )}
        {pasoActual === 4 && <Paso4Alcance form={form} />}
        {pasoActual === 5 && <Paso5ImpactoHH form={form} />}
        {pasoActual === 6 && (
          <Paso6Revision
            form={form}
            confirmado={confirmado}
            onConfirmadoChange={setConfirmado}
          />
        )}
      </div>

      {/* Botones de navegación */}
      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="outline"
          onClick={irAnterior}
          disabled={pasoActual === 1 || isPending}
        >
          ← Anterior
        </Button>

        <div className="flex gap-2">
          {pasoActual === 6 ? (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleSubmit(true)}
                disabled={isPending}
                className="gap-1.5"
              >
                <Save size={15} /> Guardar borrador
              </Button>
              <Button
                type="button"
                onClick={() => handleSubmit(false)}
                disabled={isPending || !confirmado}
                className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
              >
                <Check size={15} />
                {isPending ? 'Enviando...' : 'Enviar solicitud'}
              </Button>
            </>
          ) : (
            <Button
              type="button"
              onClick={irSiguiente}
              disabled={isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Siguiente →
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
