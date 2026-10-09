/** Etapas del tab Fechas: cada una tiene fecha estimada, fecha real y genera una tarea con responsable. */

export type TipoEtapaFecha =
  | 'definicion_usuario'
  | 'entrega'
  | 'testing'
  | 'pruebas'
  | 'ajustes'
  | 'salida_vivo'

export interface EtapaFecha {
  tipo: TipoEtapaFecha
  titulo: string
  /** Columna de la fecha estimada en requerimientos */
  estimada: string
  /** Columna de la fecha real en requerimientos */
  real: string
}

// En el orden en que ocurren dentro del ciclo del requerimiento
export const ETAPAS_FECHA: EtapaFecha[] = [
  { tipo: 'definicion_usuario', titulo: 'Definición de usuario',          estimada: 'fecha_estimada_definicion_usuario', real: 'fecha_real_definicion_usuario' },
  { tipo: 'entrega',            titulo: 'Entrega del desarrollo',         estimada: 'fecha_estimada_entrega',            real: 'fecha_real_entrega' },
  { tipo: 'testing',            titulo: 'Fin de pruebas Testing',         estimada: 'fecha_estimada_fin_testing',        real: 'fecha_real_fin_testing' },
  { tipo: 'pruebas',            titulo: 'Feedback de pruebas de usuario', estimada: 'fecha_estimada_feedback_pruebas',   real: 'fecha_real_feedback_pruebas' },
  { tipo: 'ajustes',            titulo: 'Ajustes técnicos',               estimada: 'fecha_estimada_ajustes_tecnicos',   real: 'fecha_real_ajustes_tecnicos' },
  { tipo: 'salida_vivo',        titulo: 'Salida en vivo',                 estimada: 'fecha_estimada_salida_vivo',        real: 'fecha_salida_vivo' },
]

export function getEtapaFecha(tipo: string | null | undefined): EtapaFecha | undefined {
  return ETAPAS_FECHA.find(e => e.tipo === tipo)
}

/** Descripción de la tarea que se genera para la etapa */
export function descripcionTareaEtapa(etapa: EtapaFecha): string {
  return `Fecha compromiso · ${etapa.titulo}`
}
