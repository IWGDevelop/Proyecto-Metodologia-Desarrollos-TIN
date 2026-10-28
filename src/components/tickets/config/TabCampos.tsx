'use client'

import { useState } from 'react'
import {
  DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { CalendarClock, Eye, GripVertical, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { IMPACTOS_TICKET, TIPOS_DATO_CAMPO } from '@/lib/tickets/constantes'
import type { TicketCampoTipologia, TicketTipologia } from '@/lib/tickets/types'
import {
  alternarCampo, eliminarCampo, guardarCampo, reordenarCampos,
  type CampoInput, type DatosConfigTickets,
} from '@/actions/tickets/configuracion'
import { BotonActivo, Campo, Casilla, SelectNativo, Seccion, claseInput, claseTextarea, textoALista, useAccion } from './comunes'

const LABEL_TIPO_DATO = Object.fromEntries(TIPOS_DATO_CAMPO.map(t => [t.value, t.label])) as Record<string, string>

/** Misma regla que el servidor; solo para mostrar la clave que se generará */
function clavePrevia(etiqueta: string) {
  return etiqueta.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 50)
}

// ── Diálogo de campo ─────────────────────────────────────────────────────────

type FormCampo = CampoInput & { clave?: string; opcionesTexto: string }

function DialogoCampo({ inicial, onCerrar }: { inicial: FormCampo; onCerrar: () => void }) {
  const [f, setF] = useState<FormCampo>(inicial)
  const { pendiente, ejecutar } = useAccion()
  const set = <K extends keyof FormCampo>(k: K, v: FormCampo[K]) => setF(prev => ({ ...prev, [k]: v }))

  const guardar = () => ejecutar(
    () => guardarCampo({
      id: f.id, tipologia_id: f.tipologia_id, etiqueta: f.etiqueta, tipo_dato: f.tipo_dato, obligatorio: f.obligatorio,
      opciones: f.tipo_dato === 'LISTA' ? textoALista(f.opcionesTexto) : null, ayuda: f.ayuda,
      es_fecha_requerida: f.tipo_dato === 'FECHA' && f.es_fecha_requerida, activo: f.activo,
    }),
    f.id ? 'Campo actualizado' : 'Campo creado',
    onCerrar,
  )

  return (
    <Dialog open onOpenChange={o => !o && onCerrar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>{f.id ? 'Editar campo' : 'Nuevo campo'}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Campo
            etiqueta="Etiqueta *"
            ayuda={f.id
              ? `Clave: ${f.clave} (no cambia al renombrar, para no romper exportes e informes)`
              : `Clave que se generará: ${clavePrevia(f.etiqueta) || '—'}`}
          >
            <input autoFocus value={f.etiqueta} onChange={e => set('etiqueta', e.target.value)} className={claseInput} />
          </Campo>
          <Campo etiqueta="Tipo de dato">
            <SelectNativo value={f.tipo_dato} onChange={v => set('tipo_dato', v as FormCampo['tipo_dato'])} opciones={TIPOS_DATO_CAMPO} />
          </Campo>
          {f.tipo_dato === 'LISTA' && (
            <Campo etiqueta="Opciones *" ayuda="Una por línea.">
              <textarea rows={4} value={f.opcionesTexto} onChange={e => set('opcionesTexto', e.target.value)} className={claseTextarea} />
            </Campo>
          )}
          <Campo etiqueta="Ayuda" ayuda="Texto corto bajo el campo, para orientar al funcionario.">
            <input value={f.ayuda ?? ''} onChange={e => set('ayuda', e.target.value)} className={claseInput} />
          </Campo>
          <div className="grid gap-2 sm:grid-cols-2">
            <Casilla checked={f.obligatorio} onChange={v => set('obligatorio', v)} etiqueta="Obligatorio" />
            <Casilla checked={f.activo} onChange={v => set('activo', v)} etiqueta="Activo" />
            <Casilla
              checked={f.tipo_dato === 'FECHA' && f.es_fecha_requerida}
              disabled={f.tipo_dato !== 'FECHA'}
              onChange={v => set('es_fecha_requerida', v)}
              etiqueta="Es la fecha requerida"
              ayuda="Su valor se copia a la fecha requerida del ticket. Máximo uno por tipología: si otro campo la tenía, se le quita."
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onCerrar}>Cancelar</Button>
          <Button onClick={guardar} disabled={pendiente || !f.etiqueta.trim()}>{pendiente ? 'Guardando…' : 'Guardar'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Fila ordenable ───────────────────────────────────────────────────────────

function FilaCampo({
  campo, onEditar, pendiente, onAlternar, onEliminar,
}: {
  campo: TicketCampoTipologia
  onEditar: () => void
  pendiente: boolean
  onAlternar: () => void
  onEliminar: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: campo.id })
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn('flex items-center gap-2 bg-white px-3 py-2', !campo.activo && 'bg-slate-50/70', isDragging && 'relative z-10 shadow-md')}
    >
      <button type="button" {...attributes} {...listeners} className="cursor-grab rounded p-1 text-slate-300 hover:text-slate-600 active:cursor-grabbing" aria-label="Arrastrar para reordenar">
        <GripVertical size={14} />
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={cn('text-sm font-medium', campo.activo ? 'text-slate-800' : 'text-slate-400 line-through')}>{campo.etiqueta}</span>
          {campo.obligatorio && <span className="text-xs font-bold text-red-500">*</span>}
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">{LABEL_TIPO_DATO[campo.tipo_dato]}</span>
          {campo.es_fecha_requerida && (
            <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
              <CalendarClock size={10} /> Fecha requerida
            </span>
          )}
        </div>
        <p className="font-mono text-[10px] text-slate-400">{campo.clave}{campo.tipo_dato === 'LISTA' && campo.opciones?.length ? ` · ${campo.opciones.join(' / ')}` : ''}</p>
      </div>
      <button onClick={onEditar} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" title="Editar"><Pencil size={13} /></button>
      <button onClick={onEliminar} disabled={pendiente} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" title="Eliminar (solo si no tiene respuestas)"><Trash2 size={13} /></button>
      <BotonActivo activo={campo.activo} disabled={pendiente} onClick={onAlternar} textos={['Activo', 'Inactivo']} />
    </li>
  )
}

function ListaCampos({ tipologiaId, campos, onEditar }: { tipologiaId: string; campos: TicketCampoTipologia[]; onEditar: (c: TicketCampoTipologia) => void }) {
  const [orden, setOrden] = useState(campos.map(c => c.id))
  const { pendiente, ejecutar } = useAccion()
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const porId = new Map(campos.map(c => [c.id, c]))

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const nuevo = arrayMove(orden, orden.indexOf(String(active.id)), orden.indexOf(String(over.id)))
    setOrden(nuevo)
    ejecutar(() => reordenarCampos(tipologiaId, nuevo), undefined)
  }

  if (!campos.length) {
    return <p className="px-4 py-8 text-center text-sm text-slate-400">Esta tipología no tiene campos específicos. El funcionario verá solo los campos comunes.</p>
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={orden} strategy={verticalListSortingStrategy}>
        <ul className="divide-y divide-slate-50">
          {orden.map(id => {
            const c = porId.get(id)
            if (!c) return null
            return (
              <FilaCampo
                key={id} campo={c} pendiente={pendiente}
                onEditar={() => onEditar(c)}
                onAlternar={() => ejecutar(() => alternarCampo(c.id, !c.activo), c.activo ? 'Campo desactivado' : 'Campo activado')}
                onEliminar={() => { if (confirm(`¿Eliminar el campo "${c.etiqueta}"?`)) ejecutar(() => eliminarCampo(c.id), 'Campo eliminado') }}
              />
            )
          })}
        </ul>
      </SortableContext>
    </DndContext>
  )
}

