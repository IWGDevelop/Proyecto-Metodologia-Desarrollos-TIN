'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ExternalLink, Pencil, ArrowRight, DollarSign } from 'lucide-react'
import { ESTADOS, PRIORIDADES, PROCESOS_INTERNOS } from '@/lib/constants'
import { formatFecha, formatFechaRelativa, formatCOP, cn } from '@/lib/utils'
import type { MetricaRequerimiento, HistorialEstado, Estado } from '@/lib/supabase/types'

interface Props {
  card: MetricaRequerimiento | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function KanbanCardDetail({ card, open, onOpenChange }: Props) {
  const { data: historial, isLoading: loadingHistorial } = useQuery<HistorialEstado[]>({
    queryKey: ['kanban-historial', card?.id],
    queryFn: async () => {
      if (!card?.id) return []
      const supabase = createClient()
      const { data } = await supabase
        .from('historial_estados')
        .select('*')
        .eq('requerimiento_id', card.id)
        .order('created_at', { ascending: false })
        .limit(3)
      return (data ?? []) as HistorialEstado[]
    },
    enabled: !!card?.id && open,
    staleTime: 30_000,
  })

  if (!card) return null

  const estadoCfg = ESTADOS[card.estado as Estado]
  const prioridadCfg = card.prioridad ? PRIORIDADES[card.prioridad] : null
  const procesoLabel = PROCESOS_INTERNOS.find(p => p.value === card.proceso_interno)?.label

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full max-w-md overflow-y-auto sm:max-w-lg">
        <SheetHeader className="space-y-3 pb-4">
          <div className="flex flex-wrap gap-2">
            <span className={cn('rounded-full px-2.5 py-1 text-xs font-semibold', estadoCfg.bgColor, estadoCfg.textColor)}>
              {estadoCfg.label}
            </span>
            {prioridadCfg && (
              <span className={cn('rounded-full px-2.5 py-1 text-xs font-bold', prioridadCfg.bgColor, prioridadCfg.textColor)}>
                P{card.prioridad} {prioridadCfg.label}
              </span>
            )}
            {card.alcance && (
              <Badge variant="outline" className={cn({
                'border-blue-300 text-blue-700': card.alcance === 'IWF',
                'border-green-300 text-green-700': card.alcance === 'ILT',
                'border-purple-300 text-purple-700': card.alcance === 'IWG',
              })}>
                {card.alcance}
              </Badge>
            )}
          </div>
          <SheetTitle className="text-base leading-snug">
            {card.nombre_desarrollo ?? card.identificacion}
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-4">
          {/* Info básica */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-1.5 text-sm">
            <InfoRow label="Responsable" valor={card.responsable} />
            <InfoRow label="Proceso" valor={procesoLabel} />
            <InfoRow label="Avance" valor={`${card.porcentaje_avance}%`} />
            <InfoRow label="Fecha solicitud" valor={formatFecha(card.fecha_solicitud)} />
            {card.dias_en_estado_actual != null && (
              <InfoRow label="Días en estado" valor={String(card.dias_en_estado_actual)} />
            )}
          </div>

          {/* Impacto económico */}
          {card.ahorro_anual_cop && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
              <div className="mb-2 flex items-center gap-1.5">
                <DollarSign size={14} className="text-emerald-600" />
                <p className="text-xs font-semibold text-emerald-700">Impacto económico</p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-emerald-600">Horas / mes</p>
                  <p className="font-bold text-emerald-700">{card.horas_ahorradas_mes?.toFixed(1) ?? 0} h</p>
                </div>
                <div>
                  <p className="text-emerald-600">Ahorro mensual</p>
                  <p className="font-bold text-emerald-700">{formatCOP(card.ahorro_mensual_cop)}</p>
                </div>
                <div className="col-span-2 rounded-lg bg-emerald-100 p-2 text-center">
                  <p className="text-xs text-emerald-600">Ahorro anual proyectado</p>
                  <p className="text-lg font-bold text-emerald-700">{formatCOP(card.ahorro_anual_cop)}</p>
                </div>
              </div>
            </div>
          )}

          {/* Historial */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Últimos cambios</p>
            {loadingHistorial ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : !historial?.length ? (
              <p className="text-xs text-slate-400">Sin historial de cambios</p>
            ) : (
              <ol className="space-y-1.5">
                {historial.map(h => {
                  const antCfg = h.estado_anterior ? ESTADOS[h.estado_anterior as Estado] : null
                  const nuevCfg = ESTADOS[h.estado_nuevo as Estado]
                  return (
                    <li key={h.id} className="flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs">
                      <div className="flex flex-wrap items-center gap-1">
                        {antCfg && <span className={cn('rounded-full px-1.5 py-0.5', antCfg.bgColor, antCfg.textColor)}>{antCfg.label}</span>}
                        {antCfg && <ArrowRight size={10} className="text-slate-400" />}
                        <span className={cn('rounded-full px-1.5 py-0.5', nuevCfg.bgColor, nuevCfg.textColor)}>{nuevCfg.label}</span>
                      </div>
                      <span className="ml-auto shrink-0 text-slate-400">{formatFechaRelativa(h.created_at)}</span>
                    </li>
                  )
                })}
              </ol>
            )}
          </div>

          {/* Acciones */}
          <div className="flex gap-2 pt-2">
            <Link href={`/requerimientos/${card.id}`} className="flex-1">
              <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs">
                <ExternalLink size={13} /> Ver detalle completo
              </Button>
            </Link>
            <Link href={`/requerimientos/${card.id}/editar`}>
              <Button size="sm" variant="outline" className="gap-1.5 text-xs">
                <Pencil size={13} /> Editar
              </Button>
            </Link>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function InfoRow({ label, valor }: { label: string; valor?: string | null }) {
  if (!valor) return null
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-700">{valor}</span>
    </div>
  )
}
