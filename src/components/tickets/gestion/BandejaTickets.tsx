'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Inbox, Loader2, Lock, Plus, Search, UserCheck, UserPlus, Clock, PauseCircle, AlertTriangle, Activity, X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useProcesos } from '@/context/ProcesosContext'
import { ESTADOS_TICKET, PRIORIDADES_TICKET } from '@/lib/tickets/constantes'
import { tomarTicket } from '@/actions/tickets/flujo'
import type { CategoriaOpcion, FilaBandeja, FiltrosBandeja, KpisBandeja, ResponsableOpcion } from '@/actions/tickets/bandeja'
import { AsignarDialog } from './AsignarDialog'
import { EstadoBadge, PrioridadBadge, Semaforo, formatFechaCorta, inputCls } from './ui'

interface Props {
  filas: FilaBandeja[]
  kpis: KpisBandeja
  filtros: FiltrosBandeja
  responsables: ResponsableOpcion[]
  categorias: CategoriaOpcion[]
  permisos: { coordinar: boolean; atender: boolean; usuarioId: string }
}

function Kpi({ icon: Icon, label, valor, color, onClick, activo }: {
  icon: typeof Inbox; label: string; valor: number; color: string; onClick: () => void; activo: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 rounded-xl border bg-white px-4 py-3 text-left transition-colors hover:border-blue-300',
        activo ? 'border-blue-400 ring-2 ring-blue-100' : 'border-slate-200',
      )}
    >
      <span className={cn('flex h-9 w-9 items-center justify-center rounded-lg', color)}><Icon size={17} /></span>
      <span>
        <span className="block text-xl font-bold tabular-nums text-slate-800">{valor}</span>
        <span className="block text-xs text-slate-500">{label}</span>
      </span>
    </button>
  )
}

