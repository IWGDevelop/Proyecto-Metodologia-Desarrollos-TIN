'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  AlertOctagon, CalendarClock, ClipboardX, DollarSign, Download, Users, Building2, X, ExternalLink, Search,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn, formatCOP } from '@/lib/utils'
import { exportarReporteCompleto } from '@/lib/exportar'
import { PROCESOS_INTERNOS } from '@/lib/constants'
import { TIPOS_PENALIZACION } from '@/components/requerimientos/tabs/TabPenalizaciones'
import type { RegistroIncumplimiento } from '@/actions/reporte-penalizaciones'

interface Props {
  registros: RegistroIncumplimiento[]
}

type FiltroTipo = '' | 'PENALIZACION' | 'TAREA'
type FiltroSituacion = '' | 'CUMPLIDA_TARDE' | 'VENCIDA'

const COLOR_DIAS_TAREAS = '#e11d48'       // rose-600
const COLOR_DIAS_PENALIZACION = '#f59e0b' // amber-500

const procesoLabel = (p: string | null) => (p ? PROCESOS_INTERNOS.find(x => x.value === p)?.label ?? p : 'Sin proceso')
const tipoPenalizacionLabel = (t: string) => TIPOS_PENALIZACION.find(x => x.value === t)?.label ?? t

function formatFecha(d: string | null) {
  if (!d) return '—'
  return new Date(d + 'T12:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

interface Grupo {
  clave: string
  nombre: string
  detalle: string | null
  penalizaciones: number
  diasPenalizaciones: number
  tareasTarde: number
  tareasVencidas: number
  diasTareas: number
  diasTotal: number
  promedioTarea: number | null
  maxDias: number
  monto: number
}

/** Agrupa los registros; una penalización con varios responsables cuenta una sola vez por grupo */
function agrupar(registros: RegistroIncumplimiento[], claveDe: (r: RegistroIncumplimiento) => string, nombreDe: (r: RegistroIncumplimiento) => string, detalleDe: (r: RegistroIncumplimiento) => string | null): Grupo[] {
  const grupos = new Map<string, { filas: RegistroIncumplimiento[] }>()
  for (const r of registros) {
    const k = claveDe(r)
    if (!grupos.has(k)) grupos.set(k, { filas: [] })
    grupos.get(k)!.filas.push(r)
  }
  return [...grupos.entries()].map(([clave, { filas }]) => {
    const pens = [...new Map(filas.filter(f => f.tipo === 'PENALIZACION').map(f => [f.origen_id, f])).values()]
    const tareas = filas.filter(f => f.tipo === 'TAREA')
    const diasPenalizaciones = pens.reduce((s, p) => s + p.dias, 0)
    const diasTareas = tareas.reduce((s, t) => s + t.dias, 0)
    return {
      clave,
      nombre: nombreDe(filas[0]),
      detalle: detalleDe(filas[0]),
      penalizaciones: pens.length,
      diasPenalizaciones,
      tareasTarde: tareas.filter(t => t.situacion === 'CUMPLIDA_TARDE').length,
      tareasVencidas: tareas.filter(t => t.situacion === 'VENCIDA').length,
      diasTareas,
      diasTotal: diasPenalizaciones + diasTareas,
      promedioTarea: tareas.length ? Math.round(diasTareas / tareas.length) : null,
      maxDias: Math.max(0, ...filas.map(f => f.dias)),
      monto: pens.reduce((s, p) => s + p.monto_cop, 0) + tareas.reduce((s, t) => s + t.monto_cop, 0),
    }
  }).sort((a, b) => b.diasTotal - a.diasTotal || b.monto - a.monto)
}

function Kpi({ icono: Icon, label, valor, detalle, tono }: { icono: React.ElementType; label: string; valor: string | number; detalle?: string; tono: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500"><Icon size={13} className={tono} /> {label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-slate-800">{valor}</p>
      {detalle && <p className="mt-0.5 text-[11px] text-slate-400">{detalle}</p>}
    </div>
  )
}

/** Barra de días: tareas incumplidas + penalizaciones, proporcional al máximo de la tabla */
function BarraDias({ g, max }: { g: Grupo; max: number }) {
  const pct = (v: number) => (max > 0 ? (v / max) * 100 : 0)
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-2.5 w-32 shrink-0 gap-[2px] overflow-hidden rounded-full bg-slate-100">
        {g.diasTareas > 0 && <div className="h-full rounded-full" style={{ width: `${pct(g.diasTareas)}%`, backgroundColor: COLOR_DIAS_TAREAS }} title={`${g.diasTareas} días por tareas incumplidas`} />}
        {g.diasPenalizaciones > 0 && <div className="h-full rounded-full" style={{ width: `${pct(g.diasPenalizaciones)}%`, backgroundColor: COLOR_DIAS_PENALIZACION }} title={`${g.diasPenalizaciones} días por penalizaciones`} />}
      </div>
      <span className="text-sm font-bold tabular-nums text-slate-800">{g.diasTotal}</span>
    </div>
  )
}

function TablaGrupos({ titulo, icono: Icon, grupos, etiqueta }: { titulo: string; icono: React.ElementType; grupos: Grupo[]; etiqueta: string }) {
  const max = Math.max(0, ...grupos.map(g => g.diasTotal))
  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-bold text-slate-800"><Icon size={15} className="text-slate-400" /> {titulo}</h2>
        <div className="flex items-center gap-3 text-[11px] text-slate-500">
          <span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded-full" style={{ backgroundColor: COLOR_DIAS_TAREAS }} /> Días por tareas incumplidas</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded-full" style={{ backgroundColor: COLOR_DIAS_PENALIZACION }} /> Días por penalizaciones</span>
        </div>
      </div>
      {grupos.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">Sin incumplimientos para los filtros aplicados</p>
      ) : (
        <div className="max-h-[420px] overflow-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50">
              <tr className="border-b border-slate-100 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                <th className="px-4 py-2.5">{etiqueta}</th>
                <th className="px-3 py-2.5">Impacto en días</th>
                <th className="px-3 py-2.5 text-right">Penalizaciones</th>
                <th className="px-3 py-2.5 text-right">Cumplidas tarde</th>
                <th className="px-3 py-2.5 text-right">Vencidas sin cumplir</th>
                <th className="px-3 py-2.5 text-right">Prom. días por tarea</th>
                <th className="px-3 py-2.5 text-right">Máx. días</th>
                <th className="px-3 py-2.5 text-right">Monto penalizado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 tabular-nums">
              {grupos.map(g => (
                <tr key={g.clave} className="hover:bg-slate-50/60">
                  <td className="px-4 py-2.5">
                    <p className="font-medium text-slate-700">{g.nombre}</p>
                    {g.detalle && <p className="text-[11px] text-slate-400">{g.detalle}</p>}
                  </td>
                  <td className="px-3 py-2.5"><BarraDias g={g} max={max} /></td>
                  <td className="px-3 py-2.5 text-right text-slate-600">{g.penalizaciones || '—'}</td>
                  <td className="px-3 py-2.5 text-right text-slate-600">{g.tareasTarde || '—'}</td>
                  <td className={cn('px-3 py-2.5 text-right', g.tareasVencidas ? 'font-semibold text-red-600' : 'text-slate-400')}>{g.tareasVencidas || '—'}</td>
                  <td className="px-3 py-2.5 text-right text-slate-600">{g.promedioTarea ?? '—'}</td>
                  <td className="px-3 py-2.5 text-right text-slate-600">{g.maxDias || '—'}</td>
                  <td className="px-3 py-2.5 text-right text-slate-700">{g.monto ? formatCOP(g.monto) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export function ReportePenalizaciones({ registros }: Props) {
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [proceso, setProceso] = useState('')
  const [usuario, setUsuario] = useState('')
  const [tipo, setTipo] = useState<FiltroTipo>('')
  const [situacion, setSituacion] = useState<FiltroSituacion>('')
  const [busqueda, setBusqueda] = useState('')

  const hayFiltros = !!(desde || hasta || proceso || usuario || tipo || situacion || busqueda)
  const limpiar = () => { setDesde(''); setHasta(''); setProceso(''); setUsuario(''); setTipo(''); setSituacion(''); setBusqueda('') }

  const procesos = useMemo(() => [...new Set(registros.map(r => r.proceso ?? ''))].sort((a, b) => procesoLabel(a || null).localeCompare(procesoLabel(b || null))), [registros])
  const usuarios = useMemo(() => {
    const m = new Map<string, string>()
    for (const r of registros) m.set(r.responsable_email ?? '', r.responsable_nombre)
    return [...m].sort((a, b) => a[1].localeCompare(b[1]))
  }, [registros])

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return registros.filter(r =>
      (!desde || r.fecha >= desde) &&
      (!hasta || r.fecha <= hasta) &&
      (!proceso || (r.proceso ?? '') === proceso) &&
      (!usuario || (r.responsable_email ?? '') === usuario) &&
      (!tipo || r.tipo === tipo) &&
      (!situacion || r.situacion === situacion) &&
      (!q || r.descripcion.toLowerCase().includes(q) || (r.requerimiento_nombre ?? '').toLowerCase().includes(q))
    )
  }, [registros, desde, hasta, proceso, usuario, tipo, situacion, busqueda])

  // Indicadores: cada penalización cuenta una vez aunque tenga varios responsables
  const penalizacionesUnicas = [...new Map(filtrados.filter(r => r.tipo === 'PENALIZACION').map(r => [r.origen_id, r])).values()]
  const tareas = filtrados.filter(r => r.tipo === 'TAREA')
  const diasTareas = tareas.reduce((s, t) => s + t.dias, 0)
  const diasPenalizaciones = penalizacionesUnicas.reduce((s, p) => s + p.dias, 0)
  const montoTotal = penalizacionesUnicas.reduce((s, p) => s + p.monto_cop, 0) + tareas.reduce((s, t) => s + t.monto_cop, 0)
  const responsables = new Set(filtrados.map(r => r.responsable_email ?? r.responsable_nombre)).size

  const porUsuario = useMemo(() => agrupar(
    filtrados,
    r => r.responsable_email ?? 'sin-responsable',
    r => r.responsable_nombre,
    r => [r.responsable_email, procesoLabel(r.proceso)].filter(Boolean).join(' · '),
  ), [filtrados])
  const porProceso = useMemo(() => agrupar(filtrados, r => r.proceso ?? 'sin-proceso', r => procesoLabel(r.proceso), () => null), [filtrados])

  const exportar = () => {
    const columnasGrupo = (etiqueta: string) => [
      { titulo: etiqueta,                 ancho: 34, render: (g: Grupo) => g.nombre },
      { titulo: 'Detalle',                ancho: 36, render: (g: Grupo) => g.detalle ?? '' },
      { titulo: 'Días de impacto total',  ancho: 18, render: (g: Grupo) => g.diasTotal },
      { titulo: 'Días por tareas',        ancho: 14, render: (g: Grupo) => g.diasTareas },
      { titulo: 'Días por penalizaciones', ancho: 18, render: (g: Grupo) => g.diasPenalizaciones },
      { titulo: 'Penalizaciones',         ancho: 14, render: (g: Grupo) => g.penalizaciones },
      { titulo: 'Tareas cumplidas tarde', ancho: 18, render: (g: Grupo) => g.tareasTarde },
      { titulo: 'Tareas vencidas',        ancho: 14, render: (g: Grupo) => g.tareasVencidas },
      { titulo: 'Prom. días por tarea',   ancho: 16, render: (g: Grupo) => g.promedioTarea ?? '' },
      { titulo: 'Máx. días',              ancho: 10, render: (g: Grupo) => g.maxDias },
      { titulo: 'Monto penalizado COP',   ancho: 18, render: (g: Grupo) => g.monto },
    ]
    exportarReporteCompleto([
      { nombre: 'Por usuario', datos: porUsuario, columnas: columnasGrupo('Usuario') },
      { nombre: 'Por proceso', datos: porProceso, columnas: columnasGrupo('Proceso') },
      {
        nombre: 'Detalle',
        datos: filtrados,
        columnas: [
          { titulo: 'Tipo',            ancho: 14, render: (r: RegistroIncumplimiento) => r.tipo === 'PENALIZACION' ? 'Penalización' : 'Tarea incumplida' },
          { titulo: 'Clasificación',   ancho: 30, render: (r: RegistroIncumplimiento) => r.tipo === 'PENALIZACION' ? tipoPenalizacionLabel(r.subtipo) : r.subtipo },
          { titulo: 'Situación',       ancho: 18, render: (r: RegistroIncumplimiento) => r.situacion === 'CUMPLIDA_TARDE' ? 'Cumplida tarde' : r.situacion === 'VENCIDA' ? 'Vencida sin cumplir' : '' },
          { titulo: 'Descripción',     ancho: 50, render: (r: RegistroIncumplimiento) => r.descripcion },
          { titulo: 'Responsable',     ancho: 28, render: (r: RegistroIncumplimiento) => r.responsable_nombre },
          { titulo: 'Email',           ancho: 30, render: (r: RegistroIncumplimiento) => r.responsable_email ?? '' },
          { titulo: 'Proceso',         ancho: 20, render: (r: RegistroIncumplimiento) => procesoLabel(r.proceso) },
          { titulo: 'Requerimiento',   ancho: 45, render: (r: RegistroIncumplimiento) => r.requerimiento_nombre ?? '' },
          { titulo: 'Fecha',           ancho: 13, render: (r: RegistroIncumplimiento) => r.fecha },
          { titulo: 'Cumplió',         ancho: 13, render: (r: RegistroIncumplimiento) => r.fecha_cumplimiento ?? '' },
          { titulo: 'Días de impacto', ancho: 14, render: (r: RegistroIncumplimiento) => r.dias },
          { titulo: 'Monto COP',       ancho: 14, render: (r: RegistroIncumplimiento) => r.monto_cop },
          { titulo: 'Motivo / comentario', ancho: 45, render: (r: RegistroIncumplimiento) => r.motivo ?? '' },
        ],
      },
    ], 'Penalizaciones_e_Incumplimientos')
  }

  const selectCls = 'rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300'

  return (
    <div className="space-y-5">
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-w-52 flex-1 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2">
          <Search size={13} className="shrink-0 text-slate-400" />
          <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar por descripción o requerimiento..." className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400" />
        </div>
        <select value={tipo} onChange={e => setTipo(e.target.value as FiltroTipo)} className={selectCls}>
          <option value="">Penalizaciones y tareas</option>
          <option value="PENALIZACION">Solo penalizaciones</option>
          <option value="TAREA">Solo tareas incumplidas</option>
        </select>
        <select value={situacion} onChange={e => setSituacion(e.target.value as FiltroSituacion)} className={selectCls} disabled={tipo === 'PENALIZACION'}>
          <option value="">Toda situación de tarea</option>
          <option value="CUMPLIDA_TARDE">Cumplidas tarde</option>
          <option value="VENCIDA">Vencidas sin cumplir</option>
        </select>
        <select value={proceso} onChange={e => setProceso(e.target.value)} className={selectCls}>
          <option value="">Todos los procesos</option>
          {procesos.map(p => <option key={p || 'sin'} value={p}>{procesoLabel(p || null)}</option>)}
        </select>
        <select value={usuario} onChange={e => setUsuario(e.target.value)} className={selectCls}>
          <option value="">Todos los usuarios</option>
          {usuarios.map(([email, nombre]) => <option key={email || 'sin'} value={email}>{nombre}</option>)}
        </select>
        <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-500">
          <CalendarClock size={13} className="text-slate-400" />
          <input type="date" value={desde} onChange={e => setDesde(e.target.value)} className="rounded border border-slate-200 px-1.5 py-0.5 text-slate-700" aria-label="Desde" />
          <span>a</span>
          <input type="date" value={hasta} min={desde || undefined} onChange={e => setHasta(e.target.value)} className="rounded border border-slate-200 px-1.5 py-0.5 text-slate-700" aria-label="Hasta" />
        </div>
        {hayFiltros && (
          <Button variant="ghost" size="sm" onClick={limpiar} className="gap-1 text-xs text-slate-500"><X size={13} /> Limpiar</Button>
        )}
        <Button variant="outline" size="sm" onClick={exportar} className="gap-1.5 text-xs"><Download size={13} /> Exportar Excel</Button>
      </div>

      {/* Indicadores */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi icono={CalendarClock} tono="text-rose-500" label="Impacto total en días" valor={diasTareas + diasPenalizaciones}
          detalle={`${diasTareas} por tareas · ${diasPenalizaciones} por penalizaciones`} />
        <Kpi icono={ClipboardX} tono="text-rose-500" label="Tareas incumplidas" valor={tareas.length}
          detalle={`${tareas.filter(t => t.situacion === 'CUMPLIDA_TARDE').length} cumplidas tarde · ${tareas.filter(t => t.situacion === 'VENCIDA').length} vencidas`} />
        <Kpi icono={CalendarClock} tono="text-amber-500" label="Retraso promedio por tarea" valor={tareas.length ? `${Math.round(diasTareas / tareas.length)} d` : '—'}
          detalle={tareas.length ? `Máximo ${Math.max(...tareas.map(t => t.dias))} días` : undefined} />
        <Kpi icono={AlertOctagon} tono="text-amber-500" label="Penalizaciones" valor={penalizacionesUnicas.length}
          detalle={`${responsables} responsable${responsables !== 1 ? 's' : ''} involucrado${responsables !== 1 ? 's' : ''}`} />
        <Kpi icono={DollarSign} tono="text-emerald-600" label="Monto penalizado" valor={montoTotal ? formatCOP(montoTotal) : '—'}
          detalle="Penalizaciones + tareas penalizadas" />
      </div>

      <TablaGrupos titulo="Por usuario" icono={Users} grupos={porUsuario} etiqueta="Usuario" />
      <TablaGrupos titulo="Por proceso" icono={Building2} grupos={porProceso} etiqueta="Proceso" />

      {/* Detalle */}
      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-bold text-slate-800">Detalle de incumplimientos</h2>
          <p className="text-xs text-slate-500">Ordenado por impacto en días. Las tareas vencidas siguen sumando días hasta que se cumplan.</p>
        </div>
        {filtrados.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">Sin incumplimientos para los filtros aplicados</p>
        ) : (
          <div className="max-h-[560px] overflow-auto">
            <table className="w-full min-w-[1000px] text-sm">
              <thead className="sticky top-0 z-10 bg-slate-50">
                <tr className="border-b border-slate-100 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-2.5">Incumplimiento</th>
                  <th className="px-3 py-2.5">Responsable</th>
                  <th className="px-3 py-2.5">Requerimiento</th>
                  <th className="px-3 py-2.5">Compromiso → cumplimiento</th>
                  <th className="px-3 py-2.5 text-right">Días</th>
                  <th className="px-3 py-2.5 text-right">Monto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtrados.map(r => (
                  <tr key={r.clave} className="align-top hover:bg-slate-50/60">
                    <td className="px-4 py-2.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {r.tipo === 'PENALIZACION' ? (
                          <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-semibold', TIPOS_PENALIZACION.find(t => t.value === r.subtipo)?.cls ?? 'bg-slate-100 text-slate-600 border-slate-200')}>
                            Penalización · {tipoPenalizacionLabel(r.subtipo)}
                          </span>
                        ) : (
                          <span className={cn(
                            'rounded-full px-2 py-0.5 text-[10px] font-semibold',
                            r.situacion === 'VENCIDA' ? 'bg-red-100 text-red-700' : 'bg-rose-50 text-rose-700'
                          )}>
                            {r.situacion === 'VENCIDA' ? 'Vencida sin cumplir' : 'Cumplida tarde'}
                          </span>
                        )}
                        {r.tipo === 'TAREA' && <span className="text-[10px] text-slate-400">{r.subtipo}</span>}
                      </div>
                      {r.descripcion && <p className="mt-1 max-w-md text-xs text-slate-700">{r.descripcion}</p>}
                      {r.motivo && <p className="mt-0.5 max-w-md text-[11px] italic text-slate-400">“{r.motivo}”</p>}
                    </td>
                    <td className="px-3 py-2.5">
                      <p className="text-xs font-medium text-slate-700">{r.responsable_nombre}</p>
                      <p className="text-[11px] text-slate-400">{procesoLabel(r.proceso)}</p>
                    </td>
                    <td className="px-3 py-2.5">
                      {r.requerimiento_id ? (
                        <Link href={`/admin/requerimientos/${r.requerimiento_id}`} className="inline-flex max-w-xs items-start gap-1 text-xs text-blue-600 hover:text-blue-700">
                          <span className="line-clamp-2">{r.requerimiento_numero && <span className="mr-1 font-mono text-slate-400">#{r.requerimiento_numero}</span>}{r.requerimiento_nombre}</span>
                          <ExternalLink size={10} className="mt-0.5 shrink-0" />
                        </Link>
                      ) : <span className="text-xs text-slate-400">—</span>}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-xs text-slate-600">
                      {r.tipo === 'PENALIZACION'
                        ? <>Registrada {formatFecha(r.fecha)}</>
                        : <>{formatFecha(r.fecha)} → {r.situacion === 'VENCIDA' ? <span className="font-semibold text-red-600">pendiente</span> : formatFecha(r.fecha_cumplimiento)}</>}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <span className={cn('text-sm font-bold tabular-nums', r.dias > 0 ? 'text-rose-600' : 'text-slate-300')}>{r.dias || '—'}</span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right text-xs text-slate-700">{r.monto_cop ? formatCOP(r.monto_cop) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
