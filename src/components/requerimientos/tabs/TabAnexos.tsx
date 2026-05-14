'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getAnexos } from '@/actions/historial'
import { Skeleton } from '@/components/ui/skeleton'
import { FileText, Image, File, Download, Trash2, Upload } from 'lucide-react'
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage'
import { storage } from '@/lib/firebase'
import { registrarAnexo, eliminarAnexo } from '@/actions/historial'
import { toast } from 'sonner'
import { useRef } from 'react'
import type { Anexo } from '@/lib/supabase/types'

interface Props {
  requerimientoId: string
  canUpload?: boolean
}

const TIPOS_PERMITIDOS = [
  'application/pdf', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
]

function formatBytes(bytes: number | null) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function IconoTipo({ tipo }: { tipo: string | null }) {
  if (tipo?.startsWith('image/')) return <Image size={16} className="text-blue-500" />
  if (tipo?.includes('pdf'))      return <FileText size={16} className="text-red-500" />
  return <File size={16} className="text-slate-400" />
}

export function TabAnexos({ requerimientoId, canUpload = true }: Props) {
  const qc = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState<string[]>([])

  const { data: anexos = [], isLoading } = useQuery<Anexo[]>({
    queryKey: ['anexos', requerimientoId],
    queryFn: () => getAnexos(requerimientoId),
    staleTime: 30_000,
  })

  const subirArchivo = async (file: File) => {
    if (!TIPOS_PERMITIDOS.includes(file.type)) {
      toast.error(`Tipo no permitido: ${file.name}`); return
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error(`Supera 20MB: ${file.name}`); return
    }

    const ext  = file.name.split('.').pop()
    const path = `igsi-requerimientos/${requerimientoId}/${Date.now()}.${ext}`
    const storageRef = ref(storage, path)

    setUploading(prev => [...prev, file.name])
    const task = uploadBytesResumable(storageRef, file, { contentType: file.type })

    task.on('state_changed', null,
      err => {
        toast.error(`Error al subir: ${err.message}`)
        setUploading(prev => prev.filter(n => n !== file.name))
      },
      async () => {
        const url = await getDownloadURL(task.snapshot.ref)
        await registrarAnexo(requerimientoId, {
          nombre_archivo: file.name,
          url_storage:    url,
          tipo_archivo:   file.type,
          tamanio_bytes:  file.size,
        })
        setUploading(prev => prev.filter(n => n !== file.name))
        qc.invalidateQueries({ queryKey: ['anexos', requerimientoId] })
        toast.success(`${file.name} adjuntado`)
      }
    )
  }

  const handleEliminar = async (a: Anexo) => {
    try {
      const fileRef = ref(storage, a.url_storage)
      await deleteObject(fileRef).catch(() => {})
      await eliminarAnexo(a.id, requerimientoId)
      qc.invalidateQueries({ queryKey: ['anexos', requerimientoId] })
      toast.success('Anexo eliminado')
    } catch {
      toast.error('Error al eliminar el anexo')
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
      {/* Botón subir */}
      {canUpload && (
        <div>
          <button
            onClick={() => inputRef.current?.click()}
            className="flex items-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-2.5 text-sm text-slate-600 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
          >
            <Upload size={15} /> Adjuntar archivo
          </button>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={TIPOS_PERMITIDOS.join(',')}
            className="hidden"
            onChange={e => Array.from(e.target.files ?? []).forEach(subirArchivo)}
          />
        </div>
      )}

      {/* Subiendo... */}
      {uploading.map(nombre => (
        <div key={nombre} className="flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
          <div className="h-3 w-3 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          Subiendo {nombre}...
        </div>
      ))}

      {/* Lista */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : anexos.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">Sin archivos adjuntos</p>
      ) : (
        <ul className="divide-y divide-slate-50">
          {anexos.map(a => (
            <li key={a.id} className="flex items-center gap-3 py-3">
              <IconoTipo tipo={a.tipo_archivo} />
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium text-slate-700">{a.nombre_archivo}</p>
                <p className="text-xs text-slate-400">{formatBytes(a.tamanio_bytes)}</p>
              </div>
              <a
                href={a.url_storage}
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-400 hover:text-blue-500"
              >
                <Download size={16} />
              </a>
              {canUpload && (
                <button
                  onClick={() => handleEliminar(a)}
                  className="text-slate-300 hover:text-red-500"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