export function BandejaTickets({ filas, kpis, filtros, responsables, categorias, permisos }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const { label: labelArea } = useProcesos()
  const [busqueda, setBusqueda] = useState(filtros.q ?? '')
  const [asignando, setAsignando] = useState<FilaBandeja | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [navegando, startNav] = useTransition()
  const [, startT] = useTransition()

  const aplicar = (cambios: Partial<Record<keyof FiltrosBandeja, string | boolean | undefined>>) => {
    const actual: Record<string, string> = {}
    if (filtros.estado && filtros.estado !== 'ABIERTOS') actual.estado = filtros.estado
    if (filtros.responsableId) actual.responsable = filtros.responsableId
    if (filtros.categoriaId) actual.categoria = filtros.categoriaId
    if (filtros.prioridad) actual.prioridad = filtros.prioridad
    if (filtros.vencidos) actual.vencidos = '1'
    if (filtros.sinAsignar) actual.sinAsignar = '1'
    if (filtros.misAsignados) actual.mios = '1'
    if (filtros.q) actual.q = filtros.q
    const claves: Record<keyof FiltrosBandeja, string> = {
      estado: 'estado', responsableId: 'responsable', categoriaId: 'categoria', prioridad: 'prioridad',
      vencidos: 'vencidos', sinAsignar: 'sinAsignar', misAsignados: 'mios', q: 'q',
    }
    for (const [k, v] of Object.entries(cambios) as [keyof FiltrosBandeja, string | boolean | undefined][]) {
      const clave = claves[k]
      if (v === undefined || v === '' || v === false || (k === 'estado' && v === 'ABIERTOS')) delete actual[clave]
      else actual[clave] = v === true ? '1' : String(v)
    }
    const qs = new URLSearchParams(actual).toString()
    startNav(() => router.push(qs ? `${pathname}?${qs}` : pathname))
  }

  const limpiar = () => { setBusqueda(''); startNav(() => router.push(pathname)) }
  const hayFiltros = !!(filtros.estado && filtros.estado !== 'ABIERTOS') || !!filtros.responsableId || !!filtros.categoriaId ||
    !!filtros.prioridad || !!filtros.vencidos || !!filtros.sinAsignar || !!filtros.misAsignados || !!filtros.q

  const tomar = (f: FilaBandeja) => {
    setPendingId(f.id)
    startT(async () => {
      const res = await tomarTicket(f.id)
      setPendingId(null)
      if (!res.ok) { toast.error(res.error ?? 'No se pudo tomar el ticket'); return }
      toast.success(`Tomaste ${f.codigo}`)
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={Inbox} label="Sin asignar" valor={kpis.sinAsignar} color="bg-slate-100 text-slate-600"
          activo={!!filtros.sinAsignar} onClick={() => aplicar({ sinAsignar: !filtros.sinAsignar, misAsignados: false, responsableId: undefined })} />
        <Kpi icon={Activity} label="En proceso" valor={kpis.enProceso} color="bg-indigo-50 text-indigo-600"
          activo={filtros.estado === 'EN_PROCESO'} onClick={() => aplicar({ estado: filtros.estado === 'EN_PROCESO' ? undefined : 'EN_PROCESO' })} />
        <Kpi icon={PauseCircle} label="En espera" valor={kpis.enEspera} color="bg-amber-50 text-amber-600"
          activo={false} onClick={() => aplicar({ estado: 'ESPERA_USUARIO' })} />
        <Kpi icon={AlertTriangle} label="Vencidos" valor={kpis.vencidos} color="bg-red-50 text-red-600"
          activo={!!filtros.vencidos} onClick={() => aplicar({ vencidos: !filtros.vencidos })} />
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-white p-3">
        <form
          className="relative min-w-[220px] flex-1"
          onSubmit={e => { e.preventDefault(); aplicar({ q: busqueda.trim() || undefined }) }}
        >
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por número (TK-0012) o asunto…"
            className={cn(inputCls, 'pl-8')}
          />
        </form>
        <select value={filtros.estado ?? 'ABIERTOS'} onChange={e => aplicar({ estado: e.target.value })} className={cn(inputCls, 'w-auto')} aria-label="Estado">
          <option value="ABIERTOS">Abiertos (todos)</option>
          {ESTADOS_TICKET.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
          <option value="TODOS">Todos los estados</option>
        </select>
        {permisos.coordinar && (
          <select
            value={filtros.responsableId ?? ''}
            onChange={e => aplicar({ responsableId: e.target.value || undefined, sinAsignar: false, misAsignados: false })}
            className={cn(inputCls, 'w-auto')}
            aria-label="Responsable"
          >
            <option value="">Todos los responsables</option>
            {responsables.map(r => <option key={r.id} value={r.id}>{r.nombre_completo}</option>)}
          </select>
        )}
        <select value={filtros.categoriaId ?? ''} onChange={e => aplicar({ categoriaId: e.target.value || undefined })} className={cn(inputCls, 'w-auto')} aria-label="Categoría">
          <option value="">Todas las categorías</option>
          {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
        <select value={filtros.prioridad ?? ''} onChange={e => aplicar({ prioridad: e.target.value || undefined })} className={cn(inputCls, 'w-auto')} aria-label="Prioridad">
          <option value="">Todas las prioridades</option>
          {PRIORIDADES_TICKET.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
        <label className="flex items-center gap-1.5 px-1 py-2 text-sm text-slate-600">
          <input type="checkbox" checked={!!filtros.misAsignados} onChange={e => aplicar({ misAsignados: e.target.checked, sinAsignar: false, responsableId: undefined })} />
          Mis asignados
        </label>
        <label className="flex items-center gap-1.5 px-1 py-2 text-sm text-slate-600">
          <input type="checkbox" checked={!!filtros.sinAsignar} onChange={e => aplicar({ sinAsignar: e.target.checked, misAsignados: false, responsableId: undefined })} />
          Sin asignar
        </label>
        <label className="flex items-center gap-1.5 px-1 py-2 text-sm text-slate-600">
          <input type="checkbox" checked={!!filtros.vencidos} onChange={e => aplicar({ vencidos: e.target.checked })} />
          Vencidos
        </label>
        {hayFiltros && (
          <button type="button" onClick={limpiar} className="flex items-center gap-1 rounded-lg px-2 py-2 text-xs text-slate-500 hover:bg-slate-100">
            <X size={13} /> Limpiar
          </button>
        )}
        {navegando && <Loader2 size={16} className="mb-2.5 animate-spin text-slate-400" />}
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[980px] text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
              <th className="px-3 py-2.5 font-semibold">Ticket</th>
              <th className="px-3 py-2.5 font-semibold">Asunto</th>
              <th className="px-3 py-2.5 font-semibold">Solicitante</th>
              <th className="px-3 py-2.5 font-semibold">Estado</th>
              <th className="px-3 py-2.5 font-semibold">Prioridad</th>
              <th className="px-3 py-2.5 font-semibold">Responsable</th>
              <th className="px-3 py-2.5 font-semibold" title="Tiempo hábil consumido frente al objetivo de la fase actual">Consumido</th>
              <th className="px-3 py-2.5 font-semibold">Creado</th>
              <th className="px-3 py-2.5 font-semibold"><span className="sr-only">Acciones</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filas.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-10 text-center text-sm text-slate-400">No hay tickets con estos filtros.</td></tr>
            )}
            {filas.map(f => (
              <tr key={f.id} className={cn('hover:bg-slate-50/70', f.vencido && 'bg-red-50/40')}>
                <td className="whitespace-nowrap px-3 py-2.5">
                  <Link href={`/admin/tickets/${f.id}`} className="font-mono text-xs font-semibold text-blue-700 hover:underline">{f.codigo}</Link>
                  {f.restringida && <Lock size={11} className="ml-1 inline text-slate-400" aria-label="Visibilidad restringida" />}
                </td>
                <td className="max-w-[320px] px-3 py-2.5">
                  <Link href={`/admin/tickets/${f.id}`} className="line-clamp-1 font-medium text-slate-800 hover:text-blue-700">{f.asunto}</Link>
                  <p className="line-clamp-1 text-[11px] text-slate-400">{f.categoria} · {f.tipologia}</p>
                </td>
                <td className="px-3 py-2.5">
                  <p className="line-clamp-1 text-slate-700">{f.solicitante}</p>
                  {f.area && <p className="line-clamp-1 text-[11px] text-slate-400">{labelArea(f.area)}</p>}
                </td>
                <td className="px-3 py-2.5"><EstadoBadge estado={f.estado} /></td>
                <td className="px-3 py-2.5"><PrioridadBadge prioridad={f.prioridad} /></td>
                <td className="px-3 py-2.5 text-slate-700">
                  {f.responsable ?? <span className="text-xs italic text-slate-400">Sin asignar</span>}
                </td>
                <td className="px-3 py-2.5">
                  <Semaforo
                    porcentaje={f.porcentaje}
                    vencido={f.vencido}
                    titulo={f.objetivo != null && f.consumido != null
                      ? `${f.consumido.toFixed(1)} h de ${f.objetivo} h (${f.fase === 'RESPUESTA' ? 'primera respuesta' : 'solución'})`
                      : undefined}
                  />
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-xs text-slate-500">
                  {formatFechaCorta(f.fechaCreacion)}
                  {f.fechaRequerida && <p className="flex items-center gap-1 text-[11px] text-slate-400"><Clock size={10} /> {formatFechaCorta(f.fechaRequerida)}</p>}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right">
                  {!f.responsableId && f.estado !== 'ESPERA_APROBACION' && f.estado !== 'CERRADO' && (permisos.atender || permisos.coordinar) && (
                    <button
                      type="button"
                      onClick={() => tomar(f)}
                      disabled={pendingId === f.id}
                      className="mr-1 inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                      title="Tomar el ticket"
                    >
                      {pendingId === f.id ? <Loader2 size={12} className="animate-spin" /> : <UserCheck size={12} />} Tomar
                    </button>
                  )}
                  {permisos.coordinar && f.estado !== 'ESPERA_APROBACION' && f.estado !== 'CERRADO' && (
                    <button
                      type="button"
                      onClick={() => setAsignando(f)}
                      className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      title={f.responsableId ? 'Reasignar' : 'Asignar'}
                    >
                      <UserPlus size={12} /> {f.responsableId ? 'Reasignar' : 'Asignar'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>{filas.length} ticket{filas.length !== 1 ? 's' : ''}{filas.length >= 500 ? ' (se muestran los 500 más recientes)' : ''}</span>
        <Link href="/mis-tickets/nuevo" className="flex items-center gap-1 text-blue-600 hover:underline"><Plus size={12} /> Crear ticket</Link>
      </div>

      {asignando && (
        <AsignarDialog
          open={!!asignando}
          onOpenChange={o => { if (!o) setAsignando(null) }}
          ticketId={asignando.id}
          codigo={asignando.codigo}
          responsableActualId={asignando.responsableId}
          responsables={responsables}
          onDone={() => router.refresh()}
        />
      )}
    </div>
  )
}
