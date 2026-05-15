'use client'

import { useDroppable } from '@dnd-kit/core'
import { AlertTriangle } from 'lucide-react'
import { COLOR_PALETTE } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { KanbanCard } from './KanbanCard'
import type { MetricaRequerimiento, EstadoKanban } from '@/lib/supabase/types'

const WIP_LIMITS: Record<string, number> = {
  EN_DESARROLLO:   5,
  PRUEBAS_USUARIO: 4,
}

interface Props {
  estadoConfig: EstadoKanban
  cards: MetricaRequerimiento[]
  onCardClick: (card: MetricaRequerimiento) => void
}

export function KanbanColumna({ estadoConfig, cards, onCardClick }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: estadoConfig.nombre })
  const colores = COLOR_PALETTE[estadoConfig.color_key] ?? COLOR_PALETTE['slate']
  const wipLimit = WIP_LIMITS[estadoConfig.nombre]
  const wipSuperado = wipLimit !== undefined && cards.length > wipLimit

  return (
    <div className="flex w-[288px] shrink-0 flex-col rounded-xl border border-slate-200 bg-slate-50 overflow-hidden">
      {/* Header */}
      <div className="px-3 pt-3 pb-2 bg-white border-b border-slate-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base">{estadoConfig.icono}</span>
            <span className="text-sm font-semibold text-slate-700">{estadoConfig.label}</span>
          </div>
          <span className={cn(
            'flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-bold',
            colores.bg, colores.text
          )}>
            {cards.length}
          </span>
        </div>

        {wipSuperado && wipLimit && (
          <div className="mt-2 flex items-center gap-1.5 rounded-lg border border-orange-200 bg-orange-50 px-2 py-1 text-xs font-medium text-orange-600">
            <AlertTriangle size={11} />
            ⚠ Límite recomendado ({cards.length}/{wipLimit})
          </div>
        )}
      </div>

      {/* Drop area */}
      <div
        ref={setNodeRef}
        className={cn(
          'flex flex-1 flex-col gap-2.5 overflow-y-auto p-2.5 transition-colors min-h-[120px]',
          isOver && 'bg-blue-50 ring-2 ring-inset ring-blue-300'
        )}
      >
        {cards.length === 0 ? (
          <div className={cn(
            'flex h-20 items-center justify-center rounded-xl border-2 border-dashed text-xs text-slate-400',
            isOver ? 'border-blue-400 bg-blue-50 text-blue-500' : 'border-slate-200'
          )}>
            {isOver ? 'Soltar aquí' : 'Sin requerimientos'}
          </div>
        ) : (
          cards.map(card => (
            <KanbanCard key={card.id} card={card} onCardClick={onCardClick} />
          ))
        )}
      </div>
    </div>
  )
}
