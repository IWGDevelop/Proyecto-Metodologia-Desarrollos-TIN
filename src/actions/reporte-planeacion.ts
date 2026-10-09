'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { ETAPAS_PLANEACION, calcularEjecucionEtapas } from '@/lib/etapas-planeacion'

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
  etapas: EtapaReporte[]
}

const ESTADOS_EXCLUIDOS = ['DESISTIDO', 'NO_VIABLE']

function diasEntre(desde: string | null, hasta: string | null): number | null {
  if (!desde || !hasta) return null
  return Math.round((new Date(hasta + 'T12:00:00').getTime() - new Date(desde + 'T12:00:00').getTime()) / 86400000)
}

export async function getReportePlaneacion(): Promise<RequerimientoPlaneacion[]> {
  const supabase = createAdminClient()

  const { data: planes } = await (supabase as any)
    .from('planeacion_etapas')
    .select('requerimiento_id, estado, fecha_inicio, fecha_fin')
  const conPlan = (planes ?? []).filter((p: any) => p.fecha_inicio || p.fecha_fin)
  const ids = [...new Set(conPlan.map((p: any) => p.requerimiento_id))] as string[]
  if (ids.length === 0) return []

  const [{ data: reqs }, { data: historial }] = await Promise.all([
    (supabase as any)
      .from('requerimientos')
      .select('id, numero, identificacion, nombre_desarrollo, estado, proceso_interno')
      .in('id', ids)
      .eq('es_borrador', false)
      .not('estado', 'in', `(${ESTADOS_EXCLUIDOS.join(',')})`),
    (supabase as any)
      .from('historial_estados')
      .select('requerimiento_id, estado_nuevo, created_at')
      .in('requerimiento_id', ids),
  ])

  const hoy = new Date().toISOString().slice(0, 10)

  return (reqs ?? []).map((req: any) => {
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

    return {
      id: req.id,
      numero: req.numero ?? null,
      nombre: req.nombre_desarrollo ?? req.identificacion ?? '—',
      estado: req.estado,
      proceso_interno: req.proceso_interno ?? null,
      etapas,
    }
  }).sort((a: RequerimientoPlaneacion, b: RequerimientoPlaneacion) => a.nombre.localeCompare(b.nombre))
}
