'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Bug, CheckCircle2, GraduationCap, Info, Loader2, Search } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { CADENA_IGSI, CLASIFICACIONES_BUG, SEVERIDADES_BUG } from '@/lib/tickets/constantes'
import type { ClasificacionBug, EstadoBug, SeveridadBug, TicketCausa, TipoDocumentoIGSI } from '@/lib/tickets/types'
import { resolverTicket } from '@/actions/tickets/flujo'
import { buscarBugsParaEnlace } from '@/actions/tickets/bugs'
import { btnPrimario, btnSecundario, inputCls } from './ui'

type BugEncontrado = { id: string; codigo: string; titulo: string; estado: EstadoBug; severidad: SeveridadBug }

function sinAcentos(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

export function ResolverDialog({
  open, onOpenChange, ticketId, codigo, esNovedadIGSI, causas, conceptuales30d, umbralCapacitacion,
  solicitante, tipoDocumento, asunto,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  ticketId: string
  codigo: string
  esNovedadIGSI: boolean
  causas: TicketCausa[]
  conceptuales30d: number
  umbralCapacitacion: number
  solicitante: string
  tipoDocumento: TipoDocumentoIGSI | null
  asunto: string
}) {
  const router = useRouter()
  const [pending, startT] = useTransition()
  const tipos = useMemo(() => [...new Set(causas.map(c => c.tipo_causa))], [causas])
  const [tipo, setTipo] = useState('')
  const [causaId, setCausaId] = useState('')
  const [respuesta, setRespuesta] = useState('')
  const [requiereCapacitacion, setRequiereCapacitacion] = useState(false)
  const [requiereAjuste, setRequiereAjuste] = useState(false)

  // Bug
  const [modoBug, setModoBug] = useState<'existente' | 'nuevo'>('existente')
  const [qBug, setQBug] = useState('')
  const [bugs, setBugs] = useState<BugEncontrado[]>([])
  const [buscando, setBuscando] = useState(false)
  const [bugSel, setBugSel] = useState<BugEncontrado | null>(null)
  const [nuevoBug, setNuevoBug] = useState({
    titulo: asunto,
    descripcion: '',
    clasificacion: 'BUG' as ClasificacionBug,
    severidad: 'MEDIA' as SeveridadBug,
    tipo_documento: tipoDocumento as TipoDocumentoIGSI | null,
    modulo: '',
    solucion_provisional: '',
  })

  const subcausas = causas.filter(c => c.tipo_causa === tipo)
  const tipoNorm = sinAcentos(tipo)
  const tecnica = tipoNorm.startsWith('tecnic')
  const conceptual = tipoNorm.startsWith('conceptual')
  const necesitaBug = (esNovedadIGSI && tecnica) || requiereAjuste
  const sugerirCapacitacion = esNovedadIGSI && conceptual && conceptuales30d + 1 >= umbralCapacitacion

  useEffect(() => {
    if (!necesitaBug || modoBug !== 'existente') return
    let cancel = false
    const id = setTimeout(async () => {
      setBuscando(true)
      try {
        const r = await buscarBugsParaEnlace(qBug)
        if (!cancel) setBugs(r)
      } catch {
        if (!cancel) setBugs([])
      } finally {
        if (!cancel) setBuscando(false)
      }
    }, 300)
    return () => { cancel = true; clearTimeout(id) }
  }, [qBug, necesitaBug, modoBug])

  const guardar = () => {
    if (!causaId) { toast.error('Selecciona el tipo de causa y la subcausa'); return }
    if (!respuesta.trim()) { toast.error('Escribe la respuesta para el usuario'); return }
    if (necesitaBug && modoBug === 'existente' && !bugSel) { toast.error('Selecciona el bug a enlazar o crea uno nuevo'); return }
    if (necesitaBug && modoBug === 'nuevo' && !nuevoBug.titulo.trim()) { toast.error('Escribe el título del bug'); return }
    startT(async () => {
      const res = await resolverTicket(ticketId, {
        causaId,
        respuesta: respuesta.trim(),
        requiereCapacitacion,
        requiereAjuste,
        bugId: necesitaBug && modoBug === 'existente' ? bugSel?.id ?? null : null,
        nuevoBug: necesitaBug && modoBug === 'nuevo'
          ? {
              titulo: nuevoBug.titulo.trim(),
              descripcion: nuevoBug.descripcion.trim() || undefined,
              clasificacion: nuevoBug.clasificacion,
              severidad: nuevoBug.severidad,
              tipo_documento: nuevoBug.tipo_documento,
              modulo: nuevoBug.modulo.trim() || null,
              solucion_provisional: nuevoBug.solucion_provisional.trim() || null,
            }
          : null,
      })
      if (!res.ok) { toast.error(res.error ?? 'No se pudo resolver'); return }
      toast.success(res.ticketHijoId ? `${codigo} resuelto. Se creó el ticket de capacitación.` : `${codigo} resuelto. Se envió la respuesta al usuario.`)
      onOpenChange(false)
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600" /> Resolver {codigo}
          </DialogTitle>
          <DialogDescription>
            La respuesta se envía por correo a {solicitante || 'el solicitante'}, con enlace para confirmar la solución o reabrir el ticket.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Causa */}
          <div>
            <p className="mb-1.5 text-xs font-semibold text-slate-600">{esNovedadIGSI ? 'Tipo de causa de la novedad IGSI' : 'Tipo de causa'}</p>
            {tipos.length === 0 ? (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">No hay causas activas configuradas para este tipo de ticket. Pide a un administrador que las cree en Config. Tickets.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {tipos.map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => { setTipo(t); setCausaId('') }}
                    className={cn(
                      'rounded-lg border-2 px-3 py-1.5 text-sm font-semibold transition-colors',
                      tipo === t ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:border-slate-300',
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}
            {tipo && esNovedadIGSI && (
              <p className="mt-1.5 text-[11px] text-slate-500">
                {tecnica
                  ? 'Técnica: el sistema no hace lo que debe aunque el funcionario hizo todo bien. Se exige enlazar o crear un bug.'
                  : conceptual
                    ? 'Conceptual: el sistema funciona bien; la novedad viene del uso. Explica en la respuesta cómo se debía hacer.'
                    : null}
              </p>
            )}
          </div>

          {tipo && (
            <label className="block text-xs font-semibold text-slate-600">
              Subcausa
              <select value={causaId} onChange={e => setCausaId(e.target.value)} className={`${inputCls} mt-1`}>
                <option value="">Selecciona…</option>
                {subcausas.map(c => <option key={c.id} value={c.id}>{c.subcausa}</option>)}
              </select>
            </label>
          )}

          <label className="block text-xs font-semibold text-slate-600">
            {conceptual ? 'Respuesta al funcionario (cómo se debía hacer)' : 'Respuesta al usuario'}
            <textarea
              value={respuesta}
              onChange={e => setRespuesta(e.target.value)}
              rows={5}
              className={`${inputCls} mt-1`}
              placeholder={conceptual ? 'Explica el procedimiento correcto paso a paso…' : 'Qué se hizo para solucionarlo…'}
            />
          </label>

          {sugerirCapacitacion && (
            <div className="flex items-start gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-800">
              <GraduationCap size={14} className="mt-0.5 shrink-0" />
              <p>
                {solicitante || 'Este funcionario'} acumula {conceptuales30d} novedad{conceptuales30d !== 1 ? 'es' : ''} conceptual{conceptuales30d !== 1 ? 'es' : ''} en los últimos 30 días
                (con esta serían {conceptuales30d + 1}; el umbral es {umbralCapacitacion}). Se sugiere marcar <strong>Requiere capacitación</strong>.
              </p>
            </div>
          )}

          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={requiereCapacitacion} onChange={e => setRequiereCapacitacion(e.target.checked)} />
              Requiere capacitación
            </label>
            {esNovedadIGSI && (
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={requiereAjuste} onChange={e => setRequiereAjuste(e.target.checked)} />
                Requiere ajuste en IGSI
              </label>
            )}
          </div>
          {requiereCapacitacion && (
            <p className="flex items-start gap-1.5 text-[11px] text-slate-500">
              <Info size={12} className="mt-0.5 shrink-0" />
              Se creará un ticket hijo en Capacitación / {esNovedadIGSI ? 'Capacitación en IGSI' : 'Capacitación en otra herramienta'} a tu nombre, con el área y el funcionario.
            </p>
          )}

          {/* Bug */}
          {necesitaBug && (
            <div className="space-y-3 rounded-xl border border-rose-200 bg-rose-50/40 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-rose-800"><Bug size={14} /> Bug de IGSI</p>
                <div className="flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs">
                  {(['existente', 'nuevo'] as const).map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setModoBug(m)}
                      className={cn('rounded-md px-2.5 py-1 font-medium', modoBug === m ? 'bg-rose-600 text-white' : 'text-slate-600')}
                    >
                      {m === 'existente' ? 'Enlazar existente' : 'Crear nuevo'}
                    </button>
                  ))}
                </div>
              </div>

              {modoBug === 'existente' ? (
                <div className="space-y-2">
                  <div className="relative">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input value={qBug} onChange={e => setQBug(e.target.value)} placeholder="Buscar por código (B-014) o título…" className={cn(inputCls, 'pl-8')} />
                  </div>
                  <ul className="max-h-44 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200 bg-white">
                    {buscando && <li className="flex items-center gap-2 px-3 py-2 text-xs text-slate-400"><Loader2 size={12} className="animate-spin" /> Buscando…</li>}
                    {!buscando && bugs.length === 0 && <li className="px-3 py-2 text-xs text-slate-400">Sin resultados. Puedes crear un bug nuevo.</li>}
                    {!buscando && bugs.map(b => (
                      <li key={b.id}>
                        <button
                          type="button"
                          onClick={() => setBugSel(b)}
                          className={cn('flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-slate-50', bugSel?.id === b.id && 'bg-rose-50')}
                        >
                          <span className="font-mono font-semibold text-rose-700">{b.codigo}</span>
                          <span className="flex-1 text-slate-700">{b.titulo}</span>
                          <span className="text-slate-400">{SEVERIDADES_BUG.find(s => s.value === b.severidad)?.label}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                  {bugSel && <p className="text-xs text-rose-800">Se enlazará a <strong>{bugSel.codigo}</strong> — {bugSel.titulo}</p>}
                </div>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="text-xs font-semibold text-slate-600 sm:col-span-2">
                    Título
                    <input value={nuevoBug.titulo} onChange={e => setNuevoBug(v => ({ ...v, titulo: e.target.value }))} className={`${inputCls} mt-1`} />
                  </label>
                  <label className="text-xs font-semibold text-slate-600">
                    Clasificación
                    <select value={nuevoBug.clasificacion} onChange={e => setNuevoBug(v => ({ ...v, clasificacion: e.target.value as ClasificacionBug }))} className={`${inputCls} mt-1`}>
                      {CLASIFICACIONES_BUG.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-slate-600">
                    Severidad
                    <select value={nuevoBug.severidad} onChange={e => setNuevoBug(v => ({ ...v, severidad: e.target.value as SeveridadBug }))} className={`${inputCls} mt-1`}>
                      {SEVERIDADES_BUG.map(s => <option key={s.value} value={s.value} title={s.descripcion}>{s.label}</option>)}
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-slate-600">
                    Documento
                    <select value={nuevoBug.tipo_documento ?? ''} onChange={e => setNuevoBug(v => ({ ...v, tipo_documento: (e.target.value || null) as TipoDocumentoIGSI | null }))} className={`${inputCls} mt-1`}>
                      <option value="">—</option>
                      {CADENA_IGSI.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-slate-600">
                    Módulo
                    <input value={nuevoBug.modulo} onChange={e => setNuevoBug(v => ({ ...v, modulo: e.target.value }))} className={`${inputCls} mt-1`} />
                  </label>
                  <label className="text-xs font-semibold text-slate-600 sm:col-span-2">
                    Descripción
                    <textarea value={nuevoBug.descripcion} onChange={e => setNuevoBug(v => ({ ...v, descripcion: e.target.value }))} rows={2} className={`${inputCls} mt-1`} />
                  </label>
                  <label className="text-xs font-semibold text-slate-600 sm:col-span-2">
                    Solución provisional
                    <input value={nuevoBug.solucion_provisional} onChange={e => setNuevoBug(v => ({ ...v, solucion_provisional: e.target.value }))} placeholder="Ej. Volver a guardar la remesa" className={`${inputCls} mt-1`} />
                  </label>
                  <p className="text-[11px] text-slate-500 sm:col-span-2">
                    {SEVERIDADES_BUG.find(s => s.value === nuevoBug.severidad)?.descripcion}
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => onOpenChange(false)} className={btnSecundario}>Cancelar</button>
            <button type="button" onClick={guardar} disabled={pending || !causaId} className={cn(btnPrimario, 'bg-emerald-600 hover:bg-emerald-700')}>
              {pending ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Resolver y enviar respuesta
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
