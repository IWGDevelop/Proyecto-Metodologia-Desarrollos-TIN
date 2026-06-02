'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import type { TipoPermiso } from '@/lib/recursos-sistema'

export interface RolPersonalizado {
  id: string
  nombre: string
  descripcion: string | null
  activo: boolean
  es_sistema: boolean
  created_at: string
  updated_at: string
}

export interface PermisoRol {
  recurso: string
  puede_ver: boolean
  puede_editar: boolean
  puede_crear: boolean
}

export type PermisosMap = Record<string, Record<TipoPermiso, boolean>>

/* ── Roles ─────────────────────────────────────────────────────────────────── */

export async function getRoles(): Promise<RolPersonalizado[]> {
  try {
    const supabase = createAdminClient()
    const { data } = await (supabase as any)
      .from('roles_personalizados')
      .select('*')
      .order('es_sistema', { ascending: false })
      .order('nombre')
    return (data ?? []) as RolPersonalizado[]
  } catch { return [] }
}

export async function crearRol(datos: { nombre: string; descripcion?: string }): Promise<{ ok: boolean; error?: string; id?: string }> {
  try {
    if (!datos.nombre.trim()) return { ok: false, error: 'El nombre es obligatorio' }
    const supabase = createAdminClient()
    const { data, error } = await (supabase as any)
      .from('roles_personalizados')
      .insert({ nombre: datos.nombre.trim().toUpperCase().replace(/\s+/g, '_'), descripcion: datos.descripcion?.trim() || null })
      .select()
      .single()
    if (error) return { ok: false, error: error.message }
    return { ok: true, id: data.id }
  } catch (e: any) { return { ok: false, error: e.message } }
}

export async function actualizarRol(id: string, datos: { nombre?: string; descripcion?: string | null; activo?: boolean }): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = createAdminClient()
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (datos.nombre !== undefined)      update.nombre      = datos.nombre.trim().toUpperCase().replace(/\s+/g, '_')
    if (datos.descripcion !== undefined) update.descripcion = datos.descripcion?.trim() || null
    if (datos.activo !== undefined)      update.activo      = datos.activo
    const { error } = await (supabase as any).from('roles_personalizados').update(update).eq('id', id)
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (e: any) { return { ok: false, error: e.message } }
}

export async function eliminarRol(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = createAdminClient()
    const { data: rol } = await (supabase as any).from('roles_personalizados').select('es_sistema').eq('id', id).single()
    if (rol?.es_sistema) return { ok: false, error: 'No se pueden eliminar roles del sistema' }
    const { error } = await (supabase as any).from('roles_personalizados').delete().eq('id', id)
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (e: any) { return { ok: false, error: e.message } }
}

/* ── Permisos ──────────────────────────────────────────────────────────────── */

export async function getPermisosRol(rolId: string): Promise<PermisosMap> {
  try {
    const supabase = createAdminClient()
    const { data } = await (supabase as any)
      .from('permisos_rol')
      .select('recurso, puede_ver, puede_editar, puede_crear')
      .eq('rol_id', rolId)
    const map: PermisosMap = {}
    ;(data ?? []).forEach((p: any) => {
      map[p.recurso] = { puede_ver: p.puede_ver, puede_editar: p.puede_editar, puede_crear: p.puede_crear }
    })
    return map
  } catch { return {} }
}

export async function guardarPermisosRol(
  rolId: string,
  permisos: PermisosMap
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = createAdminClient()

    const rows = Object.entries(permisos).map(([recurso, p]) => ({
      rol_id:       rolId,
      recurso,
      puede_ver:    p.puede_ver,
      puede_editar: p.puede_editar,
      puede_crear:  p.puede_crear,
    }))

    if (rows.length === 0) {
      await (supabase as any).from('permisos_rol').delete().eq('rol_id', rolId)
      return { ok: true }
    }

    const { error } = await (supabase as any)
      .from('permisos_rol')
      .upsert(rows, { onConflict: 'rol_id,recurso' })
    if (error) return { ok: false, error: error.message }

    // Eliminar recursos que ya no están en el mapa
    const recursosActuales = rows.map(r => r.recurso)
    await (supabase as any)
      .from('permisos_rol')
      .delete()
      .eq('rol_id', rolId)
      .not('recurso', 'in', `(${recursosActuales.map(r => `"${r}"`).join(',')})`)

    return { ok: true }
  } catch (e: any) { return { ok: false, error: e.message } }
}

export async function getPermisosUsuario(rolNombre: string): Promise<PermisosMap> {
  try {
    const supabase = createAdminClient()
    const { data: rol } = await (supabase as any)
      .from('roles_personalizados')
      .select('id')
      .eq('nombre', rolNombre)
      .single()
    if (!rol) return {}
    return getPermisosRol(rol.id)
  } catch { return {} }
}