// ── Vista previa ─────────────────────────────────────────────────────────────

function ControlPrevio({ campo }: { campo: TicketCampoTipologia }) {
  switch (campo.tipo_dato) {
    case 'TEXTO_LARGO':
      return <textarea rows={3} className={claseTextarea} />
    case 'NUMERO':
      return <input type="number" className={claseInput} />
    case 'FECHA':
      return <input type="date" className={claseInput} />
    case 'LISTA':
      return (
        <select className={claseInput} defaultValue="">
          <option value="">Seleccionar…</option>
          {(campo.opciones ?? []).map(o => <option key={o}>{o}</option>)}
        </select>
      )
    case 'CASILLA':
      return <input type="checkbox" className="h-4 w-4 accent-blue-600" />
    case 'USUARIO':
      return (
        <select className={claseInput} defaultValue="">
          <option value="">Buscar funcionario de TIN-FLOW…</option>
        </select>
      )
    default:
      return <input className={claseInput} />
  }
}

export function VistaPreviaFormulario({
  tipologia, categoria, campos,
}: { tipologia: TicketTipologia; categoria: string; campos: TicketCampoTipologia[] }) {
  const activos = campos.filter(c => c.activo)
  const etiqueta = (texto: string, obligatorio: boolean) => (
    <span className="text-xs font-medium text-slate-700">{texto}{obligatorio && <span className="text-red-500"> *</span>}</span>
  )
  return (
    <div className="space-y-3 p-4" aria-label="Vista previa del formulario">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1">{etiqueta('Categoría', true)}<input disabled value={categoria} className={claseInput} /></label>
        <label className="block space-y-1">{etiqueta('Tipología', true)}<input disabled value={tipologia.nombre} className={claseInput} /></label>
      </div>
      {tipologia.descripcion_ayuda && (
        <p className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-800">{tipologia.descripcion_ayuda}</p>
      )}
      {tipologia.requiere_aprobacion && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">Esta solicitud requiere la aprobación de tu jefe inmediato antes de que TIN la atienda.</p>
      )}
      <div className="space-y-1">
        {etiqueta('Impacto', true)}
        <div className="flex flex-wrap gap-3 text-sm text-slate-600">
          {IMPACTOS_TICKET.map(i => <label key={i.value} className="flex items-center gap-1.5"><input type="radio" name="impacto-previo" className="accent-blue-600" />{i.label}</label>)}
        </div>
      </div>
      <label className="block space-y-1">{etiqueta('Asunto', true)}<input className={claseInput} /></label>
      {tipologia.es_novedad_igsi && (
        <p className="rounded-lg border border-dashed border-sky-300 bg-sky-50 px-3 py-2 text-xs text-sky-800">
          Aquí aparece el formulario de Novedades IGSI: documento afectado y número, documentos relacionados, servicio y modalidad,
          acción que intentaba, qué pasó, qué esperaba, mensaje de error, validación previa e impacto en la operación.
        </p>
      )}
      {activos.map(c => (
        <div key={c.id} className={cn('space-y-1', c.tipo_dato === 'CASILLA' && 'flex items-center gap-2 space-y-0')}>
          {c.tipo_dato === 'CASILLA' ? (
            <><ControlPrevio campo={c} />{etiqueta(c.etiqueta, c.obligatorio)}</>
          ) : (
            <label className="block space-y-1">{etiqueta(c.etiqueta, c.obligatorio)}<ControlPrevio campo={c} /></label>
          )}
          {c.ayuda && <p className="text-[11px] text-slate-400">{c.ayuda}</p>}
        </div>
      ))}
      <label className="block space-y-1">{etiqueta('Descripción', true)}<textarea rows={3} className={claseTextarea} /></label>
      <div className="space-y-1">
        {etiqueta('Imágenes y adjuntos', tipologia.adjunto_obligatorio)}
        <div className="rounded-lg border-2 border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-400">
          Arrastra, pega desde el portapapeles o selecciona archivos (JPG, PNG, WEBP o PDF)
          {tipologia.adjunto_obligatorio && <span className="block font-medium text-red-500">Se exige al menos una imagen o captura</span>}
        </div>
      </div>
      <Button disabled className="w-full">Crear ticket</Button>
    </div>
  )
}

