import { canjearCodigo, origenPublico, refrescarToken } from '@/lib/mcp/oauth'

// Token endpoint (RFC 6749): authorization_code con PKCE y refresh_token con rotación.
// Recibe application/x-www-form-urlencoded, como exige el estándar y envía Claude.
const SIN_CACHE = { 'Cache-Control': 'no-store', Pragma: 'no-cache' }

export async function POST(req: Request) {
  let form: URLSearchParams
  try {
    const tipo = req.headers.get('content-type') ?? ''
    form = tipo.includes('application/json')
      ? new URLSearchParams(Object.entries(await req.json()).map(([k, v]) => [k, String(v)]))
      : new URLSearchParams(await req.text())
  } catch {
    return Response.json({ error: 'invalid_request', error_description: 'Cuerpo inválido' }, { status: 400, headers: SIN_CACHE })
  }

  const origen = origenPublico(req.headers)
  const grant = form.get('grant_type')
  const r = grant === 'authorization_code' ? await canjearCodigo(form, origen)
    : grant === 'refresh_token' ? await refrescarToken(form, origen)
    : { ok: false as const, status: 400, error: 'unsupported_grant_type', descripcion: 'grant_type no soportado' }

  if (!r.ok) return Response.json({ error: r.error, error_description: r.descripcion }, { status: r.status, headers: SIN_CACHE })
  return Response.json(r.body, { headers: SIN_CACHE })
}
