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
import { ESTADOS, PRIORIDADES } from '@/lib/constants'
import { cambiarEstado } from '@/actions/requerimientos'
import { useKanban, useInvalidateKanban, COLUMNAS_KANBAN, type KanbanData } from '@/hooks/useKanban'
import { cn } from '@/lib/utils'
import type { MetricaRequerimiento, Estado } from '@/lib/supabase/types'

interface PendingMove {
  card: MetricaRequerimiento
  fromEstado: Estado
  toEstado: Estado
}

const FILTROS_INIT: FiltrosKanban = { search: '', alcances: [], prioridades: [], responsable: '' }

function aplicarFiltros(data: KanbanData, filtros: FiltrosKanban): KanbanData {
  const filtrar = (cards: MetricaRequerimiento[]) =>
    cards.filter(c => {
      if (filtros.search) {
        const q = filtros.search.toLowerCase()
        const nombre = (c.nombre_desarrollo ?? c.identificacion ?? '').toLowerCase()
        if (!nombre.includes(q)) return false
      }
      if (filtros.alcances.length && !filtros.alcances.includes(c.alcance as any)) return false
      if (filtros.prioridades.length && !filtros.prioridades.includes(c.prioridad ?? 0)) return false
      if (filtros.responsable && c.responsable !== filtros.responsable) return false
      return true
    })

  return Object.fromEntries(
    COLUMNAS_KANBAN.map(e => [e, filtrar(data[e] ?? [])])
  ) as KanbanData
}

