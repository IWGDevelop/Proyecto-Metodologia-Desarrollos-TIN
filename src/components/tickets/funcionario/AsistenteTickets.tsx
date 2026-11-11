'use client'

import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, Loader2, RotateCcw, Send, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { RE_TIPOLOGIA_ASISTENTE, extraerBorrador, guardarBorrador, textoVisible } from './borrador-asistente'

// ConeIA: asistente de IA (Gemini) que guía al funcionario para reportar su ticket.
// La conversación vive solo en el navegador; se envía completa en cada pregunta.

interface Mensaje {
  rol: 'usuario' | 'asistente'
  texto: string
}

const SUGERENCIAS = [
  'Mi computador está muy lento',
  'Tengo un error en IGSI al liquidar un DO',
  'Necesito comprar un equipo nuevo',
  '¿Cómo reabro un ticket que no quedó resuelto?',
]

/** Cabeza del robot ConeIA en un círculo (avatar) */
function AvatarConeIA({ tamano = 28, className }: { tamano?: number; className?: string }) {
  return (
    <span
      className={cn('inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-white ring-1 ring-slate-200', className)}
      style={{ width: tamano, height: tamano }}
    >
      <Image src="/tickets/coneia-cabeza.png" alt="ConeIA" width={tamano} height={tamano} className="h-full w-full object-cover" />
    </span>
  )
}

const BIENVENIDA: Mensaje = {
  rol: 'asistente',
  texto:
    '¡Hola! Soy ConeIA de TIN-TICKETS. Cuéntame qué te pasa o qué necesitas y te ayudo a elegir la tipología correcta, ' +
    'a saber qué información y adjuntos preparar y a dejar tu ticket bien reportado.',
}

/** Negritas (**texto**) y cursivas (*texto*) dentro de una línea */
function enLinea(texto: string): ReactNode[] {
  return texto.split(/(\*\*[^*]+\*\*|\*[^*\s][^*]*\*)/g).map((parte, i) => {
    if (parte.startsWith('**') && parte.endsWith('**') && parte.length > 4) return <strong key={i}>{parte.slice(2, -2)}</strong>
    if (parte.startsWith('*') && parte.endsWith('*') && parte.length > 2) return <em key={i}>{parte.slice(1, -1)}</em>
    return <Fragment key={i}>{parte}</Fragment>
  })
}

/** Markdown mínimo: párrafos, viñetas (-, *, 1.) y negritas */
function TextoFormateado({ texto }: { texto: string }) {
  const bloques: ReactNode[] = []
  let lista: { ordenada: boolean; items: string[] } | null = null
  const cerrarLista = () => {
    if (!lista) return
    const Tag = lista.ordenada ? 'ol' : 'ul'
    bloques.push(
      <Tag key={bloques.length} className={cn('my-1 space-y-0.5 pl-4', lista.ordenada ? 'list-decimal' : 'list-disc')}>
        {lista.items.map((it, i) => <li key={i}>{enLinea(it)}</li>)}
      </Tag>,
    )
    lista = null
  }
  for (const linea of texto.split('\n')) {
    const vineta = linea.match(/^\s*[-*•]\s+(.*)$/)
    const numero = linea.match(/^\s*\d+[.)]\s+(.*)$/)
    if (vineta || numero) {
      const ordenada = !!numero
      if (lista && lista.ordenada !== ordenada) cerrarLista()
      lista ??= { ordenada, items: [] }
      lista.items.push((vineta ?? numero)![1])
      continue
    }
    cerrarLista()
    const limpia = linea.replace(/^#{1,6}\s+/, '')
    if (limpia.trim()) bloques.push(<p key={bloques.length} className="my-1">{enLinea(limpia)}</p>)
  }
  cerrarLista()
  return <>{bloques}</>
}

/** Prepara la navegación al formulario: guarda el borrador (si lo hay) para ese clic y arma la URL */
function urlFormulario(respuesta: string): string | null {
  const id = [...respuesta.matchAll(RE_TIPOLOGIA_ASISTENTE)].map(x => x[1])[0]
  if (!id) return null
  const marca = String(Date.now())
  const borrador = extraerBorrador(respuesta)
  if (borrador) guardarBorrador(marca, id.toLowerCase(), borrador)
  return `/mis-tickets/nuevo?tipologia=${id}&t=${marca}`
}

function Burbuja({ m, escribiendo, alAbrirFormulario }: { m: Mensaje; escribiendo?: boolean; alAbrirFormulario: (url: string) => void }) {
  const ids = [...m.texto.matchAll(RE_TIPOLOGIA_ASISTENTE)].map(x => x[1])
  const conBorrador = !!extraerBorrador(m.texto)
  const texto = textoVisible(m.texto)
  const esUsuario = m.rol === 'usuario'
  return (
    <div className={cn('flex items-end gap-2', esUsuario ? 'justify-end' : 'justify-start')}>
      {!esUsuario && <AvatarConeIA tamano={28} className="mb-0.5" />}
      <div
        className={cn(
          'max-w-[82%] rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed',
          esUsuario ? 'rounded-br-sm bg-blue-600 text-white' : 'rounded-bl-sm bg-slate-100 text-slate-800',
        )}
      >
        {esUsuario ? <p className="whitespace-pre-wrap">{texto}</p> : <TextoFormateado texto={texto} />}
        {escribiendo && !texto && <Loader2 size={14} className="animate-spin text-slate-400" />}
        {!esUsuario && !escribiendo && ids.slice(0, 1).map(id => (
          <Link
            key={id}
            href={`/mis-tickets/nuevo?tipologia=${id}`}
            onClick={e => {
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
              e.preventDefault()
              const url = urlFormulario(m.texto)
              if (url) alAbrirFormulario(url)
            }}
            className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
          >
            {conBorrador ? 'Llenar el formulario con esta información' : 'Abrir el formulario con esta tipología'} <ArrowRight size={13} />
          </Link>
        ))}
      </div>
    </div>
  )
}

