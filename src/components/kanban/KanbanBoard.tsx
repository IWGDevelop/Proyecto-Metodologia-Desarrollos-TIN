'use client'

import { useState, useCallback, useMemo } from 'react'
import {
  DndContext, DragOverlay, PointerSensor, KeyboardSensor,
  useSensor, useSensors, type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { KanbanColumna } from './KanbanColumna'
import { KanbanCard } from './KanbanCard'
import { KanbanFiltros, type FiltrosKanban } from './KanbanFiltros'
import { KanbanCardDetail } from './KanbanCardDetail'
import { Skeleton } from '@/components/ui/skeleton'
import { ESTADOS, COLOR_PALETTE } from '@/lib/constants'
import { cambiarEstado } from '@/actions/requerimientos'
import { useKanban, useInvalidateKanban, useEstadosKanban, type KanbanData } from '@/hooks/useKanban'
import { cn } from '@/lib/utils'
import type { MetricaRequerimiento, EstadoKanban } from '@/lib/supabase/types'

interface PendingMove {
  card: MetricaRequerimiento
  fromEstado: string
  toEstado: string
}

const FILTROS_INIT: FiltrosKanban = { search: '', alcances: [], prioridades: [], responsable: '' }

// Fallback para estados no registrados en la BD
function getColores(nombre: string, columnas: EstadoKanban[]) {
  const db = columnas.find(c => c.nombre === nombre)
  if (db) return COLOR_PALETTE[db.color_key] ?? COLOR_PALETTE['slate']
  const hard = ESTADOS[nombre]
  if (hard) return { bg: hard.bgColor, text: hard.textColor, border: hard.borderColor }
  return COLOR_PALETTE['slate']
}

function getLabel(nombre: string, columnas: EstadoKanban[]) {
  const db = columnas.find(c => c.nombre === nombre)
  if (db) return db.label
  return ESTADOS[nombre]?.label ?? nombre
}

function aplicarFiltros(
  data: KanbanData,
  filtros: FiltrosKanban,
  columnas: EstadoKanban[]
): KanbanData {
  const activas = columnas.filter(c => c.activo && !c.es_final)
  const filtrar = (cards: MetricaRequerimiento[]) =>
    cards.filter(c => {
      if (filtros.search) {
        const q = filtros.search.toLowerCase()
        if (!(c.nombre_desarrollo ?? c.identificacion ?? '').toLowerCase().includes(q)) return false
      }
      if (filtros.alcances.length && !filtros.alcances.includes(c.alcance as any)) return false
      if (filtros.prioridades.length && !filtros.prioridades.includes(c.prioridad ?? 0)) return false
      if (filtros.responsable && c.responsable !== filtros.responsable) return false
      return true
    })

  return Object.fromEntries(
    activas.map(e => [e.nombre, filtrar(data[e.nombre] ?? [])])
  )
}

export function KanbanBoard({ isAdmin = false }: { isAdmin?: boolean }) {
  const { data: serverData, isLoading: loadingData } = useKanban(isAdmin)
  const { data: columnas = [], isLoading: loadingColumnas } = useEstadosKanban()
  const invalidar = useInvalidateKanban()

  const [localData, setLocalData] = useState<KanbanData | null>(null)
  const [activeCard, setActiveCard] = useState<MetricaRequerimiento | null>(null)
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null)
  const [observacion, setObservacion] = useState('')
  const [confirmando, setConfirmando] = useState(false)
  const [detailCard, setDetailCard] = useState<MetricaRequerimiento | null>(null)
  const [filtros, setFiltros] = useState<FiltrosKanban>(FILTROS_INIT)

  const data = localData ?? serverData
  const columnasActivas = useMemo(
    () => columnas.filter(c => c.activo && !c.es_final),
    [columnas]
  )

  const dataFiltrada = useMemo(
    () => (data && columnas.length ? aplicarFiltros(data, filtros, columnas) : null),
    [data, filtros, columnas]
  )

  const responsables = useMemo(() => {
    if (!data) return []
    const todos = columnasActivas.flatMap(c => data[c.nombre] ?? [])
      .map(c => c.responsable).filter(Boolean) as string[]
    return [...new Set(todos)].sort()
  }, [data, columnasActivas])

  const totalCards = data ? columnasActivas.reduce((s, c) => s + (data[c.nombre]?.length ?? 0), 0) : 0
  const visibles   = dataFiltrada ? columnasActivas.reduce((s, c) => s + (dataFiltrada[c.nombre]?.length ?? 0), 0) : 0

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  )

  const onDragStart = useCallback((event: DragStartEvent) => {
    setActiveCard((event.active.data.current?.card as MetricaRequerimiento) ?? null)
  }, [])

  const onDragEnd = useCallback((event: DragEndEvent) => {
    setActiveCard(null)
    const { active, over } = event
    if (!over || !data) return
    const card = active.data.current?.card as MetricaRequerimiento
    const fromEstado = card?.estado as string
    const toEstado   = over.id as string
    if (!card || fromEstado === toEstado) return
    setPendingMove({ card, fromEstado, toEstado })
    setObservacion('')
  }, [data])

  const confirmarCambio = async () => {
    if (!pendingMove) return
    const { card, fromEstado, toEstado } = pendingMove

    if (toEstado === 'STAND_BY' && !observacion.trim()) {
      toast.error('El motivo del stand by es requerido')
      return
    }

    setLocalData(prev => {
      const base = prev ?? data!
      const cardActualizada = { ...card, estado: toEstado }
      return {
        ...base,
        [fromEstado]: (base[fromEstado] ?? []).filter(c => c.id !== card.id),
        [toEstado]:   [cardActualizada, ...(base[toEstado] ?? [])],
      }
    })

    setPendingMove(null)
    setConfirmando(true)

    try {
      await cambiarEstado(card.id, toEstado, observacion || undefined)
      toast.success('Estado actualizado correctamente')
      invalidar()
      setLocalData(null)
    } catch (err: any) {
      setLocalData(null)
      toast.error('Error al actualizar el estado', { description: err?.message })
    } finally {
      setConfirmando(false)
      setObservacion('')
    }
  }

  const cancelarCambio = () => { setPendingMove(null); setObservacion('') }

  const isLoading = loadingData || loadingColumnas

  if (isLoading || !dataFiltrada) {
    return (
      <div className="flex gap-4 overflow-x-auto pb-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="w-[288px] shrink-0 rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
            <Skeleton className="h-6 w-32" />
            {Array.from({ length: 3 }).map((_, j) => <Skeleton key={j} className="h-28 w-full rounded-xl" />)}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <KanbanFiltros
        filtros={filtros} onChange={setFiltros}
        responsables={responsables} total={totalCards} visibles={visibles}
      />

      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {columnasActivas.map(estadoConfig => (
            <KanbanColumna
              key={estadoConfig.nombre}
              estadoConfig={estadoConfig}
              cards={dataFiltrada[estadoConfig.nombre] ?? []}
              onCardClick={setDetailCard}
            />
          ))}
        </div>

        <DragOverlay dropAnimation={null}>
          {activeCard && <KanbanCard card={activeCard} onCardClick={() => {}} isDragOverlay />}
        </DragOverlay>
      </DndContext>

      {/* Dialog confirmación estado */}
      <Dialog open={!!pendingMove} onOpenChange={open => !open && cancelarCambio()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Cambiar estado</DialogTitle></DialogHeader>
          {pendingMove && (() => {
            const fromCfg = getColores(pendingMove.fromEstado, columnas)
            const toCfg   = getColores(pendingMove.toEstado, columnas)
            return (
              <div className="space-y-4 py-1">
                <p className="text-sm text-slate-600">
                  ¿Cambiar <span className="font-semibold text-slate-800 line-clamp-1">
                    {pendingMove.card.nombre_desarrollo ?? pendingMove.card.identificacion}
                  </span>?
                </p>
                <div className="flex items-center gap-2 text-sm">
                  <span className={cn('rounded-full px-2.5 py-1 text-xs font-medium', fromCfg.bg, fromCfg.text)}>
                    {getLabel(pendingMove.fromEstado, columnas)}
                  </span>
                  <span className="text-slate-400">→</span>
                  <span className={cn('rounded-full px-2.5 py-1 text-xs font-medium', toCfg.bg, toCfg.text)}>
                    {getLabel(pendingMove.toEstado, columnas)}
                  </span>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="obs-kanban" className="text-sm">
                    {pendingMove.toEstado === 'STAND_BY'
                      ? <><span>Motivo del stand by</span> <span className="text-red-500">*</span></>
                      : 'Observación (opcional)'}
                  </Label>
                  <Textarea
                    id="obs-kanban" rows={3}
                    placeholder={pendingMove.toEstado === 'STAND_BY'
                      ? 'Describe el motivo...'
                      : 'Agrega una observación...'}
                    value={observacion}
                    onChange={e => setObservacion(e.target.value)}
                  />
                </div>
              </div>
            )
          })()}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={cancelarCambio} disabled={confirmando}>Cancelar</Button>
            <Button
              onClick={confirmarCambio}
              disabled={confirmando || (pendingMove?.toEstado === 'STAND_BY' && !observacion.trim())}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {confirmando ? 'Guardando...' : 'Confirmar cambio'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <KanbanCardDetail
        card={detailCard} open={!!detailCard}
        onOpenChange={open => !open && setDetailCard(null)}
      />
    </div>
  )
}
