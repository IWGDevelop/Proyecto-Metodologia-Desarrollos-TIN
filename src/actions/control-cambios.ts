'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getPerfil } from '@/lib/supabase/auth'
import { revalidatePath } from 'next/cache'
import {
  ESTADOS_DECISION, TRANSICIONES_CAMBIO, codigoCambio,
  type EstadoCambio, type TipoCambio,
} from '@/lib/control-cambios'

export interface AnexoCambio {
  id: string
  nombre_archivo: string
  url_storage: string
  tipo_archivo: string | null
  tamanio_bytes: number | null
  subido_por: string | null
  created_at: string
}

export interface EventoCambio {
  id: string
  accion: 'CREADO' | 'EDITADO' | 'ESTADO'
  estado_anterior: string | null
  estado_nuevo: string | null
  comentario: string | null
  usuario: string | null
  created_at: string
}

export interface ControlCambio {
  id: string
  requerimiento_id: string
  consecutivo: number
  codigo: string
  titulo: string
  tipo: TipoCambio
  descripcion: string
  justificacion: string | null
  solicitado_por: string | null
  fecha_solicitud: string
  impacto_descripcion: string | null
  impacto_dias: number | null
  impacto_horas: number | null
  impacto_costo: number | null
  estado: EstadoCambio
  decision_por: string | null
  fecha_decision: string | null
  observaciones_decision: string | null
  version: string | null
  fecha_implementacion: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  anexos: AnexoCambio[]
  eventos: EventoCambio[]
}

/** Campos editables de la ficha del cambio */
export interface DatosCambio {
  titulo: string
  tipo: TipoCambio
  descripcion: string
  justificacion: string | null
  solicitado_por: string | null
  fecha_solicitud: string
  impacto_descripcion: string | null
  impacto_dias: number | null
  impacto_horas: number | null
  impacto_costo: number | null
  version: string | null
  fecha_implementacion: string | null
}

type Resultado = { ok: boolean; error?: string }

async function nombreUsuario(): Promise<string> {
  try {
    const perfil = await getPerfil()
    return perfil?.nombre_completo ?? perfil?.email ?? 'Sistema'
  } catch { return 'Sistema' }
}

function limpiar(datos: DatosCambio): DatosCambio {
  const texto = (v: string | null) => (v?.trim() ? v.trim() : null)
  return {
    ...datos,
    titulo: datos.titulo.trim(),
    descripcion: datos.descripcion.trim(),
    justificacion: texto(datos.justificacion),
    solicitado_por: texto(datos.solicitado_por),
    impacto_descripcion: texto(datos.impacto_descripcion),
    version: texto(datos.version),
    fecha_implementacion: datos.fecha_implementacion || null,
  }
}

function validar(datos: DatosCambio): string | null {
  if (!datos.titulo.trim()) return 'El título es obligatorio'
  if (!datos.descripcion.trim()) return 'Describe el cambio'
  if (!datos.fecha_solicitud) return 'La fecha de solicitud es obligatoria'
  return null
}

export async function getControlCambios(requerimientoId: string): Promise<ControlCambio[]> {
  const supabase = createAdminClient()
  const { data, error } = await (supabase as any)
    .from('control_cambios')
    .select('*, anexos:control_cambios_anexos(*), eventos:control_cambios_eventos(*)')
    .eq('requerimiento_id', requerimientoId)
    .order('consecutivo', { ascending: false })
  if (error) return []
  return (data ?? []).map((c: any) => ({
    ...c,
    codigo: codigoCambio(c.consecutivo),
    anexos: [...(c.anexos ?? [])].sort((a: any, b: any) => a.created_at.localeCompare(b.created_at)),
    eventos: [...(c.eventos ?? [])].sort((a: any, b: any) => b.created_at.localeCompare(a.created_at)),
  }))
}

export async function crearControlCambio(requerimientoId: string, datos: DatosCambio): Promise<Resultado & { codigo?: string }> {
  try {
    const error = validar(datos)
    if (error) return { ok: false, error }

    const supabase = createAdminClient()
    const usuario = await nombreUsuario()

    // Consecutivo por requerimiento; se reintenta si otro usuario tomó el mismo número
    for (let intento = 0; intento < 3; intento++) {
      const { data: ultimo } = await (supabase as any)
        .from('control_cambios')
        .select('consecutivo')
        .eq('requerimiento_id', requerimientoId)
        .order('consecutivo', { ascending: false })
        .limit(1)
        .maybeSingle()
      const consecutivo = (ultimo?.consecutivo ?? 0) + 1

      const { data: creado, error: errInsert } = await (supabase as any)
        .from('control_cambios')
        .insert({ requerimiento_id: requerimientoId, consecutivo, ...limpiar(datos), created_by: usuario })
        .select('id')
        .single()

      if (errInsert?.code === '23505') continue
      if (errInsert) return { ok: false, error: errInsert.message }

      await (supabase as any).from('control_cambios_eventos').insert({
        control_cambio_id: creado.id, accion: 'CREADO', estado_nuevo: 'SOLICITADO', usuario,
      })
      revalidatePath(`/admin/requerimientos/${requerimientoId}`)
      return { ok: true, codigo: codigoCambio(consecutivo) }
    }
    return { ok: false, error: 'No se pudo asignar el consecutivo, intenta de nuevo' }
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'Error al crear el cambio' }
  }
}

