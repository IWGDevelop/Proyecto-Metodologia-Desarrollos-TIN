import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email'
import { subjectReq, templateTareaVenceHoy, templateTareaVencida } from '@/lib/email-templates'
import { getEmailsActivos } from '@/actions/config-email'

function getAppUrl(): string {
  if (process.env.APP_URL) return process.env.APP_URL
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return ''
}

function diasAtras(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().split('T')[0]
}

export async function GET(req: Request) {
  const auth = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const hoy = diasAtras(0)
  const ayer = diasAtras(1)
  const supabase = createAdminClient()
  const appUrl = getAppUrl()

  const [globales] = await Promise.all([getEmailsActivos()])
  if (globales.length === 0) return NextResponse.json({ ok: true, enviados: 0 })

  let enviados = 0

  // ── Tareas técnicas ──────────────────────────────────────────────────────
  const [{ data: tecHoy }, { data: tecVencidas }] = await Promise.all([
    (supabase as any)
      .from('tareas_tecnicas')
      .select('id, titulo, fecha_compromiso, requerimiento_id, requerimientos(nombre_desarrollo, identificacion), perfil_responsable:perfiles!responsable_id(email)')
      .eq('fecha_compromiso', hoy)
      .eq('completada', false),
    (supabase as any)
      .from('tareas_tecnicas')
      .select('id, titulo, fecha_compromiso, requerimiento_id, requerimientos(nombre_desarrollo, identificacion), perfil_responsable:perfiles!responsable_id(email)')
      .eq('fecha_compromiso', ayer)
      .eq('completada', false),
  ])

  for (const t of (tecHoy ?? [])) {
    const req_data = t.requerimientos
    if (!req_data) continue
    const extra = t.perfil_responsable?.email ? [t.perfil_responsable.email] : []
    const destinatarios = [...new Set([...globales, ...extra])]
    const nombreDesarrollo = req_data.nombre_desarrollo ?? req_data.identificacion ?? '—'
    await sendEmail({
      to: destinatarios,
      subject: subjectReq(req_data.identificacion ?? '', req_data.nombre_desarrollo ?? ''),
      html: templateTareaVenceHoy({
        nombreDesarrollo,
        descripcionTarea: t.titulo,
        fechaCompromiso:  t.fecha_compromiso,
        enlace: appUrl ? `${appUrl}/admin/requerimientos/${t.requerimiento_id}` : undefined,
      }),
      requerimientoId: t.requerimiento_id,
    }).catch(err => console.error('[cron] error venceHoy tarea técnica:', err))
    enviados++
  }

  for (const t of (tecVencidas ?? [])) {
    const req_data = t.requerimientos
    if (!req_data) continue
    const extra = t.perfil_responsable?.email ? [t.perfil_responsable.email] : []
    const destinatarios = [...new Set([...globales, ...extra])]
    const nombreDesarrollo = req_data.nombre_desarrollo ?? req_data.identificacion ?? '—'
    await sendEmail({
      to: destinatarios,
      subject: subjectReq(req_data.identificacion ?? '', req_data.nombre_desarrollo ?? ''),
      html: templateTareaVencida({
        nombreDesarrollo,
        descripcionTarea: t.titulo,
        fechaCompromiso:  t.fecha_compromiso,
        enlace: appUrl ? `${appUrl}/admin/requerimientos/${t.requerimiento_id}` : undefined,
      }),
      requerimientoId: t.requerimiento_id,
    }).catch(err => console.error('[cron] error vencida tarea técnica:', err))
    enviados++
  }

  // ── Tareas de reunión ────────────────────────────────────────────────────
  const [{ data: reunHoy }, { data: reunVencidas }] = await Promise.all([
    (supabase as any)
      .from('tareas_reunion')
      .select('id, descripcion, fecha_compromiso, responsable_email, reunion:reuniones(requerimiento_id, requerimiento:requerimientos(nombre_desarrollo, identificacion))')
      .eq('fecha_compromiso', hoy)
      .eq('completada', false),
    (supabase as any)
      .from('tareas_reunion')
      .select('id, descripcion, fecha_compromiso, responsable_email, reunion:reuniones(requerimiento_id, requerimiento:requerimientos(nombre_desarrollo, identificacion))')
      .eq('fecha_compromiso', ayer)
      .eq('completada', false),
  ])

  for (const t of (reunHoy ?? [])) {
    const req_data = t.reunion?.requerimiento
    const requerimientoId = t.reunion?.requerimiento_id
    if (!req_data || !requerimientoId) continue
    const extra = t.responsable_email ? [t.responsable_email] : []
    const destinatarios = [...new Set([...globales, ...extra])]
    const nombreDesarrollo = req_data.nombre_desarrollo ?? req_data.identificacion ?? '—'
    await sendEmail({
      to: destinatarios,
      subject: subjectReq(req_data.identificacion ?? '', req_data.nombre_desarrollo ?? ''),
      html: templateTareaVenceHoy({
        nombreDesarrollo,
        descripcionTarea: t.descripcion,
        fechaCompromiso:  t.fecha_compromiso,
        enlace: appUrl ? `${appUrl}/admin/requerimientos/${requerimientoId}` : undefined,
      }),
      requerimientoId,
    }).catch(err => console.error('[cron] error venceHoy tarea reunión:', err))
    enviados++
  }

  for (const t of (reunVencidas ?? [])) {
    const req_data = t.reunion?.requerimiento
    const requerimientoId = t.reunion?.requerimiento_id
    if (!req_data || !requerimientoId) continue
    const extra = t.responsable_email ? [t.responsable_email] : []
    const destinatarios = [...new Set([...globales, ...extra])]
    const nombreDesarrollo = req_data.nombre_desarrollo ?? req_data.identificacion ?? '—'
    await sendEmail({
      to: destinatarios,
      subject: subjectReq(req_data.identificacion ?? '', req_data.nombre_desarrollo ?? ''),
      html: templateTareaVencida({
        nombreDesarrollo,
        descripcionTarea: t.descripcion,
        fechaCompromiso:  t.fecha_compromiso,
        enlace: appUrl ? `${appUrl}/admin/requerimientos/${requerimientoId}` : undefined,
      }),
      requerimientoId,
    }).catch(err => console.error('[cron] error vencida tarea reunión:', err))
    enviados++
  }

  return NextResponse.json({ ok: true, enviados, hoy, ayer })
}
