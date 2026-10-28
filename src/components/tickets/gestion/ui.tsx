import { cn } from '@/lib/utils'
import { ESTADOS_TICKET, PRIORIDADES_TICKET } from '@/lib/tickets/constantes'
import type { EstadoTicket, PrioridadTicket } from '@/lib/tickets/types'

// Piezas visuales compartidas de la gestión de tickets (sin estado).

export function EstadoBadge({ estado, className }: { estado: EstadoTicket; className?: string }) {
  const cfg = ESTADOS_TICKET.find(e => e.value === estado)
  return (
    <span className={cn('inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold', cfg?.color, className)}>
      {cfg?.label ?? estado}
    </span>
  )
}

export function PrioridadBadge({ prioridad, className }: { prioridad: PrioridadTicket; className?: string }) {
  const cfg = PRIORIDADES_TICKET.find(p => p.value === prioridad)
  return (
    <span className={cn('inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold', cfg?.color, className)}>
      {cfg?.label ?? prioridad}
    </span>
  )
}

/** Semáforo del tiempo consumido: verde < 50 %, ámbar < 100 %, rojo ≥ 100 % */
export function Semaforo({ porcentaje, vencido, titulo }: { porcentaje: number | null; vencido?: boolean; titulo?: string }) {
  if (porcentaje == null) {
    return vencido
      ? <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-700"><span className="h-2.5 w-2.5 rounded-full bg-red-500" />Vencido</span>
      : <span className="text-xs text-slate-300">—</span>
  }
  const color = vencido || porcentaje >= 100 ? 'bg-red-500' : porcentaje >= 50 ? 'bg-amber-400' : 'bg-emerald-500'
  return (
    <span className="inline-flex items-center gap-1.5 text-xs tabular-nums text-slate-600" title={titulo}>
      <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', color)} />
      {porcentaje}%
    </span>
  )
}

export function formatFechaHora(fecha: string | null | undefined): string {
  if (!fecha) return '—'
  return new Date(fecha).toLocaleString('es-CO', {
    timeZone: 'America/Bogota',
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export function formatFechaCorta(fecha: string | null | undefined): string {
  if (!fecha) return '—'
  // Fechas sin hora (YYYY-MM-DD) se muestran tal cual para no correr el día por zona horaria
  if (/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    const [y, m, d] = fecha.split('-').map(Number)
    return new Date(y, m - 1, d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
  }
  return new Date(fecha).toLocaleDateString('es-CO', { timeZone: 'America/Bogota', day: '2-digit', month: 'short', year: 'numeric' })
}

export const inputCls = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:opacity-60'
export const btnPrimario = 'inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50'
export const btnSecundario = 'inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50'
