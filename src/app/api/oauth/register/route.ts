import { registrarCliente } from '@/lib/mcp/oauth'

// Dynamic Client Registration (RFC 7591). Solo clientes públicos con PKCE.
export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'invalid_client_metadata', error_description: 'El cuerpo debe ser JSON' }, { status: 400 })
  }
  const r = await registrarCliente(body)
  if (!r.ok) return Response.json({ error: r.error, error_description: r.descripcion }, { status: 400 })
  return Response.json(r.cliente, { status: 201, headers: { 'Cache-Control': 'no-store' } })
}
