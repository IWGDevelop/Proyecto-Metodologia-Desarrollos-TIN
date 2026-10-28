'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Search, Ticket, CornerDownRight } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { ESTADOS_TICKET } from '@/lib/tickets/constantes'
import { cn } from '@/lib/utils'
import { EstadoChip, PrioridadChip, fechaCorta, fechaSolo } from './Chips'
import type { MiTicketFila } from './tipos'

type FiltroEstado = 'ABIERTOS' | 'TODOS' | MiTicketFila['estado']

export function MisTicketsLista({ tickets, estadoInicial }: { tickets: MiTicketFila[]; estadoInicial?: string }) {
  const [estado, setEstado] = useState<FiltroEstado>(
    (estadoInicial && (estadoInicial === 'TODOS' || estadoInicial === 'ABIERTOS' || ESTADOS_TICKET.some(e => e.value === estadoInicial))
      ? estadoInicial
      : 'ABIERTOS') as FiltroEstado,
  )
  const [q, setQ] = useState('')

  const conteo = useMemo(() => {
    const m = new Map<string, number>()
    for (const t of tickets) m.set(t.estado, (m.get(t.estado) ?? 0) + 1)
    return m
  }, [tickets])

  const filtrados = useMemo(() => {
    const texto = q.trim().toLowerCase()
    return tickets.filter(t => {
      if (estado === 'ABIERTOS' && t.estado === 'CERRADO') return false
      if (estado !== 'ABIERTOS' && estado !== 'TODOS' && t.estado !== estado) return false
      if (!texto) return true
      return [t.codigo, t.asunto, t.categoria, t.tipologia, t.responsable ?? ''].some(x => x.toLowerCase().includes(texto))
    })
  }, [tickets, estado, q])

  const pills: { value: FiltroEstado; label: string; n: number }[] = [
    { value: 'ABIERTOS', label: 'Abiertos', n: tickets.filter(t => t.estado !== 'CERRADO').length },
    ...ESTADOS_TICKET.filter(e => conteo.has(e.value)).map(e => ({ value: e.value as FiltroEstado, label: e.label, n: conteo.get(e.value) ?? 0 })),
    { value: 'TODOS', label: 'Todos', n: tickets.length },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {pills.map(p => (
            <button
              key={p.value}
              type="button"
              onClick={() => setEstado(p.value)}
              className={cn(
                'rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                estado === p.value ? 'bg-blue-600 text-white' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
              )}
            >
              {p.label} <span className="opacity-70">({p.n})</span>
            </button>
          ))}
        </div>
        <div className="relative sm:w-72">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Buscar por código, asunto o tipología"
            className="h-9 pl-8"
            aria-label="Buscar tickets"
          />
        </div>
      </div>

      {filtrados.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white py-12 text-center">
          <Ticket size={28} className="mx-auto text-slate-300" />
          <p className="mt-2 text-sm text-slate-500">
            {tickets.length === 0 ? 'Aún no has creado tickets.' : 'Ningún ticket coincide con los filtros.'}
          </p>
          {tickets.length === 0 && (
            <Link href="/mis-tickets/nuevo" className="mt-3 inline-block text-sm font-medium text-blue-600 hover:underline">
              Crear mi primer ticket
            </Link>
          )}
        </div>
      ) : (
        <>
          {/* Tabla en pantallas medianas y grandes */}
          <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white md:block">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2.5">Código</th>
                  <th className="px-3 py-2.5">Asunto</th>
                  <th className="px-3 py-2.5">Categoría / tipología</th>
                  <th className="px-3 py-2.5">Estado</th>
                  <th className="px-3 py-2.5">Prioridad</th>
                  <th className="px-3 py-2.5">Responsable</th>
                  <th className="px-3 py-2.5">Creado</th>
                  <th className="px-3 py-2.5">Fecha requerida</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtrados.map(t => (
                  <tr key={t.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2.5 font-mono text-xs">
                      <Link href={`/mis-tickets/${t.id}`} className="font-semibold text-blue-700 hover:underline">{t.codigo}</Link>
                    </td>
                    <td className="max-w-xs px-3 py-2.5">
                      <Link href={`/mis-tickets/${t.id}`} className="line-clamp-2 font-medium text-slate-800 hover:text-blue-700">
                        {t.es_hijo && <CornerDownRight size={12} className="mr-1 inline text-slate-400" />}
                        {t.asunto}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 text-xs">
                      <p className="text-slate-500">{t.categoria}</p>
                      <p className="font-medium text-slate-700">{t.tipologia}</p>
                    </td>
                    <td className="px-3 py-2.5"><EstadoChip estado={t.estado} /></td>
                    <td className="px-3 py-2.5"><PrioridadChip prioridad={t.prioridad} /></td>
                    <td className="px-3 py-2.5 text-xs text-slate-600">{t.responsable ?? <span className="text-slate-400">Sin asignar</span>}</td>
                    <td className="px-3 py-2.5 text-xs text-slate-600">{fechaCorta(t.fecha_creacion)}</td>
                    <td className="px-3 py-2.5 text-xs text-slate-600">{fechaSolo(t.fecha_requerida)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Tarjetas en móvil */}
          <div className="space-y-3 md:hidden">
            {filtrados.map(t => (
              <Link key={t.id} href={`/mis-tickets/${t.id}`} className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-semibold text-blue-700">{t.codigo}</span>
                  <EstadoChip estado={t.estado} className="ml-auto" />
                </div>
                <p className="mt-1.5 font-medium text-slate-800">{t.asunto}</p>
                <p className="mt-0.5 text-xs text-slate-500">{t.categoria} · {t.tipologia}</p>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                  <PrioridadChip prioridad={t.prioridad} />
                  <span>{t.responsable ?? 'Sin asignar'}</span>
                  <span>Creado {fechaCorta(t.fecha_creacion)}</span>
                  {t.fecha_requerida && <span>Requerido {fechaSolo(t.fecha_requerida)}</span>}
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
