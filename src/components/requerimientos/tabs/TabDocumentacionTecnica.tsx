'use client'

import { useState, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage'
import { storage } from '@/lib/firebase'
import { toast } from 'sonner'
import {
  FileText, Image, File, Download, Trash2, Upload, Eye,
  X, ZoomIn, ZoomOut, Plus, ChevronDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { getDocumentacionTecnica, registrarDocumentoTecnico, eliminarDocumentoTecnico } from '@/actions/documentacion-tecnica'
import type { DocumentacionTecnica, TipoDocumentoTecnico } from '@/lib/supabase/types'

const TIPOS_PERMITIDOS = [
  'application/pdf', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
]

const TIPO_DOC_LABEL: Record<TipoDocumentoTecnico, string> = {
  ESPECIFICACION:  'Especificación técnica',
  ARQUITECTURA:    'Diagrama de arquitectura',
  BASE_DE_DATOS:   'Diagrama / script de BD',
  MANUAL_TECNICO:  'Manual técnico',
  SCRIPTS_SQL:     'Scripts SQL',
  PRUEBAS:         'Plan / resultados de pruebas',
  REPOSITORIO:     'Documentación de repositorio',
  OTRO:            'Otro',
}

const TIPO_DOC_COLOR: Record<TipoDocumentoTecnico, string> = {
  ESPECIFICACION:  'bg-blue-100 text-blue-700 border-blue-200',
  ARQUITECTURA:    'bg-violet-100 text-violet-700 border-violet-200',
  BASE_DE_DATOS:   'bg-amber-100 text-amber-700 border-amber-200',
  MANUAL_TECNICO:  'bg-emerald-100 text-emerald-700 border-emerald-200',
  SCRIPTS_SQL:     'bg-orange-100 text-orange-700 border-orange-200',
  PRUEBAS:         'bg-cyan-100 text-cyan-700 border-cyan-200',
  REPOSITORIO:     'bg-indigo-100 text-indigo-700 border-indigo-200',
  OTRO:            'bg-slate-100 text-slate-600 border-slate-200',
}

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

function esPrevisualizble(tipo: string | null) {
  if (!tipo) return false
  return tipo.startsWith('image/') || tipo.includes('pdf') ||
    tipo.includes('msword') || tipo.includes('wordprocessingml') ||
    tipo.includes('ms-excel') || tipo.includes('spreadsheetml')
}

function urlPreview(doc: DocumentacionTecnica): string {
  const tipo = doc.tipo_archivo ?? ''
  if (tipo.startsWith('image/')) return doc.url_storage
  return `https://docs.google.com/viewer?url=${encodeURIComponent(doc.url_storage)}&embedded=true`
}

/* ─── Modal de previsualización ─── */
function PreviewModal({ doc, onClose }: { doc: DocumentacionTecnica; onClose: () => void }) {
  const tipo = doc.tipo_archivo ?? ''
  const [imgZoom, setImgZoom] = useState(false)
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="relative flex flex-col bg-white rounded-2xl shadow-2xl overflow-hidden"
        style={{ width: '90vw', maxWidth: 900, height: '85vh' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 shrink-0">
          <IconoTipo tipo={tipo} />
          <span className="flex-1 truncate text-sm font-medium text-slate-700">{doc.nombre_archivo}</span>
          <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-medium', TIPO_DOC_COLOR[doc.tipo_documento])}>
            {TIPO_DOC_LABEL[doc.tipo_documento]}
          </span>
          {doc.version && <span className="text-xs text-slate-400">v{doc.version}</span>}
          {tipo.startsWith('image/') && (
            <button onClick={() => setImgZoom(z => !z)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
              {imgZoom ? <ZoomOut size={16} /> : <ZoomIn size={16} />}
            </button>
          )}
          <a href={doc.url_storage} target="_blank" rel="noopener noreferrer"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-blue-600" title="Descargar">
            <Download size={16} />
          </a>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-auto bg-slate-50">
          {tipo.startsWith('image/') ? (
            <div className={cn('flex min-h-full items-center justify-center p-4', imgZoom ? 'cursor-zoom-out' : 'cursor-zoom-in')}
              onClick={() => setImgZoom(z => !z)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={doc.url_storage} alt={doc.nombre_archivo}
                className={cn('rounded-lg shadow transition-all duration-300', imgZoom ? 'max-w-none' : 'max-h-full max-w-full object-contain')}
                style={imgZoom ? { maxWidth: '200%' } : {}} />
            </div>
          ) : (
            <iframe src={urlPreview(doc)} className="h-full w-full border-0" title={doc.nombre_archivo} />
          )}
        </div>
      </div>
    </div>
  )
}

/* ─── Modal de subida ─── */
interface UploadModalProps {
  requerimientoId: string
  subidoPor?: string | null
  onClose: () => void
  onDone: () => void
}

function UploadModal({ requerimientoId, subidoPor, onClose, onDone }: UploadModalProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [archivo, setArchivo] = useState<File | null>(null)
  const [tipoDoc, setTipoDoc] = useState<TipoDocumentoTecnico>('ESPECIFICACION')
  const [descripcion, setDescripcion] = useState('')
  const [version, setVersion] = useState('')
  const [progreso, setProgreso] = useState(0)
  const [subiendo, setSubiendo] = useState(false)

  const seleccionarArchivo = (files: FileList | null) => {
    const file = files?.[0]
    if (!file) return
    if (!TIPOS_PERMITIDOS.includes(file.type)) { toast.error(`Tipo no permitido: ${file.name}`); return }
    if (file.size > 20 * 1024 * 1024) { toast.error('El archivo supera 20MB'); return }
    setArchivo(file)
  }

  const subir = () => {
    if (!archivo) return
    const ext = archivo.name.split('.').pop()
    const path = `igsi-requerimientos/${requerimientoId}/doc-tecnica/${Date.now()}.${ext}`
    const storageRef = ref(storage, path)
    setSubiendo(true)
    setProgreso(0)
    const task = uploadBytesResumable(storageRef, archivo, { contentType: archivo.type })
    task.on('state_changed',
      snap => setProgreso(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
      err => { toast.error(`Error al subir: ${err.message}`); setSubiendo(false) },
      async () => {
        try {
          const url = await getDownloadURL(task.snapshot.ref)
          await registrarDocumentoTecnico(requerimientoId, {
            nombre_archivo: archivo.name,
            url_storage:    url,
            tipo_archivo:   archivo.type,
            tamanio_bytes:  archivo.size,
            tipo_documento: tipoDoc,
            descripcion:    descripcion.trim() || null,
            version:        version.trim() || null,
            subido_por:     subidoPor ?? null,
          })
          toast.success(`${archivo.name} registrado`)
          onDone()
        } catch (e: any) {
          toast.error(`Error al registrar: ${e?.message}`)
        } finally {
          setSubiendo(false)
        }
      }
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h3 className="text-sm font-semibold text-slate-800">Subir documento técnico</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
        </div>
        <div className="space-y-4 px-5 py-4">
          {/* Archivo */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-500 uppercase tracking-wide">Archivo</label>
            <div
              onClick={() => !subiendo && inputRef.current?.click()}
              className={cn(
                'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition-colors',
                archivo ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-slate-50 hover:border-blue-300 hover:bg-blue-50/50',
                subiendo && 'cursor-not-allowed opacity-60'
              )}
            >
              {archivo ? (
                <div className="flex items-center gap-2">
                  <IconoTipo tipo={archivo.type} />
                  <span className="text-xs font-medium text-slate-700 truncate max-w-[200px]">{archivo.name}</span>
                  <span className="text-xs text-slate-400">{formatBytes(archivo.size)}</span>
                </div>
              ) : (
                <>
                  <Upload size={20} className="text-slate-400" />
                  <p className="text-xs text-slate-500">Haz clic para seleccionar o arrastra el archivo</p>
                  <p className="text-[10px] text-slate-400">PDF, Word, Excel, imágenes · Máximo 20 MB</p>
                </>
              )}
            </div>
            <input ref={inputRef} type="file" accept={TIPOS_PERMITIDOS.join(',')} className="hidden"
              onChange={e => seleccionarArchivo(e.target.files)} disabled={subiendo} />
          </div>

          {/* Tipo de documento */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-500 uppercase tracking-wide">Tipo de documento</label>
            <div className="relative">
              <select
                value={tipoDoc}
                onChange={e => setTipoDoc(e.target.value as TipoDocumentoTecnico)}
                disabled={subiendo}
                className="w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 py-2 pr-8 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
              >
                {(Object.entries(TIPO_DOC_LABEL) as [TipoDocumentoTecnico, string][]).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
              <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            </div>
          </div>

          {/* Versión */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-500 uppercase tracking-wide">Versión</label>
              <input
                type="text"
                placeholder="ej: 1.0"
                value={version}
                onChange={e => setVersion(e.target.value)}
                disabled={subiendo}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>
          </div>

          {/* Descripción */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-500 uppercase tracking-wide">Descripción <span className="normal-case font-normal text-slate-400">(opcional)</span></label>
            <textarea
              rows={2}
              placeholder="Describe brevemente el contenido del documento..."
              value={descripcion}
              onChange={e => setDescripcion(e.target.value)}
              disabled={subiendo}
              className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>

          {/* Progreso */}
          {subiendo && (
            <div className="rounded-lg bg-blue-50 px-3 py-2.5">
              <div className="flex justify-between text-xs text-blue-700 mb-1.5">
                <span>Subiendo...</span>
                <span className="font-bold">{progreso}%</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-blue-100 overflow-hidden">
                <div className="h-full rounded-full bg-blue-500 transition-all duration-300" style={{ width: `${progreso}%` }} />
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
          <button onClick={onClose} disabled={subiendo}
            className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-50">
            Cancelar
          </button>
          <button onClick={subir} disabled={!archivo || subiendo}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            <Upload size={14} /> Subir documento
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── Componente principal ─── */
interface Props {
  requerimientoId: string
  currentUserId?: string | null
  canUpload?: boolean
}

export function TabDocumentacionTecnica({ requerimientoId, currentUserId, canUpload = true }: Props) {
  const qc = useQueryClient()
  const [preview, setPreview] = useState<DocumentacionTecnica | null>(null)
  const [showUpload, setShowUpload] = useState(false)
  const [filtroTipo, setFiltroTipo] = useState<TipoDocumentoTecnico | ''>('')

  const { data: documentos = [], isLoading } = useQuery<DocumentacionTecnica[]>({
    queryKey: ['documentacion-tecnica', requerimientoId],
    queryFn: () => getDocumentacionTecnica(requerimientoId),
    staleTime: 30_000,
  })

  const handleEliminar = async (doc: DocumentacionTecnica) => {
    try {
      const fileRef = ref(storage, doc.url_storage)
      await deleteObject(fileRef).catch(() => {})
      await eliminarDocumentoTecnico(doc.id, requerimientoId)
      qc.invalidateQueries({ queryKey: ['documentacion-tecnica', requerimientoId] })
      toast.success('Documento eliminado')
    } catch {
      toast.error('Error al eliminar el documento')
    }
  }

  const documentosFiltrados = filtroTipo
    ? documentos.filter(d => d.tipo_documento === filtroTipo)
    : documentos

  const tiposPresentes = Array.from(new Set(documentos.map(d => d.tipo_documento))) as TipoDocumentoTecnico[]

  return (
    <>
      {preview && <PreviewModal doc={preview} onClose={() => setPreview(null)} />}
      {showUpload && (
        <UploadModal
          requerimientoId={requerimientoId}
          subidoPor={currentUserId}
          onClose={() => setShowUpload(false)}
          onDone={() => {
            setShowUpload(false)
            qc.invalidateQueries({ queryKey: ['documentacion-tecnica', requerimientoId] })
          }}
        />
      )}

      <div className="space-y-4">
        {/* Header con botón subir y filtro */}
        <div className="flex flex-wrap items-center gap-3">
          {canUpload && (
            <button
              onClick={() => setShowUpload(true)}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
            >
              <Plus size={15} /> Subir documento
            </button>
          )}
          {tiposPresentes.length > 1 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => setFiltroTipo('')}
                className={cn('rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                  filtroTipo === '' ? 'bg-slate-700 text-white border-slate-700' : 'border-slate-200 text-slate-500 hover:border-slate-300')}
              >
                Todos ({documentos.length})
              </button>
              {tiposPresentes.map(t => (
                <button key={t}
                  onClick={() => setFiltroTipo(t === filtroTipo ? '' : t)}
                  className={cn('rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                    filtroTipo === t ? 'bg-slate-700 text-white border-slate-700' : `${TIPO_DOC_COLOR[t]} hover:opacity-80`)}
                >
                  {TIPO_DOC_LABEL[t]}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Lista de documentos */}
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : documentosFiltrados.length === 0 ? (
            <div className="py-12 text-center">
              <FileText size={32} className="mx-auto mb-3 text-slate-200" />
              <p className="text-sm text-slate-400">
                {filtroTipo ? 'No hay documentos de este tipo' : 'Sin documentación técnica registrada'}
              </p>
              {canUpload && !filtroTipo && (
                <button onClick={() => setShowUpload(true)}
                  className="mt-3 text-xs text-blue-500 hover:text-blue-600 underline">
                  Subir primer documento
                </button>
              )}
            </div>
          ) : (
            <ul className="divide-y divide-slate-50">
              {documentosFiltrados.map(doc => (
                <li key={doc.id} className="flex items-start gap-3 px-4 py-3.5 hover:bg-slate-50 transition-colors">
                  <div className="mt-0.5 shrink-0">
                    <IconoTipo tipo={doc.tipo_archivo} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-0.5">
                      <span className="text-sm font-medium text-slate-800 truncate">{doc.nombre_archivo}</span>
                      {doc.version && (
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-mono text-slate-500">v{doc.version}</span>
                      )}
                      <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-medium', TIPO_DOC_COLOR[doc.tipo_documento])}>
                        {TIPO_DOC_LABEL[doc.tipo_documento]}
                      </span>
                    </div>
                    {doc.descripcion && (
                      <p className="text-xs text-slate-500 line-clamp-1">{doc.descripcion}</p>
                    )}
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {formatBytes(doc.tamanio_bytes)}
                      {doc.tamanio_bytes ? ' · ' : ''}
                      {new Date(doc.created_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {esPrevisualizble(doc.tipo_archivo) && (
                      <button onClick={() => setPreview(doc)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-indigo-500" title="Previsualizar">
                        <Eye size={15} />
                      </button>
                    )}
                    <a href={doc.url_storage} target="_blank" rel="noopener noreferrer"
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-blue-500" title="Descargar">
                      <Download size={15} />
                    </a>
                    {canUpload && (
                      <button onClick={() => handleEliminar(doc)}
                        className="rounded-lg p-1.5 text-slate-300 hover:bg-red-50 hover:text-red-500" title="Eliminar">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  )
}
