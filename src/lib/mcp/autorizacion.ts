import { recursoValido, redirectRegistrado, resolverCliente, urlRecurso, type ClienteOAuth } from './oauth'

// Validación de la solicitud de autorización (GET /oauth/autorizar).
// La usan la página de consentimiento y la Server Action que la aprueba: la acción
// vuelve a validar todo desde la query original y nunca confía en campos ocultos.

export type SolicitudAutorizacion =
  | { tipo: 'error_pantalla'; mensaje: string }
  | { tipo: 'error_redirect'; url: string }
  | {
      tipo: 'ok'
      cliente: ClienteOAuth
      redirectUri: string
      codeChallenge: string
      resource: string
      scope: string | null
      state: string | null
    }

/** URL de retorno al cliente con los parámetros dados (incluye `iss`, RFC 9207) */
export function urlRetorno(redirectUri: string, params: Record<string, string | null>, origen: string): string {
  const url = new URL(redirectUri)
  for (const [k, v] of Object.entries(params)) if (v != null) url.searchParams.set(k, v)
  url.searchParams.set('iss', origen)
  return url.toString()
}

export async function validarSolicitud(q: URLSearchParams, origen: string): Promise<SolicitudAutorizacion> {
  const clientId = q.get('client_id') ?? ''
  const redirectUri = q.get('redirect_uri') ?? ''
  const state = q.get('state')

  // Mientras el cliente o el redirect_uri no estén verificados, el error se muestra aquí
  // y no se redirige (evita usar este endpoint como redirector abierto).
  if (!clientId || !redirectUri) {
    return { tipo: 'error_pantalla', mensaje: 'Faltan los parámetros client_id o redirect_uri.' }
  }
  const cliente = await resolverCliente(clientId)
  if (!cliente) {
    return { tipo: 'error_pantalla', mensaje: 'La aplicación que solicita acceso no está registrada o no se pudo verificar.' }
  }
  if (!redirectRegistrado(cliente, redirectUri)) {
    return { tipo: 'error_pantalla', mensaje: 'La dirección de retorno no está registrada para esta aplicación.' }
  }

  const error = (codigo: string, descripcion: string): SolicitudAutorizacion => ({
    tipo: 'error_redirect',
    url: urlRetorno(redirectUri, { error: codigo, error_description: descripcion, state }, origen),
  })

  if (q.get('response_type') !== 'code') return error('unsupported_response_type', 'Solo se admite response_type=code')
  const codeChallenge = q.get('code_challenge') ?? ''
  if (q.get('code_challenge_method') !== 'S256' || !/^[A-Za-z0-9\-_]{43}$/.test(codeChallenge)) {
    return error('invalid_request', 'Se requiere PKCE con code_challenge_method=S256')
  }
  if (!recursoValido(q.get('resource'), origen)) return error('invalid_target', 'El recurso solicitado no corresponde a este servidor')

  return {
    tipo: 'ok',
    cliente,
    redirectUri,
    codeChallenge,
    resource: urlRecurso(origen),
    scope: q.get('scope')?.slice(0, 200) ?? null,
    state,
  }
}
