import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { hashToken, MCP_DIAS_VIGENCIA, MCP_ROL_PERMITIDO } from './tokens'

// Servidor de autorización OAuth 2.1 para el MCP, según la especificación de autorización
// de MCP y los requisitos de Claude (https://claude.com/docs/connectors/building/authentication):
// PKCE S256 obligatorio, cliente público (sin secreto), registro por CIMD o DCR,
// refresh tokens rotados y tokens ligados al recurso /api/mcp.

export const MCP_PATH = '/api/mcp'
export const SCOPE_MCP = 'requerimientos:read'
export const ACCESS_TTL_SEG = 3600
const CODIGO_TTL_SEG = 600
const REFRESH_TTL_MS = MCP_DIAS_VIGENCIA * 86_400_000

const PREFIJO_CODIGO = 'tinac_'
const PREFIJO_ACCESS = 'tinat_'
const PREFIJO_REFRESH = 'tinrt_'

// ── URLs públicas ───────────────────────────────────────────────────────────

/** Origen tal como lo ve el cliente (respeta el dominio con el que se agregó el conector) */
export function origenPublico(h: Headers): string {
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000'
  const local = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)
  const proto = h.get('x-forwarded-proto')?.split(',')[0] ?? (local ? 'http' : 'https')
  return `${proto}://${host}`
}

export const urlRecurso = (origen: string) => `${origen}${MCP_PATH}`
export const urlMetadataRecurso = (origen: string) => `${origen}/.well-known/oauth-protected-resource${MCP_PATH}`

export function metadataRecurso(origen: string) {
  return {
    resource: urlRecurso(origen),
    authorization_servers: [origen],
    scopes_supported: [SCOPE_MCP],
    bearer_methods_supported: ['header'],
    resource_name: 'TIN-FLOW Requerimientos',
  }
}

export function metadataServidorAutorizacion(origen: string) {
  return {
    issuer: origen,
    authorization_endpoint: `${origen}/oauth/autorizar`,
    token_endpoint: `${origen}/api/oauth/token`,
    registration_endpoint: `${origen}/api/oauth/register`,
    scopes_supported: [SCOPE_MCP, 'offline_access'],
    response_types_supported: ['code'],
    response_modes_supported: ['query'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    token_endpoint_auth_methods_supported: ['none'],
    code_challenge_methods_supported: ['S256'],
    client_id_metadata_document_supported: true,
    authorization_response_iss_parameter_supported: true,
  }
}

/** Header WWW-Authenticate del 401 que inicia el flujo de inicio de sesión en Claude */
// Solo ASCII: los valores de headers HTTP no deben llevar tildes
export function wwwAuthenticate(origen: string, descripcion = 'Inicia sesion en TIN-FLOW con un usuario ADMIN_TIN'): string {
  return `Bearer error="invalid_token", error_description="${descripcion}", ` +
    `resource_metadata="${urlMetadataRecurso(origen)}", scope="${SCOPE_MCP}"`
}

const sinBarraFinal = (u: string) => u.replace(/\/+$/, '')

/** El parámetro `resource` (RFC 8707) es opcional; si viene, debe ser este MCP */
export function recursoValido(resource: string | null | undefined, origen: string): boolean {
  return !resource || sinBarraFinal(resource) === urlRecurso(origen)
}

// ── Utilidades ──────────────────────────────────────────────────────────────

const tokenAleatorio = (prefijo: string) => prefijo + randomBytes(32).toString('base64url')

function igualSeguro(a: string, b: string): boolean {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  return ba.length === bb.length && timingSafeEqual(ba, bb)
}

function pkceValido(verifier: string, challenge: string): boolean {
  if (!/^[A-Za-z0-9\-._~]{43,128}$/.test(verifier)) return false
  return igualSeguro(createHash('sha256').update(verifier).digest('base64url'), challenge)
}

const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]'])

/**
 * Compara el redirect_uri pedido con uno registrado. Las URIs loopback (Claude Code)
 * se comparan sin el puerto, como pide RFC 8252 §7.3.
 */
function redirectCoincide(pedido: string, registrado: string): boolean {
  if (pedido === registrado) return true
  try {
    const p = new URL(pedido)
    const r = new URL(registrado)
    return p.protocol === 'http:' && r.protocol === 'http:' &&
      LOOPBACK.has(p.hostname) && p.hostname === r.hostname &&
      p.pathname === r.pathname && p.search === r.search
  } catch {
    return false
  }
}

