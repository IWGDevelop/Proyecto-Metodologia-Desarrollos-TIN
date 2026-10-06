'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getPerfil } from '@/lib/supabase/auth'
import { sendEmail } from '@/lib/email'
import { subjectReq, templateResumenTareasPendientes, type TareaResumenEmail } from '@/lib/email-templates'
import { getEmailsActivos } from '@/actions/config-email'
import { diasHastaCompromiso, urgenciaTarea } from '@/lib/urgencia-tareas'

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

export interface EnviarResumenInput {
  /** TODAS = todas las pendientes · URGENTES = solo vencidas y próximas a vencer */
  alcance: 'TODAS' | 'URGENTES'
  /** Enviar a los responsables de las tareas incluidas */
  responsables: boolean
  /** Enviar al responsable y a todas las partes interesadas del requerimiento */
  partesInteresadas: boolean
  /** Enviar a la lista global de notificaciones (Configuración → Notificaciones Email) */
  listaGlobal: boolean
  /** Correos adicionales */
  adicionales: string[]
  mensaje?: string
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function getAppUrl(): string {
  if (process.env.APP_URL) return process.env.APP_URL
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return ''
}

/** Envía por correo el resumen de tareas pendientes del requerimiento, clasificadas por urgencia. */
export async function enviarResumenTareasPendientes(
  requerimientoId: string,
  input: EnviarResumenInput,
): Promise<{ ok: boolean; error?: string; enviadoA?: string[]; tareas?: number }> {
  try {
    const perfil = await getPerfil()
    if (!perfil) return { ok: false, error: 'Sesión no válida' }

    const supabase = createAdminClient()
    const [{ data: req }, todas] = await Promise.all([
      (supabase as any)
        .from('requerimientos')
        .select('identificacion, nombre_desarrollo, responsable, partes_interesadas')
        .eq('id', requerimientoId)
        .single(),
      getTareasConsolidadasRequerimiento(requerimientoId),
    ])
    if (!req) return { ok: false, error: 'Requerimiento no encontrado' }

    const incluidas = todas
      .filter(t => !t.completada)
      .map(t => ({ t, urgencia: urgenciaTarea(t.fecha_compromiso), dias: diasHastaCompromiso(t.fecha_compromiso) }))
      .filter(x => input.alcance === 'TODAS' || x.urgencia === 'VENCIDA' || x.urgencia === 'PROXIMA')
      // Lo más urgente primero dentro de cada grupo
      .sort((a, b) => (a.dias ?? Number.MAX_SAFE_INTEGER) - (b.dias ?? Number.MAX_SAFE_INTEGER))

    if (incluidas.length === 0) {
      return {
        ok: false,
        error: input.alcance === 'URGENTES'
          ? 'No hay tareas vencidas ni próximas a vencer para enviar'
          : 'No hay tareas pendientes para enviar',
      }
    }

    const destinatarios = new Set<string>()
    if (input.responsables) {
      for (const { t } of incluidas) if (t.responsable_email) destinatarios.add(t.responsable_email.trim().toLowerCase())
    }
    if (input.partesInteresadas) {
      const partes = [req.responsable, ...((req.partes_interesadas ?? []) as string[])]
      for (const e of partes) if (e && EMAIL_RE.test(e.trim())) destinatarios.add(e.trim().toLowerCase())
    }
    if (input.listaGlobal) {
      for (const e of await getEmailsActivos()) destinatarios.add(e.trim().toLowerCase())
    }
    for (const e of input.adicionales) {
      const limpio = e.trim().toLowerCase()
      if (!EMAIL_RE.test(limpio)) return { ok: false, error: `Correo no válido: ${e}` }
      destinatarios.add(limpio)
    }
    if (destinatarios.size === 0) return { ok: false, error: 'No hay destinatarios para el envío' }

    const tareas: TareaResumenEmail[] = incluidas.map(({ t, urgencia, dias }) => ({
      descripcion: t.descripcion,
      origen: t.origen === 'REUNION' ? `Reunión${t.contexto ? `: ${t.contexto}` : ''}` : 'Comentarios',
      responsable: t.nombre_responsable ?? t.responsable_email,
      fechaCompromiso: t.fecha_compromiso,
      urgencia,
      dias,
    }))

    const appUrl = getAppUrl()
    const lista = [...destinatarios]
    await sendEmail({
      to: lista,
      subject: subjectReq(req.identificacion ?? '', req.nombre_desarrollo ?? req.identificacion ?? ''),
      html: templateResumenTareasPendientes({
        nombreDesarrollo: req.nombre_desarrollo ?? req.identificacion ?? '—',
        tareas,
        mensaje: input.mensaje,
        remitente: perfil.nombre_completo,
        enlace: appUrl ? `${appUrl}/admin/requerimientos/${requerimientoId}` : undefined,
      }),
      requerimientoId,
    })

    return { ok: true, enviadoA: lista, tareas: tareas.length }
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'Error al enviar el correo' }
  }
}
