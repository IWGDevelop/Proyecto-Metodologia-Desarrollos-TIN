'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage'
import {
  AlertCircle, CalendarClock, CheckCircle2, ChevronDown, ChevronUp, Circle, Download,
  File, FileText, Image as ImageIcon, MessageSquare, Paperclip, Plus, RotateCcw, Users, X,
} from 'lucide-react'
import { toast } from 'sonner'
import { storage } from '@/lib/firebase'
import { cn } from '@/lib/utils'
import {
  getTareasConsolidadasRequerimiento, type AnexoSoporteTarea, type TareaConsolidadaReq,
} from '@/actions/pendientes-requerimiento'
import {
  toggleTareaReunion, guardarRespuestaTarea, registrarAnexoTarea, eliminarAnexoTarea,
} from '@/actions/reuniones'
import {
  toggleTareaSolicitud, guardarRespuestaTareaSolicitud, registrarAnexoTareaSolicitud, eliminarAnexoTareaSolicitud,
} from '@/actions/tareas-solicitud'

interface Props {
  requerimientoId: string
  initialData?: TareaConsolidadaReq[]
}

type Filtro = 'PENDIENTES' | 'COMPLETADAS' | 'TODAS'

const TIPOS_PERMITIDOS = [
  'application/pdf', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
]
const MAX_BYTES = 20 * 1024 * 1024

