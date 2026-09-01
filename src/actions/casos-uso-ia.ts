'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getPerfil } from '@/lib/supabase/auth'
import type { CasoUsoIA, CasoUsoIAHistorial, CasoUsoIAAnexo, EstadoCasoUsoIA, Alcance, NivelRiesgoIA } from '@/lib/supabase/types'

export async function getCasosUsoIA(params?: {
  estado?: string
  alcance?: string
  search?: string
}): Promise<CasoUsoIA[]> {
  const supabase = createAdminClient()
  let query = (supabase as any)
    .from('casos_uso_ia')
    .select(`
      *,
      solicitante:solicitante_id(id, nombre_completo, email, cargo),
      autorizador_tin:autorizado_by_tin(id, nombre_completo),
      autorizador_ia:autorizado_by_ia(id, nombre_completo)
    `)
    .order('created_at', { ascending: false })

  if (params?.estado) query = query.eq('estado', params.estado)
  if (params?.alcance) query = query.eq('alcance', params.alcance)
  if (params?.search?.trim()) {
    const q = params.search.trim()
    query = query.or(`proceso_solicitante.ilike.%${q}%,proposito.ilike.%${q}%,herramienta_producto.ilike.%${q}%,herramienta_proveedor.ilike.%${q}%`)
  }

  const { data, error } = await query
  if (error) return []
  return data ?? []
}

export async function getCasoUsoIA(id: string): Promise<CasoUsoIA | null> {
  const supabase = createAdminClient()
  const { data, error } = await (supabase as any)
    .from('casos_uso_ia')
    .select(`
      *,
      solicitante:solicitante_id(id, nombre_completo, email, cargo),
      autorizador_tin:autorizado_by_tin(id, nombre_completo),
      autorizador_ia:autorizado_by_ia(id, nombre_completo)
    `)
    .eq('id', id)
    .single()

  if (error) return null
  return data
}

export async function getHistorialCasoUsoIA(casoId: string): Promise<CasoUsoIAHistorial[]> {
  const supabase = createAdminClient()
  const { data, error } = await (supabase as any)
    .from('casos_uso_ia_historial')
    .select(`*, cambiado_por:cambiado_by(id, nombre_completo, email)`)
    .eq('caso_id', casoId)
    .order('created_at', { ascending: false })

  if (error) return []
  return data ?? []
}

export async function getAnexosCasoUsoIA(casoId: string): Promise<CasoUsoIAAnexo[]> {
  const supabase = createAdminClient()
  const { data, error } = await (supabase as any)
    .from('casos_uso_ia_anexos')
    .select('*')
    .eq('caso_id', casoId)
    .order('created_at', { ascending: false })

  if (error) return []
  return data ?? []
}

export interface NuevoCasoUsoIAInput {
  proceso_solicitante: string
  alcance: Alcance
  proposito: string
  herramienta_proveedor: string
  herramienta_producto: string
  herramienta_modelo?: string
  herramienta_modalidad_acceso?: string
  tipo_datos: string
  sistemas_conectar?: string
  usuarios_previstos: string
  beneficios_esperados: string
}

export async function crearCasoUsoIA(
  input: NuevoCasoUsoIAInput
): Promise<{ ok: boolean; id?: string; error?: string }> {
  try {
    const perfil = await getPerfil()
    const supabase = createAdminClient()

    const { data, error } = await (supabase as any)
      .from('casos_uso_ia')
      .insert({
        estado: 'RECIBIDO',
        solicitante_id: perfil?.id ?? null,
        proceso_solicitante: input.proceso_solicitante,
        alcance: input.alcance,
        proposito: input.proposito,
        herramienta_proveedor: input.herramienta_proveedor,
        herramienta_producto: input.herramienta_producto,
        herramienta_modelo: input.herramienta_modelo ?? null,
        herramienta_modalidad_acceso: input.herramienta_modalidad_acceso ?? null,
        tipo_datos: input.tipo_datos,
        sistemas_conectar: input.sistemas_conectar ?? null,
        usuarios_previstos: input.usuarios_previstos,
        beneficios_esperados: input.beneficios_esperados,
      })
      .select('id')
      .single()

    if (error) return { ok: false, error: error.message }

    await (supabase as any).from('casos_uso_ia_historial').insert({
      caso_id: data.id,
      estado_anterior: null,
      estado_nuevo: 'RECIBIDO',
      comentario: 'Solicitud radicada en TIN-FLOW',
      cambiado_by: perfil?.id ?? null,
    })

    return { ok: true, id: data.id }
  } catch (e: any) {
    return { ok: false, error: e?.message }
  }
}

export async function cambiarEstadoCasoUsoIA(
  casoId: string,
  estadoNuevo: EstadoCasoUsoIA,
  comentario?: string,
  extra?: {
    nivel_riesgo?: NivelRiesgoIA
    observaciones_ajuste?: string
    fecha_autorizacion?: string
    fecha_vencimiento?: string
  }
): Promise<{ ok: boolean; error?: string }> {
  try {
    const perfil = await getPerfil()
    const supabase = createAdminClient()

    const { data: actual } = await (supabase as any)
      .from('casos_uso_ia')
      .select('estado')
      .eq('id', casoId)
      .single()

    const updates: Record<string, unknown> = { estado: estadoNuevo }
    if (extra?.nivel_riesgo) updates.nivel_riesgo = extra.nivel_riesgo
    if (extra?.observaciones_ajuste !== undefined) updates.observaciones_ajuste = extra.observaciones_ajuste
    if (extra?.fecha_autorizacion) updates.fecha_autorizacion = extra.fecha_autorizacion
    if (extra?.fecha_vencimiento) updates.fecha_vencimiento = extra.fecha_vencimiento

    if (estadoNuevo === 'AUTORIZADO' && perfil) {
      if (perfil.proceso_interno === 'TI' || perfil.rol === 'ADMIN_TIN') {
        updates.autorizado_by_tin = perfil.id
      }
      if (perfil.proceso_interno === 'IA') {
        updates.autorizado_by_ia = perfil.id
      }
    }

    const { error } = await (supabase as any)
      .from('casos_uso_ia')
      .update(updates)
      .eq('id', casoId)

    if (error) return { ok: false, error: error.message }

    await (supabase as any).from('casos_uso_ia_historial').insert({
      caso_id: casoId,
      estado_anterior: actual?.estado ?? null,
      estado_nuevo: estadoNuevo,
      comentario: comentario ?? null,
      cambiado_by: perfil?.id ?? null,
    })

    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e?.message }
  }
}

export async function registrarAnexoCasoUsoIA(
  casoId: string,
  nombre: string,
  url: string,
  tipo?: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const perfil = await getPerfil()
    const supabase = createAdminClient()

    const { error } = await (supabase as any)
      .from('casos_uso_ia_anexos')
      .insert({
        caso_id: casoId,
        nombre,
        url,
        tipo: tipo ?? null,
        uploaded_by: perfil?.id ?? null,
      })

    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e?.message }
  }
}
