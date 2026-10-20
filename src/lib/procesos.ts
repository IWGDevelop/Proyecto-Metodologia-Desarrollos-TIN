import { PROCESOS_INTERNOS } from '@/lib/constants'

/** Proceso interno del catálogo parametrizable (tabla procesos_internos) */
export interface ProcesoInternoCfg {
  /** Código que se guarda en los registros; no cambia una vez creado */
  value: string
  label: string
  /** Inactivo: no se ofrece en los formularios, pero se sigue mostrando en los registros existentes */
  activo: boolean
  orden: number
}

/** Catálogo de respaldo mientras no exista la tabla (mismos valores que la migración inicial) */
export const PROCESOS_POR_DEFECTO: ProcesoInternoCfg[] = PROCESOS_INTERNOS.map((p, i) => ({
  value: p.value,
  label: p.label,
  activo: p.value !== 'GENERAL',
  orden: (i + 1) * 10,
}))

/** Nombre visible de un proceso; si no está en el catálogo se muestra el código */
export function labelDeProceso(catalogo: ProcesoInternoCfg[], valor: string | null | undefined): string {
  if (!valor) return ''
  return catalogo.find(p => p.value === valor)?.label ?? valor.replace(/_/g, ' ')
}

/** Código a partir del nombre: "Tráfico y Seguridad" → "TRAFICO_Y_SEGURIDAD" */
export function codigoDesdeNombre(nombre: string): string {
  return nombre
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40)
}
