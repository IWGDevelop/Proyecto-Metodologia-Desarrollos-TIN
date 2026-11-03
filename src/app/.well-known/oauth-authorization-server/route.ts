import { metadataServidorAutorizacion, origenPublico } from '@/lib/mcp/oauth'

// Authorization Server Metadata (RFC 8414)
export function GET(req: Request) {
  return Response.json(metadataServidorAutorizacion(origenPublico(req.headers)), {
    headers: { 'Cache-Control': 'public, max-age=300', 'Access-Control-Allow-Origin': '*' },
  })
}
