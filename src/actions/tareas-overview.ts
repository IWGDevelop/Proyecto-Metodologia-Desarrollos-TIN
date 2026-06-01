'use server'

import { createAdminClient } from '@/lib/supabase/admin'

export interface TareaOverview {
  id: string
  descripcion: string
  responsable_email: string | null
  fecha_compromiso: string | null
  fecha_inicio: string | null
  fecha_cumplimiento: string | null
  completada: boolean
  reunion_id: string
  reunion_titulo: string | null
  requerimiento_id: string | null
  requerimiento_nombre: string | null
  created_at: string
}

export interface TareasOverviewResult {
  abiertas: TareaOverview[]
  recientes: TareaOverview[]
}

async function enrichTareas(tareas: any[]): Promise<TareaOverview[]> {
  if (!tareas.length) return []

  const supabase = createAdminClient()

  const reunionIds = [...new Set(tareas.map(t => t.reunion_id).filter(Boolean))]
  const { data: reuniones } = await (supabase as any)
    .from('reuniones')
    .select('id, titulo, requerimiento_id')
    .in('id', reunionIds)

  const reqIds = [...new Set((reuniones ?? []).map((r: any) => r.requerimiento_id).filter(Boolean))]
  const { data: reqs } = reqIds.length
    ? await (supabase as any)
        .from('requerimientos')
        .select('id, nombre_desarrollo, identificacion')
        .in('id', reqIds)
    : { data: [] }

  const reunionMap = new Map((reuniones ?? []).map((r: any) => [r.id, r]))
  const reqMap = new Map((reqs ?? []).map((r: any) => [r.id, r]))

  return tareas.map(t => {
    const reunion = reunionMap.get(t.reunion_id) as any
    const req = reunion ? (reqMap.get(reunion.requerimiento_id) as any) : null
    return {
      id:                   t.id,
      descripcion:          t.descripcion,
      responsable_email:    t.responsable_email ?? null,
      fecha_compromiso:     t.fecha_compromiso ?? null,
      fecha_inicio:         t.fecha_inicio ?? null,
      fecha_cumplimiento:   t.fecha_cumplimiento ?? null,
      completada:           t.completada,
      reunion_id:           t.reunion_id,
      reunion_titulo:       reunion?.titulo ?? null,
      requerimiento_id:     reunion?.requerimiento_id ?? null,
      requerimiento_nombre: req ? (req.nombre_desarrollo ?? req.identificacion) : null,
      created_at:           t.created_at,
    }
  })
}

export async function getTareasOverview(): Promise<TareasOverviewResult> {
  try {
    const supabase = createAdminClient()

    const hace14Dias = new Date()
    hace14Dias.setDate(hace14Dias.getDate() - 14)
    const fechaCorte = hace14Dias.toISOString().split('T')[0]

    const [{ data: rawAbiertas }, { data: rawRecientes }] = await Promise.all([
      (supabase as any)
        .from('tareas_reunion')
        .select('id, descripcion, responsable_email, fecha_compromiso, fecha_inicio, fecha_cumplimiento, completada, reunion_id, created_at')
        .eq('completada', false)
        .order('fecha_compromiso', { ascending: true }),
      (supabase as any)
        .from('tareas_reunion')
        .select('id, descripcion, responsable_email, fecha_compromiso, fecha_inicio, fecha_cumplimiento, completada, reunion_id, created_at')
        .eq('completada', true)
        .gte('fecha_cumplimiento', fechaCorte)
        .order('fecha_cumplimiento', { ascending: false }),
    ])

    const [abiertas, recientes] = await Promise.all([
      enrichTareas(rawAbiertas ?? []),
      enrichTareas(rawRecientes ?? []),
    ])

    return { abiertas, recientes }
  } catch {
    return { abiertas: [], recientes: [] }
  }
}
