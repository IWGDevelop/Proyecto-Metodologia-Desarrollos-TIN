'use server'

import { exigirAccesoAdmin } from '@/lib/supabase/guards'
import { createAdminClient } from '@/lib/supabase/admin'
import { ETAPAS_PLANEACION, calcularEjecucionEtapas } from '@/lib/etapas-planeacion'
import { computeEtiquetaJerarquica } from '@/lib/constants'

/** Cumplimiento de una etapa frente a su planeación */
export type CumplimientoEtapa =
  | 'A_TIEMPO'          // terminó en o antes del fin planeado
  | 'RETRASADA'         // terminó después del fin planeado
  | 'EN_CURSO'          // en ejecución, dentro del plazo
  | 'VENCIDA'           // en ejecución y ya pasó el fin planeado
  | 'INICIO_ATRASADO'   // no ha iniciado y ya pasó el inicio planeado
  | 'PENDIENTE'         // no ha iniciado, aún dentro del plazo
  | 'OMITIDA'           // el requerimiento avanzó a etapas posteriores sin pasar por esta
  | 'SIN_PLAN'          // sin fechas planeadas

export interface EtapaReporte {
  estado: string
  label: string
  planInicio: string | null
  planFin: string | null
  realInicio: string | null
  realFin: string | null
  enCurso: boolean
  veces: number
  /** Días de diferencia real - planeado (positivo = retraso) */
  desvInicio: number | null
  desvFin: number | null
  duracionPlan: number | null
  duracionReal: number | null
  cumplimiento: CumplimientoEtapa
}

export interface RequerimientoPlaneacion {
  id: string
  numero: string | null
  nombre: string
  estado: string
  proceso_interno: string | null
  prioridad: number | null
  sub_prioridad: number | null
  parent_id: string | null
  /** Etiqueta jerárquica de prioridad (ej. "1.2") */
  etiqueta: string
  /** Profundidad en el árbol de subrequerimientos (0 = raíz) */
  nivel: number
  tieneHijos: boolean
  /** Tiene al menos una fecha de planeación propia */
  tienePlan: boolean
  /** Inicio planeado de la fase de Desarrollo (criterio de orden) */
  inicioDesarrollo: string | null
  desarrolladores: { id: string; nombre: string }[]
  etapas: EtapaReporte[]
}

const ESTADOS_EXCLUIDOS = ['DESISTIDO', 'NO_VIABLE']

function diasEntre(desde: string | null, hasta: string | null): number | null {
  if (!desde || !hasta) return null
  return Math.round((new Date(hasta + 'T12:00:00').getTime() - new Date(desde + 'T12:00:00').getTime()) / 86400000)
}

