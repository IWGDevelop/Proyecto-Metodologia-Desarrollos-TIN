'use server'

import { createAdminClient } from '@/lib/supabase/admin'

export interface TareaIncumplida {
  id: string
  descripcion: string
  responsable_email: string | null
  responsable_nombre: string
  fecha_compromiso: string
  fecha_cumplimiento: string
  dias_tarde: number
  penalizacion_cop: number | null
  motivo_incumplimiento: string | null
  reunion_titulo: string | null
  requerimiento_nombre: string | null
  requerimiento_id: string | null
}

export interface IncumplimientoUsuario {
  responsable_email: string
  responsable_nombre: string
  total_incumplidas: number
  dias_promedio_retraso: number
  penalizacion_total: number
  tareas: TareaIncumplida[]
}

export async function getTareasIncumplidas(): Promise<IncumplimientoUsuario[]> {
  try {
    const supabase = createAdminClient()

    // 1. Todas las tareas completadas con fecha_cumplimiento y fecha_compromiso
    const { data: tareas } = await (supabase as any)
      .from('tareas_reunion')
      .select('id, descripcion, responsable_email, fecha_compromiso, fecha_cumplimiento, penalizacion_cop, motivo_incumplimiento, reunion_id')
      .eq('completada', true)
      .not('fecha_cumplimiento', 'is', null)
      .not('fecha_compromiso', 'is', null)

    if (!tareas?.length) return []

    // Filtrar las que realmente son incumplidas (comparación en JS)
    const incumplidas = (tareas as any[]).filter(
      t => t.fecha_cumplimiento > t.fecha_compromiso
    )
    if (!incumplidas.length) return []

    // 2. Info de reuniones
    const reunionIds = [...new Set(incumplidas.map(t => t.reunion_id))]
    const { data: reuniones } = await (supabase as any)
      .from('reuniones')
      .select('id, titulo, requerimiento_id')
      .in('id', reunionIds)

    // 3. Info de requerimientos
    const reqIds = [...new Set((reuniones ?? []).map((r: any) => r.requerimiento_id).filter(Boolean))]
    const { data: reqs } = reqIds.length
      ? await (supabase as any)
          .from('requerimientos')
          .select('id, nombre_desarrollo, identificacion')
          .in('id', reqIds)
      : { data: [] }

    // 4. Perfiles para mapear email → nombre
    const emails = [...new Set(incumplidas.map(t => t.responsable_email).filter(Boolean))]
    const { data: perfiles } = emails.length
      ? await (supabase as any)
          .from('perfiles')
          .select('email, nombre_completo')
          .in('email', emails)
      : { data: [] }

    // Mapas de lookup
    const reunionMap = new Map((reuniones ?? []).map((r: any) => [r.id, r]))
    const reqMap     = new Map((reqs     ?? []).map((r: any) => [r.id, r]))
    const perfilMap  = new Map((perfiles ?? []).map((p: any) => [p.email, p.nombre_completo as string]))

    // Construir registros completos
    const fullTareas: TareaIncumplida[] = incumplidas.map(t => {
      const reunion = reunionMap.get(t.reunion_id) as any
      const req     = reunion ? reqMap.get(reunion.requerimiento_id) as any : null
      const diasTarde = Math.round(
        (new Date(t.fecha_cumplimiento + 'T12:00:00').getTime() -
         new Date(t.fecha_compromiso  + 'T12:00:00').getTime()) / 86400000
      )
      return {
        id:                    t.id,
        descripcion:           t.descripcion,
        responsable_email:     t.responsable_email,
        responsable_nombre:    t.responsable_email ? (perfilMap.get(t.responsable_email) ?? t.responsable_email) : 'Sin responsable',
        fecha_compromiso:      t.fecha_compromiso,
        fecha_cumplimiento:    t.fecha_cumplimiento,
        dias_tarde:            diasTarde,
        penalizacion_cop:      t.penalizacion_cop ?? null,
        motivo_incumplimiento: t.motivo_incumplimiento ?? null,
        reunion_titulo:        reunion?.titulo ?? null,
        requerimiento_nombre:  req ? (req.nombre_desarrollo ?? req.identificacion) : null,
        requerimiento_id:      reunion?.requerimiento_id ?? null,
      }
    })

    // Agrupar por usuario
    const byUser = new Map<string, TareaIncumplida[]>()
    fullTareas.forEach(t => {
      const key = t.responsable_email ?? 'sin_email'
      if (!byUser.has(key)) byUser.set(key, [])
      byUser.get(key)!.push(t)
    })

    const result: IncumplimientoUsuario[] = []
    byUser.forEach((ts, email) => {
      const penalizacionTotal  = ts.reduce((s, t) => s + (t.penalizacion_cop ?? 0), 0)
      const diasPromedio       = Math.round(ts.reduce((s, t) => s + t.dias_tarde, 0) / ts.length)
      result.push({
        responsable_email:    email,
        responsable_nombre:   ts[0].responsable_nombre,
        total_incumplidas:    ts.length,
        dias_promedio_retraso: diasPromedio,
        penalizacion_total:   penalizacionTotal,
        tareas:               ts.sort((a, b) => b.dias_tarde - a.dias_tarde),
      })
    })

    // Ordenar: mayor penalización primero, luego mayor cantidad de incumplidas
    return result.sort((a, b) =>
      b.penalizacion_total - a.penalizacion_total ||
      b.total_incumplidas  - a.total_incumplidas
    )
  } catch {
    return []
  }
}
