'use client'

import { useState } from 'react'
import { Pencil, Plus, Save, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { TicketPlantilla, TicketPlantillaItem } from '@/lib/tickets/types'
import {
  eliminarItemPlantilla, eliminarPlantilla, guardarItemPlantilla, guardarPlantilla, moverItemPlantilla,
  type DatosConfigTickets,
} from '@/actions/tickets/configuracion'
import { BotonActivo, BotonesOrden, Seccion, claseInput, useAccion } from './comunes'

function SelectTipologia({
  datos, value, onChange,
}: { datos: DatosConfigTickets; value: string; onChange: (v: string) => void }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} className={claseInput} aria-label="Tipología">
      <option value="">Tipología…</option>
      {datos.categorias.map(c => {
        const ts = datos.tipologias.filter(t => t.categoria_id === c.id && (t.activa || t.id === value))
        if (!ts.length) return null
        return (
          <optgroup key={c.id} label={c.nombre}>
            {ts.map(t => <option key={t.id} value={t.id}>{t.nombre}{!t.activa ? ' (inactiva)' : ''}</option>)}
          </optgroup>
        )
      })}
    </select>
  )
}

function FilaItem({
  item, idx, total, datos,
}: { item: TicketPlantillaItem; idx: number; total: number; datos: DatosConfigTickets }) {
  const [editando, setEditando] = useState(false)
  const [tipologiaId, setTipologiaId] = useState(item.tipologia_id)
  const [asunto, setAsunto] = useState(item.asunto ?? '')
  const { pendiente, ejecutar } = useAccion()
  const tip = datos.tipologias.find(t => t.id === item.tipologia_id)
  const cat = datos.categorias.find(c => c.id === tip?.categoria_id)

  return (
    <li className="flex items-center gap-2 px-3 py-2">
      <BotonesOrden
        primero={idx === 0} ultimo={idx === total - 1} disabled={pendiente}
        onArriba={() => ejecutar(() => moverItemPlantilla(item.id, 'arriba'))}
        onAbajo={() => ejecutar(() => moverItemPlantilla(item.id, 'abajo'))}
      />
      {editando ? (
        <div className="grid flex-1 gap-2 sm:grid-cols-2">
          <SelectTipologia datos={datos} value={tipologiaId} onChange={setTipologiaId} />
          <input value={asunto} onChange={e => setAsunto(e.target.value)} placeholder="Asunto del ticket hijo" className={claseInput} />
        </div>
      ) : (
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-800">{asunto || tip?.nombre || 'Tipología eliminada'}</p>
          <p className={cn('text-[11px] text-slate-400', tip && !tip.activa && 'text-amber-600')}>
            {cat?.nombre ?? '—'} › {tip?.nombre ?? '—'}{tip && !tip.activa ? ' (inactiva: no se generará)' : ''}
          </p>
        </div>
      )}
      {editando ? (
        <>
          <button
            onClick={() => ejecutar(() => guardarItemPlantilla({ id: item.id, plantilla_id: item.plantilla_id, tipologia_id: tipologiaId, asunto }), 'Ticket hijo actualizado', () => setEditando(false))}
            disabled={pendiente || !tipologiaId} className="rounded p-1 text-blue-600 hover:bg-blue-50" aria-label="Guardar"
          >
            <Save size={14} />
          </button>
          <button onClick={() => { setTipologiaId(item.tipologia_id); setAsunto(item.asunto ?? ''); setEditando(false) }} className="rounded p-1 text-slate-400 hover:bg-slate-100" aria-label="Cancelar"><X size={14} /></button>
        </>
      ) : (
        <button onClick={() => setEditando(true)} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" title="Editar"><Pencil size={13} /></button>
      )}
      <button
        onClick={() => { if (confirm('¿Quitar este ticket hijo de la plantilla?')) ejecutar(() => eliminarItemPlantilla(item.id), 'Ticket hijo quitado') }}
        disabled={pendiente} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" title="Quitar"
      >
        <Trash2 size={13} />
      </button>
    </li>
  )
}

