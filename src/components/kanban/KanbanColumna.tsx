'use client'

import { useDroppable } from '@dnd-kit/core'
import { AlertTriangle } from 'lucide-react'
import { ESTADOS } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { KanbanCard } from './KanbanCard'
import type { MetricaRequerimiento, Estado } from '@/lib/supabase/types'

const ICONOS_ESTADO: Record<Estado, string> = {
  SIN_GESTION:     '📥',
  ANALISIS:        '🔍',
  EN_DESARROLLO:   '⚡',
  PRUEBAS_USUARIO: '🧪',
  STAND_BY:        '⏸',
  ENTREGADO:       '✅',
  CERRADO:         '🔒',
}

const WIP_LIMITS: Partial<Record<Estado, { limit: number; color: string; msg: string }>> = {
  EN_DESARROLLO:   { limit: 5, color: 'text-orange-600 bg-orange-50 border-orange-200', msg: '⚠ Límite recomendado' },
  PRUEBAS_USUARIO: { limit: 4, color: 'text-yellow-700 bg-yellow-50 border-yellow-200', msg: '⚠ Límite recomendado' },
}

interface Props {
  estado: Estado
  cards: MetricaRequerimiento[]
  onCardClick: (card: MetricaRequerimiento) => void
}

export function KanbanColumna({ estado, cards, onCardClick }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: estado })
  const cfg = ESTADOS[estado]
  const wip = WIP_LIMITS[estado]
  const wipSuperado = wip && cards.length > wip.limit

  return (
    <div className="flex w-[288px] shrink-0 flex-col rounded-xl border border-slate-200 bg-slate-50 overflow-hidden">
      {/* Header */}
      <div className="px-3 pt-3 pb-2 bg-white border-b border-slate-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base">{ICONOS_ESTADO[estado]}</span>
            <span className="text-sm font-semibold text-slate-700">{cfg.label}</span>
          </div>
          <span className={cn(
            'flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-bold',
            cfg.bgColor, cfg.textColor
          )}>
            {cards.length}
          </span>
        </div>

        {/* WIP indicator */}
        {wipSuperado && wip && (
          <div className={cn('mt-2 flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs font-medium', wip.color)}>
            <AlertTriangle size={11} />
            {wip.msg} ({cards.length}/{wip.limit})
          </div>
        )}
      </div>

      {/* Drop area */}
      <div
        ref={setNodeRef}
        className={cn(
          'flex flex-1 flex-col gap-2.5 overflow-y-auto p-2.5 transition-colors',
          'min-h-[120px]',
          isOver && 'bg-blue-50 ring-2 ring-inset ring-blue-300'
        )}
      >
        {cards.length === 0 ? (
          <div className={cn(
            'flex h-20 items-center justify-center rounded-xl border-2 border-dashed text-xs text-slate-400',
            isOver ? 'border-blue-400 bg-blue-50 text-blue-500' : 'border-slate-200'
          )}>
            {isOver ? 'Soltar aquí' : 'Sin requerimientos aquí'}
          </div>
        ) : (
          cards.map(card => (
            <KanbanCard
              key={card.id}
              card={card}
              onCardClick={onCardClick}
            />
          ))
        )}
      </div>
    </div>
  )
}
