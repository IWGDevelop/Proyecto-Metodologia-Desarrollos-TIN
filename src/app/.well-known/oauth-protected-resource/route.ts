import { metadataRecurso, origenPublico } from '@/lib/mcp/oauth'

// Protected Resource Metadata (RFC 9728) del endpoint MCP
export function GET(req: Request) {
  return Response.json(metadataRecurso(origenPublico(req.headers)), {
    headers: { 'Cache-Control': 'public, max-age=300', 'Access-Control-Allow-Origin': '*' },
  })
}
