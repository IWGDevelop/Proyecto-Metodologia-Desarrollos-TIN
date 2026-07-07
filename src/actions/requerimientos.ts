'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import type { Requerimiento } from '@/lib/supabase/types'
import { sendEmail } from '@/lib/email'
import { templateCambioEstado } from '@/lib/email-templates'

const ESTADO_LABEL: Record<string, string> = {
  SIN_GESTION:              'Sin gestión',
  ANALISIS:                 'En estudio y evaluación técnica',
  EN_DEFINICION_USUARIO:    'En definición de usuario',
  EN_DESARROLLO:            'En desarrollo',
  PRUEBAS_USUARIO:          'Pruebas usuario',
  EN_ESPERA_POR_TERCEROS:   'En espera por terceros',
  ENTREGADO:                'Entregado',
  CERRADO:                  'Cerrado',
  DESISTIDO:                'Desistido',
}

const TEST_EMAIL = 'c.tin@iwglogistics.com'

// Campos que pueden no existir si la migración no se ha ejecutado aún
const CAMPOS_MIGRACION = [
  'total_beneficios_cualitativos_anual',
  'impacto_economico_total_anual',
]

// Si Supabase rechaza por columna inexistente, reintenta sin los campos de migración
async function insertConFallback(
  supabase: ReturnType<typeof createAdminClient>,
  tabla: string,
  payload: Record<string, unknown>
) {
  let { data, error } = await (supabase as any)
    .from(tabla).insert(payload).select().single()

  if (error && error.message?.includes('column') && error.message?.includes('does not exist')) {
    const payloadSinMigracion = Object.fromEntries(
      Object.entries(payload).filter(([k]) => !CAMPOS_MIGRACION.includes(k))
    )
    ;({ data, error } = await (supabase as any)
      .from(tabla).insert(payloadSinMigracion).select().single())
  }

  return { data, error }
}

async function updateConFallback(
  supabase: ReturnType<typeof createAdminClient>,
  tabla: string,
  payload: Record<string, unknown>,
  id: string
) {
  let { data, error } = await (supabase as any)
    .from(tabla).update(payload).eq('id', id).select().single()

  if (error && error.message?.includes('column') && error.message?.includes('does not exist')) {
    const payloadSinMigracion = Object.fromEntries(
      Object.entries(payload).filter(([k]) => !CAMPOS_MIGRACION.includes(k))
    )
    ;({ data, error } = await (supabase as any)
      .from(tabla).update(payloadSinMigracion).eq('id', id).select().single())
  }

  return { data, error }
}

export async function crearRequerimiento(
  data: Partial<Omit<Requerimiento, 'id' | 'created_at' | 'updated_at'>> & Record<string, unknown>
) {
  const supabase = createAdminClient()

  // Auto-asignar al lote activo
  const { data: loteActivo } = await (supabase as any)
    .from('lotes').select('id').eq('activo', true).single()

  const payload = {
    identificacion: data.nombre_desarrollo ?? '',
    ...data,
    ...(loteActivo ? { lote_id: loteActivo.id } : {}),
  }

  const { data: result, error } = await insertConFallback(supabase, 'requerimientos', payload)
  if (error) throw new Error(`Error al crear requerimiento: ${error.message}`)

  revalidatePath('/requerimientos')
  revalidatePath('/admin/requerimientos')
  revalidatePath('/dashboard')
  revalidatePath('/admin/dashboard')
  revalidatePath('/mis-requerimientos')
  return result as unknown as Requerimiento
}

export async function actualizarRequerimiento(
  id: string,
  data: Partial<Omit<Requerimiento, 'id' | 'created_at' | 'updated_at'>> & Record<string, unknown>
) {
  const supabase = createAdminClient()
  const payload = { identificacion: data.nombre_desarrollo, ...data }

  const { data: result, error } = await updateConFallback(supabase, 'requerimientos', payload, id)
  if (error) throw new Error(`Error al actualizar requerimiento: ${error.message}`)

  revalidatePath('/requerimientos')
  revalidatePath(`/requerimientos/${id}`)
  revalidatePath('/admin/requerimientos')
  revalidatePath(`/admin/requerimientos/${id}`)
  revalidatePath('/dashboard')
  revalidatePath('/admin/dashboard')
  revalidatePath('/mis-requerimientos')
  return result as unknown as Requerimiento
}