export function AsistenteTickets() {
  const router = useRouter()
  const [abierto, setAbierto] = useState(false)
  const [mensajes, setMensajes] = useState<Mensaje[]>([BIENVENIDA])
  const [entrada, setEntrada] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Identifica la conversación en el historial del servidor; cambia con "Nueva conversación"
  const [conversacionId, setConversacionId] = useState(() => crypto.randomUUID())
  const finRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    finRef.current?.scrollIntoView({ block: 'end' })
  }, [mensajes, abierto])

  useEffect(() => () => abortRef.current?.abort(), [])

  const enviar = async (texto: string) => {
    const pregunta = texto.trim()
    if (!pregunta || enviando) return
    setError(null)
    setEntrada('')
    const historial: Mensaje[] = [...mensajes, { rol: 'usuario', texto: pregunta }]
    setMensajes([...historial, { rol: 'asistente', texto: '' }])
    setEnviando(true)
    const ctrl = new AbortController()
    abortRef.current = ctrl
    try {
      const res = await fetch('/api/tickets/asistente', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // La bienvenida es local: no se envía al modelo
        body: JSON.stringify({ mensajes: historial.filter(m => m !== BIENVENIDA), conversacionId }),
        signal: ctrl.signal,
      })
      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => null)
        throw new Error(j?.error ?? 'El asistente no está disponible en este momento.')
      }
      const lector = res.body.getReader()
      const dec = new TextDecoder()
      let acumulado = ''
      while (true) {
        const { value, done } = await lector.read()
        if (done) break
        acumulado += dec.decode(value, { stream: true })
        setMensajes([...historial, { rol: 'asistente', texto: acumulado }])
      }
      if (!acumulado.trim()) throw new Error('El asistente no devolvió respuesta. Intenta reformular tu pregunta.')
      // El usuario pidió ir al formulario ("vamos", "llévame al ticket"…): se abre ya prellenado
      if (extraerBorrador(acumulado)?.abrir) {
        const url = urlFormulario(acumulado)
        if (url) abrirFormulario(url)
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
      setError((e as Error).message)
      setMensajes(historial)
    } finally {
      setEnviando(false)
      abortRef.current = null
    }
  }

  // Se minimiza para que el formulario quede a la vista; la conversación se conserva
  const abrirFormulario = (url: string) => {
    setAbierto(false)
    router.push(url)
  }

  const reiniciar = () => {
    abortRef.current?.abort()
    setMensajes([BIENVENIDA])
    setConversacionId(crypto.randomUUID())
    setError(null)
    setEnviando(false)
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        title="Pregúntale a ConeIA"
        className="group fixed bottom-5 right-5 z-40 flex items-end gap-1"
      >
        <span className="mb-3 rounded-full rounded-br-sm bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition group-hover:shadow-xl">
          Hola, soy ConeIA · ¿Cómo reporto mi ticket?
        </span>
        <Image
          src="/tickets/coneia.png"
          alt="ConeIA"
          width={64}
          height={97}
          priority
          className="drop-shadow-lg transition-transform group-hover:-translate-y-1"
        />
      </button>
    )
  }

  return (
    <div className="fixed bottom-5 right-5 z-40 flex h-[min(620px,calc(100vh-2.5rem))] w-[min(400px,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
      <div className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-3 text-white">
        <AvatarConeIA tamano={36} className="ring-2 ring-white/40" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-tight">ConeIA</p>
          <p className="text-[11px] text-white/80">Asistente de TIN-TICKETS · Te ayuda a reportar tu ticket</p>
        </div>
        <button type="button" onClick={reiniciar} title="Nueva conversación" className="rounded-md p-1.5 hover:bg-white/15">
          <RotateCcw size={15} />
        </button>
        <button type="button" onClick={() => setAbierto(false)} title="Cerrar" className="rounded-md p-1.5 hover:bg-white/15">
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
        {mensajes.map((m, i) => (
          <Burbuja
            key={i}
            m={m}
            escribiendo={enviando && i === mensajes.length - 1 && m.rol === 'asistente'}
            alAbrirFormulario={abrirFormulario}
          />
        ))}
        {mensajes.length === 1 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {SUGERENCIAS.map(s => (
              <button
                key={s}
                type="button"
                onClick={() => enviar(s)}
                className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs text-violet-700 hover:bg-violet-100"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
        <div ref={finRef} />
      </div>

      <form
        onSubmit={e => { e.preventDefault(); enviar(entrada) }}
        className="border-t border-slate-100 p-2.5"
      >
        <div className="flex items-end gap-2">
          <textarea
            value={entrada}
            onChange={e => setEntrada(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(entrada) }
            }}
            rows={2}
            maxLength={2000}
            placeholder="Describe tu problema o pregunta…"
            className="min-h-[44px] flex-1 resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
          />
          <button
            type="submit"
            disabled={enviando || !entrada.trim()}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-40"
            title="Enviar"
          >
            {enviando ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
        <p className="mt-1.5 px-1 text-[10.5px] text-slate-400">
          Respuestas generadas con IA; pueden contener errores. Las conversaciones se guardan para mejorar el servicio. No escribas contraseñas.
        </p>
      </form>
    </div>
  )
}