export function esLoopback(uri: string): boolean {
  try { return LOOPBACK.has(new URL(uri).hostname) } catch { return false }
}

/** Solo se aceptan redirect URIs HTTPS o loopback HTTP, sin fragmento */
function redirectPermitido(uri: string): boolean {
  try {
    const u = new URL(uri)
    if (u.hash) return false
    return u.protocol === 'https:' || (u.protocol === 'http:' && LOOPBACK.has(u.hostname))
  } catch {
    return false
  }
}

// ── Clientes ────────────────────────────────────────────────────────────────

export interface ClienteOAuth {
  client_id: string
  /** Nombre a mostrar en el consentimiento: para CIMD, el host del client_id (el nombre es autodeclarado) */
  nombre: string
  descripcion: string
  redirect_uris: string[]
}

async function clienteCimd(clientId: string): Promise<ClienteOAuth | null> {
  let url: URL
  try { url = new URL(clientId) } catch { return null }
  // Evita SSRF hacia la red interna: solo HTTPS, nombres de dominio (no IPs) y nada local
  if (url.protocol !== 'https:' || url.pathname === '/' || url.hash) return null
  if (/^[\d.]+$/.test(url.hostname) || url.hostname.includes(':') || url.hostname === 'localhost' ||
      url.hostname.endsWith('.local') || url.hostname.endsWith('.internal')) return null

  try {
    const res = await fetch(url, {
      redirect: 'error',
      signal: AbortSignal.timeout(5000),
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })
    if (!res.ok) return null
    const texto = await res.text()
    if (texto.length > 20_000) return null
    const doc = JSON.parse(texto)
    if (doc?.client_id !== clientId || !Array.isArray(doc.redirect_uris)) return null
    const redirectUris = doc.redirect_uris.filter((u: unknown): u is string => typeof u === 'string')
    return {
      client_id: clientId,
      nombre: url.hostname,
      descripcion: typeof doc.client_name === 'string' ? doc.client_name.slice(0, 100) : url.hostname,
      redirect_uris: redirectUris,
    }
  } catch {
    return null
  }
}

async function clienteRegistrado(clientId: string): Promise<ClienteOAuth | null> {
  const { data } = await (createAdminClient() as any)
    .from('mcp_oauth_clientes')
    .select('client_id, client_name, redirect_uris')
    .eq('client_id', clientId)
    .maybeSingle()
  if (!data) return null
  const nombre = data.client_name || 'Aplicación sin nombre'
  return { client_id: data.client_id, nombre, descripcion: nombre, redirect_uris: data.redirect_uris ?? [] }
}

export async function resolverCliente(clientId: string): Promise<ClienteOAuth | null> {
  if (!clientId || clientId.length > 500) return null
  return clientId.startsWith('https://') ? clienteCimd(clientId) : clienteRegistrado(clientId)
}

export function redirectRegistrado(cliente: ClienteOAuth, redirectUri: string): boolean {
  return redirectPermitido(redirectUri) && cliente.redirect_uris.some(r => redirectCoincide(redirectUri, r))
}

/** Dynamic Client Registration (RFC 7591) */
export async function registrarCliente(body: any): Promise<{ ok: true; cliente: Record<string, unknown> } | { ok: false; error: string; descripcion: string }> {
  const redirectUris: unknown = body?.redirect_uris
  if (!Array.isArray(redirectUris) || redirectUris.length === 0 || redirectUris.length > 10 ||
      !redirectUris.every(u => typeof u === 'string' && u.length <= 500 && redirectPermitido(u))) {
    return { ok: false, error: 'invalid_redirect_uri', descripcion: 'redirect_uris debe ser una lista de URLs HTTPS o loopback' }
  }
  const metodo = body?.token_endpoint_auth_method ?? 'none'
  if (metodo !== 'none') {
    return { ok: false, error: 'invalid_client_metadata', descripcion: 'Solo se admiten clientes públicos (token_endpoint_auth_method "none")' }
  }
  const nombre = typeof body?.client_name === 'string' ? body.client_name.trim().slice(0, 100) : null
  const clientId = 'tinclient_' + randomBytes(16).toString('base64url')

  const { error } = await (createAdminClient() as any).from('mcp_oauth_clientes').insert({
    client_id: clientId,
    client_name: nombre,
    redirect_uris: redirectUris,
  })
  if (error) return { ok: false, error: 'server_error', descripcion: 'No se pudo registrar el cliente' }

  return {
    ok: true,
    cliente: {
      client_id: clientId,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      client_name: nombre ?? undefined,
      redirect_uris: redirectUris,
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
    },
  }
}

