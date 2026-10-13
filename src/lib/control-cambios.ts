/** Catálogos del control de cambios de requerimientos */

export type TipoCambio = 'ALCANCE' | 'FUNCIONAL' | 'TECNICO' | 'CRONOGRAMA' | 'DATOS' | 'OTRO'
export type EstadoCambio = 'SOLICITADO' | 'EN_EVALUACION' | 'APROBADO' | 'RECHAZADO' | 'IMPLEMENTADO'

export const TIPOS_CAMBIO: Record<TipoCambio, { label: string; descripcion: string; clase: string }> = {
  ALCANCE:    { label: 'Alcance',    descripcion: 'Agrega o quita funcionalidades del alcance acordado', clase: 'bg-violet-50 text-violet-700 border-violet-200' },
  FUNCIONAL:  { label: 'Funcional',  descripcion: 'Modifica el comportamiento o reglas de negocio',     clase: 'bg-blue-50 text-blue-700 border-blue-200' },
  TECNICO:    { label: 'Técnico',    descripcion: 'Arquitectura, integraciones o infraestructura',       clase: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  CRONOGRAMA: { label: 'Cronograma', descripcion: 'Cambia fechas o la secuencia de entregas',            clase: 'bg-amber-50 text-amber-700 border-amber-200' },
  DATOS:      { label: 'Datos',      descripcion: 'Estructura, fuentes o calidad de la información',     clase: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  OTRO:       { label: 'Otro',       descripcion: 'Cualquier otro tipo de cambio',                       clase: 'bg-slate-50 text-slate-600 border-slate-200' },
}

export const ESTADOS_CAMBIO: Record<EstadoCambio, { label: string; clase: string; punto: string }> = {
  SOLICITADO:    { label: 'Solicitado',    clase: 'bg-slate-100 text-slate-700',     punto: 'bg-slate-400' },
  EN_EVALUACION: { label: 'En evaluación', clase: 'bg-amber-100 text-amber-800',     punto: 'bg-amber-500' },
  APROBADO:      { label: 'Aprobado',      clase: 'bg-blue-100 text-blue-700',       punto: 'bg-blue-500' },
  RECHAZADO:     { label: 'Rechazado',     clase: 'bg-red-100 text-red-700',         punto: 'bg-red-500' },
  IMPLEMENTADO:  { label: 'Implementado',  clase: 'bg-emerald-100 text-emerald-700', punto: 'bg-emerald-500' },
}

/** Transiciones permitidas desde cada estado */
export const TRANSICIONES_CAMBIO: Record<EstadoCambio, EstadoCambio[]> = {
  SOLICITADO:    ['EN_EVALUACION', 'APROBADO', 'RECHAZADO'],
  EN_EVALUACION: ['APROBADO', 'RECHAZADO', 'SOLICITADO'],
  APROBADO:      ['IMPLEMENTADO', 'EN_EVALUACION'],
  RECHAZADO:     ['EN_EVALUACION'],
  IMPLEMENTADO:  ['APROBADO'],
}

/** Estados que registran una decisión (quién decide y cuándo) */
export const ESTADOS_DECISION: EstadoCambio[] = ['APROBADO', 'RECHAZADO']

export function codigoCambio(consecutivo: number): string {
  return `CC-${String(consecutivo).padStart(3, '0')}`
}
