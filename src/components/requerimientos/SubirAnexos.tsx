'use client'

import { useRef, useState, useCallback } from 'react'
import { Upload, X, FileText, Image, File, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

export interface AnexoLocal {
  id: string
  nombre: string
  url: string
  tipo: string
  tamanio: number
  path: string
}

interface Props {
  anexos: AnexoLocal[]
  onAnexosChange: (anexos: AnexoLocal[]) => void
  carpeta?: string
  disabled?: boolean
}

const TIPOS_PERMITIDOS = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
]
const MAX_SIZE_MB = 10

function iconoTipo(tipo: string) {
  if (tipo.startsWith('image/')) return <Image size={16} className="text-blue-500" />
  if (tipo.includes('pdf')) return <FileText size={16} className="text-red-500" />
  return <File size={16} className="text-slate-400" />
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function SubirAnexos({ anexos, onAnexosChange, carpeta = 'temp', disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [subiendo, setSubiendo] = useState<string[]>([])

  const subirArchivo = useCallback(
    async (file: File) => {
      if (!TIPOS_PERMITIDOS.includes(file.type)) {
        toast.error(`Tipo de archivo no permitido: ${file.name}`)
        return
      }
      if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        toast.error(`El archivo supera ${MAX_SIZE_MB}MB: ${file.name}`)
        return
      }

      const supabase = createClient()
      const ext = file.name.split('.').pop()
      const path = `${carpeta}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`

      setSubiendo(prev => [...prev, file.name])
      try {
        const { error } = await supabase.storage
          .from('requerimientos-anexos')
          .upload(path, file, { cacheControl: '3600', upsert: false })

        if (error) throw error

        const { data: urlData } = supabase.storage
          .from('requerimientos-anexos')
          .getPublicUrl(path)

        const nuevo: AnexoLocal = {
          id: path,
          nombre: file.name,
          url: urlData.publicUrl,
          tipo: file.type,
          tamanio: file.size,
          path,
        }
        onAnexosChange([...anexos, nuevo])
      } catch (err) {
        toast.error(`Error al subir ${file.name}`)
      } finally {
        setSubiendo(prev => prev.filter(n => n !== file.name))
      }
    },
    [anexos, carpeta, onAnexosChange]
  )

  const handleFiles = (files: FileList | null) => {
    if (!files) return
    Array.from(files).forEach(subirArchivo)
  }

  const eliminar = async (anexo: AnexoLocal) => {
    const supabase = createClient()
    await supabase.storage.from('requerimientos-anexos').remove([anexo.path])
    onAnexosChange(anexos.filter(a => a.id !== anexo.id))
  }

  return (
    <div className="space-y-3">
      {/* Zona drag & drop */}
      <div
        onClick={() => !disabled && inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => {
          e.preventDefault()
          setDragging(false)
          handleFiles(e.dataTransfer.files)
        }}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 text-center transition-colors',
          dragging ? 'border-blue-400 bg-blue-50' : 'border-slate-200 bg-slate-50 hover:border-blue-300 hover:bg-blue-50/50',
          disabled && 'cursor-not-allowed opacity-50'
        )}
      >
        <Upload size={24} className={dragging ? 'text-blue-500' : 'text-slate-400'} />
        <div>
          <p className="text-sm font-medium text-slate-600">
            Arrastra archivos aquí o <span className="text-blue-600">haz clic para seleccionar</span>
          </p>
          <p className="mt-0.5 text-xs text-slate-400">
            PDF, Word, Excel, imágenes · Máximo {MAX_SIZE_MB}MB por archivo
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={TIPOS_PERMITIDOS.join(',')}
          className="hidden"
          onChange={e => handleFiles(e.target.files)}
          disabled={disabled}
        />
      </div>

      {/* Subiendo... */}
      {subiendo.length > 0 && (
        <div className="space-y-1.5">
          {subiendo.map(nombre => (
            <div key={nombre} className="flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
              <Loader2 size={13} className="animate-spin" />
              Subiendo {nombre}...
            </div>
          ))}
        </div>
      )}

      {/* Lista de anexos */}
      {anexos.length > 0 && (
        <ul className="space-y-1.5">
          {anexos.map(a => (
            <li key={a.id} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
              {iconoTipo(a.tipo)}
              <a
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 truncate text-xs font-medium text-slate-700 hover:text-blue-600"
              >
                {a.nombre}
              </a>
              <span className="shrink-0 text-xs text-slate-400">{formatBytes(a.tamanio)}</span>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => eliminar(a)}
                  className="shrink-0 text-slate-300 hover:text-red-500"
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