// ── Usuarios ────────────────────────────────────────────────────────────────

async function usuarioHabilitado(usuarioId: string) {
  const { data } = await (createAdminClient() as any)
    .from('perfiles')
    .select('id, email, nombre_completo, rol, activo')
    .eq('id', usuarioId)
    .maybeSingle()
  if (!data || data.activo === false || data.rol !== MCP_ROL_PERMITIDO) return null
  return { id: data.id as string, email: data.email as string, nombre: data.nombre_completo as string, rol: data.rol as string }
}

// ── Códigos de autorización ─────────────────────────────────────────────────

export async function emitirCodigo(p: {
  cliente: ClienteOAuth
  usuarioId: string
  redirectUri: string
  codeChallenge: string
  resource: string
  scope: string | null
}): Promise<string> {
  const supabase = createAdminClient() as any
  const codigo = tokenAleatorio(PREFIJO_CODIGO)

  // Limpieza oportunista de códigos viejos
  await supabase.from('mcp_oauth_codigos').delete().lt('expira_en', new Date(Date.now() - 86_400_000).toISOString())

  const { error } = await supabase.from('mcp_oauth_codigos').insert({
    code_hash: hashToken(codigo),
    client_id: p.cliente.client_id,
    client_nombre: p.cliente.descripcion,
    usuario_id: p.usuarioId,
    redirect_uri: p.redirectUri,
    code_challenge: p.codeChallenge,
    resource: p.resource,
    scope: p.scope,
    expira_en: new Date(Date.now() + CODIGO_TTL_SEG * 1000).toISOString(),
  })
  if (error) throw new Error('No se pudo emitir el código de autorización')
  return codigo
}

// ── Token endpoint ──────────────────────────────────────────────────────────

export type RespuestaToken =
  | { ok: true; body: Record<string, unknown> }
  | { ok: false; status: number; error: string; descripcion: string }

const fallo = (error: string, descripcion: string, status = 400): RespuestaToken => ({ ok: false, status, error, descripcion })

function respuestaTokens(access: string, refresh: string, scope: string | null): RespuestaToken {
  return {
    ok: true,
    body: {
      access_token: access,
      token_type: 'Bearer',
      expires_in: ACCESS_TTL_SEG,
      refresh_token: refresh,
      scope: scope ?? SCOPE_MCP,
    },
  }
}

export async function canjearCodigo(f: URLSearchParams, origen: string): Promise<RespuestaToken> {
  const codigo = f.get('code') ?? ''
  const verifier = f.get('code_verifier') ?? ''
  const clientId = f.get('client_id') ?? ''
  const redirectUri = f.get('redirect_uri') ?? ''
  if (!codigo.startsWith(PREFIJO_CODIGO) || !verifier || !clientId) {
    return fallo('invalid_request', 'Faltan code, code_verifier o client_id')
  }

  const supabase = createAdminClient() as any
  // Marcar como usado de forma atómica: un código solo se puede canjear una vez
  const { data: filas } = await supabase
    .from('mcp_oauth_codigos')
    .update({ usado_en: new Date().toISOString() })
    .eq('code_hash', hashToken(codigo))
    .is('usado_en', null)
    .select('*')
  const c = filas?.[0]

  if (!c) return fallo('invalid_grant', 'Código inválido o ya utilizado')
  if (new Date(c.expira_en).getTime() <= Date.now()) return fallo('invalid_grant', 'El código venció')
  if (c.client_id !== clientId) return fallo('invalid_grant', 'El código no pertenece a este cliente')
  if (c.redirect_uri !== redirectUri) return fallo('invalid_grant', 'redirect_uri no coincide')
  if (!pkceValido(verifier, c.code_challenge)) return fallo('invalid_grant', 'code_verifier inválido')
  if (!recursoValido(f.get('resource'), origen) || c.resource !== urlRecurso(origen)) {
    return fallo('invalid_target', 'El recurso solicitado no corresponde a este servidor')
  }
  if (!(await usuarioHabilitado(c.usuario_id))) return fallo('invalid_grant', 'El usuario ya no tiene acceso (requiere rol ADMIN_TIN)')

  const access = tokenAleatorio(PREFIJO_ACCESS)
  const refresh = tokenAleatorio(PREFIJO_REFRESH)
  const ahora = Date.now()
  const { error } = await supabase.from('mcp_oauth_sesiones').insert({
    usuario_id: c.usuario_id,
    client_id: c.client_id,
    client_nombre: c.client_nombre,
    resource: c.resource,
    scope: c.scope,
    access_hash: hashToken(access),
    access_expira_en: new Date(ahora + ACCESS_TTL_SEG * 1000).toISOString(),
    refresh_hash: hashToken(refresh),
    refresh_expira_en: new Date(ahora + REFRESH_TTL_MS).toISOString(),
  })
  if (error) return fallo('server_error', 'No se pudo crear la sesión', 500)
  return respuestaTokens(access, refresh, c.scope)
}

