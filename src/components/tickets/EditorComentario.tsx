'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ref as refStorage, uploadBytes, getDownloadURL } from 'firebase/storage'
import { toast } from 'sonner'
import { ClipboardPaste, ImagePlus, Loader2 } from 'lucide-react'
import { storage } from '@/lib/firebase'
import { ADJUNTOS_ACEPTADOS, ADJUNTO_TAMANO_MAX } from '@/lib/tickets/constantes'
import { bloquesComentario, marcadorImagen } from '@/lib/tickets/comentario-rico'
import { cn } from '@/lib/utils'

export interface EstadoEditorComentario {
  /** Texto con las imágenes intercaladas como ![nombre](url) */
  contenido: string
  /** Imágenes que aún se están subiendo (no se debe enviar mientras sea > 0) */
  subiendo: number
}

interface Props {
  carpeta: string
  /** Carpeta raíz en Firebase Storage (por defecto 'tickets'); la imagen queda en `${raizStorage}/${carpeta}/...` */
  raizStorage?: string
  onChange: (estado: EstadoEditorComentario) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  /** Contenido con el que arranca el editor (texto con ![nombre](url)); solo se lee al montar */
  contenidoInicial?: string
  /** Alto mínimo del área de escritura (clase de Tailwind), por defecto min-h-24 */
  altoMinimo?: string
  id?: string
}

const BLOQUES = new Set(['DIV', 'P', 'LI', 'UL', 'OL', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'PRE', 'BLOCKQUOTE', 'TR'])
const MAX_MB = Math.round(ADJUNTO_TAMANO_MAX / 1024 / 1024)
const CLASE_IMG = 'my-2 block max-h-80 max-w-full rounded-lg border border-slate-200'

function limpiarNombre(nombre: string) {
  return nombre.replace(/[^\w.\-]+/g, '_').slice(-120)
}

/** Convierte el contenido editable en texto con marcadores de imagen, respetando el orden */
function serializar(raiz: HTMLElement): EstadoEditorComentario {
  let out = ''
  let subiendo = 0
  const nuevaLinea = () => { if (out && !out.endsWith('\n')) out += '\n' }
  const recorrer = (n: Node) => {
    if (n.nodeType === Node.TEXT_NODE) {
      out += (n.textContent ?? '').replace(/ /g, ' ')
      return
    }
    if (!(n instanceof HTMLElement)) return
    if (n.tagName === 'BR') { out += '\n'; return }
    if (n.tagName === 'IMG') {
      if (n.dataset.subiendo) { subiendo++; return }
      if (n.dataset.url) {
        nuevaLinea()
        out += marcadorImagen(n.dataset.nombre ?? 'imagen', n.dataset.url) + '\n'
      }
      return
    }
    const esBloque = BLOQUES.has(n.tagName)
    if (esBloque) nuevaLinea()
    n.childNodes.forEach(recorrer)
    if (esBloque) nuevaLinea()
  }
  raiz.childNodes.forEach(recorrer)
  return { contenido: out.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim(), subiendo }
}

/**
 * Editor de comentarios estilo correo: se escribe texto, se pega (Ctrl+V) o arrastra una captura
 * y se sigue escribiendo; las imágenes quedan en el orden en que se pusieron.
 * Para limpiarlo después de enviar, el padre lo vuelve a montar cambiando su `key`.
 */
