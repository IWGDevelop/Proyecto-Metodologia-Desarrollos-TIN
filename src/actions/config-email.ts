'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export interface DestinatarioEmail {
  id: string
  email: string
  nombre: string | null
  activo: boolean
  created_at: string
}

export async function getDestinatariosEmail(): Promise<DestinatarioEmail[]> {
  const supabase = createAdminClient()
  const { data, error } = await (supabase as any)
    .from('config_notificaciones_email')
    .select('*')
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function getEmailsActivos(): Promise<string[]> {
  const supabase = createAdminClient()
  const { data } = await (supabase as any)
    .from('config_notificaciones_email')
    .select('email')
    .eq('activo', true)
  return (data ?? []).map((r: { email: string }) => r.email)
}

export async function agregarDestinatario(email: string, nombre: string) {
  const supabase = createAdminClient()
  const { error } = await (supabase as any)
    .from('config_notificaciones_email')
    .insert({ email: email.trim().toLowerCase(), nombre: nombre.trim() || null })
  if (error) throw new Error(error.message)
  revalidatePath('/admin/configuracion')
}

export async function toggleDestinatario(id: string, activo: boolean) {
  const supabase = createAdminClient()
  const { error } = await (supabase as any)
    .from('config_notificaciones_email')
    .update({ activo })
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/configuracion')
}

export async function eliminarDestinatario(id: string) {
  const supabase = createAdminClient()
  const { error } = await (supabase as any)
    .from('config_notificaciones_email')
    .delete()
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/configuracion')
}

export async function getConfigParam(clave: string): Promise<string | null> {
  const supabase = createAdminClient()
  const { data } = await (supabase as any)
    .from('configuracion_sistema')
    .select('valor')
    .eq('clave', clave)
    .single()
  return data?.valor ?? null
}

export async function setConfigParam(clave: string, valor: string) {
  const supabase = createAdminClient()
  const { error } = await (supabase as any)
    .from('configuracion_sistema')
    .upsert({ clave, valor }, { onConflict: 'clave' })
  if (error) throw new Error(error.message)
  revalidatePath('/admin/configuracion')
}
