'use client'

import { useState } from 'react'
import { Plus, Save, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { guardarParametrosTickets, type DatosConfigTickets } from '@/actions/tickets/configuracion'
import { Campo, Seccion, claseInput, claseTextarea, textoALista, useAccion } from './comunes'

type FilaServicio = { servicio: string; modalidades: string }

export function TabParametros({ datos }: { datos: DatosConfigTickets }) {
  const c = datos.config
  const [coord, setCoord] = useState(c.emailsCoordinador.join('\n'))
  const [direc, setDirec] = useState(c.emailsDireccion.join('\n'))
  const [dias, setDias] = useState(String(c.diasCierreAutomatico))
  const [hora, setHora] = useState(c.horaResumenDiario)
  const [sedes, setSedes] = useState(c.sedes.join('\n'))
  const [umbral, setUmbral] = useState(String(c.umbralCapacitacion))
  const [servicios, setServicios] = useState<FilaServicio[]>(
    Object.entries(c.serviciosIGSI).map(([servicio, ms]) => ({ servicio, modalidades: ms.join(', ') })),
  )
  const { pendiente, ejecutar } = useAccion()

  const guardar = () => ejecutar(
    () => guardarParametrosTickets({
      emailsCoordinador: textoALista(coord),
      emailsDireccion: textoALista(direc),
      diasCierreAutomatico: Number(dias),
      horaResumenDiario: hora,
      sedes: sedes.split('\n').map(s => s.trim()).filter(Boolean),
      serviciosIGSI: Object.fromEntries(
        servicios.filter(s => s.servicio.trim()).map(s => [s.servicio.trim(), textoALista(s.modalidades)]),
      ),
      umbralCapacitacion: Number(umbral),
    }),
    'Parámetros guardados',
  )

  const setServ = (i: number, cambio: Partial<FilaServicio>) =>
    setServicios(prev => prev.map((s, k) => (k === i ? { ...s, ...cambio } : s)))

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-2">
        <Seccion titulo="Destinatarios de escalamiento" descripcion="Un correo por línea. Reciben los recordatorios dirigidos a «Coordinador TIN» y «Dirección de TI».">
          <div className="grid gap-3 p-4 sm:grid-cols-2">
            <Campo etiqueta="Correos del Coordinador TIN">
              <textarea rows={4} value={coord} onChange={e => setCoord(e.target.value)} className={claseTextarea} />
            </Campo>
            <Campo etiqueta="Correos de la Dirección de TI">
              <textarea rows={4} value={direc} onChange={e => setDirec(e.target.value)} className={claseTextarea} />
            </Campo>
          </div>
        </Seccion>

        <Seccion titulo="Automatismos">
          <div className="grid gap-3 p-4 sm:grid-cols-3">
            <Campo etiqueta="Días para cierre automático" ayuda="Días hábiles en Resuelto o en espera de usuario sin respuesta.">
              <input type="number" min={1} max={60} value={dias} onChange={e => setDias(e.target.value)} className={claseInput} />
            </Campo>
            <Campo etiqueta="Hora del resumen diario" ayuda="Correo a cada responsable con sus tickets abiertos.">
              <input type="time" value={hora} onChange={e => setHora(e.target.value)} className={claseInput} />
            </Campo>
            <Campo etiqueta="Umbral de capacitación" ayuda="Novedades conceptuales del mismo funcionario en 30 días que sugieren capacitación.">
              <input type="number" min={1} value={umbral} onChange={e => setUmbral(e.target.value)} className={claseInput} />
            </Campo>
          </div>
        </Seccion>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_2fr]">
        <Seccion titulo="Sedes" descripcion="Una por línea. Se ofrecen al asignar la sede de cada usuario.">
          <div className="p-4">
            <textarea rows={8} value={sedes} onChange={e => setSedes(e.target.value)} className={claseTextarea} />
          </div>
        </Seccion>

        <Seccion
          titulo="Servicios y modalidades de IGSI"
          descripcion="Listas del formulario de Novedades IGSI: la modalidad depende del servicio elegido. Separa las modalidades con coma."
          acciones={
            <Button size="sm" variant="outline" className="gap-1" onClick={() => setServicios(s => [...s, { servicio: '', modalidades: '' }])}>
              <Plus size={13} /> Servicio
            </Button>
          }
        >
          <ul className="divide-y divide-slate-50">
            {servicios.map((s, i) => (
              <li key={i} className="grid items-center gap-2 px-3 py-2 sm:grid-cols-[220px_1fr_auto]">
                <input value={s.servicio} onChange={e => setServ(i, { servicio: e.target.value })} placeholder="Servicio" aria-label="Servicio" className={cn(claseInput, 'font-medium')} />
                <input value={s.modalidades} onChange={e => setServ(i, { modalidades: e.target.value })} placeholder="Modalidades, separadas por coma" aria-label="Modalidades" className={claseInput} />
                <button onClick={() => setServicios(prev => prev.filter((_, k) => k !== i))} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" title="Quitar servicio">
                  <Trash2 size={13} />
                </button>
              </li>
            ))}
            {!servicios.length && <li className="px-4 py-6 text-center text-sm text-slate-400">Sin servicios. Agrega el primero.</li>}
          </ul>
        </Seccion>
      </div>

      <div className="sticky bottom-0 flex justify-end border-t border-slate-200 bg-white/90 py-3 backdrop-blur">
        <Button onClick={guardar} disabled={pendiente} className="gap-1.5">
          <Save size={14} /> {pendiente ? 'Guardando…' : 'Guardar parámetros'}
        </Button>
      </div>
    </div>
  )
}