function TarjetaPlantilla({ plantilla, items, datos }: { plantilla: TicketPlantilla; items: TicketPlantillaItem[]; datos: DatosConfigTickets }) {
  const [editando, setEditando] = useState(false)
  const [nombre, setNombre] = useState(plantilla.nombre)
  const [descripcion, setDescripcion] = useState(plantilla.descripcion ?? '')
  const [nuevoTip, setNuevoTip] = useState('')
  const [nuevoAsunto, setNuevoAsunto] = useState('')
  const { pendiente, ejecutar } = useAccion()

  return (
    <Seccion
      titulo={plantilla.nombre}
      descripcion={`${items.length} ticket${items.length !== 1 ? 's' : ''} hijo${items.length !== 1 ? 's' : ''}${plantilla.descripcion ? ` · ${plantilla.descripcion}` : ''}`}
      acciones={
        <div className="flex items-center gap-1">
          <button onClick={() => setEditando(e => !e)} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" title="Editar nombre y descripción"><Pencil size={13} /></button>
          <button
            onClick={() => { if (confirm(`¿Eliminar la plantilla "${plantilla.nombre}"?`)) ejecutar(() => eliminarPlantilla(plantilla.id), 'Plantilla eliminada') }}
            disabled={pendiente} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" title="Eliminar (solo si no ha generado tickets)"
          >
            <Trash2 size={13} />
          </button>
          <BotonActivo
            activo={plantilla.activa} disabled={pendiente}
            onClick={() => ejecutar(() => guardarPlantilla({ ...plantilla, activa: !plantilla.activa }), plantilla.activa ? 'Plantilla desactivada' : 'Plantilla activada')}
          />
        </div>
      }
    >
      {editando && (
        <div className="grid gap-2 border-b border-slate-100 p-3 sm:grid-cols-[1fr_1fr_auto]">
          <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Nombre" className={claseInput} />
          <input value={descripcion} onChange={e => setDescripcion(e.target.value)} placeholder="Descripción" className={claseInput} />
          <Button size="sm" disabled={pendiente || !nombre.trim()}
            onClick={() => ejecutar(() => guardarPlantilla({ id: plantilla.id, nombre, descripcion, activa: plantilla.activa }), 'Plantilla actualizada', () => setEditando(false))}>
            Guardar
          </Button>
        </div>
      )}
      <ul className="divide-y divide-slate-50">
        {items.map((it, i) => <FilaItem key={it.id} item={it} idx={i} total={items.length} datos={datos} />)}
        {!items.length && <li className="px-4 py-6 text-center text-sm text-slate-400">Sin tickets hijos.</li>}
      </ul>
      <div className="grid gap-2 border-t border-slate-100 p-3 sm:grid-cols-[1fr_1fr_auto]">
        <SelectTipologia datos={datos} value={nuevoTip} onChange={setNuevoTip} />
        <input value={nuevoAsunto} onChange={e => setNuevoAsunto(e.target.value)} placeholder="Asunto (ej. Crear usuario y permisos en IGSI)" className={claseInput} />
        <Button size="sm" className="gap-1" disabled={pendiente || !nuevoTip}
          onClick={() => ejecutar(
            () => guardarItemPlantilla({ plantilla_id: plantilla.id, tipologia_id: nuevoTip, asunto: nuevoAsunto }),
            'Ticket hijo agregado',
            () => { setNuevoTip(''); setNuevoAsunto('') },
          )}>
          <Plus size={13} /> Agregar
        </Button>
      </div>
    </Seccion>
  )
}

export function TabPlantillas({ datos }: { datos: DatosConfigTickets }) {
  const [nombre, setNombre] = useState('')
  const { pendiente, ejecutar } = useAccion()
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3">
        <p className="flex-1 text-xs text-slate-500">
          Al usar una plantilla se crea un ticket padre y un ticket hijo por cada fila, con su tipología y asunto, en este orden.
        </p>
        <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Nueva plantilla (ej. Ingreso de personal)" className={cn(claseInput, 'w-72')} />
        <Button size="sm" className="gap-1" disabled={pendiente || !nombre.trim()}
          onClick={() => ejecutar(() => guardarPlantilla({ nombre, activa: true }), 'Plantilla creada', () => setNombre(''))}>
          <Plus size={13} /> Crear
        </Button>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        {datos.plantillas.map(p => (
          <TarjetaPlantilla key={p.id} plantilla={p} datos={datos} items={datos.plantillaItems.filter(i => i.plantilla_id === p.id)} />
        ))}
      </div>
      {!datos.plantillas.length && <p className="py-8 text-center text-sm text-slate-400">Aún no hay plantillas.</p>}
    </div>
  )
}