function fmtFecha(iso: string | null) {
  if (!iso) return '—'
  // Las fechas tipo `date` (YYYY-MM-DD) se interpretan en hora local para no correr un día
  const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T00:00:00`) : new Date(iso)
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

function diasRestantes(fecha: string | null) {
  if (!fecha) return null
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
  const f = new Date(`${fecha.slice(0, 10)}T00:00:00`)
  return Math.round((f.getTime() - hoy.getTime()) / 86_400_000)
}

/** Ruta única en Storage para un soporte */
function rutaSoporte(carpeta: string, nombreArchivo: string) {
  return `${carpeta}/${Date.now()}.${nombreArchivo.split('.').pop()}`
}

function fmtBytes(bytes: number | null) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

function IconoTipo({ tipo }: { tipo: string | null }) {
  if (tipo?.startsWith('image/')) return <ImageIcon size={13} className="shrink-0 text-blue-500" />
  if (tipo?.includes('pdf'))      return <FileText size={13} className="shrink-0 text-red-500" />
  return <File size={13} className="shrink-0 text-slate-400" />
}

function BadgeCompromiso({ tarea }: { tarea: TareaConsolidadaReq }) {
  if (!tarea.fecha_compromiso) return null
  const dias = diasRestantes(tarea.fecha_compromiso)
  const vencida = !tarea.completada && dias != null && dias < 0
  const proxima = !tarea.completada && dias != null && dias >= 0 && dias <= 3
  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
      vencida ? 'bg-red-100 text-red-700' : proxima ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600',
    )}>
      <CalendarClock size={11} />
      {fmtFecha(tarea.fecha_compromiso)}
      {vencida && ` · Vencida hace ${Math.abs(dias!)} d`}
      {proxima && (dias === 0 ? ' · Vence hoy' : ` · ${dias} d`)}
    </span>
  )
}

/* ── Acciones según el origen de la tarea ─────────────────────────────────── */
function accionesPorOrigen(t: TareaConsolidadaReq, requerimientoId: string) {
  const esReunion = t.origen === 'REUNION'
  return {
    guardarRespuesta: (texto: string) => esReunion
      ? guardarRespuestaTarea(t.id, texto)
      : guardarRespuestaTareaSolicitud(t.id, requerimientoId, texto),
    registrarAnexo: (payload: { nombre_archivo: string; url_storage: string; tipo_archivo?: string; tamanio_bytes?: number }) =>
      esReunion ? registrarAnexoTarea(t.id, payload) : registrarAnexoTareaSolicitud(t.id, payload),
    eliminarAnexo: (anexoId: string) => esReunion ? eliminarAnexoTarea(anexoId) : eliminarAnexoTareaSolicitud(anexoId),
    toggle: (completada: boolean) => esReunion
      ? toggleTareaReunion(t.id, completada)
      : toggleTareaSolicitud(t.id, requerimientoId, completada),
    // Mismos prefijos que ya usa la app (reuniones / anexos del requerimiento)
    carpetaStorage: esReunion
      ? `igsi-reuniones-tareas/${t.id}`
      : `igsi-requerimientos/${requerimientoId}/tareas-solicitud/${t.id}`,
  }
}

/* ── Panel de cumplimiento con soporte ────────────────────────────────────── */
function PanelCumplimiento({
  tarea, requerimientoId, onCambio,
}: { tarea: TareaConsolidadaReq; requerimientoId: string; onCambio: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [respuesta, setRespuesta] = useState(tarea.respuesta ?? '')
  const [subiendo, setSubiendo] = useState<string[]>([])
  const [guardando, setGuardando] = useState(false)
  const acc = accionesPorOrigen(tarea, requerimientoId)

  const respuestaCambiada = respuesta.trim() !== (tarea.respuesta ?? '').trim()
  const tieneSoporte = !!respuesta.trim() || tarea.anexos.length > 0

  function subirAnexo(file: File) {
    if (!TIPOS_PERMITIDOS.includes(file.type)) { toast.error(`Tipo no permitido: ${file.name}`); return }
    if (file.size > MAX_BYTES) { toast.error(`Supera 20 MB: ${file.name}`); return }

    const task = uploadBytesResumable(ref(storage, rutaSoporte(acc.carpetaStorage, file.name)), file, { contentType: file.type })
    setSubiendo(prev => [...prev, file.name])

    task.on('state_changed', null,
      err => { toast.error(err.message); setSubiendo(prev => prev.filter(n => n !== file.name)) },
      async () => {
        const url = await getDownloadURL(task.snapshot.ref)
        const res = await acc.registrarAnexo({
          nombre_archivo: file.name, url_storage: url, tipo_archivo: file.type, tamanio_bytes: file.size,
        })
        setSubiendo(prev => prev.filter(n => n !== file.name))
        if (res.ok) { toast.success(`${file.name} adjuntado`); onCambio() }
        else toast.error(res.error ?? 'Error al guardar el soporte')
      },
    )
  }

  async function eliminarAnexo(a: AnexoSoporteTarea) {
    await deleteObject(ref(storage, a.url_storage)).catch(() => {})
    const res = await acc.eliminarAnexo(a.id)
    if (res.ok) onCambio()
    else toast.error('No se pudo eliminar el soporte')
  }

  async function guardarRespuesta() {
    setGuardando(true)
    const res = await acc.guardarRespuesta(respuesta)
    setGuardando(false)
    if (res.ok) { toast.success('Respuesta guardada'); onCambio() }
    else toast.error(res.error ?? 'Error al guardar la respuesta')
  }

  async function registrarCumplimiento() {
    if (!tieneSoporte) {
      toast.error('Agrega una respuesta o adjunta al menos un soporte')
      return
    }
    setGuardando(true)
    if (respuestaCambiada) {
      const r = await acc.guardarRespuesta(respuesta)
      if (!r.ok) { setGuardando(false); toast.error(r.error ?? 'Error al guardar la respuesta'); return }
    }
    const res = await acc.toggle(true)
    setGuardando(false)
    if (res.ok) { toast.success('Cumplimiento registrado'); onCambio() }
    else toast.error(res.error ?? 'No se pudo registrar el cumplimiento')
  }

  async function reabrir() {
    setGuardando(true)
    const res = await acc.toggle(false)
    setGuardando(false)
    if (res.ok) { toast.success('Tarea reabierta'); onCambio() }
    else toast.error(res.error ?? 'No se pudo reabrir la tarea')
  }

  return (
    <div className="mt-2 space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
      {/* Respuesta */}
      <div className="space-y-1.5">
        <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
          <MessageSquare size={12} /> ¿Qué se hizo para cumplir la tarea?
        </label>
        <textarea
          value={respuesta}
          onChange={e => setRespuesta(e.target.value)}
          placeholder="Describe la gestión realizada, el resultado obtenido, enlaces, etc."
          rows={3}
          className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
        />
        {tarea.completada && respuestaCambiada && (
          <button
            type="button"
            onClick={guardarRespuesta}
            disabled={guardando}
            className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {guardando ? 'Guardando...' : 'Guardar respuesta'}
          </button>
        )}
      </div>

      {/* Soportes */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
            <Paperclip size={12} /> Soportes
            {tarea.anexos.length > 0 && (
              <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-600">{tarea.anexos.length}</span>
            )}
          </label>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600"
          >
            <Plus size={11} /> Adjuntar
          </button>
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={TIPOS_PERMITIDOS.join(',')}
          className="hidden"
          onChange={e => { Array.from(e.target.files ?? []).forEach(subirAnexo); e.target.value = '' }}
        />
        {subiendo.map(nombre => (
          <div key={nombre} className="flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-1.5 text-xs text-blue-700">
            <div className="h-3 w-3 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
            Subiendo {nombre}...
          </div>
        ))}
        {tarea.anexos.length > 0 ? (
          <ul className="space-y-1">
            {tarea.anexos.map(a => (
              <li key={a.id} className="flex items-center gap-2 rounded-lg border border-slate-100 bg-white px-2.5 py-1.5">
                <IconoTipo tipo={a.tipo_archivo} />
                <span className="flex-1 truncate text-xs font-medium text-slate-700">{a.nombre_archivo}</span>
                <span className="shrink-0 text-xs text-slate-400">{fmtBytes(a.tamanio_bytes)}</span>
                <a href={a.url_storage} target="_blank" rel="noopener noreferrer" className="shrink-0 text-slate-400 hover:text-blue-500">
                  <Download size={13} />
                </a>
                <button type="button" onClick={() => eliminarAnexo(a)} className="shrink-0 text-slate-300 hover:text-red-400" aria-label="Eliminar soporte">
                  <X size={12} />
                </button>
              </li>
            ))}
          </ul>
        ) : (!subiendo.length && <p className="text-xs italic text-slate-400">Sin soportes adjuntos</p>)}
        <p className="text-[11px] text-slate-400">PDF, Word, Excel o imágenes · máx. 20 MB por archivo</p>
      </div>

      {/* Acción principal */}
      {!tarea.completada ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3">
          {!tieneSoporte ? (
            <p className="flex items-center gap-1.5 text-xs text-amber-700">
              <AlertCircle size={13} /> Se requiere una respuesta o al menos un soporte
            </p>
          ) : <span />}
          <button
            type="button"
            onClick={registrarCumplimiento}
            disabled={guardando || !tieneSoporte || subiendo.length > 0}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            <CheckCircle2 size={14} /> {guardando ? 'Registrando...' : 'Registrar cumplimiento'}
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-end border-t border-slate-200 pt-3">
          <button
            type="button"
            onClick={reabrir}
            disabled={guardando}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50"
          >
            <RotateCcw size={13} /> Reabrir tarea
          </button>
        </div>
      )}
    </div>
  )
}

export function TabPendientes({ requerimientoId, initialData }: Props) {
  const qc = useQueryClient()
  const router = useRouter()
  const [filtro, setFiltro] = useState<Filtro>('PENDIENTES')
  const [abierta, setAbierta] = useState<string | null>(null)

  const { data: tareas = [], isLoading } = useQuery<TareaConsolidadaReq[]>({
    queryKey: ['pendientes-req', requerimientoId],
    queryFn: () => getTareasConsolidadasRequerimiento(requerimientoId),
    initialData,
  })

  const pendientes = tareas.filter(t => !t.completada)
  const vencidas = pendientes.filter(t => (diasRestantes(t.fecha_compromiso) ?? 0) < 0)
  const visibles = tareas.filter(t =>
    filtro === 'TODAS' ? true : filtro === 'PENDIENTES' ? !t.completada : t.completada
  )

  function refrescar() {
    qc.invalidateQueries({ queryKey: ['pendientes-req', requerimientoId] })
    qc.invalidateQueries({ queryKey: ['reuniones', requerimientoId] })
    qc.invalidateQueries({ queryKey: ['tareas-solicitud', requerimientoId] })
    router.refresh() // actualiza el contador del menú lateral
  }

  return (
    <div className="space-y-4">
      {/* Resumen */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { label: 'Pendientes', valor: pendientes.length, cls: 'text-blue-700' },
          { label: 'Vencidas', valor: vencidas.length, cls: vencidas.length ? 'text-red-600' : 'text-slate-700' },
          { label: 'Completadas', valor: tareas.length - pendientes.length, cls: 'text-emerald-600' },
        ].map(k => (
          <div key={k.label} className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{k.label}</p>
            <p className={cn('text-2xl font-bold', k.cls)}>{k.valor}</p>
          </div>
        ))}
      </div>

      {/* Filtro */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
          {(['PENDIENTES', 'COMPLETADAS', 'TODAS'] as Filtro[]).map(f => (
            <button
              key={f}
              type="button"
              onClick={() => setFiltro(f)}
              className={cn(
                'rounded-md px-3 py-1 text-xs font-medium transition-colors',
                filtro === f ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700',
              )}
            >
              {f === 'PENDIENTES' ? 'Pendientes' : f === 'COMPLETADAS' ? 'Completadas' : 'Todas'}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-400">Orden cronológico según la fecha en que surgió cada tarea</p>
      </div>

      {/* Línea de tiempo */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        {isLoading ? (
          <p className="py-8 text-center text-sm text-slate-400">Cargando tareas...</p>
        ) : visibles.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">
            {filtro === 'PENDIENTES' ? 'No hay tareas pendientes 🎉' : 'No hay tareas para mostrar'}
          </p>
        ) : (
          <ol className="relative space-y-4 border-l border-slate-200 pl-5">
            {visibles.map(t => {
              const clave = `${t.origen}-${t.id}`
              const esReunion = t.origen === 'REUNION'
              const expandida = abierta === clave
              return (
                <li key={clave} className="relative">
                  <span className={cn(
                    'absolute -left-[27px] top-1 flex h-3 w-3 rounded-full border-2 border-white',
                    t.completada ? 'bg-emerald-400' : esReunion ? 'bg-violet-400' : 'bg-blue-400',
                  )} />
                  <p className="text-[11px] font-medium text-slate-400">{fmtFecha(t.fecha_origen)}</p>
                  <div className="mt-1 rounded-lg border border-slate-100 p-3">
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 shrink-0">
                        {t.completada
                          ? <CheckCircle2 size={18} className="text-emerald-500" />
                          : <Circle size={18} className="text-slate-300" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className={cn('text-sm text-slate-800', t.completada && 'text-slate-500')}>
                          {t.descripcion}
                        </p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <span className={cn(
                            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
                            esReunion ? 'bg-violet-100 text-violet-700' : 'bg-blue-100 text-blue-700',
                          )}>
                            {esReunion ? <Users size={11} /> : <MessageSquare size={11} />}
                            {esReunion ? `Reunión${t.contexto ? `: ${t.contexto}` : ''}` : 'Comentarios'}
                          </span>
                          {t.responsable_email && (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                              {t.nombre_responsable ?? t.responsable_email}
                            </span>
                          )}
                          <BadgeCompromiso tarea={t} />
                          {t.completada && t.fecha_cumplimiento && (
                            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700">
                              Cumplida {fmtFecha(t.fecha_cumplimiento)}
                            </span>
                          )}
                          {t.anexos.length > 0 && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                              <Paperclip size={10} /> {t.anexos.length}
                            </span>
                          )}
                          {!esReunion && t.contexto && (
                            <span className="text-[11px] text-slate-400">Registrada por {t.contexto}</span>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setAbierta(expandida ? null : clave)}
                        className={cn(
                          'flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors',
                          t.completada
                            ? 'text-slate-500 hover:bg-slate-100'
                            : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
                        )}
                      >
                        {t.completada ? 'Ver soporte' : 'Registrar cumplimiento'}
                        {expandida ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                      </button>
                    </div>
                    {expandida && (
                      <PanelCumplimiento
                        // key por versión de la respuesta para reiniciar el borrador tras guardar
                        key={`${clave}-${t.respuesta ?? ''}`}
                        tarea={t}
                        requerimientoId={requerimientoId}
                        onCambio={refrescar}
                      />
                    )}
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </div>
    </div>
  )
}
