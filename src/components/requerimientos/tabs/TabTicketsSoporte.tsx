import Link from 'next/link'
import { LifeBuoy, Plus } from 'lucide-react'
import { ESTADOS_TICKET } from '@/lib/tickets/constantes'
import type { TicketDeRequerimiento } from '@/lib/tickets/requerimientos'
import { cn, formatFecha } from '@/lib/utils'

interface Props {
  requerimientoId: string
  tickets: TicketDeRequerimiento[]
  /** El requerimiento está entregado o cerrado: se pueden abrir tickets relacionados */
  puedeAbrir: boolean
  /** Ruta base del detalle del ticket (/admin/tickets o /mis-tickets) */
  rutaTicket: string
}

/** Tickets de soporte abiertos sobre un requerimiento después de su entrega o cierre */
export function TabTicketsSoporte({ requerimientoId, tickets, puedeAbrir, rutaTicket }: Props) {
  const abiertos = tickets.filter(t => t.estado !== 'CERRADO').length
  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <LifeBuoy size={15} className="text-violet-500" /> Tickets de soporte relacionados
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            {tickets.length === 0
              ? 'Aún no se han abierto tickets sobre este desarrollo.'
              : `${tickets.length} ticket${tickets.length === 1 ? '' : 's'} · ${abiertos} sin cerrar`}
          </p>
        </div>
        {puedeAbrir ? (
          <Link
            href={`/mis-tickets/nuevo?requerimiento=${requerimientoId}`}
            className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-700"
          >
            <Plus size={14} /> Abrir ticket relacionado
          </Link>
        ) : (
          <p className="max-w-xs text-right text-xs text-slate-400">
            Se pueden abrir tickets relacionados cuando el requerimiento esté entregado o cerrado.
          </p>
        )}
      </div>

      {tickets.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-400">
                <th className="px-2 py-2 font-medium">Ticket</th>
                <th className="px-2 py-2 font-medium">Asunto</th>
                <th className="px-2 py-2 font-medium">Tipología</th>
                <th className="px-2 py-2 font-medium">Solicitante</th>
                <th className="px-2 py-2 font-medium">Estado</th>
                <th className="px-2 py-2 font-medium">Abierto</th>
                <th className="px-2 py-2 font-medium">Cerrado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {tickets.map(t => {
                const est = ESTADOS_TICKET.find(e => e.value === t.estado)
                return (
                  <tr key={t.id} className="hover:bg-slate-50">
                    <td className="px-2 py-2">
                      <Link href={`${rutaTicket}/${t.id}`} className="font-mono text-xs font-semibold text-blue-700 hover:underline">{t.codigo}</Link>
                    </td>
                    <td className="max-w-[320px] px-2 py-2"><span className="line-clamp-2 text-slate-700">{t.asunto}</span></td>
                    <td className="px-2 py-2 text-xs text-slate-500">{t.categoria} · {t.tipologia}</td>
                    <td className="px-2 py-2 text-xs text-slate-600">{t.solicitante ?? '—'}</td>
                    <td className="px-2 py-2">
                      <span className={cn('whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold', est?.color)}>{est?.label ?? t.estado}</span>
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 text-xs text-slate-500">{formatFecha(t.fecha_creacion)}</td>
                    <td className="whitespace-nowrap px-2 py-2 text-xs text-slate-500">{t.fecha_cierre ? formatFecha(t.fecha_cierre) : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
