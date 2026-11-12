import type { SupabaseClient } from '@supabase/supabase-js'
import type { PermisosMap } from '@/actions/roles-permisos'

// Personal de TI: los perfiles activos cuyo proceso interno es TI o IA.
// Son los únicos que aparecen como responsables de tickets y bugs, y por estar en esos
// procesos pueden atender tickets y entrar a la bandeja aunque su rol no lo tenga.

export const PROCESOS_TI = ['TI', 'IA'] as const

/** Permisos que se conceden por pertenecer a un proceso de TI (además de los del rol) */
export const RECURSOS_PERSONAL_TI = ['menu:tickets', 'tickets:atender'] as const

export function esProcesoTI(proceso: string | null | undefined): boolean {
  return !!proceso && (PROCESOS_TI as readonly string[]).includes(proceso.trim().toUpperCase())
}

/** Agrega al mapa de permisos del rol los que da el proceso de TI */
export function concederPermisosTI(permisos: PermisosMap, proceso: string | null | undefined): PermisosMap {
  if (!esProcesoTI(proceso)) return permisos
  const resultado: PermisosMap = { ...permisos }
  for (const recurso of RECURSOS_PERSONAL_TI) {
    resultado[recurso] = { puede_ver: true, puede_editar: permisos[recurso]?.puede_editar ?? false, puede_crear: permisos[recurso]?.puede_crear ?? false }
  }
  return resultado
}

/** Ids de los perfiles activos de TI (procesos TI e IA), que pueden ser responsables */
export async function idsPersonalTI(supabase: SupabaseClient): Promise<string[]> {
  const { data } = await supabase
    .from('perfiles')
    .select('id')
    .eq('activo', true)
    .in('proceso_interno', [...PROCESOS_TI])
  return (data ?? []).map((p: { id: string }) => p.id)
}
