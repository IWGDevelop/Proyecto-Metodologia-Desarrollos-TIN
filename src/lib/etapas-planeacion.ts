/** Etapas (estados del Kanban) que se planean con fecha de inicio y fin en el tab Fechas. */

export interface EtapaPlaneacion {
  /** Nombre del estado en estados_kanban / requerimientos.estado */
  estado: string
  label: string
}

// En el orden en que ocurren dentro del ciclo del requerimiento
export const ETAPAS_PLANEACION: EtapaPlaneacion[] = [
  { estado: 'EN_DEFINICION_USUARIO',          label: 'Definición de usuario' },
  { estado: 'ANALISIS',                       label: 'Estudio y evaluación técnica' },
  { estado: 'EN_DESARROLLO',                  label: 'Desarrollo' },
  { estado: 'PRUEBAS_DE_TESTING_Y_QA',        label: 'Pruebas de Testing y QA' },
  { estado: 'PRUEBAS_USUARIO',                label: 'Pruebas de usuario' },
  { estado: 'PROGRAMADO_PARA_SALIDA_EN_VIVO', label: 'Programado para salida en vivo' },
  { estado: 'CERRADO',                        label: 'Cerrado' },
]

/** tipo_fecha con el que se registran en historial_fechas los cambios de planeación */
export function tipoFechaPlaneacion(campo: 'inicio' | 'fin', estado: string): string {
  return `plan_${campo}:${estado}`
}

/** Etiqueta legible de un tipo_fecha de planeación, o null si no es de planeación */
export function labelTipoFechaPlaneacion(tipoFecha: string): string | null {
  const m = /^plan_(inicio|fin):(.+)$/.exec(tipoFecha)
  if (!m) return null
  const etapa = ETAPAS_PLANEACION.find(e => e.estado === m[2])
  return `Planeación · ${m[1] === 'inicio' ? 'Inicio' : 'Fin'} de ${etapa?.label ?? m[2]}`
}

export interface EjecucionEtapa {
  /** Primera vez que el requerimiento entró a la etapa (YYYY-MM-DD) */
  inicio: string | null
  /** Última vez que salió de la etapa; null si nunca entró o si está en ella actualmente */
  fin: string | null
  /** El requerimiento está actualmente en esta etapa */
  enCurso: boolean
  /** Número de veces que entró a la etapa (más de 1 = reprocesos) */
  veces: number
}

const aFecha = (iso: string) => iso.slice(0, 10)

/**
 * Calcula, a partir del historial de cambios de estado, cuándo inició y terminó realmente cada etapa.
 * Una etapa empieza cuando el requerimiento entra al estado y termina con el siguiente cambio de estado.
 */
export function calcularEjecucionEtapas(
  historial: { estado_nuevo: string; created_at: string }[],
): Record<string, EjecucionEtapa> {
  const ordenado = [...historial].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )
  const resultado: Record<string, EjecucionEtapa> = {}

  ordenado.forEach((h, i) => {
    const siguiente = ordenado[i + 1]
    const actual = resultado[h.estado_nuevo] ?? { inicio: null, fin: null, enCurso: false, veces: 0 }
    actual.inicio ??= aFecha(h.created_at)
    actual.veces += 1
    actual.enCurso = !siguiente
    actual.fin = siguiente ? aFecha(siguiente.created_at) : null
    resultado[h.estado_nuevo] = actual
  })

  return resultado
}
