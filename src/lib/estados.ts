import { ESTADOS, getEstadoCfg } from '@/lib/constants'
import type { EstadoKanban } from '@/lib/supabase/types'

/** Estado del catálogo parametrizable (tabla estados_kanban, Configuración → Estados) */
export type EstadoCatalogo = Pick<EstadoKanban, 'nombre' | 'label' | 'activo' | 'es_final' | 'orden'>

/** Catálogo de respaldo mientras no se pueda leer la tabla: los nombres fijos del código */
export const ESTADOS_POR_DEFECTO: EstadoCatalogo[] = Object.entries(ESTADOS).map(([nombre, cfg], i) => ({
  nombre,
  label: cfg.label,
  activo: true,
  es_final: false,
  orden: (i + 1) * 10,
}))

/** Nombre con el que se configuró el estado; si no está en el catálogo, el nombre fijo o el código */
export function labelDeEstado(catalogo: EstadoCatalogo[], nombre: string | null | undefined): string {
  if (!nombre) return ''
  return catalogo.find(e => e.nombre === nombre)?.label ?? getEstadoCfg(nombre).label
}

/** Configuración visual del estado (colores, ícono) con el nombre configurado */
export function cfgDeEstado(catalogo: EstadoCatalogo[], nombre: string) {
  return { ...getEstadoCfg(nombre), label: labelDeEstado(catalogo, nombre) }
}

/** Códigos para filtros y selectores: los del catálogo en su orden y luego cualquier otro conocido */
export function codigosDeEstado(catalogo: EstadoCatalogo[], extra: string[] = []): string[] {
  const codigos = catalogo.map(e => e.nombre)
  for (const c of [...Object.keys(ESTADOS), ...extra]) if (!codigos.includes(c)) codigos.push(c)
  return codigos
}
