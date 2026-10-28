'use client'

import { useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import type { AmbitoCausa, TicketCausa } from '@/lib/tickets/types'
import {
  alternarCausa, eliminarCausa, guardarCausa, moverCausa, type DatosConfigTickets,
} from '@/actions/tickets/configuracion'
import { BotonActivo, BotonesOrden, Campo, Casilla, SelectNativo, Seccion, claseInput, useAccion } from './comunes'

const AMBITOS: { value: AmbitoCausa; label: string; descripcion: string; tipos: string[] }[] = [
  {
    value: 'IGSI', label: 'Novedades IGSI',
    descripcion: 'Técnica: el sistema no hace lo que debe. Conceptual: la novedad viene del uso o de la falta de validación del funcionario.',
    tipos: ['Técnica', 'Conceptual'],
  },
  { value: 'GENERAL', label: 'Demás tickets', descripcion: 'Causas de cierre para las tipologías que no son novedades IGSI.', tipos: [] },
]

type FormCausa = { id?: string; ambito: AmbitoCausa; tipo_causa: string; subcausa: string; activa: boolean }

function DialogoCausa({ inicial, tiposExistentes, onCerrar }: { inicial: FormCausa; tiposExistentes: string[]; onCerrar: () => void }) {
  const [f, setF] = useState(inicial)
  const { pendiente, ejecutar } = useAccion()
  const sugeridos = [...new Set([...(AMBITOS.find(a => a.value === f.ambito)?.tipos ?? []), ...tiposExistentes])]
  return (
    <Dialog open onOpenChange={o => !o && onCerrar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{f.id ? 'Editar causa' : 'Nueva causa de cierre'}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Campo etiqueta="Ámbito">
            <SelectNativo value={f.ambito} onChange={v => setF({ ...f, ambito: v as AmbitoCausa })} opciones={AMBITOS} />
          </Campo>
          <Campo etiqueta="Tipo de causa *" ayuda={f.ambito === 'IGSI' ? 'Para IGSI usa «Técnica» o «Conceptual»: así se calcula el indicador técnico vs. conceptual.' : undefined}>
            <input list="tipos-causa" value={f.tipo_causa} onChange={e => setF({ ...f, tipo_causa: e.target.value })} className={claseInput} />
            <datalist id="tipos-causa">{sugeridos.map(t => <option key={t} value={t} />)}</datalist>
          </Campo>
          <Campo etiqueta="Subcausa *">
            <input value={f.subcausa} onChange={e => setF({ ...f, subcausa: e.target.value })} className={claseInput} />
          </Campo>
          <Casilla checked={f.activa} onChange={v => setF({ ...f, activa: v })} etiqueta="Activa" ayuda="Las inactivas no se ofrecen al cerrar tickets." />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onCerrar}>Cancelar</Button>
          <Button
            disabled={pendiente || !f.tipo_causa.trim() || !f.subcausa.trim()}
            onClick={() => ejecutar(() => guardarCausa(f), f.id ? 'Causa actualizada' : 'Causa creada', onCerrar)}
          >
            {pendiente ? 'Guardando…' : 'Guardar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ListaAmbito({ ambito, causas, onEditar }: { ambito: (typeof AMBITOS)[number]; causas: TicketCausa[]; onEditar: (c: FormCausa) => void }) {
  const { pendiente, ejecutar } = useAccion()
  const tipos = [...new Set(causas.map(c => c.tipo_causa))]
  return (
    <Seccion
      titulo={`${ambito.label} (${causas.filter(c => c.activa).length} activas)`}
      descripcion={ambito.descripcion}
      acciones={
        <Button size="sm" className="gap-1" onClick={() => onEditar({ ambito: ambito.value, tipo_causa: ambito.tipos[0] ?? '', subcausa: '', activa: true })}>
          <Plus size={13} /> Nueva causa
        </Button>
      }
    >
      {tipos.map(tipo => (
        <div key={tipo}>
          <div className="bg-slate-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-600">{tipo}</div>
          <ul className="divide-y divide-slate-50">
            {causas.filter(c => c.tipo_causa === tipo).map(c => {
              const idx = causas.findIndex(x => x.id === c.id)
              return (
                <li key={c.id} className={cn('flex items-center gap-2 px-3 py-2', !c.activa && 'bg-slate-50/70')}>
                  <BotonesOrden
                    primero={idx === 0} ultimo={idx === causas.length - 1} disabled={pendiente}
                    onArriba={() => ejecutar(() => moverCausa(c.id, 'arriba'))}
                    onAbajo={() => ejecutar(() => moverCausa(c.id, 'abajo'))}
                  />
                  <span className={cn('flex-1 text-sm', c.activa ? 'text-slate-700' : 'text-slate-400 line-through')}>{c.subcausa}</span>
                  <button onClick={() => onEditar({ ...c })} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" title="Editar"><Pencil size={13} /></button>
                  <button
                    onClick={() => { if (confirm(`¿Eliminar la causa "${c.subcausa}"?`)) ejecutar(() => eliminarCausa(c.id), 'Causa eliminada') }}
                    disabled={pendiente} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" title="Eliminar (solo si no se ha usado)"
                  >
                    <Trash2 size={13} />
                  </button>
                  <BotonActivo activo={c.activa} disabled={pendiente} onClick={() => ejecutar(() => alternarCausa(c.id, !c.activa), c.activa ? 'Causa desactivada' : 'Causa activada')} />
                </li>
              )
            })}
          </ul>
        </div>
      ))}
      {!causas.length && <p className="px-4 py-8 text-center text-sm text-slate-400">Sin causas registradas.</p>}
    </Seccion>
  )
}

export function TabCausas({ datos }: { datos: DatosConfigTickets }) {
  const [editando, setEditando] = useState<FormCausa | null>(null)
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {AMBITOS.map(a => (
        <ListaAmbito key={a.value} ambito={a} causas={datos.causas.filter(c => c.ambito === a.value)} onEditar={setEditando} />
      ))}
      {editando && (
        <DialogoCausa
          inicial={editando}
          tiposExistentes={[...new Set(datos.causas.filter(c => c.ambito === editando.ambito).map(c => c.tipo_causa))]}
          onCerrar={() => setEditando(null)}
        />
      )}
    </div>
  )
}
