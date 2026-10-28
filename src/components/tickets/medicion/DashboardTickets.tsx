'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { AlertTriangle, Download, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { exportarReporteCompleto } from '@/lib/exportar'
import { useProcesos } from '@/context/ProcesosContext'
import { LABEL_ESTADO_TICKET, LABEL_PRIORIDAD_TICKET, SEVERIDADES_BUG, ESTADOS_BUG } from '@/lib/tickets/constantes'
import { obtenerDashboardTickets, type DatosDashboard, type FiltrosDashboard } from '@/actions/tickets/dashboard'
import { GraficoRespuestaSolucion } from './GraficoRespuestaSolucion'
import {
  calcularKpis, conteo, cumplimientoFecha, esperas, fmtH, fmtPct, pct, porResponsable, reaperturas,
} from './indicadores'
import { PILL_SEVERIDAD, SELECT_CLASE } from './estilos'

const DOT: Record<'ok' | 'alerta' | 'vencido', string> = {
  ok: 'bg-emerald-500',
  alerta: 'bg-amber-500',
  vencido: 'bg-red-600',
}
const LABEL_SEMAFORO = { ok: 'En tiempo', alerta: 'Con recordatorio', vencido: 'Vencido' }

function fechaLocalHoy(offsetDias = 0): string {
  const d = new Date(Date.now() - 5 * 3_600_000 + offsetDias * 86_400_000)
  return d.toISOString().slice(0, 10)
}

const PRESETS: { id: string; label: string; rango: () => [string, string] }[] = [
  { id: '7', label: '7 días', rango: () => [fechaLocalHoy(-6), fechaLocalHoy()] },
  { id: '30', label: '30 días', rango: () => [fechaLocalHoy(-29), fechaLocalHoy()] },
  { id: '90', label: '90 días', rango: () => [fechaLocalHoy(-89), fechaLocalHoy()] },
  { id: 'mes', label: 'Este mes', rango: () => [`${fechaLocalHoy().slice(0, 8)}01`, fechaLocalHoy()] },
  { id: 'anio', label: 'Este año', rango: () => [`${fechaLocalHoy().slice(0, 4)}-01-01`, fechaLocalHoy()] },
]

function Kpi({ valor, texto, sub, alerta }: { valor: string | number; texto: string; sub?: string; alerta?: boolean }) {
  return (
    <div className={cn('rounded-xl border bg-white px-4 py-3', alerta ? 'border-red-200 bg-red-50' : 'border-slate-200')}>
      <p className={cn('text-2xl font-bold tabular-nums', alerta ? 'text-red-700' : 'text-slate-800')}>{valor}</p>
      <p className="text-xs text-slate-600">{texto}</p>
      {sub && <p className="mt-0.5 text-[11px] text-slate-400">{sub}</p>}
    </div>
  )
}

function Tarjeta({ titulo, ayuda, children, className }: { titulo: string; ayuda?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-xl border border-slate-200 bg-white p-4', className)}>
      <h2 className="text-sm font-semibold text-slate-800">{titulo}</h2>
      {ayuda && <p className="mb-3 text-xs text-slate-500">{ayuda}</p>}
      {!ayuda && <div className="mb-3" />}
      {children}
    </section>
  )
}