export async function refrescarToken(f: URLSearchParams, origen: string): Promise<RespuestaToken> {
  const refresh = f.get('refresh_token') ?? ''
  const clientId = f.get('client_id') ?? ''
  if (!refresh.startsWith(PREFIJO_REFRESH)) return fallo('invalid_grant', 'refresh_token inválido')

  const supabase = createAdminClient() as any
  const hashViejo = hashToken(refresh)
  const { data: s } = await supabase
    .from('mcp_oauth_sesiones')
    .select('id, usuario_id, client_id, resource, scope, refresh_expira_en, revocado_en')
    .eq('refresh_hash', hashViejo)
    .maybeSingle()

  if (!s || s.revocado_en) return fallo('invalid_grant', 'refresh_token inválido o revocado')
  if (new Date(s.refresh_expira_en).getTime() <= Date.now()) return fallo('invalid_grant', 'refresh_token vencido')
  if (clientId && clientId !== s.client_id) return fallo('invalid_grant', 'El refresh_token no pertenece a este cliente')
  if (!recursoValido(f.get('resource'), origen) || s.resource !== urlRecurso(origen)) {
    return fallo('invalid_target', 'El recurso solicitado no corresponde a este servidor')
  }
  if (!(await usuarioHabilitado(s.usuario_id))) return fallo('invalid_grant', 'El usuario ya no tiene acceso (requiere rol ADMIN_TIN)')

  // Rotación: el refresh token viejo deja de servir en la misma operación
  const access = tokenAleatorio(PREFIJO_ACCESS)
  const nuevoRefresh = tokenAleatorio(PREFIJO_REFRESH)
  const ahora = Date.now()
  const { data: rotada } = await supabase
    .from('mcp_oauth_sesiones')
    .update({
      access_hash: hashToken(access),
      access_expira_en: new Date(ahora + ACCESS_TTL_SEG * 1000).toISOString(),
      refresh_hash: hashToken(nuevoRefresh),
      refresh_expira_en: new Date(ahora + REFRESH_TTL_MS).toISOString(),
      updated_at: new Date(ahora).toISOString(),
    })
    .eq('id', s.id)
    .eq('refresh_hash', hashViejo)
    .select('id')
  if (!rotada?.length) return fallo('invalid_grant', 'refresh_token ya utilizado')
  return respuestaTokens(access, nuevoRefresh, s.scope)
}

// ── Validación del access token en /api/mcp ─────────────────────────────────

export function esAccessTokenOAuth(token: string): boolean {
  return token.startsWith(PREFIJO_ACCESS)
}

export async function autenticarAccessToken(token: string, origen: string) {
  const supabase = createAdminClient() as any
  const { data: s } = await supabase
    .from('mcp_oauth_sesiones')
    .select('id, usuario_id, resource, access_expira_en, revocado_en')
    .eq('access_hash', hashToken(token))
    .maybeSingle()

  if (!s || s.revocado_en) return null
  if (new Date(s.access_expira_en).getTime() <= Date.now()) return null
  if (s.resource !== urlRecurso(origen)) return null // token emitido para otro recurso

  const usuario = await usuarioHabilitado(s.usuario_id)
  if (!usuario) return null

  await supabase.from('mcp_oauth_sesiones').update({ ultimo_uso: new Date().toISOString() }).eq('id', s.id)
  return usuario
}
