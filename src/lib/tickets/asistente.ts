/* eslint-disable @typescript-eslint/no-explicit-any -- patrón (supabase as any) del repo */
import type { SupabaseClient } from '@supabase/supabase-js'
import { IMPACTOS_TICKET, MEDICIONES, PRIORIDADES_TICKET, TIPOS_GESTION } from './constantes'
import type { AccesoTickets } from './solicitante'

// Asistente de IA de TIN-TICKETS (Gemini). Ayuda al funcionario a elegir la tipología
// correcta y a diligenciar su ticket. Solo de servidor: lo usa /api/tickets/asistente.

export const GEMINI_MODELO_DEFECTO = 'gemini-flash-latest'


export interface MensajeAsistente {
  rol: 'usuario' | 'asistente'
  texto: string
}

/** Resumen del Manual de usuario de TIN-TICKETS (v1.1) para el asistente */
const MANUAL = `
## Qué es TIN-TICKETS
Mesa de ayuda de TI de Interworld dentro de TIN-FLOW. Por aquí se reporta cualquier novedad o solicitud para el área TIN: falla de un equipo, novedad en IGSI, compra, delegación de cuentas, capacitación, etc. Cada solicitud queda como un ticket con código consecutivo (TK-0001), tipología, prioridad y responsable. El sistema mide en horas hábiles cuánto tarda TIN en responder y en solucionar.

## Menú del funcionario
- Mis tickets de TI: lista de sus tickets (pestañas Abiertos y Todos, buscador) y el botón Nuevo ticket.
- Aprobar tickets: solo para jefes inmediatos; solicitudes de su equipo que requieren aprobación.
- Volver a TIN-FLOW: regresa a TIN-FLOW.

## Crear un ticket, paso a paso (Mis tickets de TI > Nuevo ticket)
Paso 1. Elegir la categoría y la tipología. Al elegir la tipología aparece un recuadro con sus características (tipo de gestión, contra qué se mide, si requiere aprobación o imagen) y la información que TIN necesita. Léalo antes de seguir.
Paso 2. Describir la novedad y marcar el impacto:
- Asunto: resumen corto, es el título del ticket.
- Descripción: qué pasó, desde cuándo, qué intentó.
- Datos específicos de la tipología (campos propios; los que tienen asterisco son obligatorios).
- Impacto: "Solo me afecta a mí", "Afecta a mi área" o "Detiene la operación". La prioridad se calcula sola y se muestra en vivo.
Paso 3. Adjuntar imágenes y archivos: arrastrar, hacer clic para seleccionar o pegar una captura con Ctrl+V. Formatos JPG, PNG, WEBP o PDF, máximo 10 MB cada uno. Algunas tipologías exigen al menos una imagen.
Al pulsar Crear ticket, el ticket queda registrado con su código, el usuario recibe un correo de acuse y aparece en Mis tickets de TI. Si la tipología tiene responsable por defecto, nace Asignado; si no, lo asigna el Coordinador TIN.
El botón Crear ticket se activa cuando todos los campos obligatorios están diligenciados (y la imagen, si la tipología la exige).

## Casos especiales del formulario
- Novedad en IGSI (categoría Soporte IGSI): formulario propio. Se elige el documento afectado en la cadena SS → DO → Remesa → Manifiesto (u Otro), el número del documento (o marcar que no tiene número porque no se pudo crear), documentos anteriores relacionados (opcional), servicio y modalidad, la acción que intentaba, qué pasó, qué esperaba, el mensaje de error exacto (copiarlo tal cual), el impacto en la operación (Detiene, Retrasa o No afecta por ahora) y confirmar que revisó los datos del documento antes de reportar. Adjuntar captura del error.
- Requerimiento relacionado: si la novedad es sobre un desarrollo que TIN ya entregó o cerró, búsquelo por número o nombre en "Requerimiento relacionado"; así el ticket queda en la traza del requerimiento.
- Tipologías que requieren aprobación (por ejemplo, Compras): el ticket nace "En espera de aprobación" y no pasa a TIN hasta que su jefe inmediato lo apruebe. Si no tiene jefe configurado, lo aprueba un coordinador TIN. Mientras espera la aprobación, el reloj no corre.
- Plantilla de ingreso o retiro de personal: la usan TIN y talento humano; crea un ticket padre y un ticket hijo por cada tarea.
- Si ninguna tipología corresponde, elija la categoría Otros; TIN la reclasificará.

## Prioridad (la calcula el sistema; el usuario no la elige)
${PRIORIDADES_TICKET.map(p => `- ${p.label}: ${p.regla}.`).join('\n')}
Si "Detiene la operación" está marcado, la prioridad es Crítica aunque la tipología sea planificada. Si el usuario solo se afecta a sí mismo, se usa la prioridad por defecto de la tipología, o Media.
Tiempos objetivo (horas hábiles, pendientes de aprobación por la Dirección de TI): Crítica 1 h respuesta / 4 h solución; Alta 2 h / 8 h; Media 4 h / 16 h; Baja 8 h / 40 h.

## Estados del ticket
Abierto (creado, aún sin responsable) → Asignado → En proceso → Resuelto → Cerrado. Esperas en las que el reloj se detiene: En espera de aprobación, En espera de usuario (TIN le pidió información), En espera de proveedor.

## Seguir el ticket
- En el detalle del ticket se ven la descripción, los adjuntos, el estado, el responsable y el seguimiento.
- Se puede comentar y pegar capturas dentro del comentario; el comentario llega a TIN.
- Si TIN le pide información, el ticket queda En espera de usuario: responda con un comentario. Si no responde en los días configurados, el ticket se cierra.
- Cuando TIN lo resuelve, llega un correo con la respuesta y un enlace. En el detalle aparecen "Sí, quedó resuelto" (cierra el ticket) y "No, reabrir" (pide escribir qué sigue fallando; vuelve a En proceso con el mismo responsable, conservando el reloj original).
- Si no confirma, el ticket se cierra solo después de 3 días hábiles.

## Avisos
El panel amarillo "Avisos de tickets" y la campana muestran novedades: le asignaron un ticket, TIN le pidió información, su ticket fue resuelto, etc.

## Preguntas frecuentes
- No encuentro la tipología: use el buscador de categorías y lea la ayuda de cada tipología; si ninguna corresponde, elija Otros.
- No puedo pulsar Crear ticket: falta un campo obligatorio (con asterisco) o la tipología exige una imagen.
- ¿Puedo cambiar la prioridad? No. Si cambió la situación, escríbalo en un comentario; el responsable TIN puede ajustarla.
- Mi jefe no está y el ticket requiere aprobación: el reloj no corre mientras espera; el aprobador recibe recordatorios.
- TIN resolvió pero el problema sigue: abra el ticket y pulse Reabrir (o use el enlace del correo) y explique qué sigue pasando.
- ¿Por qué se cerró si no lo confirmé?: pasaron los días hábiles de cierre automático. Puede reabrirlo.
- ¿Qué ve el usuario del historial?: solo los comentarios y eventos visibles; los comentarios internos de TIN no.
`

