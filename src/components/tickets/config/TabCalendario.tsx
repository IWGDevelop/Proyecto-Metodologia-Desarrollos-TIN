'use client'

import { useState } from 'react'
import { Plus, Save, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { HorarioLaboral } from '@/lib/tickets/types'
import {
  eliminarDiaCalendario, guardarDiaCalendario, guardarHorarioLaboral, type DatosConfigTickets,
} from '@/actions/tickets/configuracion'
import { Campo, Seccion, SelectNativo, claseInput, useAccion } from './comunes'

const DIAS = [
  { n: 1, label: 'Lun' }, { n: 2, label: 'Mar' }, { n: 3, label: 'Mié' }, { n: 4, label: 'Jue' },
  { n: 5, label: 'Vie' }, { n: 6, label: 'Sáb' }, { n: 0, label: 'Dom' },
]

function fmtFecha(iso: string) {
  const [a, m, d] = iso.split('-').map(Number)
  return new Date(a, m - 1, d).toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' })
}

function hhmm(v: string | null | undefined) {
  return v ? v.slice(0, 5) : ''
}

function HorarioGeneral({ horario }: { horario: HorarioLaboral }) {
  const [h, setH] = useState<HorarioLaboral>({
    ...horario, almuerzo_inicio: horario.almuerzo_inicio ?? '', almuerzo_fin: horario.almuerzo_fin ?? '',
  })
  const { pendiente, ejecutar } = useAccion()
  const alternarDia = (n: number) => setH(prev => ({
    ...prev, dias: prev.dias.includes(n) ? prev.dias.filter(d => d !== n) : [...prev.dias, n],
  }))

  const horasDia = (() => {
    const min = (x: string) => { const [a, b] = x.split(':').map(Number); return a * 60 + b }
    if (!h.inicio || !h.fin) return 0
    let t = min(h.fin) - min(h.inicio)
    if (h.almuerzo_inicio && h.almuerzo_fin) t -= min(h.almuerzo_fin) - min(h.almuerzo_inicio)
    return Math.max(0, t / 60)
  })()

  return (
    <Seccion
      titulo="Horario laboral general"
      descripcion="Base para medir todos los tiempos en horas hábiles (zona horaria Bogotá)."
      acciones={
        <Button size="sm" className="gap-1" disabled={pendiente} onClick={() => ejecutar(() => guardarHorarioLaboral(h), 'Horario guardado')}>
          <Save size={13} /> Guardar horario
        </Button>
      }
    >
      <div className="space-y-4 p-4">
        <div>
          <p className="mb-1.5 text-xs font-medium text-slate-600">Días hábiles</p>
          <div className="flex flex-wrap gap-1.5">
            {DIAS.map(d => (
              <button
                key={d.n} type="button" onClick={() => alternarDia(d.n)}
                className={cn('w-12 rounded-lg border py-1.5 text-xs font-semibold', h.dias.includes(d.n) ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-400 hover:bg-slate-50')}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Campo etiqueta="Inicio de jornada"><input type="time" value={h.inicio} onChange={e => setH({ ...h, inicio: e.target.value })} className={claseInput} /></Campo>
          <Campo etiqueta="Fin de jornada"><input type="time" value={h.fin} onChange={e => setH({ ...h, fin: e.target.value })} className={claseInput} /></Campo>
          <Campo etiqueta="Inicio almuerzo"><input type="time" value={h.almuerzo_inicio ?? ''} onChange={e => setH({ ...h, almuerzo_inicio: e.target.value })} className={claseInput} /></Campo>
          <Campo etiqueta="Fin almuerzo"><input type="time" value={h.almuerzo_fin ?? ''} onChange={e => setH({ ...h, almuerzo_fin: e.target.value })} className={claseInput} /></Campo>
        </div>
        <p className="text-xs text-slate-500">
          {horasDia.toLocaleString('es-CO', { maximumFractionDigits: 2 })} horas hábiles por día · {h.dias.length} días por semana.
          Deja el almuerzo vacío si no se descuenta.
        </p>
      </div>
    </Seccion>
  )
}

function Excepciones({ calendario, hoy }: { calendario: DatosConfigTickets['calendario']; hoy: string }) {
  const anioActual = Number(hoy.slice(0, 4))
  const anios = [...new Set([anioActual, anioActual + 1, ...calendario.map(d => Number(d.fecha.slice(0, 4)))])].sort()
  const [anio, setAnio] = useState(anioActual)
  const [nuevo, setNuevo] = useState({ fecha: '', es_habil: false, hora_inicio: '08:00', hora_fin: '12:00', descripcion: '' })
  const { pendiente, ejecutar } = useAccion()
  const delAnio = calendario.filter(d => d.fecha.startsWith(String(anio)))

  const agregar = () => ejecutar(
    () => guardarDiaCalendario(nuevo),
    'Fecha guardada',
    () => setNuevo(n => ({ ...n, fecha: '', descripcion: '' })),
  )

  return (
    <Seccion
      titulo="Festivos y jornadas especiales"
      descripcion="Excepciones al horario general: festivos (no hábiles) o días con horario distinto."
      acciones={
        <SelectNativo className="w-28" value={String(anio)} onChange={v => setAnio(Number(v))} ariaLabel="Año"
          opciones={anios.map(a => ({ value: String(a), label: String(a) }))} />
      }
    >
      <div className="flex flex-wrap items-end gap-2 border-b border-slate-100 p-3">
        <Campo etiqueta="Fecha"><input type="date" value={nuevo.fecha} onChange={e => setNuevo({ ...nuevo, fecha: e.target.value })} className={cn(claseInput, 'w-40')} /></Campo>
        <Campo etiqueta="Tipo">
          <SelectNativo className="w-44" value={nuevo.es_habil ? 'si' : 'no'} onChange={v => setNuevo({ ...nuevo, es_habil: v === 'si' })}
            opciones={[{ value: 'no', label: 'Festivo / no hábil' }, { value: 'si', label: 'Jornada especial' }]} />
        </Campo>
        {nuevo.es_habil && (
          <>
            <Campo etiqueta="Desde"><input type="time" value={nuevo.hora_inicio} onChange={e => setNuevo({ ...nuevo, hora_inicio: e.target.value })} className={cn(claseInput, 'w-28')} /></Campo>
            <Campo etiqueta="Hasta"><input type="time" value={nuevo.hora_fin} onChange={e => setNuevo({ ...nuevo, hora_fin: e.target.value })} className={cn(claseInput, 'w-28')} /></Campo>
          </>
        )}
        <Campo etiqueta="Descripción" className="min-w-[180px] flex-1">
          <input value={nuevo.descripcion} onChange={e => setNuevo({ ...nuevo, descripcion: e.target.value })} placeholder="Ej. Día de la Independencia" className={claseInput} />
        </Campo>
        <Button size="sm" className="gap-1" disabled={!nuevo.fecha || pendiente} onClick={agregar}><Plus size={13} /> Agregar</Button>
      </div>
      <ul className="divide-y divide-slate-50">
        {delAnio.map(d => (
          <li key={d.fecha} className="flex items-center gap-3 px-4 py-2 text-sm">
            <span className="w-32 font-medium capitalize text-slate-700">{fmtFecha(d.fecha)}</span>
            <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', d.es_habil ? 'bg-blue-50 text-blue-700' : 'bg-red-50 text-red-700')}>
              {d.es_habil ? `Jornada ${hhmm(d.hora_inicio)}–${hhmm(d.hora_fin)}` : 'No hábil'}
            </span>
            <span className="flex-1 text-slate-500">{d.descripcion ?? ''}</span>
            <button
              onClick={() => ejecutar(() => eliminarDiaCalendario(d.fecha), 'Fecha quitada')}
              disabled={pendiente} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" title="Quitar"
            >
              <Trash2 size={13} />
            </button>
          </li>
        ))}
        {!delAnio.length && <li className="px-4 py-8 text-center text-sm text-slate-400">Sin excepciones registradas para {anio}.</li>}
      </ul>
    </Seccion>
  )
}

export function TabCalendario({ datos }: { datos: DatosConfigTickets }) {
  return (
    <div className="space-y-5">
      <HorarioGeneral horario={datos.config.horarioLaboral} />
      <Excepciones calendario={datos.calendario} hoy={datos.hoy} />
    </div>
  )
}
