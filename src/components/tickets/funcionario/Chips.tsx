import {
  ESTADOS_TICKET,
  PRIORIDADES_TICKET,
  TIPOS_GESTION,
} from '@/lib/tickets/constantes'
import type { EstadoTicket, PrioridadTicket, TipoGestion } from '@/lib/tickets/types'
import { cn } from '@/lib/utils'

export function EstadoChip({ estado, className }: { estado: EstadoTicket; className?: string }) {
  const cfg = ESTADOS_TICKET.find(e => e.value === estado)
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap', cfg?.color, className)}>
      {cfg?.label ?? estado}
    </span>
  )
}

export function PrioridadChip({ prioridad, className }: { prioridad: PrioridadTicket; className?: string }) {
  const cfg = PRIORIDADES_TICKET.find(p => p.value === prioridad)
  return (
    <span title={cfg?.regla} className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold whitespace-nowrap', cfg?.color, className)}>
      {cfg?.label ?? prioridad}
    </span>
  )
}

export function TipoGestionChip({ tipo, className }: { tipo: TipoGestion | null; className?: string }) {
  if (!tipo) return null
  const cfg = TIPOS_GESTION.find(t => t.value === tipo)
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap', cfg?.color, className)}>
      {cfg?.label ?? tipo}
    </span>
  )
}

/** Fecha sin hora (YYYY-MM-DD) → DD/MM/YYYY, sin conversión de zona horaria */
export function fechaSolo(f: string | null | undefined): string {
  if (!f) return '—'
  const [a, m, d] = f.slice(0, 10).split('-')
  return d && m && a ? `${d}/${m}/${a}` : f
}

/** Fecha y hora en la zona horaria de Colombia */
export function fechaHora(f: string | null | undefined): string {
  if (!f) return '—'
  try {
    return new Date(f).toLocaleString('es-CO', {
      timeZone: 'America/Bogota', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return f
  }
}

export function fechaCorta(f: string | null | undefined): string {
  if (!f) return '—'
  try {
    return new Date(f).toLocaleDateString('es-CO', { timeZone: 'America/Bogota', day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch {
    return f
  }
}
