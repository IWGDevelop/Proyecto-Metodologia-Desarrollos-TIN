import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { autenticarTokenMcp, type UsuarioMcp } from '@/lib/mcp/tokens'
import { autenticarAccessToken, esAccessTokenOAuth, origenPublico, wwwAuthenticate } from '@/lib/mcp/oauth'
import { crearServidorMcp } from '@/lib/mcp/servidor'

// Endpoint MCP (Streamable HTTP, sin estado) para Claude web, Desktop y Code.
// Autenticación (Authorization: Bearer …), ambas solo para ADMIN_TIN:
//  - OAuth 2.1: Claude inicia el flujo al recibir el 401 con WWW-Authenticate (ver src/lib/mcp/oauth.ts)
//  - Token personal generado en /admin/conexion-mcp (para `claude mcp add --header`)
// Está excluido del redirect a /login en middleware.ts porque valida su propio token.

export const maxDuration = 60

async function autenticar(req: Request, origen: string): Promise<UsuarioMcp | null> {
  const authorization = req.headers.get('authorization')
  const token = authorization?.match(/^Bearer\s+(\S+)$/i)?.[1]
  if (!token) return null
  if (esAccessTokenOAuth(token)) return autenticarAccessToken(token, origen)
  return autenticarTokenMcp(authorization)
}

async function manejar(req: Request): Promise<Response> {
  const origen = origenPublico(req.headers)
  const usuario = await autenticar(req, origen)
  if (!usuario) {
    return Response.json(
      {
        error: 'invalid_token',
        error_description: 'Inicia sesión en TIN-FLOW con un usuario ADMIN_TIN para usar este conector.',
      },
      { status: 401, headers: { 'WWW-Authenticate': wwwAuthenticate(origen) } }
    )
  }

  const server = crearServidorMcp(usuario)
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // sin estado: cada petición es independiente (apto para Vercel)
    enableJsonResponse: true,
  })
  await server.connect(transport)
  return transport.handleRequest(req)
}

export const POST = manejar
export const GET = manejar
export const DELETE = manejar
