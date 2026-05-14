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

// ─── Beneficio cualitativo con cuantificación económica ───────────────────────
export const beneficioSchema = z.object({
  id: z.string(),
  nombre: z.string(),
  icono: z.string(),
  marcado: z.boolean().default(false),
  nombre_beneficio: z.string().optional(),    // solo para "Otro"
  descripcion: z.string().optional(),
  valor_cop: z.number().min(0).optional(),
  periodicidad: z.enum(['UNICO', 'MENSUAL', 'ANUAL'] as const).optional(),
  valor_anual_calculado: z.number().min(0).optional(),
  justificacion: z.string().optional(),
})

export type BeneficioItem = z.infer<typeof beneficioSchema>

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

// ─── Catálogo de beneficios cualitativos ──────────────────────────────────────
export const BENEFICIOS_CONFIG: Pick<BeneficioItem, 'id' | 'nombre' | 'icono'>[] = [
  { id: 'ventaja_competitiva',    nombre: 'Ventaja competitiva frente al mercado',    icono: '🏆' },
  { id: 'seguridad_informacion',  nombre: 'Mejora en seguridad de la información',    icono: '🔒' },
  { id: 'reduccion_errores',      nombre: 'Reducción de errores operativos',          icono: '❌' },
  { id: 'experiencia_cliente',    nombre: 'Mejor experiencia del cliente / usuario',  icono: '😊' },
  { id: 'cumplimiento_normativo', nombre: 'Cumplimiento normativo o regulatorio',     icono: '⚖️' },
  { id: 'almacenamiento',         nombre: 'Optimización de almacenamiento de datos',  icono: '💾' },
  { id: 'eliminacion_reprocesos', nombre: 'Eliminación de reprocesos',               icono: '🔄' },
  { id: 'reduccion_riesgos',      nombre: 'Reducción de riesgos operacionales',       icono: '⚠️' },
  { id: 'otro',                   nombre: 'Otro beneficio',                           icono: '➕' },
]

// ─── Cálculo de valor anual según periodicidad ────────────────────────────────
export function calcValorAnual(valorCop: number, periodicidad: string): number {
  switch (periodicidad) {
    case 'MENSUAL': return valorCop * 12
    case 'UNICO':   return valorCop
    case 'ANUAL':   return valorCop
    default:        return 0
  }
}

export function calcTotalCualitativos(beneficios: BeneficioItem[]): number {
  return beneficios
    .filter(b => b.marcado)
    .reduce((sum, b) => sum + (b.valor_anual_calculado ?? 0), 0)
}

// ─── Constantes ───────────────────────────────────────────────────────────────
export const FRECUENCIA_MENSUAL: Record<string, number> = {
  DIARIA: 22, SEMANAL: 4, QUINCENAL: 2, MENSUAL: 1,
}

export function calcularActividad(act: z.infer<typeof actividadSchema>) {
  const toHoras = (val: number, unit: string) => unit === 'MINUTOS' ? val / 60 : val
  const sinMejora = toHoras(act.tiempo_sin_mejora ?? 0, act.tiempo_sin_mejora_unidad ?? 'MINUTOS')
  const conMejora = toHoras(act.tiempo_con_mejora ?? 0, act.tiempo_con_mejora_unidad ?? 'MINUTOS')
  const ahorroOcurrencia = Math.max(0, sinMejora - conMejora)
  const frecMes = FRECUENCIA_MENSUAL[act.frecuencia] ?? 1
  return { ahorro_ocurrencia: ahorroOcurrencia, horas_mes: ahorroOcurrencia * frecMes }
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
    beneficios: BENEFICIOS_CONFIG.map(b => ({
      ...b,
      marcado: false,
      nombre_beneficio: '',
      descripcion: '',
      valor_cop: undefined,
      periodicidad: undefined,
      valor_anual_calculado: 0,
      justificacion: '',
    })),
  }
}