const INSTRUCCIONES = `
Eres el Asistente de TIN-TICKETS, la mesa de ayuda de TI de Interworld Group. Ayudas a los funcionarios a reportar bien su novedad o solicitud: a elegir la categoría y la tipología correctas, a saber qué información y adjuntos preparar, a marcar el impacto correcto y a entender el estado de su ticket.

Reglas:
1. Responde siempre en español, en tono cordial, claro y breve (usa viñetas cortas cuando ayuden). Trata al usuario de "tú".
2. Usa solo la información del manual y del catálogo que tienes abajo. No inventes tipologías, campos, tiempos ni procedimientos. Si no sabes algo, dilo y sugiere preguntarle a TIN en un comentario o crear el ticket en la categoría Otros.
3. Tú NO creas tickets, no los consultas y no cambias su estado. Explica cómo hacerlo en el sistema.
4. No intentes resolver tú la falla técnica en profundidad: puedes sugerir una verificación rápida y obvia (por ejemplo, reiniciar el equipo), pero tu objetivo es que el ticket quede bien reportado.
5. Cuando el usuario describa su problema, identifica la tipología más adecuada del catálogo. Si hay ambigüedad, haz como máximo una o dos preguntas para decidir. Luego indica: categoría y tipología, si requiere aprobación o imagen, los campos que deberá diligenciar (destaca los obligatorios), qué impacto marcar según lo que contó y qué adjuntar. Propón también un asunto corto.
6. Cuando recomiendes una tipología concreta, agrega al final de tu respuesta, en una línea aparte, el marcador [[TIPOLOGIA:<id>]] con el id exacto del catálogo (una sola tipología por respuesta). El sistema lo mostrará como un botón para abrir el formulario con esa tipología ya elegida. No muestres el id de ninguna otra forma.
7. No pidas ni repitas contraseñas, claves ni datos sensibles. Si el usuario los escribe, recuérdale que no los ponga en el ticket.
8. Si te preguntan algo ajeno a TIN-TICKETS o al soporte de TI, responde amablemente que solo puedes ayudar con los tickets de TI.
`

function etiqueta<T extends { value: string; label: string }>(lista: T[], v: string | null | undefined): string {
  return lista.find(x => x.value === v)?.label ?? (v ?? '')
}