/** Lista con barra proporcional (una sola magnitud, un solo tono) */
function Ranking({ filas, vacio = 'Sin datos en el periodo', max = 8 }: { filas: { clave: string; n: number; extra?: string }[]; vacio?: string; max?: number }) {
  if (!filas.length) return <p className="text-sm text-slate-500">{vacio}</p>
  const tope = Math.max(...filas.map(f => f.n), 1)
  const visibles = filas.slice(0, max)
  const resto = filas.slice(max).reduce((a, f) => a + f.n, 0)
  return (
    <ul className="space-y-1.5">
      {[...visibles, ...(resto ? [{ clave: 'Otras', n: resto }] : [])].map(f => (
        <li key={f.clave} className="text-xs" title={`${f.clave}: ${f.n}`}>
          <div className="flex justify-between gap-2">
            <span className="truncate text-slate-700">{f.clave}</span>
            <span className="shrink-0 tabular-nums text-slate-800">{f.n}{'extra' in f && f.extra ? <span className="text-slate-400"> · {f.extra}</span> : null}</span>
          </div>
          <div className="mt-0.5 h-1.5 rounded-full bg-slate-100">
            <div className="h-1.5 rounded-full bg-[#2a78d6]" style={{ width: `${(f.n / tope) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  )
}

export function DashboardTickets({ inicial }: { inicial: DatosDashboard }) {
  const procesos = useProcesos()
  const [datos, setDatos] = useState<DatosDashboard>(inicial)
  const [f, setF] = useState<FiltrosDashboard>(inicial.filtros)
  const [pendiente, startTransition] = useTransition()

  const aplicar = (nuevo: FiltrosDashboard) => {
    setF(nuevo)
    startTransition(async () => {
      try {
        const d = await obtenerDashboardTickets(nuevo)
        setDatos(d)
      } catch (e) {
        toast.error((e as Error).message || 'No se pudo cargar el dashboard')
      }
    })
  }

  const areaLabel = (a: string | null) => (a ? procesos.label(a) : 'Sin área')
  const { periodo, abiertos } = datos
  const kpis = useMemo(() => calcularKpis(periodo, abiertos), [periodo, abiertos])
  const filasResp = useMemo(() => porResponsable(periodo, abiertos), [periodo, abiertos])
  const abiertosOrden = useMemo(
    () => [...abiertos].sort((a, b) => (b.nivel?.u ?? -1) - (a.nivel?.u ?? -1)),
    [abiertos],
  )
  const volCat = useMemo(() => conteo(periodo, t => t.categoria), [periodo])
  const volTip = useMemo(() => conteo(periodo, t => t.tipologia), [periodo])
  const volArea = useMemo(() => conteo(periodo, t => areaLabel(t.area)), [periodo]) // eslint-disable-line react-hooks/exhaustive-deps
  const esp = useMemo(() => esperas(periodo), [periodo])
  const reap = useMemo(() => reaperturas(periodo), [periodo])
  const fecha = useMemo(() => cumplimientoFecha(periodo), [periodo])
  const igsi = datos.igsi
  const presetActivo = PRESETS.find(p => {
    const [d, h] = p.rango()
    return d === f.desde && h === f.hasta
  })?.id

  const exportar = () => {
    const nombreArea = (a: string | null) => areaLabel(a)
    exportarReporteCompleto([
      {
        nombre: 'Indicadores',
        datos: [
          ['Periodo', `${f.desde} a ${f.hasta}`],
          ['Tickets en el periodo', kpis.total],
          ['Abiertos (hoy)', kpis.abiertos],
          ['Primera respuesta promedio (h hábiles)', kpis.respuestaProm?.toFixed(2) ?? ''],
          ['Solución promedio (h hábiles)', kpis.solucionProm?.toFixed(2) ?? ''],
          ['Cumplimiento de primera respuesta', fmtPct(kpis.pctRespuesta)],
          ['Cumplimiento de solución', fmtPct(kpis.pctSolucion)],
          ['Abiertos vencidos', kpis.vencidosAbiertos],
          ['Reaperturas / cerrados', `${reap.reabiertos} / ${reap.cerrados} (${fmtPct(reap.tasa)})`],
          ['Cumplimiento de fecha', `${fecha.aTiempo} / ${fecha.medidos} (${fmtPct(fecha.pct)})`],
          ['Novedades IGSI técnicas', igsi.tecnicas],
          ['Novedades IGSI conceptuales', igsi.conceptuales],
          ...esp.map(e => [`Espera de ${e.tipo.toLowerCase()} (h hábiles)`, e.horas.toFixed(1)]),
          ['Objetivos de tiempo', datos.objetivosPendientes ? 'Pendientes de aprobación' : 'Aprobados'],
        ],
        columnas: [
          { titulo: 'Indicador', ancho: 42, render: (r: (string | number)[]) => r[0] },
          { titulo: 'Valor', ancho: 28, render: (r: (string | number)[]) => r[1] },
        ],
      },
      {
        nombre: 'Por responsable',
        datos: filasResp,
        columnas: [
          { titulo: 'Responsable', ancho: 28, render: r => r.nombre },
          { titulo: 'Asignados', render: r => r.asignados },
          { titulo: 'Abiertos', render: r => r.abiertos },
          { titulo: 'Resueltos o cerrados', render: r => r.cerrados },
          { titulo: 'Respuesta prom. (h)', render: r => r.respuestaProm?.toFixed(2) ?? '' },
          { titulo: 'Solución prom. (h)', render: r => r.solucionProm?.toFixed(2) ?? '' },
          { titulo: 'Respuestas a tiempo', render: r => fmtPct(r.pctRespuesta) },
          { titulo: 'Soluciones a tiempo', render: r => fmtPct(r.pctSolucion) },
          { titulo: 'Con recordatorio', render: r => r.conRecordatorio },
          { titulo: 'Vencidos', render: r => r.vencidos },
        ],
      },
      {
        nombre: 'Abiertos',
        datos: abiertosOrden,
        columnas: [
          { titulo: 'Ticket', render: r => r.codigo },
          { titulo: 'Asunto', ancho: 40, render: r => r.asunto },
          { titulo: 'Responsable', ancho: 24, render: r => r.responsable },
          { titulo: 'Categoría', ancho: 24, render: r => r.categoria },
          { titulo: 'Prioridad', render: r => LABEL_PRIORIDAD_TICKET[r.prioridad as keyof typeof LABEL_PRIORIDAD_TICKET] },
          { titulo: 'Estado', ancho: 22, render: r => LABEL_ESTADO_TICKET[r.estado as keyof typeof LABEL_ESTADO_TICKET] },
          { titulo: 'Respondido', render: r => (r.respondido ? 'Sí' : 'No') },
          { titulo: 'Horas hábiles', render: r => (r.respondido ? r.t_consumido : r.horas_respuesta)?.toFixed(1) ?? '' },
          { titulo: '% consumido', render: r => (r.nivel ? Math.round(r.nivel.u * 100) : '') },
          { titulo: 'Recordatorio', ancho: 32, render: r => r.nivel?.etiqueta ?? 'Sin objetivo' },
        ],
      },
      {
        nombre: 'Tickets del periodo',
        datos: periodo,
        columnas: [
          { titulo: 'Ticket', render: r => r.codigo },
          { titulo: 'Creado', render: r => new Date(r.fecha_creacion).toLocaleString('es-CO', { timeZone: 'America/Bogota' }) },
          { titulo: 'Asunto', ancho: 40, render: r => r.asunto },
          { titulo: 'Categoría', ancho: 24, render: r => r.categoria },
          { titulo: 'Tipología', ancho: 28, render: r => r.tipologia },
          { titulo: 'Área', ancho: 20, render: r => nombreArea(r.area) },
          { titulo: 'Responsable', ancho: 24, render: r => r.responsable },
          { titulo: 'Prioridad', render: r => LABEL_PRIORIDAD_TICKET[r.prioridad as keyof typeof LABEL_PRIORIDAD_TICKET] },
          { titulo: 'Estado', ancho: 20, render: r => LABEL_ESTADO_TICKET[r.estado as keyof typeof LABEL_ESTADO_TICKET] },
          { titulo: 'Asignación (h)', render: r => r.t_asignacion },
          { titulo: 'Primera respuesta (h)', render: r => r.t_primera_respuesta },
          { titulo: 'Solución (h)', render: r => r.t_solucion },
          { titulo: 'Espera aprobación (h)', render: r => r.t_espera_aprobacion },
          { titulo: 'Espera usuario (h)', render: r => r.t_espera_usuario },
          { titulo: 'Espera proveedor (h)', render: r => r.t_espera_proveedor },
          { titulo: 'Confirmación (h)', render: r => r.t_confirmacion },
          { titulo: 'Total (h)', render: r => r.t_total },
          { titulo: 'Reaperturas', render: r => r.reaperturas },
          { titulo: 'Objetivo respuesta (h)', render: r => r.objetivo_respuesta },
          { titulo: 'Objetivo solución (h)', render: r => r.objetivo_solucion },
          { titulo: 'Cumple respuesta', render: r => (r.cumple_respuesta == null ? '' : r.cumple_respuesta ? 'Sí' : 'No') },
          { titulo: 'Cumple solución', render: r => (r.cumple_solucion == null ? '' : r.cumple_solucion ? 'Sí' : 'No') },
          { titulo: 'Fecha requerida', render: r => r.fecha_requerida ?? '' },
          { titulo: 'Días vs. fecha', render: r => r.dias_vs_fecha_requerida },
        ],
      },
    ], 'Dashboard_Tickets')
  }

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-3">
        <div className="space-y-1">
          <span className="block text-xs text-slate-500">Periodo (creación)</span>
          <div className="flex flex-wrap gap-1">
            {PRESETS.map(p => (
              <Button
                key={p.id}
                size="sm"
                variant={presetActivo === p.id ? 'default' : 'outline'}
                disabled={pendiente}
                onClick={() => { const [desde, hasta] = p.rango(); aplicar({ ...f, desde, hasta }) }}
              >
                {p.label}
              </Button>
            ))}
          </div>
        </div>
        <label className="space-y-1 text-xs text-slate-500">
          <span className="block">Desde</span>
          <Input type="date" className="w-36" value={f.desde} max={f.hasta} onChange={e => e.target.value && aplicar({ ...f, desde: e.target.value })} />
        </label>
        <label className="space-y-1 text-xs text-slate-500">
          <span className="block">Hasta</span>
          <Input type="date" className="w-36" value={f.hasta} min={f.desde} onChange={e => e.target.value && aplicar({ ...f, hasta: e.target.value })} />
        </label>
        <label className="space-y-1 text-xs text-slate-500">
          <span className="block">Responsable</span>
          <select className={SELECT_CLASE} value={f.responsableId ?? ''} onChange={e => aplicar({ ...f, responsableId: e.target.value || undefined })}>
            <option value="">Todos</option>
            <option value="SIN">Sin asignar</option>
            {datos.opciones.responsables.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-xs text-slate-500">
          <span className="block">Categoría</span>
          <select className={SELECT_CLASE} value={f.categoriaId ?? ''} onChange={e => aplicar({ ...f, categoriaId: e.target.value || undefined })}>
            <option value="">Todas</option>
            {datos.opciones.categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-xs text-slate-500">
          <span className="block">Área</span>
          <select className={SELECT_CLASE} value={f.area ?? ''} onChange={e => aplicar({ ...f, area: e.target.value || undefined })}>
            <option value="">Todas</option>
            {datos.opciones.areas.map(a => <option key={a} value={a}>{procesos.label(a)}</option>)}
          </select>
        </label>
        <div className="ml-auto flex items-center gap-2">
          {pendiente && <Loader2 size={16} className="animate-spin text-slate-400" aria-label="Cargando" />}
          <Button variant="outline" className="gap-1.5" onClick={exportar} disabled={pendiente}>
            <Download size={15} /> Exportar a Excel
          </Button>
        </div>
      </div>

      {/* Objetivos */}
      <div className={cn(
        'flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border px-4 py-3 text-xs',
        datos.objetivosPendientes ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-slate-200 bg-white text-slate-600',
      )}>
        {datos.objetivosPendientes && (
          <span className="flex items-center gap-1.5 font-semibold">
            <AlertTriangle size={14} /> Tiempos objetivo pendientes de aprobación de la Dirección de TI: los cumplimientos son provisionales.
          </span>
        )}
        {!datos.objetivosPendientes && <span className="font-semibold text-slate-700">Tiempos objetivo vigentes (horas hábiles):</span>}
        {datos.objetivos.map(o => (
          <span key={o.prioridad}>
            <strong>{LABEL_PRIORIDAD_TICKET[o.prioridad]}</strong>: respuesta {o.horas_respuesta} h · solución {o.horas_solucion} h
            {!o.aprobado && ' (sin aprobar)'}
          </span>
        ))}
        {datos.objetivos.length === 0 && <span>No hay tiempos objetivo configurados.</span>}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
        <Kpi valor={kpis.total} texto="tickets en el periodo" />
        <Kpi valor={kpis.abiertos} texto="abiertos hoy" />
        <Kpi valor={fmtH(kpis.respuestaProm)} texto="primera respuesta promedio" sub={`${kpis.respondidos} respondidos`} />
        <Kpi valor={fmtH(kpis.solucionProm)} texto="solución promedio" sub={`${kpis.resueltos} resueltos`} />
        <Kpi valor={fmtPct(kpis.pctRespuesta)} texto="respuestas a tiempo" />
        <Kpi valor={fmtPct(kpis.pctSolucion)} texto="soluciones a tiempo" />
        <Kpi valor={kpis.vencidosAbiertos} texto="abiertos vencidos" alerta={kpis.vencidosAbiertos > 0} sub={`${kpis.conRecordatorio} con recordatorio`} />
      </div>

      {/* Responsables */}
      <div className="grid gap-4 xl:grid-cols-5">
        <Tarjeta titulo="Respuesta vs. solución por responsable" ayuda="Promedio de horas hábiles del periodo (la solución descuenta las esperas)" className="xl:col-span-2">
          <GraficoRespuestaSolucion filas={filasResp} />
        </Tarjeta>
        <Tarjeta titulo="Por responsable" ayuda="Asignados, cerrados y tiempos del periodo; abiertos y recordatorios a hoy" className="overflow-x-auto xl:col-span-3">
          <table className="w-full min-w-[720px] text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="py-2 pr-2 font-medium">Responsable</th>
                <th className="px-2 text-right font-medium">Asignados</th>
                <th className="px-2 text-right font-medium">Abiertos</th>
                <th className="px-2 text-right font-medium">Cerrados</th>
                <th className="px-2 text-right font-medium">Respuesta prom.</th>
                <th className="px-2 text-right font-medium">Solución prom.</th>
                <th className="px-2 text-right font-medium">Respuestas a tiempo</th>
                <th className="px-2 text-right font-medium">Soluciones a tiempo</th>
                <th className="px-2 text-right font-medium">Con recordatorio</th>
                <th className="pl-2 text-right font-medium">Vencidos</th>
              </tr>
            </thead>
            <tbody>
              {filasResp.length === 0 && (
                <tr><td colSpan={10} className="py-4 text-center text-slate-500">No hay tickets con estos filtros.</td></tr>
              )}
              {filasResp.map(r => (
                <tr key={r.id} className="border-b border-slate-100 tabular-nums">
                  <td className="py-2 pr-2 font-medium text-slate-800">{r.nombre}</td>
                  <td className="px-2 text-right">{r.asignados}</td>
                  <td className="px-2 text-right">{r.abiertos}</td>
                  <td className="px-2 text-right">{r.cerrados}</td>
                  <td className="px-2 text-right">{fmtH(r.respuestaProm)}</td>
                  <td className="px-2 text-right">{fmtH(r.solucionProm)}</td>
                  <td className="px-2 text-right">{fmtPct(r.pctRespuesta)}</td>
                  <td className="px-2 text-right">{fmtPct(r.pctSolucion)}</td>
                  <td className="px-2 text-right">{r.conRecordatorio}</td>
                  <td className="pl-2 text-right">
                    {r.vencidos ? <span className="rounded bg-red-100 px-1.5 py-0.5 font-semibold text-red-700">{r.vencidos}</span> : 0}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Tarjeta>
      </div>

      {/* Abiertos con semáforo */}
      <Tarjeta
        titulo={`Tickets abiertos (${abiertos.length})`}
        ayuda="Ordenados por % del tiempo objetivo consumido. Sin primera respuesta se mide contra el objetivo de respuesta; después, contra el de solución. El nivel usa las reglas de recordatorio activas."
        className="overflow-x-auto"
      >
        <table className="w-full min-w-[860px] text-xs">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="py-2 pr-2 font-medium">Ticket</th>
              <th className="px-2 font-medium">Responsable</th>
              <th className="px-2 font-medium">Categoría</th>
              <th className="px-2 font-medium">Prioridad</th>
              <th className="px-2 font-medium">Estado</th>
              <th className="px-2 text-right font-medium">Horas hábiles</th>
              <th className="px-2 font-medium">Consumido</th>
              <th className="pl-2 font-medium">Recordatorio</th>
            </tr>
          </thead>
          <tbody>
            {abiertosOrden.length === 0 && (
              <tr><td colSpan={8} className="py-4 text-center text-slate-500">No hay tickets abiertos con estos filtros.</td></tr>
            )}
            {abiertosOrden.map(t => {
              const clase = t.nivel?.clase ?? 'ok'
              return (
                <tr key={t.id} className="border-b border-slate-100 align-top">
                  <td className="py-2 pr-2">
                    <Link href={`/admin/tickets/${t.id}`} className="font-semibold text-blue-700 hover:underline">{t.codigo}</Link>
                    <p className="max-w-[260px] truncate text-slate-500" title={t.asunto}>{t.asunto}</p>
                  </td>
                  <td className="px-2 text-slate-700">{t.responsable}</td>
                  <td className="px-2 text-slate-700">{t.categoria}</td>
                  <td className="px-2 text-slate-700">{LABEL_PRIORIDAD_TICKET[t.prioridad]}</td>
                  <td className="px-2 text-slate-700">
                    {LABEL_ESTADO_TICKET[t.estado]}
                    {!t.respondido && <span className="block text-amber-700">Sin primera respuesta</span>}
                  </td>
                  <td className="px-2 text-right tabular-nums">{fmtH(t.respondido ? t.t_consumido : t.horas_respuesta)}</td>
                  <td className="px-2 whitespace-nowrap">
                    {t.nivel ? (
                      <span className="inline-flex items-center gap-1.5 tabular-nums">
                        <span className={cn('h-2.5 w-2.5 rounded-full', DOT[clase])} aria-hidden />
                        {Math.round(t.nivel.u * 100)}%
                        <span className="sr-only">{LABEL_SEMAFORO[clase]}</span>
                      </span>
                    ) : <span className="text-slate-400">Sin objetivo</span>}
                  </td>
                  <td className={cn('pl-2', clase === 'vencido' ? 'font-medium text-red-700' : clase === 'alerta' ? 'text-amber-800' : 'text-slate-500')}>
                    {t.nivel?.etiqueta ?? '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <p className="mt-2 flex flex-wrap gap-4 text-[11px] text-slate-500">
          {(['ok', 'alerta', 'vencido'] as const).map(c => (
            <span key={c} className="flex items-center gap-1.5"><span className={cn('h-2 w-2 rounded-full', DOT[c])} />{LABEL_SEMAFORO[c]}</span>
          ))}
        </p>
      </Tarjeta>

      {/* Volumen */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Tarjeta titulo="Volumen por categoría"><Ranking filas={volCat} /></Tarjeta>
        <Tarjeta titulo="Volumen por tipología"><Ranking filas={volTip} /></Tarjeta>
        <Tarjeta titulo="Volumen por área solicitante"><Ranking filas={volArea} /></Tarjeta>
      </div>

      {/* IGSI, esperas, reaperturas, fecha */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Tarjeta titulo="Novedades IGSI: técnicas vs. conceptuales" ayuda="Novedades del periodo cerradas, por tipo de causa">
          {igsi.total === 0 ? (
            <p className="text-sm text-slate-500">Sin novedades IGSI clasificadas en el periodo</p>
          ) : (
            <div className="space-y-3">
              <div className="flex h-3 overflow-hidden rounded-full bg-slate-100" role="img"
                aria-label={`Técnicas ${igsi.tecnicas}, conceptuales ${igsi.conceptuales}`}>
                <div className="bg-[#2a78d6]" style={{ width: `${pct(igsi.tecnicas, igsi.total)}%` }} />
                <div className="border-l-2 border-white bg-[#eb6834]" style={{ width: `${pct(igsi.conceptuales, igsi.total)}%` }} />
              </div>
              <div className="flex flex-wrap gap-4 text-xs text-slate-700">
                <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-[#2a78d6]" />Técnicas: <strong>{igsi.tecnicas}</strong> ({fmtPct(pct(igsi.tecnicas, igsi.total))})</span>
                <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-[#eb6834]" />Conceptuales: <strong>{igsi.conceptuales}</strong> ({fmtPct(pct(igsi.conceptuales, igsi.total))})</span>
                {igsi.otras > 0 && <span>Otras: {igsi.otras}</span>}
              </div>
              <div>
                <p className="mb-1.5 text-xs font-medium text-slate-600">Conceptuales por área</p>
                <Ranking filas={igsi.conceptualesPorArea.map(a => ({ clave: areaLabel(a.area === 'Sin área' ? null : a.area), n: a.n }))} vacio="Ninguna conceptual" max={6} />
              </div>
            </div>
          )}
        </Tarjeta>

        <Tarjeta titulo="Tiempo en espera" ayuda="Horas hábiles del periodo que no dependen de TIN">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="py-1.5 font-medium">Espera de</th>
                <th className="text-right font-medium">Horas</th>
                <th className="text-right font-medium">Tickets</th>
                <th className="text-right font-medium">Prom. por ticket</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {esp.map(e => (
                <tr key={e.tipo} className="border-b border-slate-100">
                  <td className="py-1.5 text-slate-700">{e.tipo}</td>
                  <td className="text-right">{fmtH(e.horas)}</td>
                  <td className="text-right">{e.tickets}</td>
                  <td className="text-right">{fmtH(e.promedio)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-lg font-bold tabular-nums text-slate-800">{fmtPct(reap.tasa)}</p>
              <p className="text-[11px] text-slate-500">reaperturas ({reap.reabiertos} reabiertos ÷ {reap.cerrados} cerrados)</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-lg font-bold tabular-nums text-slate-800">{fmtPct(fecha.pct)}</p>
              <p className="text-[11px] text-slate-500">
                cumplimiento de fecha ({fecha.aTiempo} de {fecha.medidos}
                {fecha.promedioDias != null ? `, ${fecha.promedioDias >= 0 ? '+' : ''}${fecha.promedioDias.toFixed(1)} días hábiles prom.` : ''})
              </p>
            </div>
          </div>
        </Tarjeta>

        <Tarjeta titulo="Bugs y deuda técnica de IGSI" ayuda="Abiertos (no desplegados) a hoy, por severidad">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="py-1.5 font-medium">Severidad</th>
                <th className="text-right font-medium">Abiertos</th>
                <th className="text-right font-medium">Días prom.</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {datos.bugs.porSeveridad.map(s => (
                <tr key={s.severidad} className="border-b border-slate-100">
                  <td className="py-1.5">
                    <span className={cn('rounded px-1.5 py-0.5', PILL_SEVERIDAD[s.severidad])}>{SEVERIDADES_BUG.find(x => x.value === s.severidad)?.label}</span>
                  </td>
                  <td className="text-right">{s.abiertos}</td>
                  <td className="text-right">{s.diasPromedio ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mb-1.5 mt-4 text-xs font-medium text-slate-600">Recurrencia: tickets enlazados por bug (periodo · total)</p>
          {datos.bugs.recurrencia.length === 0 ? (
            <p className="text-sm text-slate-500">Ningún ticket enlazado a bugs</p>
          ) : (
            <ul className="space-y-1 text-xs">
              {datos.bugs.recurrencia.map(b => (
                <li key={b.id} className="flex items-center gap-2">
                  <Link href="/admin/tickets-bugs" className="font-semibold text-blue-700 hover:underline">{b.codigo}</Link>
                  <span className="flex-1 truncate text-slate-700" title={b.titulo}>{b.titulo}</span>
                  <span className="shrink-0 text-[10px] text-slate-400">{ESTADOS_BUG.find(e => e.value === b.estado)?.label}</span>
                  <span className="shrink-0 tabular-nums text-slate-800">{b.ticketsPeriodo} · {b.ticketsTotal}</span>
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>
      </div>

      <p className="text-right text-[11px] text-slate-400">
        Actualizado {new Date(datos.generado).toLocaleString('es-CO', { timeZone: 'America/Bogota' })} · tiempos en horas hábiles (America/Bogota)
      </p>
    </div>
  )
}