export async function guardarBorrador(
  id: string | null,
  data: Partial<Omit<Requerimiento, 'id' | 'created_at' | 'updated_at'>> & Record<string, unknown>
) {
  const supabase = createAdminClient()
  const payload = { identificacion: data.nombre_desarrollo ?? '', ...data, es_borrador: true }

  if (id) {
    const { data: result, error } = await updateConFallback(supabase, 'requerimientos', payload, id)
    if (error) throw new Error(`Error al guardar borrador: ${error.message}`)
    revalidatePath(`/requerimientos/${id}`)
    return result as unknown as Requerimiento
  } else {
    const { data: result, error } = await insertConFallback(supabase, 'requerimientos', payload)
    if (error) throw new Error(`Error al crear borrador: ${error.message}`)
    revalidatePath('/requerimientos')
    return result as unknown as Requerimiento
  }
}

export async function cambiarEstado(
  id: string,
  estado: string,
  observacion?: string,
  fechaTransicion?: string  // YYYY-MM-DD; reemplaza la fecha auto-asignada del estado destino
) {
  const supabase = createAdminClient()

  // Obtener datos del requerimiento antes del cambio
  const { data: req } = await (supabase as any)
    .from('requerimientos')
    .select('nombre_desarrollo, identificacion, estado')
    .eq('id', id)
    .single()

  const updates: Record<string, unknown> = { estado }

  const hoy = new Date().toISOString().split('T')[0]
  const fecha = fechaTransicion ?? hoy
  if (estado === 'ENTREGADO' || estado === 'CERRADO') updates.porcentaje_avance = 100
  if (estado === 'EN_DESARROLLO') updates.fecha_inicio_desarrollo = fecha
  if (estado === 'ENTREGADO')     updates.fecha_real_entrega       = fecha
  if (estado === 'CERRADO')       updates.fecha_cierre             = fecha

  const { error } = await (supabase as any).from('requerimientos').update(updates).eq('id', id)
  if (error) throw new Error(`Error al cambiar estado: ${error.message}`)

  if (observacion?.trim()) {
    const { data: ultimo } = await supabase
      .from('historial_estados')
      .select('id').eq('requerimiento_id', id)
      .order('created_at', { ascending: false }).limit(1).single()
    if (ultimo) {
      await (supabase as any).from('historial_estados')
        .update({ observacion: observacion.trim() }).eq('id', ultimo.id)
    }
  }

  revalidatePath('/requerimientos')
  revalidatePath(`/requerimientos/${id}`)
  revalidatePath('/kanban')
  revalidatePath('/dashboard')

  // Enviar correo de notificación (sin bloquear si falla)
  if (req) {
    sendEmail({
      to: TEST_EMAIL,
      subject: `[${req.identificacion}] Cambio de estado: ${ESTADO_LABEL[estado] ?? estado}`,
      html: templateCambioEstado({
        nombreDesarrollo: req.nombre_desarrollo ?? req.identificacion ?? '—',
        identificacion:   req.identificacion ?? '',
        estadoAnterior:   ESTADO_LABEL[req.estado] ?? req.estado ?? '—',
        estadoNuevo:      ESTADO_LABEL[estado] ?? estado,
        observacion:      observacion?.trim(),
      }),
    }).catch(err => console.error('[email] Error al enviar notificación de estado:', err))
  }
}

export async function registrarFechaEntrega(id: string, fecha: string) {
  const supabase = createAdminClient()
  const { error } = await (supabase as any)
    .from('requerimientos')
    .update({ fecha_real_entrega: fecha })
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/requerimientos')
  revalidatePath(`/admin/requerimientos/${id}`)
  revalidatePath('/admin/reporte-presidencial')
}

export async function eliminarRequerimiento(id: string) {
  const supabase = createAdminClient()
  const { error } = await (supabase as any)
    .from('requerimientos')
    .update({ estado: 'CERRADO', fecha_cierre: new Date().toISOString().split('T')[0] })
    .eq('id', id)
  if (error) throw new Error(`Error al cerrar requerimiento: ${error.message}`)
  revalidatePath('/requerimientos')
  revalidatePath('/dashboard')
}

export async function agregarComentario(
  requerimientoId: string, comentario: string, usuario: string
) {
  const supabase = createAdminClient()
  const { data, error } = await (supabase as any)
    .from('comentarios')
    .insert({ requerimiento_id: requerimientoId, comentario, usuario })
    .select().single()
  if (error) throw new Error(`Error al agregar comentario: ${error.message}`)
  revalidatePath(`/requerimientos/${requerimientoId}`)
  return data
}

export async function publicarRequerimiento(id: string) {
  return actualizarRequerimiento(id, {
    es_borrador: false,
    fecha_envio_solicitud: new Date().toISOString(),
  })
}