/** Catálogo vigente (categorías, tipologías y campos) que el usuario puede ver, en texto para el modelo */
export async function catalogoParaAsistente(supabase: SupabaseClient, acceso: AccesoTickets): Promise<string> {
  const [cats, tips] = await Promise.all([
    (supabase as any).from('ticket_categorias').select('id, nombre, descripcion').eq('activa', true)
      .order('orden', { ascending: true }).order('nombre', { ascending: true }),
    (supabase as any).from('ticket_tipologias')
      .select('id, categoria_id, nombre, descripcion_ayuda, tipo_gestion, se_mide_contra, requiere_aprobacion, visibilidad_restringida, adjunto_obligatorio, es_novedad_igsi')
      .eq('activa', true).order('orden', { ascending: true }).order('nombre', { ascending: true }),
  ])
  const verRestringidas = acceso.esAdmin || acceso.restringidas
  const categorias = (cats.data ?? []) as { id: string; nombre: string; descripcion: string | null }[]
  const tipologias = ((tips.data ?? []) as any[]).filter(t => !t.visibilidad_restringida || verRestringidas)

  const campos = new Map<string, { etiqueta: string; obligatorio: boolean; ayuda: string | null; opciones: string[] | null }[]>()
  if (tipologias.length > 0) {
    const { data } = await (supabase as any).from('ticket_campos_tipologia')
      .select('tipologia_id, etiqueta, obligatorio, ayuda, opciones')
      .in('tipologia_id', tipologias.map(t => t.id)).eq('activo', true).order('orden', { ascending: true })
    for (const c of (data ?? []) as any[]) {
      const l = campos.get(c.tipologia_id) ?? []
      l.push(c)
      campos.set(c.tipologia_id, l)
    }
  }

  const bloques: string[] = []
  for (const cat of categorias) {
    const tc = tipologias.filter(t => t.categoria_id === cat.id)
    if (tc.length === 0) continue
    const lineas = [`### Categoría: ${cat.nombre}${cat.descripcion ? ` — ${cat.descripcion}` : ''}`]
    for (const t of tc) {
      const rasgos = [
        etiqueta(TIPOS_GESTION, t.tipo_gestion),
        `se mide contra: ${etiqueta(MEDICIONES, t.se_mide_contra)}`,
        t.requiere_aprobacion ? 'requiere aprobación del jefe inmediato' : null,
        t.adjunto_obligatorio ? 'exige adjuntar al menos una imagen' : null,
        t.es_novedad_igsi ? 'usa el formulario de Novedad en IGSI' : null,
      ].filter(Boolean).join('; ')
      lineas.push(`- Tipología "${t.nombre}" (id ${t.id}) — ${rasgos}.${t.descripcion_ayuda ? ` Ayuda: ${t.descripcion_ayuda}` : ''}`)
      const cs = campos.get(t.id) ?? []
      if (cs.length) {
        lineas.push(`  Campos: ${cs.map(c => `${c.etiqueta}${c.obligatorio ? ' (obligatorio)' : ''}${c.opciones?.length ? ` [opciones: ${c.opciones.join(', ')}]` : ''}${c.ayuda ? ` — ${c.ayuda}` : ''}`).join('; ')}.`)
      }
    }
    bloques.push(lineas.join('\n'))
  }
  return bloques.join('\n\n') || 'El catálogo de tickets aún no está configurado.'
}

export function instruccionesSistema(catalogo: string, nombreUsuario: string | null): string {
  return [
    INSTRUCCIONES,
    nombreUsuario ? `El usuario se llama ${nombreUsuario}.` : '',
    `Impactos posibles en el formulario general: ${IMPACTOS_TICKET.map(i => `"${i.label}"`).join(', ')}.`,
    '# Manual de usuario de TIN-TICKETS (resumen)',
    MANUAL,
    '# Catálogo vigente de categorías y tipologías',
    catalogo,
  ].join('\n')
}

export interface UsoGemini {
  tokensEntrada: number | null
  tokensSalida: number | null
  tokensRazonamiento: number | null
}

export interface FinRespuesta {
  /** Texto completo (o parcial, si se canceló o falló a mitad) */
  texto: string
  estado: 'OK' | 'CANCELADA' | 'ERROR'
  error?: string
  modelo: string
  uso: UsoGemini
}

/**
 * Llama a Gemini en streaming (SSE) y devuelve un ReadableStream de texto plano.
 * Lanza error si la API responde con un estado no exitoso.
 * `alTerminar` se espera antes de cerrar el stream, para que el registro quede guardado
 * dentro de la misma petición.
 */
