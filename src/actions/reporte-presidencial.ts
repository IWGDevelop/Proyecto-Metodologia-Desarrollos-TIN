'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { ESTADOS, PROCESOS_INTERNOS, ORIGENES_REQUERIMIENTO } from '@/lib/constants'

export interface ReporteEstado {
  estado: string
  label: string
  cantidad: number
  porcentaje: number
}

export interface ReporteProceso {
  proceso: string
  label: string
  cantidad: number
  horasEstimadas: number
  impactoAnual: number
  sinCuantificar: number
}

export interface ReporteAlcance {
  alcance: string
  cantidad: number
  impactoAnual: number
}

export interface ReporteOrigen {
  origen: string
  label: string
  cantidad: number
  porcentaje: number
}

export interface ReportePresidencial {
  totalRequerimientos: number
  totalBorradores: number
  totalActivos: number        // no borradores
  totalHorasEstimadas: number
  impactoTotalAnual: number
  impactoTotalAnualReal: number
  sinCuantificar: number      // reqs sin impacto_economico_total_anual
  porEstado: ReporteEstado[]
  porProceso: ReporteProceso[]
  porAlcance: ReporteAlcance[]
  porOrigen: ReporteOrigen[]
  topImpacto: { id: string; nombre: string; impacto: number; proceso: string | null; alcance: string | null }[]
  generadoEn: string
}

function estadoLabel(estado: string) {
  return ESTADOS[estado]?.label ?? estado.replace(/_/g, ' ')
}

function procesoLabel(proceso: string) {
  return PROCESOS_INTERNOS.find(p => p.value === proceso)?.label ?? proceso
}

function origenLabel(origen: string) {
  return (ORIGENES_REQUERIMIENTO as readonly { value: string; label: string }[]).find(o => o.value === origen)?.label ?? origen
}

export async function fetchReportePresidencial(): Promise<ReportePresidencial> {
  const supabase = createAdminClient()

  const { data: rows } = await (supabase as any)
    .from('v_metricas_requerimientos')
    .select(`
      id, identificacion, nombre_desarrollo,
      estado, es_borrador, alcance,
      proceso_interno, origen_requerimiento,
      horas_estimadas_desarrollo,
      impacto_economico_total_anual,
      impacto_economico_total_anual_real,
      ahorro_anual_cop, total_beneficios_cualitativos_anual
    `)

  const todos: any[] = rows ?? []
  const activos = todos.filter(r => !r.es_borrador)
  const total = activos.length

  /* ── Totales globales ── */
  const totalHoras = activos.reduce((s: number, r: any) => s + (r.horas_estimadas_desarrollo ?? 0), 0)
  const impactoTotal = activos.reduce((s: number, r: any) => s + (r.impacto_economico_total_anual ?? 0), 0)
  const impactoTotalReal = activos.reduce((s: number, r: any) => s + (r.impacto_economico_total_anual_real ?? 0), 0)
  const sinCuantificar = activos.filter((r: any) => !r.impacto_economico_total_anual || r.impacto_economico_total_anual === 0).length

  /* ── Por estado ── */
  const estadoMap = new Map<string, number>()
  activos.forEach((r: any) => {
    const k = r.estado ?? 'SIN_GESTION'
    estadoMap.set(k, (estadoMap.get(k) ?? 0) + 1)
  })
  const porEstado: ReporteEstado[] = Array.from(estadoMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([estado, cantidad]) => ({
      estado,
      label: estadoLabel(estado),
      cantidad,
      porcentaje: total > 0 ? Math.round((cantidad / total) * 100) : 0,
    }))

  /* ── Por proceso ── */
  const procesoMap = new Map<string, { cantidad: number; horas: number; impacto: number; sin: number }>()
  activos.forEach((r: any) => {
    const k = r.proceso_interno ?? 'SIN_PROCESO'
    const prev = procesoMap.get(k) ?? { cantidad: 0, horas: 0, impacto: 0, sin: 0 }
    procesoMap.set(k, {
      cantidad: prev.cantidad + 1,
      horas:    prev.horas + (r.horas_estimadas_desarrollo ?? 0),
      impacto:  prev.impacto + (r.impacto_economico_total_anual ?? 0),
      sin:      prev.sin + (!r.impacto_economico_total_anual || r.impacto_economico_total_anual === 0 ? 1 : 0),
    })
  })
  const porProceso: ReporteProceso[] = Array.from(procesoMap.entries())
    .sort((a, b) => b[1].cantidad - a[1].cantidad)
    .map(([proceso, d]) => ({
      proceso,
      label: procesoLabel(proceso),
      cantidad: d.cantidad,
      horasEstimadas: d.horas,
      impactoAnual: d.impacto,
      sinCuantificar: d.sin,
    }))

  /* ── Por alcance ── */
  const alcanceMap = new Map<string, { cantidad: number; impacto: number }>()
  activos.forEach((r: any) => {
    const k = r.alcance ?? 'SIN_ALCANCE'
    const prev = alcanceMap.get(k) ?? { cantidad: 0, impacto: 0 }
    alcanceMap.set(k, {
      cantidad: prev.cantidad + 1,
      impacto:  prev.impacto + (r.impacto_economico_total_anual ?? 0),
    })
  })
  const porAlcance: ReporteAlcance[] = Array.from(alcanceMap.entries())
    .sort((a, b) => b[1].cantidad - a[1].cantidad)
    .map(([alcance, d]) => ({ alcance, cantidad: d.cantidad, impactoAnual: d.impacto }))

  /* ── Por origen ── */
  const origenMap = new Map<string, number>()
  activos.forEach((r: any) => {
    const k = r.origen_requerimiento ?? 'SIN_ORIGEN'
    origenMap.set(k, (origenMap.get(k) ?? 0) + 1)
  })
  const porOrigen: ReporteOrigen[] = Array.from(origenMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([origen, cantidad]) => ({
      origen,
      label: origen === 'SIN_ORIGEN' ? 'Sin origen asignado' : origenLabel(origen),
      cantidad,
      porcentaje: total > 0 ? Math.round((cantidad / total) * 100) : 0,
    }))

  /* ── Top 10 por impacto ── */
  const topImpacto = activos
    .filter((r: any) => (r.impacto_economico_total_anual ?? 0) > 0)
    .sort((a: any, b: any) => (b.impacto_economico_total_anual ?? 0) - (a.impacto_economico_total_anual ?? 0))
    .slice(0, 10)
    .map((r: any) => ({
      id: r.id,
      nombre: r.nombre_desarrollo ?? r.identificacion ?? '—',
      impacto: r.impacto_economico_total_anual ?? 0,
      proceso: r.proceso_interno ? procesoLabel(r.proceso_interno) : null,
      alcance: r.alcance ?? null,
    }))

  return {
    totalRequerimientos: todos.length,
    totalBorradores: todos.length - activos.length,
    totalActivos: activos.length,
    totalHorasEstimadas: totalHoras,
    impactoTotalAnual: impactoTotal,
    impactoTotalAnualReal: impactoTotalReal,
    sinCuantificar,
    porEstado,
    porProceso,
    porAlcance,
    porOrigen,
    topImpacto,
    generadoEn: new Date().toISOString(),
  }
}
