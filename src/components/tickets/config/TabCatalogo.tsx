'use client'

import { useMemo, useState } from 'react'
import { Lock, Paperclip, Pencil, Plus, Save, Search, ShieldCheck, Trash2, X, ListChecks, UserCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { MEDICIONES, PRIORIDADES_TICKET, TIPOS_GESTION } from '@/lib/tickets/constantes'
import type { TicketCategoria, TicketTipologia } from '@/lib/tickets/types'
import {
  actualizarCategoria, alternarTipologia, crearCategoria, eliminarCategoria, eliminarTipologia,
  guardarTipologia, moverCategoria, moverTipologia,
  type DatosConfigTickets, type TipologiaInput,
} from '@/actions/tickets/configuracion'
import {
  BotonActivo, BotonesOrden, Campo, Casilla, SelectNativo, Seccion, claseInput, claseTextarea, useAccion,
} from './comunes'

const LABEL_TIPO = Object.fromEntries(TIPOS_GESTION.map(t => [t.value, t])) as Record<string, (typeof TIPOS_GESTION)[number]>
const LABEL_MEDICION = Object.fromEntries(MEDICIONES.map(m => [m.value, m.label])) as Record<string, string>

// ── Resumen por categoría ────────────────────────────────────────────────────

function ResumenCategorias({ categorias, tipologias }: { categorias: TicketCategoria[]; tipologias: TicketTipologia[] }) {
  const filas = categorias.map(c => {
    const ts = tipologias.filter(t => t.categoria_id === c.id && t.activa)
    return {
      c,
      n: ts.length,
      aprob: ts.filter(t => t.requiere_aprobacion).length,
      adj: ts.filter(t => t.adjunto_obligatorio).length,
      restr: ts.filter(t => t.visibilidad_restringida).length,
      medicion: [...new Set(ts.map(t => LABEL_MEDICION[t.se_mide_contra]))].join('; '),
    }
  })
  const activas = tipologias.filter(t => t.activa)
  const th = 'px-3 py-2 text-left text-xs font-medium text-slate-400'
  const td = 'px-3 py-2 text-slate-600'
  return (
    <Seccion
      titulo="Resumen por categoría"
      descripcion={`${categorias.filter(c => c.activa).length} categorías activas · ${activas.length} tipologías activas · ${activas.filter(t => t.requiere_aprobacion).length} requieren aprobación · ${activas.filter(t => t.adjunto_obligatorio).length} exigen imagen o captura`}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-100 bg-slate-50">
            <tr>
              <th className={th}>Categoría</th><th className={th}>Tipologías</th><th className={th}>Con aprobación</th>
              <th className={th}>Imagen obligatoria</th><th className={th}>Restringidas</th><th className={th}>Se mide contra</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filas.map(f => (
              <tr key={f.c.id} className={cn(!f.c.activa && 'text-slate-400')}>
                <td className={cn(td, 'font-medium text-slate-800', !f.c.activa && 'text-slate-400 line-through')}>{f.c.nombre}</td>
                <td className={td}>{f.n}</td><td className={td}>{f.aprob}</td><td className={td}>{f.adj}</td>
                <td className={td}>{f.restr}</td><td className={cn(td, 'text-xs')}>{f.medicion || '—'}</td>
              </tr>
            ))}
            <tr className="bg-slate-50 font-semibold">
              <td className={td}>Total</td>
              <td className={td}>{activas.length}</td>
              <td className={td}>{activas.filter(t => t.requiere_aprobacion).length}</td>
              <td className={td}>{activas.filter(t => t.adjunto_obligatorio).length}</td>
              <td className={td}>{activas.filter(t => t.visibilidad_restringida).length}</td>
              <td className={td} />
            </tr>
          </tbody>
        </table>
      </div>
    </Seccion>
  )
}

// ── Categorías ───────────────────────────────────────────────────────────────

