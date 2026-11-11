import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { accesoTickets } from '@/lib/tickets/solicitante'
import {
  catalogoParaAsistente,
  instruccionesSistema,
  streamGemini,
  type MensajeAsistente,
} from '@/lib/tickets/asistente'

// Asistente de IA de TIN-TICKETS: recibe la conversación y responde en streaming (texto plano).
export const maxDuration = 60

const MAX_MENSAJES = 16
const MAX_CARACTERES = 2000
const LIMITE_POR_MINUTO = 12

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
  if (excedeLimite(acceso.usuarioId)) {
    return NextResponse.json({ error: 'Enviaste muchos mensajes seguidos. Espera un minuto e intenta de nuevo.' }, { status: 429 })
  }

  let cuerpo: unknown
  try {
    cuerpo = await req.json()
  } catch {
    return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 })
  }
  const mensajes = validarMensajes((cuerpo as { mensajes?: unknown })?.mensajes)
  if (!mensajes) return NextResponse.json({ error: 'Conversación inválida' }, { status: 400 })

  try {
    const supabase = createAdminClient()
    const [catalogo, perfil] = await Promise.all([
      catalogoParaAsistente(supabase, acceso),
      supabase.from('perfiles').select('nombre_completo').eq('id', acceso.usuarioId).maybeSingle(),
    ])
    const nombre = (perfil.data as { nombre_completo?: string } | null)?.nombre_completo?.split(' ')[0] ?? null
    const stream = await streamGemini(instruccionesSistema(catalogo, nombre), mensajes)
    return new Response(stream, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    })
  } catch (err) {
    console.error('[asistente tickets]', err)
    return NextResponse.json({ error: 'El asistente no está disponible en este momento. Intenta más tarde.' }, { status: 502 })
  }
}
