/** Valor del filtro de desarrollador para requerimientos sin nadie asignado */
export const SIN_DESARROLLADOR = 'sin_asignar'

const UUID_VACIO = '00000000-0000-0000-0000-000000000000'

/**
 * Restringe una consulta de requerimientos (columna `id`) a los asignados al desarrollador,
 * o a los que no tienen ninguno con SIN_DESARROLLADOR. Uso exclusivo en servidor.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function aplicarFiltroDesarrollador(supabase: any, query: any, desarrollador?: string): Promise<any> {
  if (!desarrollador) return query
  if (desarrollador === SIN_DESARROLLADOR) {
    const { data } = await supabase.from('requerimiento_desarrolladores').select('requerimiento_id')
    const ids = [...new Set((data ?? []).map((r: { requerimiento_id: string }) => r.requerimiento_id))]
    return ids.length ? query.not('id', 'in', `(${ids.join(',')})`) : query
  }
  const { data } = await supabase
    .from('requerimiento_desarrolladores')
    .select('requerimiento_id')
    .eq('perfil_id', desarrollador)
  const ids = (data ?? []).map((r: { requerimiento_id: string }) => r.requerimiento_id)
  return query.in('id', ids.length ? ids : [UUID_VACIO])
}

/** Filtro en memoria para listas que ya tienen requerimiento_id (pendientes, reportes) */
export function coincideDesarrollador(
  requerimientoId: string,
  desarrollador: string,
  porRequerimiento: Record<string, string[]>,
): boolean {
  if (!desarrollador) return true
  const asignados = porRequerimiento[requerimientoId] ?? []
  return desarrollador === SIN_DESARROLLADOR ? asignados.length === 0 : asignados.includes(desarrollador)
}
