'use server'

import { createAdminClient } from '@/lib/supabase/admin'

export interface RegistroHorasRow {
  id: string
  fecha: string
  horas: number
  notas: string | null
}

export interface TareaRow {
  id: string
  titulo: string
  completada: boolean
  categoria: string | null
  registros: RegistroHorasRow[]
  total_horas: number
}

export interface ReqRow {
  id: string
  identificacion: string
  nombre: string
  estado: string
  alcance: string | null
  tareas: TareaRow[]
  total_horas: number
  horas_por_dia: { fecha: string; horas: number }[]
}

export interface DesarrolladorRow {
  perfil_id: string
  nombre: string
  cargo: string | null
  requerimientos: ReqRow[]
  total_horas: number
  horas_por_dia: { fecha: string; horas: number }[]
}

export async function fetchReporteDesarrolladores(
  desde?: string,
  hasta?: string
): Promise<DesarrolladorRow[]> {
  try {
    const supabase = createAdminClient()

    let query = (supabase as any)
      .from('tareas_tecnicas')
      .select(`
        id, titulo, completada, categoria,
        responsable:responsable_id(id, nombre_completo, cargo),
        requerimiento:requerimiento_id(id, nombre_desarrollo, estado, alcance, identificacion),
        registros_horas_tarea(id, fecha, horas, notas)
      `)
      .not('responsable_id', 'is', null)

    const { data, error } = await query
    if (error) throw new Error(error.message)

    // Agrupar por desarrollador → requerimiento
    const devMap = new Map<string, {
      perfil_id: string
      nombre: string
      cargo: string | null
      reqs: Map<string, {
        id: string; identificacion: string; nombre: string; estado: string; alcance: string | null
        tareas: TareaRow[]
      }>
    }>()

    for (const t of (data ?? [])) {
      const responsable = t.responsable
      if (!responsable) continue

      const req = t.requerimiento
      if (!req) continue

      // Filtrar registros por rango de fechas
      let registros: RegistroHorasRow[] = (t.registros_horas_tarea ?? [])
        .sort((a: RegistroHorasRow, b: RegistroHorasRow) => a.fecha.localeCompare(b.fecha))

      if (desde) registros = registros.filter(r => r.fecha >= desde)
      if (hasta) registros = registros.filter(r => r.fecha <= hasta)

      const tarea: TareaRow = {
        id:         t.id,
        titulo:     t.titulo,
        completada: t.completada,
        categoria:  t.categoria,
        registros,
        total_horas: registros.reduce((s: number, r: RegistroHorasRow) => s + r.horas, 0),
      }

      // Solo incluir tareas que tengan registros (en el rango) o que no tengan rango
      if ((desde || hasta) && tarea.registros.length === 0) continue

      if (!devMap.has(responsable.id)) {
        devMap.set(responsable.id, {
          perfil_id: responsable.id,
          nombre:    responsable.nombre_completo,
          cargo:     responsable.cargo,
          reqs:      new Map(),
        })
      }
      const dev = devMap.get(responsable.id)!

      if (!dev.reqs.has(req.id)) {
        dev.reqs.set(req.id, {
          id:            req.id,
          identificacion: req.identificacion ?? '',
          nombre:        req.nombre_desarrollo ?? req.identificacion ?? '—',
          estado:        req.estado ?? '',
          alcance:       req.alcance ?? null,
          tareas:        [],
        })
      }
      dev.reqs.get(req.id)!.tareas.push(tarea)
    }

    // Convertir map a array con totales
    return Array.from(devMap.values())
      .map(dev => {
        const requerimientos: ReqRow[] = Array.from(dev.reqs.values()).map(r => {
          const hDiaMap = new Map<string, number>()
          r.tareas.forEach(t =>
            t.registros.forEach(reg => hDiaMap.set(reg.fecha, (hDiaMap.get(reg.fecha) ?? 0) + reg.horas))
          )
          const total_horas = r.tareas.reduce((s, t) => s + t.total_horas, 0)
          return {
            ...r,
            total_horas,
            horas_por_dia: Array.from(hDiaMap.entries())
              .sort((a, b) => a[0].localeCompare(b[0]))
              .map(([fecha, horas]) => ({ fecha, horas })),
          }
        }).sort((a, b) => b.total_horas - a.total_horas)

        const hDiaTotMap = new Map<string, number>()
        requerimientos.forEach(r =>
          r.horas_por_dia.forEach(h => hDiaTotMap.set(h.fecha, (hDiaTotMap.get(h.fecha) ?? 0) + h.horas))
        )

        return {
          perfil_id: dev.perfil_id,
          nombre:    dev.nombre,
          cargo:     dev.cargo,
          requerimientos,
          total_horas: requerimientos.reduce((s, r) => s + r.total_horas, 0),
          horas_por_dia: Array.from(hDiaTotMap.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([fecha, horas]) => ({ fecha, horas })),
        }
      })
      .sort((a, b) => b.total_horas - a.total_horas)
  } catch {
    return []
  }
}
