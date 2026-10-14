'use server'

import { createAdminClient } from '@/lib/supabase/admin'

export type TipoRegistro = 'PENALIZACION' | 'TAREA'
/** Solo para tareas: entregada después del compromiso, o compromiso vencido y aún sin cumplir */
export type SituacionTarea = 'CUMPLIDA_TARDE' | 'VENCIDA'

/** Un incumplimiento atribuido a un responsable (una penalización con varios responsables genera una fila por cada uno) */
export interface RegistroIncumplimiento {
  /** Identificador de la fila (único) */
  clave: string
  /** Identificador del hecho: la misma penalización comparte `origen_id` entre sus responsables */
  origen_id: string
  tipo: TipoRegistro
  /** Tipo de penalización, o el origen de la tarea */
  subtipo: string
  situacion: SituacionTarea | null
  descripcion: string
  responsable_email: string | null
  responsable_nombre: string
  /** Proceso del responsable; si no lo tiene, el del requerimiento */
  proceso: string | null
  requerimiento_id: string | null
  requerimiento_nombre: string | null
  requerimiento_numero: string | null
  /** Fecha del registro: compromiso de la tarea o fecha de la penalización */
  fecha: string
  fecha_cumplimiento: string | null
  /** Impacto en días: retraso de la tarea o días de impacto de la penalización */
  dias: number
  monto_cop: number
  motivo: string | null
}

const ORIGEN_TAREA: Record<string, string> = {
  REUNION: 'Tarea de reunión',
  COMENTARIO: 'Tarea de comentarios',
  FECHAS: 'Compromiso de fecha',
}

function diasEntre(desde: string, hasta: string): number {
  return Math.round((new Date(hasta + 'T12:00:00').getTime() - new Date(desde + 'T12:00:00').getTime()) / 86400000)
}

export async function getReportePenalizaciones(): Promise<RegistroIncumplimiento[]> {
  const supabase = createAdminClient()
  const hoy = new Date().toISOString().slice(0, 10)

  const [{ data: penalizaciones }, { data: tareasReunion }, { data: tareasSolicitud }] = await Promise.all([
    (supabase as any).from('penalizaciones_requerimiento').select('*'),
    (supabase as any)
      .from('tareas_reunion')
      .select('id, descripcion, responsable_email, fecha_compromiso, fecha_cumplimiento, completada, penalizacion_cop, motivo_incumplimiento, reunion:reuniones(titulo, requerimiento_id)')
      .not('fecha_compromiso', 'is', null),
    (supabase as any)
      .from('tareas_solicitud')
      .select('*')
      .not('fecha_compromiso', 'is', null),
  ])

  // Tareas incumplidas: cumplidas después del compromiso, o abiertas con el compromiso vencido
  const situacion = (t: any): SituacionTarea | null => {
    if (t.completada) return t.fecha_cumplimiento && t.fecha_cumplimiento > t.fecha_compromiso ? 'CUMPLIDA_TARDE' : null
    return t.fecha_compromiso < hoy ? 'VENCIDA' : null
  }
  const reunionIncumplidas = (tareasReunion ?? []).filter((t: any) => situacion(t))
  const solicitudIncumplidas = (tareasSolicitud ?? []).filter((t: any) => situacion(t))

  const reqIds = [...new Set([
    ...(penalizaciones ?? []).map((p: any) => p.requerimiento_id),
    ...reunionIncumplidas.map((t: any) => t.reunion?.requerimiento_id),
    ...solicitudIncumplidas.map((t: any) => t.requerimiento_id),
  ].filter(Boolean))] as string[]
  const emails = [...new Set([
    ...(penalizaciones ?? []).flatMap((p: any) => p.responsables ?? []),
    ...reunionIncumplidas.map((t: any) => t.responsable_email),
    ...solicitudIncumplidas.map((t: any) => t.responsable_email),
  ].filter(Boolean))] as string[]

  const [{ data: reqs }, { data: perfiles }] = await Promise.all([
    reqIds.length
      ? (supabase as any).from('requerimientos').select('id, numero, nombre_desarrollo, identificacion, proceso_interno').in('id', reqIds)
      : { data: [] },
    emails.length
      ? (supabase as any).from('perfiles').select('email, nombre_completo, proceso_interno').in('email', emails)
      : { data: [] },
  ])
  const reqPorId = new Map<string, any>((reqs ?? []).map((r: any) => [r.id, r]))
  const perfilPorEmail = new Map<string, any>((perfiles ?? []).map((p: any) => [p.email, p]))

  const base = (email: string | null, reqId: string | null) => {
    const perfil = email ? perfilPorEmail.get(email) : null
    const req = reqId ? reqPorId.get(reqId) : null
    return {
      responsable_email: email,
      responsable_nombre: perfil?.nombre_completo ?? email ?? 'Sin responsable',
      proceso: perfil?.proceso_interno ?? req?.proceso_interno ?? null,
      requerimiento_id: reqId,
      requerimiento_nombre: req ? (req.nombre_desarrollo ?? req.identificacion ?? null) : null,
      requerimiento_numero: req?.numero ?? null,
    }
  }

  const registros: RegistroIncumplimiento[] = []

  for (const p of penalizaciones ?? []) {
    const responsables: (string | null)[] = p.responsables?.length ? p.responsables : [null]
    for (const email of responsables) {
      registros.push({
        clave: `pen-${p.id}-${email ?? 'sin'}`,
        origen_id: p.id,
        tipo: 'PENALIZACION',
        subtipo: p.tipo,
        situacion: null,
        descripcion: p.descripcion ?? '',
        ...base(email, p.requerimiento_id),
        fecha: String(p.created_at).slice(0, 10),
        fecha_cumplimiento: null,
        dias: Number(p.dias_impacto ?? 0),
        monto_cop: Number(p.monto_cop ?? 0),
        motivo: p.comentario_admin ?? null,
      })
    }
  }

  const agregarTarea = (t: any, origen: string, reqId: string | null, contexto: string | null) => {
    const sit = situacion(t)!
    registros.push({
      clave: `tarea-${t.id}`,
      origen_id: t.id,
      tipo: 'TAREA',
      subtipo: ORIGEN_TAREA[origen] + (contexto ? `: ${contexto}` : ''),
      situacion: sit,
      descripcion: t.descripcion ?? '',
      ...base(t.responsable_email ?? null, reqId),
      fecha: t.fecha_compromiso,
      fecha_cumplimiento: t.fecha_cumplimiento ?? null,
      dias: diasEntre(t.fecha_compromiso, sit === 'CUMPLIDA_TARDE' ? t.fecha_cumplimiento : hoy),
      monto_cop: Number(t.penalizacion_cop ?? 0),
      motivo: t.motivo_incumplimiento ?? null,
    })
  }

  for (const t of reunionIncumplidas) agregarTarea(t, 'REUNION', t.reunion?.requerimiento_id ?? null, t.reunion?.titulo ?? null)
  for (const t of solicitudIncumplidas) agregarTarea(t, t.tipo_fecha ? 'FECHAS' : 'COMENTARIO', t.requerimiento_id ?? null, null)

  return registros.sort((a, b) => b.dias - a.dias || b.monto_cop - a.monto_cop)
}
