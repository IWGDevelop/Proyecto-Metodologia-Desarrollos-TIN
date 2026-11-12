/* eslint-disable @typescript-eslint/no-explicit-any -- patrón (supabase as any) del repo */
import type { SupabaseClient } from '@supabase/supabase-js'

// Base de conocimiento de ConeIA (RAG): instructivos y procedimientos de TIN partidos en
// fragmentos con embedding (tabla ticket_conocimiento). En cada pregunta se buscan solo los
// fragmentos más parecidos y se envían al modelo, en lugar de los documentos completos.
// Los documentos se cargan con scripts/cargar-conocimiento-tickets.mjs. Solo servidor.

const MODELO_EMBEDDING = 'gemini-embedding-001'
const DIMENSIONES = 768
const FRAGMENTOS = 5
const UMBRAL = 0.65

export interface FragmentoConocimiento {
  documento_codigo: string
  documento_titulo: string
  seccion: string | null
  contenido: string
  similitud: number
}

async function embeddingConsulta(texto: string): Promise<number[]> {
  const clave = process.env.GEMINI_API_KEY
  if (!clave) throw new Error('GEMINI_API_KEY no está configurada')
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODELO_EMBEDDING}:embedContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': clave },
      body: JSON.stringify({
        content: { parts: [{ text: texto }] },
        taskType: 'RETRIEVAL_QUERY',
        outputDimensionality: DIMENSIONES,
      }),
      signal: AbortSignal.timeout(8000),
    },
  )
  if (!res.ok) throw new Error(`Embedding respondió ${res.status}`)
  const json = await res.json()
  const valores = json?.embedding?.values
  if (!Array.isArray(valores) || valores.length !== DIMENSIONES) throw new Error('Embedding sin valores')
  return valores
}

/**
 * Fragmentos de instructivos relevantes para la consulta. Si la base de conocimiento no está
 * creada o falla la búsqueda, devuelve [] y el asistente responde sin ellos.
 */
export async function buscarConocimiento(supabase: SupabaseClient, consulta: string): Promise<FragmentoConocimiento[]> {
  const texto = consulta.trim().slice(0, 2000)
  if (!texto) return []
  try {
    const vector = await embeddingConsulta(texto)
    const { data, error } = await (supabase as any).rpc('buscar_conocimiento_tickets', {
      consulta: JSON.stringify(vector),
      cantidad: FRAGMENTOS,
      umbral: UMBRAL,
    })
    if (error) throw new Error(error.message)
    return (data ?? []) as FragmentoConocimiento[]
  } catch (e) {
    console.error('[asistente tickets] no se pudo consultar la base de conocimiento:', (e as Error).message)
    return []
  }
}

/** Texto de los fragmentos para el prompt, agrupados por documento */
export function conocimientoParaPrompt(fragmentos: FragmentoConocimiento[]): string {
  if (!fragmentos.length) return ''
  return fragmentos
    .map(f => `### ${f.documento_codigo} ${f.documento_titulo}${f.seccion ? ` — ${f.seccion}` : ''}\n${f.contenido}`)
    .join('\n\n')
}

/** Códigos de los documentos usados (sin repetir), para el historial */
export function documentosDe(fragmentos: FragmentoConocimiento[]): string[] {
  return [...new Set(fragmentos.map(f => f.documento_codigo))]
}
