'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { sendEmail } from '@/lib/email'
import { getConfigParam } from '@/actions/config-email'
import { templateSolicitudVistoBueno, templateConfirmacionFirma } from '@/lib/email-templates'

const EMAIL_ESTRATEGIA = 'dc.estrategia@iwglogistics.com'

export type TipoVistoBueno = 'DOCUMENTACION' | 'SALIDA_VIVO'
export type EstadoSolicitud = 'PENDIENTE' | 'COMPLETADO' | 'CANCELADO'

export interface FirmaVistoBueno {
  id: string
  solicitud_id: string
  requerimiento_id: string
  email_requerido: string
  nombre_requerido: string | null
  es_estrategia: boolean
  firmado: boolean
  firmado_por_email: string | null
  firmado_por_nombre: string | null
  firmado_at: string | null
  created_at: string
}

export interface SolicitudVistoBueno {
  id: string
  requerimiento_id: string
  tipo: TipoVistoBueno
  estado: EstadoSolicitud
  solicitado_por: string | null
  solicitado_por_email: string | null
  mensaje: string | null
  created_at: string
  completado_at: string | null
  firmas: FirmaVistoBueno[]
}

/* ── helpers ─────────────────────────────────────────────────────────────── */
async function getCurrentPerfil() {
  try {
    const authClient = await createClient()
    const { data: { user } } = await authClient.auth.getUser()
    if (!user?.id) return null
    const supabase = createAdminClient()
    const { data } = await (supabase as any)
      .from('perfiles').select('id, email, nombre_completo').eq('id', user.id).single()
    return data ?? null
  } catch { return null }
}

function getAppUrl(): string {
  if (process.env.APP_URL) return process.env.APP_URL
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return ''
}

/* ── Queries ─────────────────────────────────────────────────────────────── */
export async function getSolicitudesVistoBueno(
  reqId: string,
): Promise<SolicitudVistoBueno[]> {
  const supabase = createAdminClient()
  const { data, error } = await (supabase as any)
    .from('solicitudes_visto_bueno')
    .select('*, firmas:firmas_visto_bueno(*)')
    .eq('requerimiento_id', reqId)
    .order('created_at', { ascending: false })
  if (error) return []
  return (data ?? []).map((s: any) => ({
    ...s,
    firmas: (s.firmas ?? []).sort((a: any, b: any) =>
      Number(b.es_estrategia) - Number(a.es_estrategia) ||
      a.email_requerido.localeCompare(b.email_requerido)
    ),
  }))
}

export async function getMisFirmasPendientesEnReq(
  reqId: string,
  userEmail: string,
): Promise<FirmaVistoBueno[]> {
  const supabase = createAdminClient()
  const { data } = await (supabase as any)
    .from('firmas_visto_bueno')
    .select('*, solicitud:solicitudes_visto_bueno!inner(estado)')
    .eq('requerimiento_id', reqId)
    .eq('email_requerido', userEmail)
    .eq('firmado', false)
    .eq('solicitud.estado', 'PENDIENTE')
  return data ?? []
}

/* ── Crear solicitud ─────────────────────────────────────────────────────── */
export async function crearSolicitudVistoBueno(
  reqId: string,
  tipo: TipoVistoBueno,
  mensaje: string | null,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const perfil = await getCurrentPerfil()
    const supabase = createAdminClient()

    // Datos del requerimiento
    const { data: req } = await (supabase as any)
      .from('requerimientos')
      .select('nombre_desarrollo, identificacion, numero, responsable, partes_interesadas')
      .eq('id', reqId)
      .single()
    if (!req) return { ok: false, error: 'Requerimiento no encontrado' }

    // Construir lista de firmantes: partes_interesadas + responsable + estrategia
    const emailsRaw: string[] = [
      ...(req.partes_interesadas ?? []),
      req.responsable ?? '',
    ].filter(e => e && e.includes('@'))

    const emailsUnicos = [...new Set([...emailsRaw, EMAIL_ESTRATEGIA])]

    // Buscar nombres en perfiles para cada email
    const { data: perfiles } = await (supabase as any)
      .from('perfiles')
      .select('email, nombre_completo')
      .in('email', emailsUnicos)
    const nombresPorEmail: Record<string, string> = {}
    for (const p of perfiles ?? []) nombresPorEmail[p.email] = p.nombre_completo

    // Crear solicitud
    const { data: solicitud, error: errSol } = await (supabase as any)
      .from('solicitudes_visto_bueno')
      .insert({
        requerimiento_id:     reqId,
        tipo,
        estado:               'PENDIENTE',
        solicitado_por:       perfil?.nombre_completo ?? null,
        solicitado_por_email: perfil?.email ?? null,
        mensaje:              mensaje || null,
      })
      .select().single()
    if (errSol) return { ok: false, error: errSol.message }

    // Crear firmas individuales
    const firmasInsert = emailsUnicos.map(email => ({
      solicitud_id:     solicitud.id,
      requerimiento_id: reqId,
      email_requerido:  email,
      nombre_requerido: nombresPorEmail[email] ?? null,
      es_estrategia:    email === EMAIL_ESTRATEGIA,
      firmado:          false,
    }))
    await (supabase as any).from('firmas_visto_bueno').insert(firmasInsert)

    revalidatePath(`/admin/requerimientos/${reqId}`)

    // Enviar correos de notificación a cada firmante
    const nombreReq = req.nombre_desarrollo ?? req.identificacion
    const enlace = `${getAppUrl()}/admin/requerimientos/${reqId}?tab=visto-bueno`

    Promise.all(
      emailsUnicos.map(email =>
        sendEmail({
          to: email,
          subject: `TIN-FLOW | Visto bueno requerido · ${nombreReq}`,
          html: templateSolicitudVistoBueno({
            tipo,
            nombreDesarrollo: nombreReq,
            numero: req.numero ? `#${req.numero}` : null,
            solicitadoPor: perfil?.nombre_completo ?? 'Administrador',
            mensaje: mensaje ?? null,
            enlace,
            esEstrategia: email === EMAIL_ESTRATEGIA,
          }),
          requerimientoId: reqId,
        })
      )
    ).catch(err => console.error('[visto-bueno] Error enviando notificaciones:', err))

    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e.message }
  }
}

