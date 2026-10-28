'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Upload, X, FileText, Loader2, ClipboardPaste } from 'lucide-react'
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage'
import { toast } from 'sonner'
import { storage } from '@/lib/firebase'
import { ADJUNTOS_ACEPTADOS, ADJUNTO_TAMANO_MAX } from '@/lib/tickets/constantes'
import { cn } from '@/lib/utils'

export type AdjuntoNuevo = {
  nombre_archivo: string
  tipo_archivo: string
  tamano: number
  url: string
  ruta: string
  es_imagen: boolean
}

interface Props {
  carpeta: string
  value: AdjuntoNuevo[]
  onChange: (v: AdjuntoNuevo[]) => void
  /** Exige al menos una imagen (lo muestra en el texto de ayuda; la validación final la hace el formulario/servidor) */
  requerirImagen?: boolean
  disabled?: boolean
}

interface Subiendo {
  id: string
  nombre: string
  progreso: number
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function limpiarNombre(nombre: string) {
  return nombre.replace(/[^\w.\-]+/g, '_').slice(-120)
}

const MAX_MB = Math.round(ADJUNTO_TAMANO_MAX / 1024 / 1024)

export function SubirAdjuntos({ carpeta, value, onChange, requerirImagen, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const zonaRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState(false)
  const [subiendo, setSubiendo] = useState<Subiendo[]>([])
  // Referencia al valor más reciente: varias subidas terminan en paralelo
  const valueRef = useRef(value)
  useEffect(() => { valueRef.current = value }, [value])

  const subirArchivo = useCallback((file: File) => {
    if (!ADJUNTOS_ACEPTADOS.includes(file.type)) {
      toast.error(`Tipo de archivo no admitido: ${file.name}. Usa JPG, PNG, WEBP o PDF.`)
      return
    }
    if (file.size > ADJUNTO_TAMANO_MAX) {
      toast.error(`${file.name} supera ${MAX_MB} MB`)
      return
    }
    const nombre = file.name || `captura-${Date.now()}.png`
    const ruta = `tickets/${carpeta}/${Date.now()}-${limpiarNombre(nombre)}`
    const id = ruta
    setSubiendo(prev => [...prev, { id, nombre, progreso: 0 }])

    const tarea = uploadBytesResumable(ref(storage, ruta), file, { contentType: file.type })
    tarea.on(
      'state_changed',
      snap => {
        const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100)
        setSubiendo(prev => prev.map(s => (s.id === id ? { ...s, progreso: pct } : s)))
      },
      err => {
        toast.error(`Error al subir ${nombre}: ${err.message}`)
        setSubiendo(prev => prev.filter(s => s.id !== id))
      },
      async () => {
        const url = await getDownloadURL(tarea.snapshot.ref)
        const nuevo: AdjuntoNuevo = {
          nombre_archivo: nombre,
          tipo_archivo: file.type,
          tamano: file.size,
          url,
          ruta,
          es_imagen: file.type.startsWith('image/'),
        }
        const siguiente = [...valueRef.current, nuevo]
        valueRef.current = siguiente
        onChange(siguiente)
        setSubiendo(prev => prev.filter(s => s.id !== id))
      },
    )
  }, [carpeta, onChange])

  const manejarArchivos = (files: FileList | File[] | null) => {
    if (!files || disabled) return
    Array.from(files).forEach(subirArchivo)
  }

  // Pegar capturas desde el portapapeles (Ctrl+V) mientras el foco está en la página
  useEffect(() => {
    if (disabled) return
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return
      const archivos: File[] = []
      for (const it of Array.from(items)) {
        if (it.kind === 'file') {
          const f = it.getAsFile()
          if (f) {
            const ext = f.type.split('/')[1] ?? 'png'
            archivos.push(f.name && f.name !== 'image.png' ? f : new File([f], `captura-${Date.now()}.${ext}`, { type: f.type }))
          }
        }
      }
      if (archivos.length > 0) {
        e.preventDefault()
        archivos.forEach(subirArchivo)
      }
    }
    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  }, [disabled, subirArchivo])

  const eliminar = async (a: AdjuntoNuevo) => {
    try {
      await deleteObject(ref(storage, a.ruta))
    } catch {
      // El objeto pudo no existir; se quita de la lista igual
    }
    const siguiente = valueRef.current.filter(x => x.ruta !== a.ruta)
    valueRef.current = siguiente
    onChange(siguiente)
  }

  const faltaImagen = requerirImagen && !value.some(a => a.es_imagen)

  return (
    <div className="space-y-3">
      <div
        ref={zonaRef}
        role="button"
        tabIndex={disabled ? -1 : 0}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={e => { if (!disabled && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); inputRef.current?.click() } }}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); manejarArchivos(e.dataTransfer.files) }}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition-colors',
          dragging ? 'border-blue-400 bg-blue-50' : 'border-slate-200 bg-slate-50 hover:border-blue-300 hover:bg-blue-50/50',
          faltaImagen && 'border-amber-300',
          disabled && 'cursor-not-allowed opacity-50',
        )}
      >
        <Upload size={22} className={dragging ? 'text-blue-500' : 'text-slate-400'} />
        <p className="text-sm font-medium text-slate-600">
          Arrastra archivos aquí o <span className="text-blue-600">haz clic para seleccionar</span>
        </p>
        <p className="flex items-center gap-1 text-xs text-slate-400">
          <ClipboardPaste size={12} /> También puedes pegar una captura con Ctrl+V · JPG, PNG, WEBP o PDF · máx. {MAX_MB} MB
        </p>
        {requerirImagen && (
          <p className={cn('text-xs font-medium', faltaImagen ? 'text-amber-700' : 'text-emerald-700')}>
            {faltaImagen ? 'Esta solicitud exige al menos una imagen o captura de pantalla' : 'Imagen adjunta'}
          </p>
        )}
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ADJUNTOS_ACEPTADOS.join(',')}
          className="hidden"
          disabled={disabled}
          onChange={e => { manejarArchivos(e.target.files); e.target.value = '' }}
        />
      </div>

      {subiendo.length > 0 && (
        <div className="space-y-2">
          {subiendo.map(s => (
            <div key={s.id} className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2">
              <div className="mb-1 flex items-center justify-between text-xs text-blue-700">
                <span className="flex items-center gap-1.5 truncate"><Loader2 size={12} className="animate-spin" />{s.nombre}</span>
                <span className="font-bold">{s.progreso}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-blue-100">
                <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${s.progreso}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {value.length > 0 && (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {value.map(a => (
            <li key={a.ruta} className="group relative overflow-hidden rounded-lg border border-slate-200 bg-white">
              <a href={a.url} target="_blank" rel="noopener noreferrer" className="block">
                {a.es_imagen ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.url} alt={a.nombre_archivo} className="h-24 w-full object-cover" />
                ) : (
                  <div className="flex h-24 items-center justify-center bg-slate-50">
                    <FileText size={28} className="text-red-500" />
                  </div>
                )}
                <div className="px-2 py-1">
                  <p className="truncate text-[11px] font-medium text-slate-700">{a.nombre_archivo}</p>
                  <p className="text-[10px] text-slate-400">{formatBytes(a.tamano)}</p>
                </div>
              </a>
              {!disabled && (
                <button
                  type="button"
                  aria-label={`Quitar ${a.nombre_archivo}`}
                  onClick={() => eliminar(a)}
                  className="absolute right-1 top-1 rounded-full bg-white/90 p-0.5 text-slate-500 shadow hover:text-red-600"
                >
                  <X size={14} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
