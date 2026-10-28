'use client'

import { useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { DESTINATARIOS_RECORDATORIO, DISPARADORES_RECORDATORIO } from '@/lib/tickets/constantes'
import type { AccionRecordatorio, CanalRecordatorio, DisparadorRecordatorio, TicketReglaRecordatorio } from '@/lib/tickets/types'
import {
  alternarReglaRecordatorio, eliminarReglaRecordatorio, guardarReglaRecordatorio, moverReglaRecordatorio,
  type DatosConfigTickets, type ReglaInput,
} from '@/actions/tickets/configuracion'
import { BotonActivo, BotonesOrden, Campo, Casilla, SelectNativo, Seccion, claseInput, claseTextarea, useAccion } from './comunes'

const CANALES: { value: CanalRecordatorio; label: string }[] = [
  { value: 'APP', label: 'Aviso en TIN-FLOW' },
  { value: 'CORREO', label: 'Correo' },
  { value: 'AMBOS', label: 'Aviso en TIN-FLOW y correo' },
]
const ACCIONES: { value: AccionRecordatorio; label: string }[] = [
  { value: 'MARCAR_RESPUESTA_VENCIDA', label: 'Marcar respuesta vencida' },
  { value: 'MARCAR_VENCIDO', label: 'Marcar ticket vencido' },
  { value: 'CIERRE_AUTOMATICO', label: 'Cerrar automáticamente' },
]
const LABEL_DEST = Object.fromEntries(DESTINATARIOS_RECORDATORIO.map(d => [d.value, d.label])) as Record<string, string>
const LABEL_CANAL = Object.fromEntries(CANALES.map(c => [c.value, c.label])) as Record<string, string>
const LABEL_ACCION = Object.fromEntries(ACCIONES.map(a => [a.value, a.label])) as Record<string, string>

const usaPorcentaje = (d: DisparadorRecordatorio) => d === 'RESPUESTA' || d === 'SOLUCION'
const usaDias = (d: DisparadorRecordatorio) => d === 'ESPERA_USUARIO' || d === 'ESPERA_APROBACION' || d === 'FECHA_REQUERIDA'

function momento(r: Pick<TicketReglaRecordatorio, 'disparador' | 'porcentaje' | 'dias_habiles'>) {
  switch (r.disparador) {
    case 'RESPUESTA': return `${r.porcentaje ?? '?'}% del tiempo de respuesta sin responder`
    case 'SOLUCION': return `${r.porcentaje ?? '?'}% del tiempo de solución`
    case 'ESPERA_USUARIO': return `${r.dias_habiles ?? '?'} día(s) hábil(es) en espera de usuario`
    case 'ESPERA_APROBACION': return `${r.dias_habiles ?? '?'} día(s) hábil(es) en espera de aprobación`
    case 'FECHA_REQUERIDA': return `${r.dias_habiles ?? '?'} día(s) hábil(es) antes de la fecha requerida`
    case 'RESUMEN_DIARIO': return 'Resumen diario'
  }
}

function DialogoRegla({ inicial, onCerrar }: { inicial: ReglaInput; onCerrar: () => void }) {
  const [f, setF] = useState<ReglaInput>(inicial)
  const { pendiente, ejecutar } = useAccion()
  const set = <K extends keyof ReglaInput>(k: K, v: ReglaInput[K]) => setF(prev => ({ ...prev, [k]: v }))
  const alternarDest = (d: ReglaInput['destinatarios'][number]) =>
    set('destinatarios', f.destinatarios.includes(d) ? f.destinatarios.filter(x => x !== d) : [...f.destinatarios, d])

  return (
    <Dialog open onOpenChange={o => !o && onCerrar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader><DialogTitle>{f.id ? 'Editar regla de recordatorio' : 'Nueva regla de recordatorio'}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Campo etiqueta="Nombre *"><input value={f.nombre} onChange={e => set('nombre', e.target.value)} className={claseInput} /></Campo>
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo etiqueta="Disparador">
              <SelectNativo value={f.disparador} onChange={v => set('disparador', v as DisparadorRecordatorio)} opciones={DISPARADORES_RECORDATORIO} />
            </Campo>
            {usaPorcentaje(f.disparador) && (
              <Campo etiqueta="Porcentaje del tiempo objetivo">
                <input type="number" min={1} step={5} value={f.porcentaje ?? ''} onChange={e => set('porcentaje', e.target.value === '' ? null : Number(e.target.value))} className={claseInput} />
              </Campo>
            )}
            {usaDias(f.disparador) && (
              <Campo etiqueta="Días hábiles">
                <input type="number" min={0} step={0.5} value={f.dias_habiles ?? ''} onChange={e => set('dias_habiles', e.target.value === '' ? null : Number(e.target.value))} className={claseInput} />
              </Campo>
            )}
            {f.disparador === 'RESUMEN_DIARIO' && (
              <p className="self-end text-xs text-slate-500">La hora del resumen se define en Parámetros.</p>
            )}
          </div>
          <div>
            <p className="mb-1.5 text-xs font-medium text-slate-600">Destinatarios *</p>
            <div className="flex flex-wrap gap-1.5">
              {DESTINATARIOS_RECORDATORIO.map(d => (
                <button
                  key={d.value} type="button" onClick={() => alternarDest(d.value)}
                  className={cn('rounded-full border px-2.5 py-1 text-xs font-medium', f.destinatarios.includes(d.value) ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50')}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo etiqueta="Canal">
              <SelectNativo value={f.canal} onChange={v => set('canal', v as CanalRecordatorio)} opciones={CANALES} />
            </Campo>
            <Campo etiqueta="Acción adicional">
              <SelectNativo value={f.accion ?? ''} onChange={v => set('accion', (v || null) as AccionRecordatorio | null)} placeholder="Ninguna" opciones={ACCIONES} />
            </Campo>
          </div>
          <Campo
            etiqueta="Contenido del mensaje"
            ayuda="Texto que acompaña el aviso o el correo (qué se le informa o pide al destinatario)."
          >
            <textarea rows={4} value={f.plantilla ?? ''} onChange={e => set('plantilla', e.target.value)} className={claseTextarea} />
          </Campo>
          <Casilla checked={f.activa} onChange={v => set('activa', v)} etiqueta="Activa" />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onCerrar}>Cancelar</Button>
          <Button
            disabled={pendiente || !f.nombre.trim() || !f.destinatarios.length}
            onClick={() => ejecutar(() => guardarReglaRecordatorio(f), f.id ? 'Regla actualizada' : 'Regla creada', onCerrar)}
          >
            {pendiente ? 'Guardando…' : 'Guardar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function TabRecordatorios({ datos }: { datos: DatosConfigTickets }) {
  const { reglas } = datos
  const [editando, setEditando] = useState<ReglaInput | null>(null)
  const { pendiente, ejecutar } = useAccion()

  return (
    <>
      <Seccion
        titulo="Reglas de recordatorio y escalamiento"
        descripcion="El proceso automático las evalúa en este orden. Una regla que ya envió recordatorios no se borra: se desactiva."
        acciones={
          <Button size="sm" className="gap-1" onClick={() => setEditando({
            nombre: '', disparador: 'RESPUESTA', porcentaje: 50, dias_habiles: null, destinatarios: ['RESPONSABLE'],
            canal: 'AMBOS', plantilla: '', accion: null, activa: true,
          })}>
            <Plus size={13} /> Nueva regla
          </Button>
        }
      >
        <ul className="divide-y divide-slate-50">
          {reglas.map((r, i) => (
            <li key={r.id} className={cn('flex items-start gap-2 px-3 py-2.5', !r.activa && 'bg-slate-50/70')}>
              <BotonesOrden
                primero={i === 0} ultimo={i === reglas.length - 1} disabled={pendiente}
                onArriba={() => ejecutar(() => moverReglaRecordatorio(r.id, 'arriba'))}
                onAbajo={() => ejecutar(() => moverReglaRecordatorio(r.id, 'abajo'))}
              />
              <div className="min-w-0 flex-1">
                <p className={cn('text-sm font-medium', r.activa ? 'text-slate-800' : 'text-slate-400 line-through')}>{r.nombre}</p>
                <p className="text-xs text-slate-500">{momento(r)}</p>
                <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-400">
                  <span>A: {r.destinatarios.map(d => LABEL_DEST[d] ?? d).join(', ')}</span>
                  <span>{LABEL_CANAL[r.canal]}</span>
                  {r.accion && <span className="font-medium text-amber-700">{LABEL_ACCION[r.accion]}</span>}
                  <span className="font-mono">{r.codigo}</span>
                </p>
              </div>
              <button onClick={() => setEditando({ ...r })} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" title="Editar"><Pencil size={13} /></button>
              <button
                onClick={() => { if (confirm(`¿Eliminar la regla "${r.nombre}"?`)) ejecutar(() => eliminarReglaRecordatorio(r.id), 'Regla eliminada') }}
                disabled={pendiente} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" title="Eliminar (solo si no ha enviado recordatorios)"
              >
                <Trash2 size={13} />
              </button>
              <BotonActivo activo={r.activa} disabled={pendiente} onClick={() => ejecutar(() => alternarReglaRecordatorio(r.id, !r.activa), r.activa ? 'Regla desactivada' : 'Regla activada')} />
            </li>
          ))}
          {!reglas.length && <li className="px-4 py-8 text-center text-sm text-slate-400">Sin reglas de recordatorio.</li>}
        </ul>
      </Seccion>
      {editando && <DialogoRegla inicial={editando} onCerrar={() => setEditando(null)} />}
    </>
  )
}