// ── Pestaña ──────────────────────────────────────────────────────────────────

export function TabCampos({
  datos, tipologiaId, onCambiarTipologia,
}: { datos: DatosConfigTickets; tipologiaId: string; onCambiarTipologia: (id: string) => void }) {
  const { categorias, tipologias, campos } = datos
  const [editando, setEditando] = useState<FormCampo | null>(null)

  const tipologia = tipologias.find(t => t.id === tipologiaId)
  const categoria = categorias.find(c => c.id === tipologia?.categoria_id)
  const camposTip = campos.filter(c => c.tipologia_id === tipologiaId)

  const abrir = (c?: TicketCampoTipologia) => setEditando(c
    ? { ...c, opcionesTexto: (c.opciones ?? []).join('\n') }
    : {
        tipologia_id: tipologiaId, etiqueta: '', tipo_dato: 'TEXTO', obligatorio: false, opciones: null, ayuda: '',
        es_fecha_requerida: false, activo: true, opcionesTexto: '',
      })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-3">
        <Campo etiqueta="Tipología" className="min-w-[280px] flex-1">
          <select value={tipologiaId} onChange={e => onCambiarTipologia(e.target.value)} className={claseInput}>
            <option value="">Elige una tipología…</option>
            {categorias.map(c => {
              const ts = tipologias.filter(t => t.categoria_id === c.id)
              if (!ts.length) return null
              return (
                <optgroup key={c.id} label={c.nombre}>
                  {ts.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.nombre}{!t.activa ? ' (inactiva)' : ''} — {campos.filter(x => x.tipologia_id === t.id).length} campos
                    </option>
                  ))}
                </optgroup>
              )
            })}
          </select>
        </Campo>
        {tipologia && <Button size="sm" className="gap-1" onClick={() => abrir()}><Plus size={13} /> Nuevo campo</Button>}
      </div>

      {tipologia ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <Seccion
            titulo={`Campos de «${tipologia.nombre}»`}
            descripcion="Arrastra para cambiar el orden. Los campos con respuestas no se borran: se desactivan."
          >
            <ListaCampos
              key={`${tipologiaId}:${camposTip.map(c => c.id).join(',')}`}
              tipologiaId={tipologiaId} campos={camposTip} onEditar={c => abrir(c)}
            />
          </Seccion>
          <Seccion titulo="Vista previa" descripcion="Así verá el funcionario el formulario de esta tipología (solo campos activos).">
            <div className="flex items-center gap-1.5 border-b border-slate-100 px-4 py-2 text-[11px] text-slate-400"><Eye size={12} /> Solo lectura, no crea tickets</div>
            <VistaPreviaFormulario tipologia={tipologia} categoria={categoria?.nombre ?? ''} campos={camposTip} />
          </Seccion>
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-slate-200 bg-white py-12 text-center text-sm text-slate-400">
          Elige una tipología para editar sus campos y ver la vista previa del formulario.
        </p>
      )}

      {editando && <DialogoCampo inicial={editando} onCerrar={() => setEditando(null)} />}
    </div>
  )
}
