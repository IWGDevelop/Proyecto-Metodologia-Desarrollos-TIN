'use client'

import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { Progress } from '@/components/ui/progress'
import { DollarSign } from 'lucide-react'
import { PRIORIDADES, PROCESOS_INTERNOS, formatPrioridad } from '@/lib/constants'
import { formatCOP, cn } from '@/lib/utils'
import type { MetricaRequerimiento, Estado } from '@/lib/supabase/types'

const PRIORIDAD_BORDE: Record<number, string> = {
  1: 'border-l-red-500',
  2: 'border-l-orange-400',
  3: 'border-l-yellow-400',
  4: 'border-l-slate-300',
}

const ALCANCE_COLORS: Record<string, string> = {
  IWF: 'bg-blue-100 text-blue-700',
  ILT: 'bg-green-100 text-green-700',
  IWG: 'bg-purple-100 text-purple-700',
}

function Avatar({ nombre }: { nombre: string | null }) {
  if (!nombre) return null
  const iniciales = nombre.trim().split(/\s+/).map(n => n[0]).slice(0, 2).join('').toUpperCase()
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-700">
        {iniciales}
      </div>
      <span className="truncate text-xs text-slate-500">{nombre}</span>
    </div>
  )
}

interface Props {
  card: MetricaRequerimiento
  onCardClick: (card: MetricaRequerimiento) => void
  isDragOverlay?: boolean
}

export function KanbanCard({ card, onCardClick, isDragOverlay = false }: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: card.id,
    data: { estado: card.estado, card },
  })

  const style = isDragOverlay
    ? undefined
    : transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined

  const bordePrioridad = card.prioridad ? PRIORIDAD_BORDE[card.prioridad] : 'border-l-slate-200'
  const prioridadCfg = card.prioridad ? PRIORIDADES[card.prioridad] : null
  const procesoLabel = PROCESOS_INTERNOS.find(p => p.value === card.proceso_interno)?.label ?? card.proceso_interno

  const slaExcedido = card.cumple_sla === false
  const diasColor = slaExcedido ? 'text-red-600' : 'text-emerald-600'
  const diasPulse = slaExcedido ? 'animate-pulse' : ''

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={(e) => {
        if (!isDragging) onCardClick(card)
      }}
      className={cn(
        'w-[272px] shrink-0 rounded-xl border-l-4 border border-slate-200 bg-white p-3 shadow-sm',
        'cursor-grab select-none transition-all duration-150',
        'hover:shadow-md hover:border-slate-300',
        bordePrioridad,
        isDragging && !isDragOverlay && 'opacity-40 ring-2 ring-blue-300',
        isDragOverlay && 'shadow-2xl ring-2 ring-blue-400 cursor-grabbing rotate-1 scale-[1.02]',
      )}
    >
      {/* Header */}
      <div className="mb-2 flex items-center gap-1.5">
        {card.alcance && (
          <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-semibold', ALCANCE_COLORS[card.alcance])}>
            {card.alcance}
          </span>
        )}
        {card.numero && (
          <span className="text-[10px] font-mono text-slate-400">{card.numero}</span>
        )}
        <div className="ml-auto">
          {prioridadCfg && (
            <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-bold', prioridadCfg.bgColor, prioridadCfg.textColor)}>
              {formatPrioridad(card.prioridad, (card as any).sub_prioridad)}
            </span>
          )}
        </div>
      </div>

      {/* Nombre */}
      <p className="mb-1 line-clamp-2 text-sm font-semibold leading-snug text-slate-700">
        {card.nombre_desarrollo ?? card.identificacion}
      </p>

      {/* Proceso */}
      {procesoLabel && (
        <p className="mb-2 text-xs text-slate-400 capitalize line-clamp-1">
          {procesoLabel?.replace(/_/g, ' ').toLowerCase()}
        </p>
      )}

      {/* Responsable */}
      <div className="mb-3">
        <Avatar nombre={card.responsable} />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-2">
        {/* Progreso */}
        <div className="flex flex-1 items-center gap-1.5">
          <Progress value={card.porcentaje_avance} className="h-1.5 flex-1" />
          <span className="text-[10px] text-slate-400">{card.porcentaje_avance}%</span>
        </div>

        {/* Días en estado */}
        {card.dias_en_estado_actual != null && (
          <span className={cn('text-xs font-semibold tabular-nums', diasColor, diasPulse)}>
            {card.dias_en_estado_actual}d
          </span>
        )}
      </div>

      {/* Impacto económico */}
      {card.ahorro_mensual_cop && (
        <div className="mt-2 flex items-center gap-1 text-[10px] text-emerald-600">
          <DollarSign size={10} />
          <span className="font-semibold">{formatCOP(card.ahorro_mensual_cop)}/mes</span>
        </div>
      )}
    </div>
  )
}
