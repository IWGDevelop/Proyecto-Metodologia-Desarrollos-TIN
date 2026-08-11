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
