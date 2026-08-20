'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email'
import { subjectReq, templateAsignacionDesarrollador } from '@/lib/email-templates'
import { getEmailsActivos } from '@/actions/config-email'
import type { Perfil, RequerimientoDesarrollador } from '@/lib/supabase/types'

function getAppUrl(): string {
  if (process.env.APP_URL) return process.env.APP_URL
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return ''
}

export async function getDesarrolladoresReq(requerimientoId: string): Promise<RequerimientoDesarrollador[]> {
  const supabase = createAdminClient()
  const { data, error } = await (supabase as any)
    .from('requerimiento_desarrolladores')
    .select('*, perfil:perfil_id(id, nombre_completo, email, cargo, proceso_interno)')
    .eq('requerimiento_id', requerimientoId)
    .order('asignado_at', { ascending: true })

  if (error) return []
  return data ?? []
}

export async function getDesarrolladoresDisponibles(): Promise<Perfil[]> {
  const supabase = createAdminClient()
  const { data, error } = await (supabase as any)
    .from('perfiles')
    .select('*')
    .eq('activo', true)
    .order('nombre_completo', { ascending: true })

  if (error) return []
  return data ?? []
}

export async function asignarDesarrollador(
  requerimientoId: string,
  perfilId: string,
  asignadoBy?: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = createAdminClient()
    const { error } = await (supabase as any)
      .from('requerimiento_desarrolladores')
      .upsert({
        requerimiento_id: requerimientoId,
        perfil_id: perfilId,
        asignado_by: asignadoBy ?? null,
      }, { onConflict: 'requerimiento_id,perfil_id' })

    if (error) return { ok: false, error: error.message }

    // Notificación por correo (sin bloquear)
    Promise.all([
      (supabase as any)
        .from('perfiles')
        .select('nombre_completo, email')
        .eq('id', perfilId)
        .single(),
      (supabase as any)
        .from('requerimientos')
        .select('nombre_desarrollo, identificacion, numero')
        .eq('id', requerimientoId)
        .single(),
      getEmailsActivos(),
    ]).then(([{ data: perfil }, { data: req }, globales]) => {
      if (!perfil || !req) return
      const appUrl = getAppUrl()
      const enlace = appUrl ? `${appUrl}/admin/requerimientos/${requerimientoId}` : undefined
      const todos = [...new Set([...globales, perfil.email])]
      if (todos.length === 0) return
      return sendEmail({
        to: todos,
        subject: subjectReq(req.identificacion ?? '', req.nombre_desarrollo ?? ''),
        html: templateAsignacionDesarrollador({
          nombreDesarrollador: perfil.nombre_completo ?? perfil.email,
          nombreDesarrollo:    req.nombre_desarrollo ?? req.identificacion ?? '—',
          identificacion:      req.identificacion ?? '—',
          numero:              req.numero ?? null,
          enlace,
        }),
        requerimientoId,
      })
    }).catch(err => console.error('[email] Error al notificar asignación de desarrollador:', err))

    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e?.message }
  }
}

export async function actualizarFechasDesarrollador(
  requerimientoId: string,
  perfilId: string,
  fechaInicio: string | null,
  fechaFin: string | null
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = createAdminClient()
    const { error } = await (supabase as any)
      .from('requerimiento_desarrolladores')
      .update({
        fecha_inicio_estimada: fechaInicio || null,
        fecha_fin_estimada:    fechaFin    || null,
      })
      .eq('requerimiento_id', requerimientoId)
      .eq('perfil_id', perfilId)

    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e?.message }
  }
}

export interface AsignacionCronograma {
  perfil_id: string
  requerimiento_id: string
  nombre_desarrollador: string
  cargo: string | null
  fecha_inicio_estimada: string | null
  fecha_fin_estimada: string | null
  nombre_desarrollo: string | null
  identificacion: string
  numero: string | null
  estado: string
  prioridad: number | null
  sub_prioridad: number | null
  parent_id: string | null
  fechas_heredadas: boolean
}

export async function getAsignacionesCronogramaTIN(): Promise<AsignacionCronograma[]> {
  const supabase = createAdminClient()
  // Fetch ALL assignments (no date filter) to support date inheritance from parent reqs
  const { data, error } = await (supabase as any)
    .from('requerimiento_desarrolladores')
    .select(`
      perfil_id,
      requerimiento_id,
      fecha_inicio_estimada,
      fecha_fin_estimada,
      perfil:perfil_id(nombre_completo, cargo),
      requerimiento:requerimiento_id(nombre_desarrollo, identificacion, numero, estado, prioridad, sub_prioridad, parent_id)
    `)
    .order('perfil_id', { ascending: true })

  if (error) return []

  const rows: AsignacionCronograma[] = (data ?? []).map((r: any) => ({
    perfil_id:             r.perfil_id,
    requerimiento_id:      r.requerimiento_id,
    nombre_desarrollador:  r.perfil?.nombre_completo ?? 'Sin nombre',
    cargo:                 r.perfil?.cargo ?? null,
    fecha_inicio_estimada: r.fecha_inicio_estimada as string | null,
    fecha_fin_estimada:    r.fecha_fin_estimada    as string | null,
    nombre_desarrollo:     r.requerimiento?.nombre_desarrollo ?? null,
    identificacion:        r.requerimiento?.identificacion ?? '—',
    numero:                r.requerimiento?.numero ?? null,
    estado:                r.requerimiento?.estado ?? 'PENDIENTE',
    prioridad:             r.requerimiento?.prioridad ?? null,
    sub_prioridad:         r.requerimiento?.sub_prioridad ?? null,
    parent_id:             r.requerimiento?.parent_id ?? null,
    fechas_heredadas:      false,
  }))

  // Map requerimiento_id → dates for quick lookup during inheritance
  const reqDatesMap = new Map<string, { inicio: string | null; fin: string | null }>()
  rows.forEach(row => {
    if (row.fecha_inicio_estimada || row.fecha_fin_estimada) {
      reqDatesMap.set(row.requerimiento_id, {
        inicio: row.fecha_inicio_estimada,
        fin:    row.fecha_fin_estimada,
      })
    }
  })

  // Inherit parent dates for child entries that have no dates
  const result: AsignacionCronograma[] = []
  for (const row of rows) {
    if (row.fecha_inicio_estimada || row.fecha_fin_estimada) {
      result.push(row)
    } else if (row.parent_id) {
      const parentDates = reqDatesMap.get(row.parent_id)
      if (parentDates) {
        result.push({ ...row, fecha_inicio_estimada: parentDates.inicio, fecha_fin_estimada: parentDates.fin, fechas_heredadas: true })
      }
    }
    // Entries with no dates and no parent (or parent without dates) are excluded
  }

  return result
}

export async function desasignarDesarrollador(
  requerimientoId: string,
  perfilId: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = createAdminClient()
    const { error } = await (supabase as any)
      .from('requerimiento_desarrolladores')
      .delete()
      .eq('requerimiento_id', requerimientoId)
      .eq('perfil_id', perfilId)

    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e?.message }
  }
}
