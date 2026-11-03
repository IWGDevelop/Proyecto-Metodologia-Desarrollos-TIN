// Destino seguro después del login (?next=…): solo rutas internas de la app.
// Rechaza URLs absolutas, protocol-relative (//host) y variantes con barra invertida,
// para que el login no sirva como redirector abierto.

export const COOKIE_NEXT = 'tin_next'

export function destinoSeguro(next: string | null | undefined): string | null {
  if (!next || next.length > 2000) return null
  if (!next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return null
  try {
    const url = new URL(next, 'http://interno.local')
    if (url.host !== 'interno.local') return null
    return url.pathname + url.search
  } catch {
    return null
  }
}