/* ── Firmar visto bueno ──────────────────────────────────────────────────── */
export async function firmarVistoBueno(
  firmaId: string,
  reqId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const perfil = await getCurrentPerfil()
    if (!perfil) return { ok: false, error: 'Debes iniciar sesión para firmar' }

    const supabase = createAdminClient()
    const ahora = new Date().toISOString()

    // Actualizar firma
    const { data: firma, error: errFirma } = await (supabase as any)
      .from('firmas_visto_bueno')
      .update({
        firmado:           true,
        firmado_por_email: perfil.email,
        firmado_por_nombre: perfil.nombre_completo,
        firmado_at:        ahora,
      })
      .eq('id', firmaId)
      .eq('firmado', false)   // solo si no estaba ya firmada
      .select('*, solicitud:solicitudes_visto_bueno(*)')
      .single()

    if (errFirma || !firma) return { ok: false, error: 'No se pudo registrar la firma' }

    // Verificar si todas las firmas de la solicitud ya están completas
    const { data: todasFirmas } = await (supabase as any)
      .from('firmas_visto_bueno')
      .select('firmado')
      .eq('solicitud_id', firma.solicitud_id)

    const todasFirmadas = (todasFirmas ?? []).every((f: any) => f.firmado)
    if (todasFirmadas) {
      await (supabase as any)
        .from('solicitudes_visto_bueno')
        .update({ estado: 'COMPLETADO', completado_at: ahora })
        .eq('id', firma.solicitud_id)
    }

    revalidatePath(`/admin/requerimientos/${reqId}`)

    // Correo de confirmación al firmante
    const { data: req } = await (supabase as any)
      .from('requerimientos')
      .select('nombre_desarrollo, identificacion, numero')
      .eq('id', reqId).single()

    const nombreReq = req?.nombre_desarrollo ?? req?.identificacion ?? 'Requerimiento'
    const enlace = `${getAppUrl()}/admin/requerimientos/${reqId}?tab=visto-bueno`

    sendEmail({
      to: perfil.email,
      subject: `TIN-FLOW | Firma registrada · ${nombreReq}`,
      html: templateConfirmacionFirma({
        tipo: firma.solicitud?.tipo ?? 'DOCUMENTACION',
        nombreDesarrollo: nombreReq,
        numero: req?.numero ? `#${req.numero}` : null,
        nombreFirmante: perfil.nombre_completo,
        emailFirmante: perfil.email,
        fechaFirma: ahora,
        enlace,
      }),
      requerimientoId: reqId,
    }).catch(err => console.error('[visto-bueno] Error enviando confirmación:', err))

    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e.message }
  }
}

/* ── Cancelar solicitud ──────────────────────────────────────────────────── */
export async function cancelarSolicitudVistoBueno(
  solicitudId: string,
  reqId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = createAdminClient()
    const { error } = await (supabase as any)
      .from('solicitudes_visto_bueno')
      .update({ estado: 'CANCELADO' })
      .eq('id', solicitudId)
      .eq('estado', 'PENDIENTE')
    if (error) return { ok: false, error: error.message }
    revalidatePath(`/admin/requerimientos/${reqId}`)
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e.message }
  }
}
