import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { accesoTickets } from '@/lib/tickets/solicitante'
import {
  catalogoParaAsistente,
  instruccionesSistema,
  registrarInteraccion,
  streamGemini,
  type MensajeAsistente,
} from '@/lib/tickets/asistente'
import { buscarConocimiento, conocimientoParaPrompt, documentosDe } from '@/lib/tickets/conocimiento'

// Asistente de IA de TIN-TICKETS: recibe la conversación y responde en streaming (texto plano).
// Cada pregunta queda registrada en ticket_asistente_interacciones (trazabilidad y estadísticas).
export const maxDuration = 60

const MAX_MENSAJES = 16
const MAX_CARACTERES = 2000
const LIMITE_POR_MINUTO = 12
const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Límite simple por usuario y por instancia, para evitar abusos del API key
const usos = new Map<string, number[]>()
function excedeLimite(usuarioId: string): boolean {
  const ahora = Date.now()
  const recientes = (usos.get(usuarioId) ?? []).filter(t => ahora - t < 60_000)
  recientes.push(ahora)
  usos.set(usuarioId, recientes)
  return recientes.length > LIMITE_POR_MINUTO
}

function validarMensajes(entrada: unknown): MensajeAsistente[] | null {
  if (!Array.isArray(entrada) || entrada.length === 0) return null
  const mensajes: MensajeAsistente[] = []
  for (const m of entrada.slice(-MAX_MENSAJES)) {
    const rol = (m as { rol?: unknown })?.rol
    const texto = String((m as { texto?: unknown })?.texto ?? '').trim().slice(0, MAX_CARACTERES)
    if ((rol !== 'usuario' && rol !== 'asistente') || !texto) return null
    mensajes.push({ rol, texto })
  }
  // Gemini exige que la conversación empiece y termine con el usuario
  while (mensajes.length && mensajes[0].rol !== 'usuario') mensajes.shift()
  if (!mensajes.length || mensajes[mensajes.length - 1].rol !== 'usuario') return null
  return mensajes
}

export async function POST(req: Request) {
  const acceso = await accesoTickets()
  if (!acceso) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  let cuerpo: { mensajes?: unknown; conversacionId?: unknown; turno?: unknown }
  try {
    cuerpo = await req.json()
  } catch {
    return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 })
  }
  const mensajes = validarMensajes(cuerpo?.mensajes)
  if (!mensajes) return NextResponse.json({ error: 'Conversación inválida' }, { status: 400 })

  const supabase = createAdminClient()
  const conversacionId = typeof cuerpo.conversacionId === 'string' && RE_UUID.test(cuerpo.conversacionId)
    ? cuerpo.conversacionId
    : crypto.randomUUID()
  const turno = mensajes.filter(m => m.rol === 'usuario').length
  const base = {
    usuarioId: acceso.usuarioId,
    conversacionId,
    turno,
    pregunta: mensajes[mensajes.length - 1].texto,
  }

  if (excedeLimite(acceso.usuarioId)) {
    await registrarInteraccion(supabase, { ...base, estado: 'LIMITE' })
    return NextResponse.json({ error: 'Enviaste muchos mensajes seguidos. Espera un minuto e intenta de nuevo.' }, { status: 429 })
  }

  const inicio = Date.now()
  try {
    // RAG: se buscan los fragmentos de instructivos con las dos últimas preguntas del usuario
    // (la anterior da contexto a preguntas cortas como "¿y cómo lo pido?")
    const consulta = mensajes.filter(m => m.rol === 'usuario').slice(-2).map(m => m.texto).join('\n')
    const [catalogo, perfil, fragmentos] = await Promise.all([
      catalogoParaAsistente(supabase, acceso),
      supabase.from('perfiles').select('nombre_completo').eq('id', acceso.usuarioId).maybeSingle(),
      buscarConocimiento(supabase, consulta),
    ])
    const documentosConsultados = documentosDe(fragmentos)
    const nombre = (perfil.data as { nombre_completo?: string } | null)?.nombre_completo?.split(' ')[0] ?? null
    const stream = await streamGemini(instruccionesSistema(catalogo, nombre, conocimientoParaPrompt(fragmentos)), mensajes, fin =>
      registrarInteraccion(supabase, {
        ...base,
        respuesta: fin.texto,
        estado: fin.estado === 'OK' && !fin.texto.trim() ? 'ERROR' : fin.estado,
        error: fin.error ?? (fin.estado === 'OK' && !fin.texto.trim() ? 'Respuesta vacía' : null),
        modelo: fin.modelo,
        duracionMs: Date.now() - inicio,
        uso: fin.uso,
        documentosConsultados,
      }),
    )
    return new Response(stream, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    })
  } catch (err) {
    console.error('[asistente tickets]', err)
    await registrarInteraccion(supabase, {
      ...base,
      estado: 'ERROR',
      error: (err as Error).message,
      duracionMs: Date.now() - inicio,
    })
    return NextResponse.json({ error: 'El asistente no está disponible en este momento. Intenta más tarde.' }, { status: 502 })
  }
}
