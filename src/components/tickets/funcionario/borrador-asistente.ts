// Borrador del ticket que propone el asistente de IA ([[BORRADOR:{...}]]) y su paso al formulario.
// El chat lo guarda en sessionStorage antes de navegar y NuevoTicketForm lo toma una sola vez.

export interface BorradorAsistente {
  asunto?: string
  descripcion?: string
  /** SOLO_YO | MI_AREA | DETIENE_OPERACION */
  impacto?: string
  /** Campos propios de la tipología, por etiqueta exacta */
  campos?: Record<string, string>
  /** Formulario de Novedad en IGSI */
  igsi?: {
    empresa?: string
    tipo_documento?: string
    numero_documento?: string
    accion?: string
    que_paso?: string
    que_esperaba?: string
    mensaje_error?: string
    impacto_operacion?: string
  }
  /** El usuario pidió ir al formulario: el chat lo abre solo al terminar la respuesta */
  abrir?: boolean
}

const CLAVE = 'tin-tickets:borrador-asistente'

export const RE_TIPOLOGIA_ASISTENTE = /\[\[TIPOLOGIA:([0-9a-f-]{36})\]\]/gi
const RE_BORRADOR = /\[\[BORRADOR:(\{[\s\S]*?\})\]\]/gi

const texto = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined)

/** Lee el último borrador válido del texto de una respuesta */
export function extraerBorrador(respuesta: string): BorradorAsistente | null {
  const encontrados = [...respuesta.matchAll(RE_BORRADOR)]
  for (const m of encontrados.reverse()) {
    try {
      const j = JSON.parse(m[1]) as Record<string, unknown>
      const campos: Record<string, string> = {}
      if (j.campos && typeof j.campos === 'object') {
        for (const [k, v] of Object.entries(j.campos as Record<string, unknown>)) {
          if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
            const s = String(v).trim()
            if (s) campos[k.slice(0, 200)] = s.slice(0, 2000)
          }
        }
      }
      const ig = (j.igsi && typeof j.igsi === 'object' ? j.igsi : {}) as Record<string, unknown>
      return {
        asunto: texto(j.asunto, 300),
        descripcion: texto(j.descripcion, 5000),
        impacto: texto(j.impacto, 40),
        campos,
        igsi: {
          empresa: texto(ig.empresa, 10),
          tipo_documento: texto(ig.tipo_documento, 40),
          numero_documento: texto(ig.numero_documento, 100),
          accion: texto(ig.accion, 40),
          que_paso: texto(ig.que_paso, 5000),
          que_esperaba: texto(ig.que_esperaba, 2000),
          mensaje_error: texto(ig.mensaje_error, 2000),
          impacto_operacion: texto(ig.impacto_operacion, 40),
        },
        abrir: j.abrir === true,
      }
    } catch {
      // JSON mal formado: se ignora y se intenta con el anterior
    }
  }
  return null
}

/** Texto para mostrar: sin marcadores, ni el que aún se está escribiendo durante el streaming */
export function textoVisible(respuesta: string): string {
  let t = respuesta.replace(RE_BORRADOR, '').replace(RE_TIPOLOGIA_ASISTENTE, '')
  const abierto = t.lastIndexOf('[[')
  if (abierto >= 0 && !t.includes(']]', abierto)) t = t.slice(0, abierto)
  return t.trim()
}

export function guardarBorrador(marca: string, tipologiaId: string, borrador: BorradorAsistente) {
  try {
    sessionStorage.setItem(CLAVE, JSON.stringify({ marca, tipologiaId, borrador }))
  } catch {
    // sin sessionStorage el formulario abre solo con la tipología
  }
}

/** Devuelve el borrador guardado para ese clic (marca) y tipología, y lo borra */
export function tomarBorrador(marca: string | null | undefined, tipologiaId: string): BorradorAsistente | null {
  try {
    const crudo = sessionStorage.getItem(CLAVE)
    if (!crudo) return null
    const g = JSON.parse(crudo) as { marca?: string; tipologiaId?: string; borrador?: BorradorAsistente }
    if (!marca || g.marca !== marca || g.tipologiaId !== tipologiaId) return null
    sessionStorage.removeItem(CLAVE)
    return g.borrador ?? null
  } catch {
    return null
  }
}
