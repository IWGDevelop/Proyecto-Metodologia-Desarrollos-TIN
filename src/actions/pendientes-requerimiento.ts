'use server'

import { createAdminClient } from '@/lib/supabase/admin'

export type OrigenTareaReq = 'REUNION' | 'COMENTARIO'

export interface AnexoSoporteTarea {
  id: string
  nombre_archivo: string
  url_storage: string
  tipo_archivo: string | null
  tamanio_bytes: number | null
  created_at: string
}

/** Tarea consolidada de un requerimiento (reuniones + tareas/solicitudes de comentarios). */
export interface TareaConsolidadaReq {
  id: string
  origen: OrigenTareaReq
  descripcion: string
  responsable_email: string | null
  nombre_responsable: string | null
  fecha_compromiso: string | null
  completada: boolean
  fecha_cumplimiento: string | null
  /** Fecha en que surgió la tarea: fecha de la reunión o creación de la solicitud */
  fecha_origen: string
  /** Reunión de la que salió la tarea, o quién la registró en comentarios */
  contexto: string | null
  /** Soporte de cumplimiento */
  respuesta: string | null
  anexos: AnexoSoporteTarea[]
}

export async function getTareasConsolidadasRequerimiento(requerimientoId: string): Promise<TareaConsolidadaReq[]> {
  const supabase = createAdminClient()

  const [{ data: reuniones }, { data: solicitudes }] = await Promise.all([
    (supabase as any)
      .from('reuniones')
      .select('id, titulo, fecha_reunion, tareas_reunion(*, anexos_tarea_reunion(*))')
      .eq('requerimiento_id', requerimientoId),
    (supabase as any)
      .from('tareas_solicitud')
      .select('*')
      .eq('requerimiento_id', requerimientoId),
  ])

  // Anexos de tareas de comentarios (consulta aparte: si la tabla aún no existe, no rompe el listado)
  const idsSolicitud = (solicitudes ?? []).map((s: { id: string }) => s.id)
  const anexosPorSolicitud = new Map<string, AnexoSoporteTarea[]>()
  if (idsSolicitud.length > 0) {
    const { data: anexos } = await (supabase as any)
      .from('anexos_tarea_solicitud')
      .select('*')
      .in('tarea_solicitud_id', idsSolicitud)
      .order('created_at', { ascending: true })
    for (const a of anexos ?? []) {
      const lista = anexosPorSolicitud.get(a.tarea_solicitud_id) ?? []
      lista.push(a)
      anexosPorSolicitud.set(a.tarea_solicitud_id, lista)
    }
  }

  const tareas: TareaConsolidadaReq[] = []

  for (const r of reuniones ?? []) {
    for (const t of r.tareas_reunion ?? []) {
      tareas.push({
        id: t.id,
        origen: 'REUNION',
        descripcion: t.descripcion,
        responsable_email: t.responsable_email ?? null,
        nombre_responsable: null,
        fecha_compromiso: t.fecha_compromiso ?? null,
        completada: !!t.completada,
        fecha_cumplimiento: t.fecha_cumplimiento ?? null,
        fecha_origen: r.fecha_reunion ?? t.created_at,
        contexto: r.titulo ?? null,
        respuesta: t.respuesta ?? null,
        anexos: t.anexos_tarea_reunion ?? [],
      })
    }
  }

  for (const t of solicitudes ?? []) {
    tareas.push({
      id: t.id,
      origen: 'COMENTARIO',
      descripcion: t.descripcion,
      responsable_email: t.responsable_email ?? null,
      nombre_responsable: null,
      fecha_compromiso: t.fecha_compromiso ?? null,
      completada: !!t.completada,
      fecha_cumplimiento: t.fecha_cumplimiento ?? null,
      fecha_origen: t.created_at,
      contexto: t.created_by ?? null,
      respuesta: t.respuesta ?? null,
      anexos: anexosPorSolicitud.get(t.id) ?? [],
    })
  }

  // Nombres de responsables
  const emails = [...new Set(tareas.map(t => t.responsable_email).filter(Boolean))] as string[]
  if (emails.length > 0) {
    const { data: perfiles } = await (supabase as any)
      .from('perfiles')
      .select('email, nombre_completo')
      .in('email', emails)
    const nombres = new Map<string, string>(
      (perfiles ?? []).map((p: { email: string; nombre_completo: string }) => [p.email, p.nombre_completo])
    )
    for (const t of tareas) {
      if (t.responsable_email) t.nombre_responsable = nombres.get(t.responsable_email) ?? null
    }
  }

  // Cronológico: de la más antigua a la más reciente según su origen
  return tareas.sort((a, b) => new Date(a.fecha_origen).getTime() - new Date(b.fecha_origen).getTime())
}