export function KanbanBoard() {
  const { data: serverData, isLoading } = useKanban()
  const invalidar = useInvalidateKanban()

  const [localData, setLocalData] = useState<KanbanData | null>(null)
  const [activeCard, setActiveCard] = useState<MetricaRequerimiento | null>(null)
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null)
  const [observacion, setObservacion] = useState('')
  const [confirmando, setConfirmando] = useState(false)
  const [detailCard, setDetailCard] = useState<MetricaRequerimiento | null>(null)
  const [filtros, setFiltros] = useState<FiltrosKanban>(FILTROS_INIT)

  // Datos efectivos: localData (optimista) o serverData
  const data = localData ?? serverData

  // Filtros aplicados
  const dataFiltrada = useMemo(
    () => (data ? aplicarFiltros(data, filtros) : null),
    [data, filtros]
  )

  // Responsables únicos para el select
  const responsables = useMemo(() => {
    if (!data) return []
    const todos = COLUMNAS_KANBAN.flatMap(e => data[e] ?? [])
      .map(c => c.responsable).filter(Boolean) as string[]
    return [...new Set(todos)].sort()
  }, [data])

  const totalCards = data ? COLUMNAS_KANBAN.reduce((s, e) => s + (data[e]?.length ?? 0), 0) : 0
  const visibles = dataFiltrada ? COLUMNAS_KANBAN.reduce((s, e) => s + (dataFiltrada[e]?.length ?? 0), 0) : 0

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  )

  // ─── Drag handlers ───────────────────────────────────────────────────────
  const onDragStart = useCallback((event: DragStartEvent) => {
    const card = event.active.data.current?.card as MetricaRequerimiento
    setActiveCard(card ?? null)
  }, [])

  const onDragEnd = useCallback((event: DragEndEvent) => {
    setActiveCard(null)
    const { active, over } = event
    if (!over || !data) return

    const card = active.data.current?.card as MetricaRequerimiento
    const fromEstado = card?.estado as Estado
    const toEstado = over.id as Estado

    if (!card || fromEstado === toEstado) return

    setPendingMove({ card, fromEstado, toEstado })
    setObservacion('')
  }, [data])

  // ─── Confirmar cambio de estado ───────────────────────────────────────────
  const confirmarCambio = async () => {
    if (!pendingMove) return
    const { card, fromEstado, toEstado } = pendingMove

    if (toEstado === 'STAND_BY' && !observacion.trim()) {
      toast.error('El motivo del stand by es requerido')
      return
    }

    // Update optimista
    setLocalData(prev => {
      const base = prev ?? data!
      const cardActualizada = { ...card, estado: toEstado }
      return {
        ...base,
        [fromEstado]: base[fromEstado].filter(c => c.id !== card.id),
        [toEstado]: [cardActualizada, ...base[toEstado]],
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
      // Revertir
      setLocalData(null)
      toast.error('Error al actualizar el estado', { description: err?.message })
    } finally {
      setConfirmando(false)
      setObservacion('')
    }
  }

  const cancelarCambio = () => {
    setPendingMove(null)
    setObservacion('')
  }

  // ─── Loading ──────────────────────────────────────────────────────────────
  if (isLoading || !dataFiltrada) {
    return (
      <div className="flex gap-4 overflow-x-auto pb-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="w-[288px] shrink-0 rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
            <Skeleton className="h-6 w-32" />
            {Array.from({ length: 3 }).map((_, j) => (
              <Skeleton key={j} className="h-28 w-full rounded-xl" />
            ))}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col gap-3">
      {/* Filtros */}
      <KanbanFiltros
        filtros={filtros}
        onChange={setFiltros}
        responsables={responsables}
        total={totalCards}
        visibles={visibles}
      />

      {/* Board */}
      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {COLUMNAS_KANBAN.map(estado => (
            <KanbanColumna
              key={estado}
              estado={estado}
              cards={dataFiltrada[estado] ?? []}
              onCardClick={setDetailCard}
            />
          ))}
        </div>

        {/* Overlay — card flotante durante el arrastre */}
        <DragOverlay dropAnimation={null}>
          {activeCard && (
            <KanbanCard
              card={activeCard}
              onCardClick={() => {}}
              isDragOverlay
            />
          )}
        </DragOverlay>
      </DndContext>

      {/* Dialog de confirmación de cambio de estado */}
      <Dialog
        open={!!pendingMove}
        onOpenChange={open => !open && cancelarCambio()}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cambiar estado</DialogTitle>
          </DialogHeader>

          {pendingMove && (
            <div className="space-y-4 py-1">
              <p className="text-sm text-slate-600">
                ¿Cambiar{' '}
                <span className="font-semibold text-slate-800 line-clamp-1">
                  {pendingMove.card.nombre_desarrollo ?? pendingMove.card.identificacion}
                </span>
              </p>
              <div className="flex items-center gap-2 text-sm">
                <span className={cn(
                  'rounded-full px-2.5 py-1 text-xs font-medium',
                  ESTADOS[pendingMove.fromEstado].bgColor,
                  ESTADOS[pendingMove.fromEstado].textColor
                )}>
                  {ESTADOS[pendingMove.fromEstado].label}
                </span>
                <span className="text-slate-400">→</span>
                <span className={cn(
                  'rounded-full px-2.5 py-1 text-xs font-medium',
                  ESTADOS[pendingMove.toEstado].bgColor,
                  ESTADOS[pendingMove.toEstado].textColor
                )}>
                  {ESTADOS[pendingMove.toEstado].label}
                </span>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="obs-kanban" className="text-sm">
                  {pendingMove.toEstado === 'STAND_BY'
                    ? <>Motivo del stand by <span className="text-red-500">*</span></>
                    : 'Observación (opcional)'}
                </Label>
                <Textarea
                  id="obs-kanban"
                  rows={3}
                  placeholder={
                    pendingMove.toEstado === 'STAND_BY'
                      ? 'Describe el motivo por el que entra en stand by...'
                      : 'Agrega una observación al cambio de estado...'
                  }
                  value={observacion}
                  onChange={e => setObservacion(e.target.value)}
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={cancelarCambio} disabled={confirmando}>
              Cancelar
            </Button>
            <Button
              onClick={confirmarCambio}
              disabled={
                confirmando ||
                (pendingMove?.toEstado === 'STAND_BY' && !observacion.trim())
              }
              className="bg-blue-600 hover:bg-blue-700"
            >
              {confirmando ? 'Guardando...' : 'Confirmar cambio'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sheet de detalle */}
      <KanbanCardDetail
        card={detailCard}
        open={!!detailCard}
        onOpenChange={open => !open && setDetailCard(null)}
      />
    </div>
  )
}
