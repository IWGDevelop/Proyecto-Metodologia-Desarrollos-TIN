'use server'

import { getUsuarioActual, NO_AUTORIZADO } from '@/lib/supabase/guards'
import { createAdminClient } from '@/lib/supabase/admin'
import { generarTokenPlano, hashToken, MCP_DIAS_VIGENCIA, MCP_ROL_PERMITIDO } from '@/lib/mcp/tokens'

export interface TokenMcp {
  id: string
  nombre: string
  prefijo: string
  expira_en: string
  ultimo_uso: string | null
  revocado_en: string | null
  created_at: string
}

// Solo ADMIN_TIN puede gestionar tokens MCP (los propios)
async function exigirAdminTin(): Promise<string> {
  const actual = await getUsuarioActual()
  if (!actual || actual.rol !== MCP_ROL_PERMITIDO) throw new Error(NO_AUTORIZADO)
  return actual.user.id
}

export async function listarMisTokensMcp(): Promise<TokenMcp[]> {
  const usuarioId = await exigirAdminTin()
  const { data, error } = await (createAdminClient() as any)
    .from('mcp_tokens')
    .select('id, nombre, prefijo, expira_en, ultimo_uso, revocado_en, created_at')
    .eq('usuario_id', usuarioId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data ?? []
}

/** Crea un token y lo devuelve en claro. Es la única vez que se puede ver. */
export async function generarTokenMcp(nombre: string): Promise<{ token: string; expira_en: string }> {
  const usuarioId = await exigirAdminTin()
  const nombreLimpio = nombre.trim().slice(0, 80)
  if (!nombreLimpio) throw new Error('Ponle un nombre al token (ej. "Portátil oficina")')

  const token = generarTokenPlano()
  const expira = new Date(Date.now() + MCP_DIAS_VIGENCIA * 86_400_000).toISOString()

  const { error } = await (createAdminClient() as any).from('mcp_tokens').insert({
    usuario_id: usuarioId,
    nombre: nombreLimpio,
    token_hash: hashToken(token),
    prefijo: token.slice(0, 10),
    expira_en: expira,
  })
  if (error) throw new Error(error.message)
  return { token, expira_en: expira }
}

export async function revocarTokenMcp(id: string): Promise<void> {
  const usuarioId = await exigirAdminTin()
  const { error } = await (createAdminClient() as any)
    .from('mcp_tokens')
    .update({ revocado_en: new Date().toISOString() })
    .eq('id', id)
    .eq('usuario_id', usuarioId)
    .is('revocado_en', null)
  if (error) throw new Error(error.message)
}
