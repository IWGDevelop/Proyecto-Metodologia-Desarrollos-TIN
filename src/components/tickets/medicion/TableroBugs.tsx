'use client'

import { useMemo, useState } from 'react'
import {
  DndContext, DragOverlay, KeyboardSensor, PointerSensor, useDraggable, useDroppable, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { CLASIFICACIONES_BUG, ESTADOS_BUG, SEVERIDADES_BUG } from '@/lib/tickets/constantes'
import { cambiarEstadoBug, listarBugs, type BugTablero } from '@/actions/tickets/bugs'
import type { ClasificacionBug, EstadoBug, SeveridadBug } from '@/lib/tickets/types'
import { CadenaDocumento } from './CadenaDocumento'
import { DetalleBug } from './DetalleBug'
import { FormularioBug } from './FormularioBug'
import { BORDE_SEVERIDAD, CORTO_CLASIFICACION, PILL_CLASIFICACION, PILL_SEVERIDAD, SELECT_CLASE } from './estilos'

interface Props {
  bugsIniciales: BugTablero[]
  responsables: { id: string; nombre: string }[]
  /** Bug que se abre al cargar (enlace /admin/tickets-bugs?bug=<id> desde el detalle de un ticket) */
  bugAbiertoInicial?: string | null
}

const LABEL_SEV = Object.fromEntries(SEVERIDADES_BUG.map(s => [s.value, s.label])) as Record<SeveridadBug, string>

function Kpi({ valor, texto, alerta }: { valor: string | number; texto: string; alerta?: boolean }) {
  return (
    <div className={cn('rounded-xl border bg-white px-4 py-3', alerta ? 'border-red-200 bg-red-50' : 'border-slate-200')}>
      <p className={cn('text-2xl font-bold tabular-nums', alerta ? 'text-red-700' : 'text-slate-800')}>{valor}</p>
      <p className="text-xs text-slate-500">{texto}</p>
    </div>
  )
}

function TarjetaBug({ bug, onClick, overlay = false }: { bug: BugTablero; onClick?: () => void; overlay?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: bug.id, data: { bug }, disabled: overlay })
  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined
  return (
    <div
      ref={overlay ? undefined : setNodeRef}
      style={style}
      {...(overlay ? {} : listeners)}
      {...(overlay ? {} : attributes)}
      onClick={onClick}
      className={cn(
        'cursor-grab space-y-2 rounded-lg border border-l-4 border-slate-200 bg-white p-3 text-left shadow-sm transition hover:shadow-md active:cursor-grabbing',
        BORDE_SEVERIDAD[bug.severidad],
        isDragging && !overlay && 'opacity-40',
        overlay && 'rotate-1 shadow-lg',
      )}
    >
      <p className="text-sm font-semibold leading-snug text-slate-800">{bug.titulo}</p>
      <CadenaDocumento documento={bug.tipo_documento} />
      <span className={cn('inline-block rounded px-1.5 py-0.5 text-[11px] font-medium', PILL_CLASIFICACION[bug.clasificacion])}>
        {CORTO_CLASIFICACION[bug.clasificacion]}
      </span>
      <div className="flex flex-wrap gap-x-2 gap-y-1 text-[11px] text-slate-500">
        <span className="font-semibold text-slate-600">{bug.codigo}</span>
        <span className={cn('rounded px-1', PILL_SEVERIDAD[bug.severidad])}>{LABEL_SEV[bug.severidad]}</span>
        <span>{bug.tickets} {bug.tickets === 1 ? 'ticket' : 'tickets'}</span>
        <span>{bug.dias_abierto} {bug.dias_abierto === 1 ? 'día' : 'días'}</span>
      </div>
      <p className="text-[11px] text-slate-500">
        Provisional: <span className="text-slate-700">{bug.solucion_provisional || 'Ninguna'}</span>
      </p>
    </div>
  )
}

function Columna({ estado, label, bugs, onAbrir }: { estado: EstadoBug; label: string; bugs: BugTablero[]; onAbrir: (b: BugTablero) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: estado })
  return (
    <div className="flex w-[260px] shrink-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
      <div className="flex items-center justify-between border-b border-slate-100 bg-white px-3 py-2.5">
        <span className="text-sm font-semibold text-slate-700">{label}</span>
        <span className="rounded-full bg-slate-100 px-2 text-xs font-bold text-slate-600">{bugs.length}</span>
      </div>
      <div
        ref={setNodeRef}
        className={cn('flex min-h-[140px] flex-1 flex-col gap-2.5 p-2.5 transition-colors', isOver && 'bg-blue-50 ring-2 ring-inset ring-blue-300')}
      >
        {bugs.length === 0 && <p className="py-6 text-center text-xs text-slate-400">Sin bugs</p>}
        {bugs.map(b => <TarjetaBug key={b.id} bug={b} onClick={() => onAbrir(b)} />)}
      </div>
    </div>
  )
}