export async function streamGemini(
  sistema: string,
  mensajes: MensajeAsistente[],
  alTerminar?: (fin: FinRespuesta) => Promise<void>,
): Promise<ReadableStream<Uint8Array>> {
  const clave = process.env.GEMINI_API_KEY
  if (!clave) throw new Error('GEMINI_API_KEY no está configurada')
  let modelo = process.env.GEMINI_MODEL || GEMINI_MODELO_DEFECTO

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelo)}:streamGenerateContent?alt=sse`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': clave },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: sistema }] },
        contents: mensajes.map(m => ({ role: m.rol === 'usuario' ? 'user' : 'model', parts: [{ text: m.texto }] })),
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 4096,
          // Razonamiento bajo: respuestas más rápidas y sin agotar el límite de tokens.
          // Los modelos 2.x usan otro parámetro (thinkingBudget), por eso solo se envía a los demás.
          ...(modelo.startsWith('gemini-2') ? {} : { thinkingConfig: { thinkingLevel: 'low' } }),
        },
      }),
    },
  )
  if (!res.ok || !res.body) {
    const detalle = await res.text().catch(() => '')
    throw new Error(`Gemini respondió ${res.status}: ${detalle.slice(0, 300)}`)
  }

  const decoder = new TextDecoder()
  const encoder = new TextEncoder()
  const lector = res.body.getReader()
  let buffer = ''
  let completo = ''
  const uso: UsoGemini = { tokensEntrada: null, tokensSalida: null, tokensRazonamiento: null }
  let terminado = false
  const terminar = async (estado: FinRespuesta['estado'], error?: string) => {
    if (terminado) return
    terminado = true
    try {
      await alTerminar?.({ texto: completo, estado, error, modelo, uso })
    } catch (e) {
      console.error('[asistente tickets] no se pudo registrar la interacción', e)
    }
  }

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        while (true) {
          const { value, done } = await lector.read()
          if (done) {
            await terminar('OK')
            controller.close()
            return
          }
          buffer += decoder.decode(value, { stream: true })
          const eventos = buffer.split(/\r?\n\r?\n/)
          buffer = eventos.pop() ?? ''
          let emitido = false
          for (const ev of eventos) {
            const datos = ev.split(/\r?\n/).filter(l => l.startsWith('data:')).map(l => l.slice(5).trim()).join('')
            if (!datos) continue
            try {
              const json = JSON.parse(datos)
              if (typeof json?.modelVersion === 'string') modelo = json.modelVersion
              const u = json?.usageMetadata
              if (u) {
                uso.tokensEntrada = u.promptTokenCount ?? uso.tokensEntrada
                uso.tokensSalida = u.candidatesTokenCount ?? uso.tokensSalida
                uso.tokensRazonamiento = u.thoughtsTokenCount ?? uso.tokensRazonamiento
              }
              const texto = (json?.candidates?.[0]?.content?.parts ?? [])
                .filter((p: any) => typeof p?.text === 'string' && !p.thought)
                .map((p: any) => p.text)
                .join('')
              if (texto) {
                completo += texto
                controller.enqueue(encoder.encode(texto))
                emitido = true
              }
            } catch {
              // fragmento incompleto o no JSON: se ignora
            }
          }
          if (emitido) return
        }
      } catch (e) {
        await terminar('ERROR', (e as Error).message)
        controller.error(e)
      }
    },
    async cancel() {
      lector.cancel().catch(() => {})
      await terminar('CANCELADA')
    },
  })
}

const RE_TIPOLOGIA = /\[\[TIPOLOGIA:([0-9a-f-]{36})\]\]/i

export interface Interaccion {
  usuarioId: string
  conversacionId: string
  turno: number
  pregunta: string
  respuesta?: string | null
  estado: 'OK' | 'CANCELADA' | 'ERROR' | 'LIMITE'
  error?: string | null
  modelo?: string | null
  duracionMs?: number | null
  uso?: UsoGemini
}

/** Guarda una pregunta del asistente y su respuesta en ticket_asistente_interacciones */
export async function registrarInteraccion(supabase: SupabaseClient, i: Interaccion): Promise<void> {
  const fila = {
    usuario_id: i.usuarioId,
    conversacion_id: i.conversacionId,
    turno: i.turno,
    pregunta: i.pregunta,
    respuesta: i.respuesta || null,
    tipologia_sugerida_id: i.respuesta?.match(RE_TIPOLOGIA)?.[1]?.toLowerCase() ?? null,
    estado: i.estado,
    error: i.error ? i.error.slice(0, 1000) : null,
    modelo: i.modelo ?? null,
    duracion_ms: i.duracionMs ?? null,
    tokens_entrada: i.uso?.tokensEntrada ?? null,
    tokens_salida: i.uso?.tokensSalida ?? null,
    tokens_razonamiento: i.uso?.tokensRazonamiento ?? null,
  }
  let { error } = await (supabase as any).from('ticket_asistente_interacciones').insert(fila)
  // Si el modelo propuso un id de tipología que no existe (FK), se guarda sin él
  if (error?.code === '23503' && fila.tipologia_sugerida_id) {
    ;({ error } = await (supabase as any).from('ticket_asistente_interacciones').insert({ ...fila, tipologia_sugerida_id: null }))
  }
  if (error) console.error('[asistente tickets] error al guardar la interacción:', error.message)
}
