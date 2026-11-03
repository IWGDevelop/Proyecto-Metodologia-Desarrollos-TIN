'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getUsuarioActual, NO_AUTORIZADO } from '@/lib/supabase/guards'
import { createAdminClient } from '@/lib/supabase/admin'
import { MCP_ROL_PERMITIDO } from '@/lib/mcp/tokens'
import { emitirCodigo, origenPublico } from '@/lib/mcp/oauth'
import { urlRetorno, validarSolicitud } from '@/lib/mcp/autorizacion'

// Consentimiento OAuth del MCP. Las Server Actions de Next validan el Origin,
// lo que protege el botón "Permitir" contra CSRF.

async function solicitudDesdeForm(formData: FormData) {
  const consulta = new URLSearchParams(String(formData.get('consulta') ?? ''))
  const origen = origenPublico(await headers())
  return { origen, solicitud: await validarSolicitud(consulta, origen) }
}

export async function aprobarAutorizacionMcp(formData: FormData): Promise<void> {
  const { origen, solicitud } = await solicitudDesdeForm(formData)
  if (solicitud.tipo === 'error_pantalla') throw new Error(solicitud.mensaje)
  if (solicitud.tipo === 'error_redirect') redirect(solicitud.url)

  const actual = await getUsuarioActual()
  if (!actual || actual.rol !== MCP_ROL_PERMITIDO) throw new Error(NO_AUTORIZADO)

  const codigo = await emitirCodigo({
    cliente: solicitud.cliente,
    usuarioId: actual.user.id,
    redirectUri: solicitud.redirectUri,
    codeChallenge: solicitud.codeChallenge,
    resource: solicitud.resource,
    scope: solicitud.scope,
  })
  redirect(urlRetorno(solicitud.redirectUri, { code: codigo, state: solicitud.state }, origen))
}

export async function denegarAutorizacionMcp(formData: FormData): Promise<void> {
  const { origen, solicitud } = await solicitudDesdeForm(formData)
  if (solicitud.tipo === 'error_pantalla') throw new Error(solicitud.mensaje)
  if (solicitud.tipo === 'error_redirect') redirect(solicitud.url)
  redirect(urlRetorno(solicitud.redirectUri, {
    error: 'access_denied',
    error_description: 'El usuario rechazó la solicitud',
    state: solicitud.state,
  }, origen))
}

// ── Conexiones OAuth del usuario (para /admin/conexion-mcp) ────────────────

export interface ConexionMcp {
  id: string
  client_nombre: string
  created_at: string
  ultimo_uso: string | null
  refresh_expira_en: string
}

async function exigirAdminTin(): Promise<string> {
  const actual = await getUsuarioActual()
  if (!actual || actual.rol !== MCP_ROL_PERMITIDO) throw new Error(NO_AUTORIZADO)
  return actual.user.id
}

export async function listarMisConexionesMcp(): Promise<ConexionMcp[]> {
  const usuarioId = await exigirAdminTin()
  const { data, error } = await (createAdminClient() as any)
    .from('mcp_oauth_sesiones')
    .select('id, client_nombre, created_at, ultimo_uso, refresh_expira_en')
    .eq('usuario_id', usuarioId)
    .is('revocado_en', null)
    .gt('refresh_expira_en', new Date().toISOString())
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function revocarConexionMcp(id: string): Promise<void> {
  const usuarioId = await exigirAdminTin()
  const { error } = await (createAdminClient() as any)
    .from('mcp_oauth_sesiones')
    .update({ revocado_en: new Date().toISOString() })
    .eq('id', id)
    .eq('usuario_id', usuarioId)
  if (error) throw new Error(error.message)
}
