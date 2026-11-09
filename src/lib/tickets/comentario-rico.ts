// Formato de los comentarios con imágenes intercaladas (sin dependencias de servidor ni cliente).
// El texto se guarda tal cual en ticket_historial.comentario y cada imagen queda en su propia
// línea como ![nombre](url). Solo se muestran como imagen las URL de Firebase Storage.

export const PREFIJO_IMAGEN_PERMITIDA = 'https://firebasestorage.googleapis.com/'

export type BloqueComentario =
  | { tipo: 'texto'; texto: string }
  | { tipo: 'imagen'; nombre: string; url: string }

const RE_IMAGEN = /!\[([^\]\n]*)\]\((https:\/\/[^)\s]+)\)/g

export function marcadorImagen(nombre: string, url: string): string {
  return `![${nombre.replace(/[\[\]\n]/g, ' ').trim() || 'imagen'}](${url})`
}

/** Divide el comentario en bloques de texto e imagen, en el orden en que se escribió */
export function bloquesComentario(contenido: string): BloqueComentario[] {
  const bloques: BloqueComentario[] = []
  let ultimo = 0
  const empujarTexto = (t: string) => {
    const limpio = t.replace(/^\n+|\n+$/g, '')
    if (limpio.trim()) bloques.push({ tipo: 'texto', texto: limpio })
  }
  for (const m of contenido.matchAll(RE_IMAGEN)) {
    const url = m[2]
    if (!url.startsWith(PREFIJO_IMAGEN_PERMITIDA)) continue
    empujarTexto(contenido.slice(ultimo, m.index))
    bloques.push({ tipo: 'imagen', nombre: m[1], url })
    ultimo = (m.index ?? 0) + m[0].length
  }
  empujarTexto(contenido.slice(ultimo))
  return bloques
}

/** Texto sin las imágenes (para avisos, correos y vistas resumidas) */
export function textoPlanoComentario(contenido: string): string {
  return contenido.replace(RE_IMAGEN, (_m, nombre: string) => `[imagen: ${nombre}]`).replace(/\n{3,}/g, '\n\n').trim()
}
