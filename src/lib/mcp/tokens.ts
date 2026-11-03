import { createHash, randomBytes } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'

// Tokens personales para el servidor MCP (/api/mcp).
// En la base solo se guarda el hash SHA-256; el token se muestra una única vez al generarlo.

export const MCP_ROL_PERMITIDO = 'ADMIN_TIN'
export const MCP_DIAS_VIGENCIA = 90

const PREFIJO_TOKEN = 'tin_'

export function generarTokenPlano(): string {
  return PREFIJO_TOKEN + randomBytes(32).toString('base64url')
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export interface UsuarioMcp {
  id: string
  email: string
  nombre: string
  rol: string
}

/**
 * Valida el header `Authorization: Bearer <token>`.
 * Devuelve el usuario si el token existe, no está revocado ni vencido
 * y el usuario sigue activo con rol ADMIN_TIN; si no, null.
 */
export async function autenticarTokenMcp(authorization: string | null): Promise<UsuarioMcp | null> {
  const token = authorization?.match(/^Bearer\s+(\S+)$/i)?.[1]
  if (!token || !token.startsWith(PREFIJO_TOKEN)) return null

  const supabase = createAdminClient()
  const { data: registro } = await (supabase as any)
    .from('mcp_tokens')
    .select('id, usuario_id, expira_en, revocado_en')
    .eq('token_hash', hashToken(token))
    .maybeSingle()

  if (!registro || registro.revocado_en) return null
  if (new Date(registro.expira_en).getTime() <= Date.now()) return null

  // El rol se revisa en cada petición: si al usuario le quitan ADMIN_TIN, el token deja de servir
  const { data: perfil } = await (supabase as any)
    .from('perfiles')
    .select('id, email, nombre_completo, rol, activo')
    .eq('id', registro.usuario_id)
    .maybeSingle()

  if (!perfil || perfil.activo === false || perfil.rol !== MCP_ROL_PERMITIDO) return null

  await (supabase as any)
    .from('mcp_tokens')
    .update({ ultimo_uso: new Date().toISOString() })
    .eq('id', registro.id)

  return { id: perfil.id, email: perfil.email, nombre: perfil.nombre_completo, rol: perfil.rol }
}