export function TableroBugs({ bugsIniciales, responsables, bugAbiertoInicial = null }: Props) {
  const [bugs, setBugs] = useState<BugTablero[]>(bugsIniciales)
  const [fClas, setFClas] = useState<ClasificacionBug | ''>('')
  const [fSev, setFSev] = useState<SeveridadBug | ''>('')
  const [activo, setActivo] = useState<BugTablero | null>(null)
  const [abiertoId, setAbiertoId] = useState<string | null>(bugAbiertoInicial)
  const [form, setForm] = useState<{ bug: BugTablero | null; n: number } | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  )

  const recargar = async () => {
    try { setBugs(await listarBugs()) } catch { toast.error('No se pudo actualizar el tablero') }
  }

  const visibles = useMemo(
    () => bugs.filter(b => (!fClas || b.clasificacion === fClas) && (!fSev || b.severidad === fSev)),
    [bugs, fClas, fSev],
  )
  const kpis = useMemo(() => {
    const abiertos = visibles.filter(b => b.estado !== 'DESPLEGADO')
    const deuda = abiertos.filter(b => b.clasificacion === 'DEUDA_TECNICA')
    return {
      abiertos: abiertos.length,
      bloqueantes: abiertos.filter(b => b.severidad === 'BLOQUEANTE').length,
      tickets: visibles.reduce((s, b) => s + b.tickets, 0),
      diasDeuda: deuda.length ? Math.round(deuda.reduce((s, b) => s + b.dias_abierto, 0) / deuda.length) : null,
    }
  }, [visibles])

  const onDragStart = (e: DragStartEvent) => setActivo((e.active.data.current?.bug as BugTablero) ?? null)

  const onDragEnd = async (e: DragEndEvent) => {
    setActivo(null)
    const bug = e.active.data.current?.bug as BugTablero | undefined
    const destino = e.over?.id as EstadoBug | undefined
    if (!bug || !destino || bug.estado === destino) return
    const previo = bugs
    setBugs(bs => bs.map(b => (b.id === bug.id
      ? { ...b, estado: destino, fecha_desplegado: destino === 'DESPLEGADO' ? new Date().toISOString() : null }
      : b)))
    const r = await cambiarEstadoBug(bug.id, destino)
    if (!r.ok) {
      setBugs(previo)
      toast.error(r.error ?? 'No se pudo mover el bug')
      return
    }
    toast.success(`${bug.codigo} → ${ESTADOS_BUG.find(s => s.value === destino)?.label}`)
    recargar()
  }

  const abierto = abiertoId ? bugs.find(b => b.id === abiertoId) ?? null : null

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi valor={kpis.abiertos} texto="abiertos" />
        <Kpi valor={kpis.bloqueantes} texto="bloqueantes abiertos" alerta={kpis.bloqueantes > 0} />
        <Kpi valor={kpis.tickets} texto="tickets enlazados" />
        <Kpi valor={kpis.diasDeuda ?? '—'} texto="días promedio de la deuda técnica abierta" />
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="space-y-1 text-xs text-slate-500">
          <span className="block">Clasificación</span>
          <select className={SELECT_CLASE} value={fClas} onChange={e => setFClas(e.target.value as ClasificacionBug | '')}>
            <option value="">Todas</option>
            {CLASIFICACIONES_BUG.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-xs text-slate-500">
          <span className="block">Severidad</span>
          <select className={SELECT_CLASE} value={fSev} onChange={e => setFSev(e.target.value as SeveridadBug | '')}>
            <option value="">Todas</option>
            {SEVERIDADES_BUG.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </label>
        <span className="pb-1.5 text-xs text-slate-500">{visibles.length} de {bugs.length} bugs</span>
        <Button className="ml-auto gap-1.5" onClick={() => setForm({ bug: null, n: Date.now() })}>
          <Plus size={15} /> Nuevo bug
        </Button>
      </div>

      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActivo(null)}>
        <div className="flex gap-3 overflow-x-auto pb-3">
          {ESTADOS_BUG.map(s => (
            <Columna
              key={s.value}
              estado={s.value}
              label={s.label}
              bugs={visibles.filter(b => b.estado === s.value)}
              onAbrir={b => setAbiertoId(b.id)}
            />
          ))}
        </div>
        <DragOverlay>{activo ? <TarjetaBug bug={activo} overlay /> : null}</DragOverlay>
      </DndContext>

      <DetalleBug
        bug={abierto}
        onClose={() => setAbiertoId(null)}
        onEditar={b => setForm({ bug: b, n: Date.now() })}
        onCambio={recargar}
      />

      {form && (
        <FormularioBug
          key={form.n}
          open
          onOpenChange={o => { if (!o) setForm(null) }}
          bug={form.bug}
          responsables={responsables}
          onGuardado={recargar}
        />
      )}
    </div>
  )
}
