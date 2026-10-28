'use client'

import { useMemo, useState } from 'react'
import { AlertTriangle, BadgeCheck, CalendarPlus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { PRIORIDADES_TICKET } from '@/lib/tickets/constantes'
import type { PrioridadTicket, TicketObjetivoTiempo } from '@/lib/tickets/types'
import {
  aprobarVersionObjetivos, crearVersionObjetivos, eliminarVersionObjetivos, type DatosConfigTickets,
} from '@/actions/tickets/configuracion'
import { Campo, Casilla, Seccion, claseInput, useAccion } from './comunes'

type Version = { fecha: string; filas: TicketObjetivoTiempo[]; aprobado: boolean }

function fmtFecha(iso: string) {
  const [a, m, d] = iso.split('-').map(Number)
  return new Date(a, m - 1, d).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** Ejemplo de la especificación, como punto de partida si no hay versiones */
const EJEMPLO: Record<PrioridadTicket, [number, number]> = { CRITICA: [1, 4], ALTA: [2, 8], MEDIA: [4, 16], BAJA: [8, 40] }

export function TabObjetivos({ datos }: { datos: DatosConfigTickets }) {
  const { objetivos, hoy } = datos
  const { pendiente, ejecutar } = useAccion()

  const versiones: Version[] = useMemo(() => {
    const porFecha = new Map<string, TicketObjetivoTiempo[]>()
    for (const o of objetivos) porFecha.set(o.vigente_desde, [...(porFecha.get(o.vigente_desde) ?? []), o])
    return [...porFecha.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([fecha, filas]) => ({ fecha, filas, aprobado: filas.every(f => f.aprobado) }))
  }, [objetivos])

  // Vigente por prioridad: la de mayor vigente_desde <= hoy
  const vigentes = PRIORIDADES_TICKET.map(p => ({
    p,
    o: objetivos
      .filter(o => o.prioridad === p.value && o.vigente_desde <= hoy)
      .sort((a, b) => b.vigente_desde.localeCompare(a.vigente_desde))[0],
  }))
  const sinDefinir = vigentes.filter(v => !v.o)
  const pendientes = vigentes.filter(v => v.o && !v.o.aprobado)

  const base = versiones.find(v => v.fecha <= hoy) ?? versiones[0]
  const inicial = Object.fromEntries(PRIORIDADES_TICKET.map(p => {
    const f = base?.filas.find(x => x.prioridad === p.value)
    return [p.value, f ? [f.horas_respuesta, f.horas_solucion] : EJEMPLO[p.value]]
  })) as Record<PrioridadTicket, [number, number]>

  const [nueva, setNueva] = useState<Record<PrioridadTicket, [number, number]>>(inicial)
  const [desde, setDesde] = useState(hoy)
  const [aprobada, setAprobada] = useState(false)
  const existeFecha = versiones.some(v => v.fecha === desde)

  const crear = () => ejecutar(
    () => crearVersionObjetivos({
      vigente_desde: desde,
      aprobado: aprobada,
      filas: PRIORIDADES_TICKET.map(p => ({ prioridad: p.value, horas_respuesta: nueva[p.value][0], horas_solucion: nueva[p.value][1] })),
    }),
    'Nueva versión de tiempos objetivo creada',
  )

  return (
    <div className="space-y-5">
      {(sinDefinir.length > 0 || pendientes.length > 0) && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <div>
            {sinDefinir.length > 0 && <p><strong>Sin tiempo objetivo vigente:</strong> {sinDefinir.map(v => v.p.label).join(', ')}. Esos tickets no se pueden medir contra un objetivo.</p>}
            {pendientes.length > 0 && (
              <p><strong>Pendientes de aprobación por la Dirección de TI:</strong> {pendientes.map(v => v.p.label).join(', ')}. Los indicadores se calculan con valores aún no aprobados.</p>
            )}
          </div>
        </div>
      )}

      <Seccion titulo="Tiempos objetivo vigentes" descripcion={`Horas hábiles. Vigentes al ${fmtFecha(hoy)}.`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50">
              <tr>{['Prioridad', 'Regla', 'Primera respuesta', 'Solución', 'Vigente desde', 'Estado'].map(h => <th key={h} className="px-3 py-2 text-left text-xs font-medium text-slate-400">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {vigentes.map(({ p, o }) => (
                <tr key={p.value}>
                  <td className="px-3 py-2"><span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', p.color)}>{p.label}</span></td>
                  <td className="px-3 py-2 text-xs text-slate-500">{p.regla}</td>
                  <td className="px-3 py-2 font-medium text-slate-700">{o ? `${o.horas_respuesta} h` : '—'}</td>
                  <td className="px-3 py-2 font-medium text-slate-700">{o ? `${o.horas_solucion} h` : '—'}</td>
                  <td className="px-3 py-2 text-slate-500">{o ? fmtFecha(o.vigente_desde) : '—'}</td>
                  <td className="px-3 py-2">
                    {!o ? <span className="text-xs text-slate-400">Por definir</span>
                      : o.aprobado ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700"><BadgeCheck size={13} /> Aprobado</span>
                        : <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700"><AlertTriangle size={13} /> Pendiente de aprobación</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Seccion>

      <Seccion
        titulo="Crear nueva versión"
        descripcion="Los tiempos no se sobrescriben: cada cambio es una versión con su fecha de inicio, para que las mediciones anteriores conserven el objetivo con el que se midieron."
      >
        <div className="space-y-3 p-4">
          <div className="overflow-x-auto">
            <table className="text-sm">
              <thead>
                <tr>{['Prioridad', 'Primera respuesta (h hábiles)', 'Solución (h hábiles)'].map(h => <th key={h} className="px-2 py-1 text-left text-xs font-medium text-slate-400">{h}</th>)}</tr>
              </thead>
              <tbody>
                {PRIORIDADES_TICKET.map(p => (
                  <tr key={p.value}>
                    <td className="px-2 py-1 font-medium text-slate-700">{p.label}</td>
                    {[0, 1].map(i => (
                      <td key={i} className="px-2 py-1">
                        <input
                          type="number" min={0.25} step={0.25} value={nueva[p.value][i]}
                          aria-label={`${i === 0 ? 'Respuesta' : 'Solución'} ${p.label}`}
                          onChange={e => {
                            const v = Number(e.target.value)
                            setNueva(prev => {
                              const fila: [number, number] = [...prev[p.value]]
                              fila[i] = v
                              return { ...prev, [p.value]: fila }
                            })
                          }}
                          className={cn(claseInput, 'w-32')}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <Campo etiqueta="Vigente desde" ayuda={existeFecha ? (desde > hoy ? 'Ya hay una versión programada para esa fecha: se reemplazará.' : 'Ya existe una versión con esa fecha; elige otra.') : undefined}>
              <input type="date" value={desde} min={hoy} onChange={e => setDesde(e.target.value)} className={cn(claseInput, 'w-44')} />
            </Campo>
            <div className="w-72"><Casilla checked={aprobada} onChange={setAprobada} etiqueta="Aprobado por la Dirección de TI" /></div>
            <Button onClick={crear} disabled={pendiente || !desde || (existeFecha && desde <= hoy)} className="gap-1">
              <CalendarPlus size={14} /> Crear versión
            </Button>
          </div>
        </div>
      </Seccion>

      <Seccion titulo="Historial de versiones">
        <ul className="divide-y divide-slate-100">
          {versiones.map(v => {
            const futura = v.fecha > hoy
            return (
              <li key={v.fecha} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                <div className="w-36">
                  <p className="text-sm font-medium text-slate-800">{fmtFecha(v.fecha)}</p>
                  <p className="text-[11px] text-slate-400">{futura ? 'Programada' : v.fecha === base?.fecha ? 'Vigente' : 'Anterior'}</p>
                </div>
                <div className="flex flex-1 flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                  {PRIORIDADES_TICKET.map(p => {
                    const f = v.filas.find(x => x.prioridad === p.value)
                    return <span key={p.value}><strong>{p.label}:</strong> {f ? `${f.horas_respuesta} h / ${f.horas_solucion} h` : '—'}</span>
                  })}
                </div>
                <button
                  onClick={() => ejecutar(() => aprobarVersionObjetivos(v.fecha, !v.aprobado), v.aprobado ? 'Aprobación retirada' : 'Versión aprobada')}
                  disabled={pendiente}
                  className={cn('rounded-full px-2.5 py-1 text-xs font-semibold', v.aprobado ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-amber-50 text-amber-700 hover:bg-amber-100')}
                  title={v.aprobado ? 'Quitar la marca de aprobación' : 'Marcar como aprobada por la Dirección de TI'}
                >
                  {v.aprobado ? 'Aprobada por Dirección de TI' : 'Pendiente · marcar aprobada'}
                </button>
                {futura && (
                  <button
                    onClick={() => { if (confirm('¿Eliminar esta versión programada?')) ejecutar(() => eliminarVersionObjetivos(v.fecha), 'Versión eliminada') }}
                    disabled={pendiente} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" title="Eliminar versión programada"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </li>
            )
          })}
          {!versiones.length && <li className="px-4 py-8 text-center text-sm text-slate-400">Aún no hay tiempos objetivo. Crea la primera versión arriba.</li>}
        </ul>
      </Seccion>
    </div>
  )
}
