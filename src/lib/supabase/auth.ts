import { createClient } from './server'
import type { Perfil } from './types'

export async function getSession() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

export async function getUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function getPerfil(): Promise<Perfil | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await (supabase as any)
    .from('perfiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return (data as Perfil | null)
}

export async function isAdminTIN(): Promise<boolean> {
  const perfil = await getPerfil()
  return perfil?.rol === 'ADMIN_TIN'
}

export async function isPresidencia(): Promise<boolean> {
  const perfil = await getPerfil()
  return perfil?.rol === 'PRESIDENCIA'
}

export async function hasAdminAccess(): Promise<boolean> {
  const perfil = await getPerfil()
  return perfil?.rol === 'ADMIN_TIN' || perfil?.rol === 'PRESIDENCIA'
}
