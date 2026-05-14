import { z } from 'zod'

// ─── Schemas por paso ─────────────────────────────────────────────────────────

export const paso1Schema = z.object({
  fecha_solicitud: z.string().min(1, 'La fecha es requerida'),
  tipo_solicitud: z.enum(['NUEVO_DESARROLLO', 'MEJORA', 'INTEGRACION', 'INFORME'] as const),
})

export const paso2Schema = z.object({
  alcance: z.enum(['IWF', 'ILT', 'IWG'] as const),
  sucursal: z.string().min(1, 'La sucursal es requerida'),
  proceso_interno: z.enum([
    'FINANCIERO', 'OPERACIONES', 'COMERCIAL', 'CARGA',
    'SISTEMAS_GESTION', 'SERVICIO_CLIENTE', 'COMPRAS',
    'SEGUROS', 'DATOS', 'TI', 'GENERAL',
  ] as const),
  responsable: z.string().min(1, 'El responsable es requerido'),
  partes_interesadas: z.array(z.string()).default([]),
  nombre_desarrollo: z.string()
    .min(1, 'El nombre del desarrollo es requerido')
    .max(300, 'Máximo 300 caracteres'),
  prioridad: z.number().min(1).max(4),
})

export const paso3Schema = z.object({
  descripcion_situacion_actual: z.string().min(1, 'Requerido'),
  definicion_requerimiento: z.string().min(1, 'Requerido'),
  objetivo: z.string().min(1, 'Requerido'),
  criterios_validacion: z.string().min(1, 'Requerido'),
  integra_otros_aplicativos: z.boolean().default(false),
  detalle_integracion: z.string().optional(),
  tipo_operacion_integracion: z.array(z.string()).default([]),
  definicion_usuarios: z.string().optional(),
})

export const paso4Schema = z.object({
  impacta: z.enum(['FUNCIONARIOS', 'CLIENTES', 'AMBOS'] as const),
  tipos_cliente: z.array(z.string()).default([]),
  procesos_cargos: z.array(z.object({
    proceso: z.string().min(1),
    cargo: z.string().min(1),
    nivel_impacto: z.enum(['ALTO', 'MEDIO', 'BAJO'] as const),
  })).default([]),
  ventajas_beneficios: z.string().min(1, 'Requerido'),
})

export const actividadSchema = z.object({
  actividad: z.string().min(1),
  cargo_ejecuta: z.string().min(1),
  frecuencia: z.enum(['DIARIA', 'SEMANAL', 'QUINCENAL', 'MENSUAL'] as const),
  tiempo_sin_mejora: z.number().min(0),
  tiempo_sin_mejora_unidad: z.enum(['MINUTOS', 'HORAS'] as const),
  tiempo_con_mejora: z.number().min(0),
  tiempo_con_mejora_unidad: z.enum(['MINUTOS', 'HORAS'] as const),
})

export const beneficioSchema = z.object({
  tipo: z.string(),
  seleccionado: z.boolean().default(false),
  descripcion: z.string().default(''),
})

export const paso5Schema = z.object({
  actividades: z.array(actividadSchema).default([]),
  salario_promedio_cargo: z.number().optional(),
  horas_laborales_mes: z.number().default(192),
  beneficios: z.array(beneficioSchema).default([]),
})

// ─── Schema completo ──────────────────────────────────────────────────────────
export const wizardSchema = paso1Schema
  .merge(paso2Schema)
  .merge(paso3Schema)
  .merge(paso4Schema)
  .merge(paso5Schema)

export type WizardData = z.infer<typeof wizardSchema>

// ─── Campos a validar por paso ────────────────────────────────────────────────
export const CAMPOS_POR_PASO: Record<number, (keyof WizardData)[]> = {
  1: ['fecha_solicitud', 'tipo_solicitud'],
  2: ['alcance', 'sucursal', 'proceso_interno', 'responsable', 'nombre_desarrollo', 'prioridad'],
  3: ['descripcion_situacion_actual', 'definicion_requerimiento', 'objetivo', 'criterios_validacion'],
  4: ['impacta', 'ventajas_beneficios'],
  5: [],
  6: [],
}

// ─── Constantes ───────────────────────────────────────────────────────────────
export const BENEFICIOS_OPCIONES = [
  'Ventaja competitiva frente al mercado',
  'Mejora en seguridad de la información',
  'Reducción de errores operativos',
  'Mejor experiencia del cliente/usuario',
  'Cumplimiento normativo o regulatorio',
  'Optimización de almacenamiento de datos',
  'Eliminación de reprocesos',
  'Reducción de riesgos operacionales',
  'Otro beneficio',
]

export const FRECUENCIA_MENSUAL: Record<string, number> = {
  DIARIA: 22,
  SEMANAL: 4,
  QUINCENAL: 2,
  MENSUAL: 1,
}

export function calcularActividad(act: z.infer<typeof actividadSchema>) {
  const toHoras = (val: number, unit: string) => unit === 'MINUTOS' ? val / 60 : val
  const sinMejora = toHoras(act.tiempo_sin_mejora ?? 0, act.tiempo_sin_mejora_unidad ?? 'MINUTOS')
  const conMejora = toHoras(act.tiempo_con_mejora ?? 0, act.tiempo_con_mejora_unidad ?? 'MINUTOS')
  const ahorroOcurrencia = Math.max(0, sinMejora - conMejora)
  const frecMes = FRECUENCIA_MENSUAL[act.frecuencia] ?? 1
  return {
    ahorro_ocurrencia: ahorroOcurrencia,
    horas_mes: ahorroOcurrencia * frecMes,
  }
}

export function defaultWizardValues(): Partial<WizardData> {
  return {
    fecha_solicitud: new Date().toISOString().split('T')[0],
    partes_interesadas: [],
    tipo_operacion_integracion: [],
    integra_otros_aplicativos: false,
    tipos_cliente: [],
    procesos_cargos: [],
    actividades: [],
    horas_laborales_mes: 192,
    beneficios: BENEFICIOS_OPCIONES.map(tipo => ({
      tipo, seleccionado: false, descripcion: '',
    })),
  }
}