export async function getReportePlaneacion(): Promise<RequerimientoPlaneacion[]> {
  await exigirAccesoAdmin()
  const supabase = createAdminClient()

  const { data: planes } = await (supabase as any)
    .from('planeacion_etapas')
    .select('requerimiento_id, estado, fecha_inicio, fecha_fin')
  const conPlan = (planes ?? []).filter((p: any) => p.fecha_inicio || p.fecha_fin)
  const idsConPlan = new Set(conPlan.map((p: any) => p.requerimiento_id) as string[])
  if (idsConPlan.size === 0) return []

  const { data: reqs } = await (supabase as any)
    .from('requerimientos')
    .select('id, numero, identificacion, nombre_desarrollo, estado, proceso_interno, prioridad, sub_prioridad, parent_id')
    .eq('es_borrador', false)
    .not('estado', 'in', `(${ESTADOS_EXCLUIDOS.join(',')})`)
  const todos: any[] = reqs ?? []
  const porId = new Map(todos.map(r => [r.id, r]))
  const hijosDe = new Map<string, string[]>()
  for (const r of todos) {
    if (r.parent_id && porId.has(r.parent_id)) hijosDe.set(r.parent_id, [...(hijosDe.get(r.parent_id) ?? []), r.id])
  }

  // Familia a mostrar: los requerimientos planeados, sus ancestros (contexto) y sus subrequerimientos
  const incluidos = new Set<string>()
  const agregarDescendientes = (id: string) => {
    for (const h of hijosDe.get(id) ?? []) if (!incluidos.has(h)) { incluidos.add(h); agregarDescendientes(h) }
  }
  for (const id of idsConPlan) {
    if (!porId.has(id)) continue
    incluidos.add(id)
    agregarDescendientes(id)
    for (let p = porId.get(id)?.parent_id; p && porId.has(p) && !incluidos.has(p); p = porId.get(p)?.parent_id) incluidos.add(p)
  }
  const ids = [...incluidos]
  if (ids.length === 0) return []

  const [{ data: historial }, { data: asignaciones }] = await Promise.all([
    (supabase as any)
      .from('historial_estados')
      .select('requerimiento_id, estado_nuevo, created_at')
      .in('requerimiento_id', ids),
    (supabase as any)
      .from('requerimiento_desarrolladores')
      .select('requerimiento_id, perfil:perfil_id(id, nombre_completo, email)')
      .in('requerimiento_id', ids),
  ])
  const devsPorReq = new Map<string, { id: string; nombre: string }[]>()
  for (const a of asignaciones ?? []) {
    if (!a.perfil) continue
    const lista = devsPorReq.get(a.requerimiento_id) ?? []
    lista.push({ id: a.perfil.id, nombre: a.perfil.nombre_completo ?? a.perfil.email })
    devsPorReq.set(a.requerimiento_id, lista)
  }

  const hoy = new Date().toISOString().slice(0, 10)

  const filas: RequerimientoPlaneacion[] = ids.map(id => porId.get(id)).map((req: any) => {
    const ejecucion = calcularEjecucionEtapas((historial ?? []).filter((h: any) => h.requerimiento_id === req.id))
    // Índice de la etapa planeable más avanzada a la que llegó el requerimiento
    const ultimaAlcanzada = ETAPAS_PLANEACION.reduce((max, e, i) => ejecucion[e.estado] ? i : max, -1)

    const etapas: EtapaReporte[] = ETAPAS_PLANEACION.map((etapa, i) => {
      const plan = conPlan.find((p: any) => p.requerimiento_id === req.id && p.estado === etapa.estado)
      const real = ejecucion[etapa.estado]
      const planInicio: string | null = plan?.fecha_inicio ?? null
      const planFin: string | null = plan?.fecha_fin ?? null
      const realInicio = real?.inicio ?? null
      // Cerrado es un hito: se cumple al entrar al estado
      const esHito = etapa.estado === 'CERRADO'
      const realFin = esHito ? realInicio : (real?.fin ?? null)
      const enCurso = !esHito && !!real?.enCurso

      let cumplimiento: CumplimientoEtapa
      if (!planInicio && !planFin) cumplimiento = 'SIN_PLAN'
      else if (realFin && !enCurso) {
        const desv = diasEntre(planFin ?? planInicio, realFin) ?? 0
        cumplimiento = desv > 0 ? 'RETRASADA' : 'A_TIEMPO'
      }
      else if (enCurso) cumplimiento = planFin && planFin < hoy ? 'VENCIDA' : 'EN_CURSO'
      else if (i < ultimaAlcanzada) cumplimiento = 'OMITIDA'
      else cumplimiento = (planInicio ?? planFin)! < hoy ? 'INICIO_ATRASADO' : 'PENDIENTE'

      return {
        estado: etapa.estado,
        label: etapa.label,
        planInicio,
        planFin,
        realInicio,
        realFin: enCurso ? null : realFin,
        enCurso,
        veces: real?.veces ?? 0,
        desvInicio: diasEntre(planInicio, realInicio),
        desvFin: enCurso ? null : diasEntre(planFin, realFin),
        duracionPlan: diasEntre(planInicio, planFin),
        duracionReal: enCurso ? diasEntre(realInicio, hoy) : diasEntre(realInicio, realFin),
        cumplimiento,
      }
    })

    const parentId: string | null = req.parent_id && incluidos.has(req.parent_id) ? req.parent_id : null
    return {
      id: req.id,
      numero: req.numero ?? null,
      nombre: req.nombre_desarrollo ?? req.identificacion ?? '—',
      estado: req.estado,
      proceso_interno: req.proceso_interno ?? null,
      prioridad: req.prioridad ?? null,
      sub_prioridad: req.sub_prioridad ?? null,
      parent_id: parentId,
      etiqueta: computeEtiquetaJerarquica(req.id, todos),
      nivel: 0,
      tieneHijos: false,
      tienePlan: idsConPlan.has(req.id),
      inicioDesarrollo: etapas.find(e => e.estado === 'EN_DESARROLLO')?.planInicio ?? null,
      desarrolladores: devsPorReq.get(req.id) ?? [],
      etapas,
    }
  })

  return ordenarPorInicioDesarrollo(filas)
}

/**
 * Orden jerárquico: cada padre seguido de sus subrequerimientos.
 * Entre hermanos se ordena por el inicio planeado de Desarrollo (si el nodo no lo tiene,
 * se usa el más temprano de sus subrequerimientos); sin fecha al final, luego por prioridad.
 */
function ordenarPorInicioDesarrollo(filas: RequerimientoPlaneacion[]): RequerimientoPlaneacion[] {
  const hijos = new Map<string | null, RequerimientoPlaneacion[]>()
  for (const f of filas) hijos.set(f.parent_id, [...(hijos.get(f.parent_id) ?? []), f])

  const claveOrden = new Map<string, string | null>()
  const calcularClave = (f: RequerimientoPlaneacion): string | null => {
    if (claveOrden.has(f.id)) return claveOrden.get(f.id)!
    const candidatas = [f.inicioDesarrollo, ...(hijos.get(f.id) ?? []).map(calcularClave)].filter((d): d is string => !!d)
    const clave = candidatas.length ? candidatas.sort()[0] : null
    claveOrden.set(f.id, clave)
    return clave
  }

  const comparar = (a: RequerimientoPlaneacion, b: RequerimientoPlaneacion) => {
    const ka = calcularClave(a), kb = calcularClave(b)
    if (ka !== kb) {
      if (!ka) return 1
      if (!kb) return -1
      return ka < kb ? -1 : 1
    }
    return (a.prioridad ?? 99) - (b.prioridad ?? 99)
      || (a.sub_prioridad ?? 99) - (b.sub_prioridad ?? 99)
      || a.nombre.localeCompare(b.nombre)
  }

  const resultado: RequerimientoPlaneacion[] = []
  const recorrer = (parentId: string | null, nivel: number) => {
    for (const f of [...(hijos.get(parentId) ?? [])].sort(comparar)) {
      resultado.push({ ...f, nivel, tieneHijos: (hijos.get(f.id)?.length ?? 0) > 0 })
      recorrer(f.id, nivel + 1)
    }
  }
  recorrer(null, 0)
  return resultado
}