function FilaCategoria({
  c, idx, total, nTipologias,
}: { c: TicketCategoria; idx: number; total: number; nTipologias: number }) {
  const [editando, setEditando] = useState(false)
  const [nombre, setNombre] = useState(c.nombre)
  const { pendiente, ejecutar } = useAccion()

  const guardar = () => ejecutar(() => actualizarCategoria(c.id, { nombre }), 'Categoría renombrada', () => setEditando(false))

  return (
    <li className={cn('flex items-center gap-2 px-3 py-2', !c.activa && 'bg-slate-50/70')}>
      <BotonesOrden
        primero={idx === 0} ultimo={idx === total - 1} disabled={pendiente}
        onArriba={() => ejecutar(() => moverCategoria(c.id, 'arriba'))}
        onAbajo={() => ejecutar(() => moverCategoria(c.id, 'abajo'))}
      />
      <div className="min-w-0 flex-1">
        {editando ? (
          <div className="flex items-center gap-1">
            <input
              autoFocus value={nombre} onChange={e => setNombre(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') guardar(); if (e.key === 'Escape') { setNombre(c.nombre); setEditando(false) } }}
              className={claseInput}
            />
            <button onClick={guardar} disabled={pendiente} className="rounded p-1 text-blue-600 hover:bg-blue-50" aria-label="Guardar"><Save size={14} /></button>
            <button onClick={() => { setNombre(c.nombre); setEditando(false) }} className="rounded p-1 text-slate-400 hover:bg-slate-100" aria-label="Cancelar"><X size={14} /></button>
          </div>
        ) : (
          <p className={cn('truncate text-sm font-medium', c.activa ? 'text-slate-800' : 'text-slate-400 line-through')}>{c.nombre}</p>
        )}
        <p className="text-[11px] text-slate-400">{nTipologias} tipología{nTipologias !== 1 ? 's' : ''}</p>
      </div>
      {!editando && (
        <button onClick={() => setEditando(true)} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" title="Renombrar">
          <Pencil size={13} />
        </button>
      )}
      {nTipologias === 0 && (
        <button
          onClick={() => { if (confirm(`¿Eliminar la categoría "${c.nombre}"?`)) ejecutar(() => eliminarCategoria(c.id), 'Categoría eliminada') }}
          disabled={pendiente}
          className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" title="Eliminar (solo categorías vacías)"
        >
          <Trash2 size={13} />
        </button>
      )}
      <BotonActivo
        activo={c.activa} disabled={pendiente}
        onClick={() => {
          if (c.activa && nTipologias && !confirm(`Al desactivar "${c.nombre}" sus tipologías dejarán de ofrecerse al crear tickets. ¿Continuar?`)) return
          ejecutar(() => actualizarCategoria(c.id, { activa: !c.activa }), c.activa ? 'Categoría desactivada' : 'Categoría activada')
        }}
      />
    </li>
  )
}

function GestionCategorias({ categorias, tipologias }: { categorias: TicketCategoria[]; tipologias: TicketTipologia[] }) {
  const [nueva, setNueva] = useState('')
  const { pendiente, ejecutar } = useAccion()
  const crear = () => ejecutar(() => crearCategoria({ nombre: nueva }), 'Categoría creada', () => setNueva(''))
  return (
    <Seccion titulo="Categorías" descripcion="El orden aquí es el orden en que el funcionario las ve al crear un ticket.">
      <div className="flex gap-2 border-b border-slate-100 p-3">
        <input
          value={nueva} onChange={e => setNueva(e.target.value)} placeholder="Nueva categoría"
          onKeyDown={e => { if (e.key === 'Enter' && nueva.trim()) crear() }}
          className={claseInput}
        />
        <Button size="sm" onClick={crear} disabled={!nueva.trim() || pendiente} className="gap-1">
          <Plus size={13} /> Agregar
        </Button>
      </div>
      <ul className="max-h-[520px] divide-y divide-slate-50 overflow-y-auto">
        {categorias.map((c, i) => (
          <FilaCategoria
            key={c.id} c={c} idx={i} total={categorias.length}
            nTipologias={tipologias.filter(t => t.categoria_id === c.id).length}
          />
        ))}
        {!categorias.length && <li className="px-3 py-6 text-center text-sm text-slate-400">Sin categorías</li>}
      </ul>
    </Seccion>
  )
}

// ── Formulario de tipología ──────────────────────────────────────────────────

function vacia(categoriaId: string): TipologiaInput {
  return {
    categoria_id: categoriaId, nombre: '', descripcion_ayuda: '', tipo_gestion: 'SOLICITUD', se_mide_contra: 'SLA',
    prioridad_defecto: null, requiere_aprobacion: false, visibilidad_restringida: false, adjunto_obligatorio: false,
    es_novedad_igsi: false, area_responsable: '', responsable_defecto_id: null, activa: true,
  }
}

function DialogoTipologia({
  inicial, categorias, responsables, onCerrar,
}: {
  inicial: TipologiaInput
  categorias: TicketCategoria[]
  responsables: DatosConfigTickets['responsables']
  onCerrar: () => void
}) {
  const [f, setF] = useState<TipologiaInput>(inicial)
  const { pendiente, ejecutar } = useAccion()
  const set = <K extends keyof TipologiaInput>(k: K, v: TipologiaInput[K]) => setF(prev => ({ ...prev, [k]: v }))

  return (
    <Dialog open onOpenChange={o => !o && onCerrar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>{inicial.id ? 'Editar tipología' : 'Nueva tipología'}</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo etiqueta="Categoría *">
            <SelectNativo
              value={f.categoria_id} onChange={v => set('categoria_id', v)} placeholder="Elegir…"
              opciones={categorias.map(c => ({ value: c.id, label: c.activa ? c.nombre : `${c.nombre} (inactiva)` }))}
            />
          </Campo>
          <Campo etiqueta="Nombre de la tipología *">
            <input value={f.nombre} onChange={e => set('nombre', e.target.value)} className={claseInput} />
          </Campo>
          <Campo etiqueta="Información que se pide (ayuda para el funcionario)" className="sm:col-span-2">
            <textarea rows={3} value={f.descripcion_ayuda ?? ''} onChange={e => set('descripcion_ayuda', e.target.value)} className={claseTextarea} />
          </Campo>
          <Campo etiqueta="Tipo de gestión">
            <SelectNativo value={f.tipo_gestion} onChange={v => set('tipo_gestion', v as TipologiaInput['tipo_gestion'])} opciones={TIPOS_GESTION} />
          </Campo>
          <Campo etiqueta="Se mide contra">
            <SelectNativo value={f.se_mide_contra} onChange={v => set('se_mide_contra', v as TipologiaInput['se_mide_contra'])} opciones={MEDICIONES} />
          </Campo>
          <Campo etiqueta="Prioridad por defecto" ayuda="Se usa cuando el impacto es «solo me afecta a mí». Vacío = Media.">
            <SelectNativo
              value={f.prioridad_defecto ?? ''} placeholder="Según el impacto (Media)"
              onChange={v => set('prioridad_defecto', (v || null) as TipologiaInput['prioridad_defecto'])}
              opciones={PRIORIDADES_TICKET.map(p => ({ value: p.value, label: p.label }))}
            />
          </Campo>
          <Campo etiqueta="Área responsable">
            <input value={f.area_responsable ?? ''} onChange={e => set('area_responsable', e.target.value)} className={claseInput} placeholder="Ej. Soporte, Infraestructura" />
          </Campo>
          <Campo
            etiqueta="Responsable por defecto (asignación automática)" className="sm:col-span-2"
            ayuda="Si se elige, el ticket nace Asignado a esta persona. Solo aparecen perfiles activos que pueden atender tickets."
          >
            <SelectNativo
              value={f.responsable_defecto_id ?? ''} placeholder="Sin asignación automática (lo asigna el Coordinador TIN)"
              onChange={v => set('responsable_defecto_id', v || null)}
              opciones={[
                ...responsables.map(r => ({ value: r.id, label: `${r.nombre_completo} — ${r.email}` })),
                ...(f.responsable_defecto_id && !responsables.some(r => r.id === f.responsable_defecto_id)
                  ? [{ value: f.responsable_defecto_id, label: '(perfil inactivo o sin permiso para atender)' }]
                  : []),
              ]}
            />
          </Campo>
          <Casilla checked={f.requiere_aprobacion} onChange={v => set('requiere_aprobacion', v)} etiqueta="Requiere aprobación del jefe" ayuda="Nace en espera de aprobación del jefe inmediato." />
          <Casilla checked={f.adjunto_obligatorio} onChange={v => set('adjunto_obligatorio', v)} etiqueta="Imagen o captura obligatoria" />
          <Casilla checked={f.visibilidad_restringida} onChange={v => set('visibilidad_restringida', v)} etiqueta="Visibilidad restringida" ayuda="Solo la ven el solicitante, el responsable y quien tenga el permiso de Auditoría." />
          <Casilla checked={f.es_novedad_igsi} onChange={v => set('es_novedad_igsi', v)} etiqueta="Novedad IGSI" ayuda="Usa el formulario propio de novedades IGSI y las causas técnica/conceptual." />
          <Casilla checked={f.activa} onChange={v => set('activa', v)} etiqueta="Activa" ayuda="Las inactivas no se ofrecen al crear tickets." />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onCerrar}>Cancelar</Button>
          <Button
            disabled={pendiente || !f.nombre.trim() || !f.categoria_id}
            onClick={() => ejecutar(() => guardarTipologia(f), inicial.id ? 'Tipología actualizada' : 'Tipología creada', onCerrar)}
          >
            {pendiente ? 'Guardando…' : 'Guardar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Tabla de tipologías ──────────────────────────────────────────────────────

function Bandera({ on, Icon, titulo }: { on: boolean; Icon: typeof Lock; titulo: string }) {
  if (!on) return null
  return <span title={titulo} className="inline-flex"><Icon size={13} className="text-slate-500" /></span>
}

export function TabCatalogo({ datos, onEditarCampos }: { datos: DatosConfigTickets; onEditarCampos: (tipologiaId: string) => void }) {
  const { categorias, tipologias, responsables, ticketsPorTipologia, campos } = datos
  const [q, setQ] = useState('')
  const [fCat, setFCat] = useState('')
  const [fTipo, setFTipo] = useState('')
  const [fEstado, setFEstado] = useState('')
  const [editando, setEditando] = useState<TipologiaInput | null>(null)
  const { pendiente, ejecutar } = useAccion()

  const nombreResp = useMemo(() => new Map(responsables.map(r => [r.id, r.nombre_completo])), [responsables])

  const filtradas = useMemo(() => {
    const texto = q.trim().toLowerCase()
    const catNombre = new Map(categorias.map(c => [c.id, c.nombre]))
    return tipologias.filter(t =>
      (!fCat || t.categoria_id === fCat) &&
      (!fTipo || t.tipo_gestion === fTipo) &&
      (!fEstado || (fEstado === 'activas' ? t.activa : !t.activa)) &&
      (!texto || `${catNombre.get(t.categoria_id) ?? ''} ${t.nombre} ${t.descripcion_ayuda ?? ''} ${t.area_responsable ?? ''}`.toLowerCase().includes(texto)),
    )
  }, [tipologias, categorias, q, fCat, fTipo, fEstado])

  const grupos = categorias
    .map(c => ({ c, ts: filtradas.filter(t => t.categoria_id === c.id) }))
    .filter(g => g.ts.length)

  const alternar = (t: TicketTipologia) => {
    const n = ticketsPorTipologia[t.id] ?? 0
    if (t.activa && n && !confirm(`"${t.nombre}" tiene ${n} ticket(s). Al desactivarla deja de ofrecerse, pero esos tickets la conservan. ¿Continuar?`)) return
    ejecutar(() => alternarTipologia(t.id, !t.activa), t.activa ? 'Tipología desactivada' : 'Tipología activada')
  }

  return (
    <div className="space-y-5">
      <ResumenCategorias categorias={categorias} tipologias={tipologias} />

      <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
        <GestionCategorias categorias={categorias} tipologias={tipologias} />

        <Seccion
          titulo="Tipologías"
          descripcion={`${filtradas.length} de ${tipologias.length} tipologías`}
          acciones={
            <Button
              size="sm" className="gap-1" disabled={!categorias.length}
              onClick={() => setEditando(vacia(fCat || categorias.find(c => c.activa)?.id || categorias[0]?.id || ''))}
            >
              <Plus size={13} /> Nueva tipología
            </Button>
          }
        >
          <div className="flex flex-wrap gap-2 border-b border-slate-100 p-3">
            <div className="relative min-w-[200px] flex-1">
              <Search size={14} className="absolute top-1/2 left-2.5 -translate-y-1/2 text-slate-400" />
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar tipología, información o área" className={cn(claseInput, 'pl-8')} />
            </div>
            <SelectNativo className="w-auto" value={fCat} onChange={setFCat} placeholder="Todas las categorías" ariaLabel="Categoría"
              opciones={categorias.map(c => ({ value: c.id, label: c.nombre }))} />
            <SelectNativo className="w-auto" value={fTipo} onChange={setFTipo} placeholder="Todos los tipos" ariaLabel="Tipo"
              opciones={TIPOS_GESTION} />
            <SelectNativo className="w-auto" value={fEstado} onChange={setFEstado} placeholder="Activas e inactivas" ariaLabel="Estado"
              opciones={[{ value: 'activas', label: 'Solo activas' }, { value: 'inactivas', label: 'Solo inactivas' }]} />
          </div>

          <div className="divide-y divide-slate-100">
            {grupos.map(({ c, ts }) => (
              <div key={c.id}>
                <div className="flex items-center justify-between bg-slate-50 px-4 py-1.5">
                  <span className={cn('text-xs font-semibold uppercase tracking-wide text-slate-600', !c.activa && 'line-through')}>{c.nombre}</span>
                  <span className="text-[11px] text-slate-400">{ts.length} {ts.length === 1 ? 'tipología' : 'tipologías'}</span>
                </div>
                <ul className="divide-y divide-slate-50">
                  {ts.map(t => {
                    const todasCat = tipologias.filter(x => x.categoria_id === t.categoria_id)
                    const idx = todasCat.findIndex(x => x.id === t.id)
                    const nTickets = ticketsPorTipologia[t.id] ?? 0
                    const nCampos = campos.filter(x => x.tipologia_id === t.id && x.activo).length
                    const tipo = LABEL_TIPO[t.tipo_gestion]
                    return (
                      <li key={t.id} className={cn('flex items-start gap-2 px-3 py-2.5', !t.activa && 'bg-slate-50/70')}>
                        <BotonesOrden
                          primero={idx === 0} ultimo={idx === todasCat.length - 1} disabled={pendiente || !!(fCat || fTipo || fEstado || q)}
                          onArriba={() => ejecutar(() => moverTipologia(t.id, 'arriba'))}
                          onAbajo={() => ejecutar(() => moverTipologia(t.id, 'abajo'))}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className={cn('text-sm font-medium', t.activa ? 'text-slate-800' : 'text-slate-400 line-through')}>{t.nombre}</span>
                            {tipo && <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold', tipo.color)}>{tipo.label}</span>}
                            <Bandera on={t.requiere_aprobacion} Icon={ShieldCheck} titulo="Requiere aprobación del jefe" />
                            <Bandera on={t.adjunto_obligatorio} Icon={Paperclip} titulo="Imagen o captura obligatoria" />
                            <Bandera on={t.visibilidad_restringida} Icon={Lock} titulo="Visibilidad restringida" />
                            {t.es_novedad_igsi && <span className="rounded bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700">IGSI</span>}
                          </div>
                          {t.descripcion_ayuda && <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{t.descripcion_ayuda}</p>}
                          <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-400">
                            <span>{LABEL_MEDICION[t.se_mide_contra]}</span>
                            {t.prioridad_defecto && <span>Prioridad por defecto: {PRIORIDADES_TICKET.find(p => p.value === t.prioridad_defecto)?.label}</span>}
                            {t.area_responsable && <span>Área: {t.area_responsable}</span>}
                            {t.responsable_defecto_id && (
                              <span className="inline-flex items-center gap-1"><UserCheck size={11} />{nombreResp.get(t.responsable_defecto_id) ?? 'Responsable no disponible'}</span>
                            )}
                            <span>{nCampos} campo{nCampos !== 1 ? 's' : ''}</span>
                            <span>{nTickets} ticket{nTickets !== 1 ? 's' : ''}</span>
                          </p>
                        </div>
                        <button onClick={() => onEditarCampos(t.id)} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" title="Campos del formulario">
                          <ListChecks size={14} />
                        </button>
                        <button
                          onClick={() => setEditando({ ...t })}
                          className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" title="Editar"
                        >
                          <Pencil size={13} />
                        </button>
                        {nTickets === 0 && (
                          <button
                            onClick={() => { if (confirm(`¿Eliminar la tipología "${t.nombre}"? Solo es posible porque no tiene tickets.`)) ejecutar(() => eliminarTipologia(t.id), 'Tipología eliminada') }}
                            disabled={pendiente}
                            className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" title="Eliminar (solo sin tickets)"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                        <BotonActivo activo={t.activa} disabled={pendiente} onClick={() => alternar(t)} />
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
            {!grupos.length && (
              <p className="px-4 py-10 text-center text-sm text-slate-400">Ninguna tipología coincide. Borra la búsqueda o cambia los filtros.</p>
            )}
          </div>
        </Seccion>
      </div>

      {editando && (
        <DialogoTipologia
          inicial={editando} categorias={categorias} responsables={responsables}
          onCerrar={() => setEditando(null)}
        />
      )}
    </div>
  )
}
