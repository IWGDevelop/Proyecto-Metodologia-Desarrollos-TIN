import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { autenticarTokenMcp } from '@/lib/mcp/tokens'
import { crearServidorMcp } from '@/lib/mcp/servidor'

// Endpoint MCP (Streamable HTTP, sin estado) para conectar Claude Code.
// Autenticación: `Authorization: Bearer <token>` generado en /perfil (solo ADMIN_TIN).
// Está excluido del redirect a /login en middleware.ts porque valida su propio token.

export const maxDuration = 60

async function manejar(req: Request): Promise<Response> {
  const usuario = await autenticarTokenMcp(req.headers.get('authorization'))
  if (!usuario) {
    return Response.json(
      {
        jsonrpc: '2.0',
        error: { code: -32001, message: 'Token inválido, vencido o revocado, o el usuario no es ADMIN_TIN. Genera uno nuevo en /perfil.' },
        id: null,
      },
      { status: 401 }
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
