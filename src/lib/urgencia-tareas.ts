import type { UrgenciaTarea } from '@/lib/email-templates'

/** Días o menos para considerar una tarea "próxima a vencer" */
export const DIAS_PROXIMA_A_VENCER = 3

/** Fecha de hoy (YYYY-MM-DD) en Colombia, sin importar la zona horaria del servidor o navegador */
export function hoyColombia(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date())
}

/** Días entre hoy (Colombia) y la fecha de compromiso; negativo = días de retraso */
export function diasHastaCompromiso(fechaCompromiso: string | null): number | null {
  if (!fechaCompromiso) return null
  const [y1, m1, d1] = hoyColombia().split('-').map(Number)
  const [y2, m2, d2] = fechaCompromiso.slice(0, 10).split('-').map(Number)
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000)
}

export function urgenciaTarea(fechaCompromiso: string | null): UrgenciaTarea {
  const dias = diasHastaCompromiso(fechaCompromiso)
  if (dias == null) return 'SIN_FECHA'
  if (dias < 0) return 'VENCIDA'
  if (dias <= DIAS_PROXIMA_A_VENCER) return 'PROXIMA'
  return 'AL_DIA'
}