export function EditorComentario({ carpeta, raizStorage = 'tickets', onChange, placeholder, disabled, className, contenidoInicial, altoMinimo, id }: Props) {
  const editorRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const rangoRef = useRef<Range | null>(null)
  const onChangeRef = useRef(onChange)
  const [vacio, setVacio] = useState(true)
  const [subiendo, setSubiendo] = useState(0)

  useEffect(() => { onChangeRef.current = onChange }, [onChange])

  // Contenido inicial: se pinta una sola vez al montar (el editor no es controlado)
  const inicialRef = useRef(contenidoInicial)
  useEffect(() => {
    const el = editorRef.current
    const inicial = inicialRef.current
    if (!el || !inicial) return
    for (const b of bloquesComentario(inicial)) {
      if (b.tipo === 'texto') {
        el.appendChild(document.createTextNode(b.texto))
        el.appendChild(document.createElement('br'))
      } else {
        const img = document.createElement('img')
        img.src = b.url
        img.alt = b.nombre
        img.className = CLASE_IMG
        img.dataset.url = b.url
        img.dataset.nombre = b.nombre
        el.appendChild(img)
      }
    }
    const estado = serializar(el)
    setVacio(!estado.contenido)
  }, [])

  const emitir = useCallback(() => {
    const el = editorRef.current
    if (!el) return
    const estado = serializar(el)
    setVacio(!estado.contenido && !el.querySelector('img'))
    setSubiendo(estado.subiendo)
    onChangeRef.current(estado)
  }, [])

  const guardarRango = () => {
    const sel = window.getSelection()
    const el = editorRef.current
    if (el && sel && sel.rangeCount > 0 && el.contains(sel.anchorNode)) rangoRef.current = sel.getRangeAt(0).cloneRange()
  }

  /** Inserta un nodo en la posición del cursor (o al final) y deja el cursor después de él */
  const insertarNodo = (nodo: Node) => {
    const el = editorRef.current
    if (!el) return
    const sel = window.getSelection()
    let rango: Range | null = null
    if (sel && sel.rangeCount > 0 && el.contains(sel.anchorNode)) rango = sel.getRangeAt(0)
    else if (rangoRef.current && el.contains(rangoRef.current.startContainer)) rango = rangoRef.current
    if (rango) {
      rango.deleteContents()
      rango.insertNode(nodo)
    } else {
      el.appendChild(nodo)
    }
    const despues = document.createRange()
    despues.setStartAfter(nodo)
    despues.collapse(true)
    sel?.removeAllRanges()
    sel?.addRange(despues)
    rangoRef.current = despues.cloneRange()
  }

  const subirImagen = (archivo: File) => {
    if (!archivo.type.startsWith('image/') || !ADJUNTOS_ACEPTADOS.includes(archivo.type)) {
      toast.error(`Solo se pueden insertar imágenes JPG, PNG o WEBP en el comentario (${archivo.name}). Los PDF van como adjunto.`)
      return
    }
    if (archivo.size > ADJUNTO_TAMANO_MAX) {
      toast.error(`${archivo.name} supera ${MAX_MB} MB`)
      return
    }
    const ext = archivo.type.split('/')[1] ?? 'png'
    const nombre = archivo.name && archivo.name !== 'image.png' ? archivo.name : `captura-${Date.now()}.${ext}`
    const local = URL.createObjectURL(archivo)

    const img = document.createElement('img')
    img.src = local
    img.alt = nombre
    img.className = cn(CLASE_IMG, 'opacity-50')
    img.dataset.subiendo = '1'
    img.dataset.nombre = nombre
    insertarNodo(img)
    emitir()

    const ruta = `${raizStorage}/${carpeta}/${Date.now()}-${limpiarNombre(nombre)}`
    uploadBytes(refStorage(storage, ruta), archivo, { contentType: archivo.type })
      .then(snap => getDownloadURL(snap.ref))
      .then(url => {
        img.src = url
        img.dataset.url = url
        delete img.dataset.subiendo
        img.className = CLASE_IMG
      })
      .catch((err: Error) => {
        toast.error(`No se pudo subir ${nombre}: ${err.message}`)
        img.remove()
      })
      .finally(() => {
        URL.revokeObjectURL(local)
        emitir()
      })
  }

  const insertarTexto = (texto: string) => {
    // insertText conserva deshacer (Ctrl+Z) y no trae formato externo
    if (!document.execCommand('insertText', false, texto)) insertarNodo(document.createTextNode(texto))
  }

  const onPaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault()
    const texto = e.clipboardData.getData('text/plain')
    const imagenes = Array.from(e.clipboardData.files).filter(f => f.type.startsWith('image/'))
    // Si viene texto (p. ej. celdas de Excel) se pega el texto; si solo hay imagen, la captura
    if (texto) insertarTexto(texto)
    else imagenes.forEach(subirImagen)
    emitir()
  }

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    if (disabled) return
    const doc = document as Document & { caretRangeFromPoint?: (x: number, y: number) => Range | null }
    const punto = doc.caretRangeFromPoint?.(e.clientX, e.clientY)
    if (punto) {
      const sel = window.getSelection()
      sel?.removeAllRanges()
      sel?.addRange(punto)
    }
    const archivos = Array.from(e.dataTransfer.files)
    if (archivos.length > 0) archivos.forEach(subirImagen)
    else {
      const texto = e.dataTransfer.getData('text/plain')
      if (texto) insertarTexto(texto)
    }
    emitir()
  }

  const elegirArchivos = (files: FileList | null) => {
    if (!files) return
    editorRef.current?.focus()
    if (rangoRef.current) {
      const sel = window.getSelection()
      sel?.removeAllRanges()
      sel?.addRange(rangoRef.current)
    }
    Array.from(files).forEach(subirImagen)
  }

  return (
    <div className={cn('rounded-lg border border-slate-200 bg-white focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100', disabled && 'opacity-60', className)}>
      <div className="relative">
        {vacio && placeholder && (
          <span className="pointer-events-none absolute left-3 top-2 text-sm text-slate-400">{placeholder}</span>
        )}
        <div
          ref={editorRef}
          id={id}
          role="textbox"
          aria-multiline="true"
          aria-label={placeholder ?? 'Comentario'}
          contentEditable={!disabled}
          suppressContentEditableWarning
          onInput={emitir}
          onPaste={onPaste}
          onDrop={onDrop}
          onDragOver={e => e.preventDefault()}
          onBlur={guardarRango}
          onKeyUp={guardarRango}
          onMouseUp={guardarRango}
          className={cn('max-h-[60vh] overflow-y-auto whitespace-pre-wrap break-words px-3 py-2 text-sm text-slate-800 outline-none', altoMinimo ?? 'min-h-24')}
        />
      </div>
      <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 px-3 py-1.5 text-[11px] text-slate-400">
        <button
          type="button"
          onMouseDown={e => e.preventDefault()}
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50"
        >
          <ImagePlus size={13} /> Insertar imagen
        </button>
        <span className="inline-flex items-center gap-1">
          <ClipboardPaste size={12} /> Pega capturas con Ctrl+V donde quieras que queden dentro del texto
        </span>
        {subiendo > 0 && (
          <span className="ml-auto inline-flex items-center gap-1 text-blue-600">
            <Loader2 size={12} className="animate-spin" /> Subiendo {subiendo} imagen{subiendo === 1 ? '' : 'es'}…
          </span>
        )}
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={e => { elegirArchivos(e.target.files); e.target.value = '' }}
        />
      </div>
    </div>
  )
}