export async function actualizarControlCambio(id: string, requerimientoId: string, datos: DatosCambio): Promise<Resultado> {
  try {
    const error = validar(datos)
    if (error) return { ok: false, error }

    const supabase = createAdminClient()
    const usuario = await nombreUsuario()
    const { error: errUpdate } = await (supabase as any)
      .from('control_cambios')
      .update({ ...limpiar(datos), updated_at: new Date().toISOString() })
      .eq('id', id)
    if (errUpdate) return { ok: false, error: errUpdate.message }

    await (supabase as any).from('control_cambios_eventos').insert({
      control_cambio_id: id, accion: 'EDITADO', comentario: 'Se actualizó la ficha del cambio', usuario,
    })
    revalidatePath(`/admin/requerimientos/${requerimientoId}`)
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'Error al actualizar el cambio' }
  }
}

export async function cambiarEstadoControlCambio(
  id: string,
  requerimientoId: string,
  nuevoEstado: EstadoCambio,
  comentario: string,
): Promise<Resultado> {
  try {
    const supabase = createAdminClient()
    const { data: actual } = await (supabase as any)
      .from('control_cambios').select('estado').eq('id', id).single()
    if (!actual) return { ok: false, error: 'Cambio no encontrado' }

    const desde = actual.estado as EstadoCambio
    if (!TRANSICIONES_CAMBIO[desde]?.includes(nuevoEstado)) {
      return { ok: false, error: 'Transición de estado no permitida' }
    }
    if (ESTADOS_DECISION.includes(nuevoEstado) && !comentario.trim()) {
      return { ok: false, error: 'Registra las observaciones de la decisión' }
    }

    const usuario = await nombreUsuario()
    const hoy = new Date().toISOString().slice(0, 10)
    const cambios: Record<string, any> = { estado: nuevoEstado, updated_at: new Date().toISOString() }
    if (ESTADOS_DECISION.includes(nuevoEstado)) {
      cambios.decision_por = usuario
      cambios.fecha_decision = hoy
      cambios.observaciones_decision = comentario.trim()
    }
    if (nuevoEstado === 'IMPLEMENTADO') cambios.fecha_implementacion = hoy

    const { error } = await (supabase as any).from('control_cambios').update(cambios).eq('id', id)
    if (error) return { ok: false, error: error.message }

    await (supabase as any).from('control_cambios_eventos').insert({
      control_cambio_id: id,
      accion: 'ESTADO',
      estado_anterior: desde,
      estado_nuevo: nuevoEstado,
      comentario: comentario.trim() || null,
      usuario,
    })
    revalidatePath(`/admin/requerimientos/${requerimientoId}`)
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'Error al cambiar el estado' }
  }
}

export async function eliminarControlCambio(id: string, requerimientoId: string): Promise<Resultado> {
  try {
    const perfil = await getPerfil()
    if (perfil?.rol !== 'ADMIN_TIN') return { ok: false, error: 'Solo un administrador puede eliminar cambios' }
    const supabase = createAdminClient()
    const { error } = await (supabase as any).from('control_cambios').delete().eq('id', id)
    if (error) return { ok: false, error: error.message }
    revalidatePath(`/admin/requerimientos/${requerimientoId}`)
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'Error al eliminar el cambio' }
  }
}

export async function registrarAnexoControlCambio(
  controlCambioId: string,
  payload: { nombre_archivo: string; url_storage: string; tipo_archivo?: string; tamanio_bytes?: number },
): Promise<Resultado> {
  try {
    const supabase = createAdminClient()
    const { error } = await (supabase as any)
      .from('control_cambios_anexos')
      .insert({ control_cambio_id: controlCambioId, ...payload, subido_por: await nombreUsuario() })
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'Error al registrar el anexo' }
  }
}

export async function eliminarAnexoControlCambio(id: string): Promise<Resultado> {
  try {
    const supabase = createAdminClient()
    const { error } = await (supabase as any).from('control_cambios_anexos').delete().eq('id', id)
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'Error al eliminar el anexo' }
  }
}
