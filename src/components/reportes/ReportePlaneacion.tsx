'use client'

import { useMemo, useState } from 'react'
import { Download, Search, CalendarRange, Filter, UserCog, ChevronDown, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { exportarReporte } from '@/lib/exportar'
import { PRIORIDADES } from '@/lib/constants'
import { useEstados } from '@/context/EstadosContext'
import { useProcesos } from '@/context/ProcesosContext'
import { ETAPAS_PLANEACION } from '@/lib/etapas-planeacion'
import { GanttPlaneacion, ICONO_CUMPLIMIENTO } from './GanttPlaneacion'
import type { CumplimientoEtapa, RequerimientoPlaneacion } from '@/actions/reporte-planeacion'

interface Props {
  datos: RequerimientoPlaneacion[]
}

const CON_ALERTA: CumplimientoEtapa[] = ['RETRASADA', 'VENCIDA', 'INICIO_ATRASADO']
const SIN_ASIGNAR = '__sin_asignar__'

type FasePeriodo = 'AMBAS' | 'EN_DESARROLLO' | 'PRUEBAS_USUARIO'

/** Devuelve un actualizador de Set que agrega o quita `valor` */
const alternar = (valor: string) => (prev: Set<string>) => {
  const next = new Set(prev)
  next.has(valor) ? next.delete(valor) : next.add(valor)
  return next
}

/** Filtro de selección múltiple en un desplegable (mismo patrón que el listado de Requerimientos) */
function FiltroMultiple({
  etiqueta, Icon, opciones, seleccion, onToggle, onLimpiar,
}: {
  etiqueta: string
  Icon: React.ElementType
  opciones: { valor: string; contenido: React.ReactNode }[]
  seleccion: Set<string>
  onToggle: (valor: string) => void
  onLimpiar: () => void
}) {
  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          'inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors',
          seleccion.size
            ? 'border-blue-400 bg-blue-50 text-blue-700'
            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
        )}
      >
        <Icon size={13} />
        {etiqueta}
        {seleccion.size > 0 && (
          <span className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] text-white">
            {seleccion.size}
          </span>
        )}
        <ChevronDown size={12} />
      </PopoverTrigger>
      <PopoverContent className="max-h-80 w-72 overflow-y-auto p-2" align="start">
        <div className="space-y-1">
          {opciones.length === 0 && <p className="px-2 py-1.5 text-xs text-slate-400">Sin opciones</p>}
          {opciones.map(o => (
            <label key={o.valor} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-slate-50">
              <Checkbox checked={seleccion.has(o.valor)} onCheckedChange={() => onToggle(o.valor)} />
              {o.contenido}
            </label>
          ))}
        </div>
        {seleccion.size > 0 && (
          <button onClick={onLimpiar} className="mt-1 w-full rounded-md px-2 py-1.5 text-left text-xs text-slate-500 hover:bg-slate-50">
            Quitar selección
          </button>
        )}
      </PopoverContent>
    </Popover>
  )
}

function formatDesv(dias: number | null): string {
  if (dias === null) return '—'
  if (dias === 0) return '0d'
  return dias > 0 ? `+${dias}d` : `${dias}d`
}

const promedio = (xs: number[]) => xs.length ? Math.round(xs.reduce((s, x) => s + x, 0) / xs.length) : null

function TextoDesv({ dias }: { dias: number | null }) {
  return (
    <span className={cn(
      'tabular-nums',
      dias === null ? 'text-slate-300' : dias > 0 ? 'font-semibold text-red-600' : 'text-emerald-600'
    )}>
      {formatDesv(dias)}
    </span>
  )
}

function Kpi({ label, valor, detalle, tono }: { label: string; valor: string | number; detalle?: string; tono?: 'alerta' }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={cn('mt-1 text-2xl font-bold tabular-nums', tono === 'alerta' ? 'text-red-600' : 'text-slate-800')}>{valor}</p>
      {detalle && <p className="mt-0.5 text-[11px] text-slate-400">{detalle}</p>}
    </div>
  )
}

export function ReportePlaneacion({ datos }: Props) {
  const procesos = useProcesos()
  const getEstadoCfg = useEstados().cfg
  const [busqueda, setBusqueda] = useState('')
  const [proceso, setProceso] = useState('')
  const [soloAlertas, setSoloAlertas] = useState(false)
  const [criticidad, setCriticidad] = useState('')
  const [estadosFiltro, setEstadosFiltro] = useState<Set<string>>(new Set())
  const [devsFiltro, setDevsFiltro] = useState<Set<string>>(new Set())
  const [fasePeriodo, setFasePeriodo] = useState<FasePeriodo>('AMBAS')
  const [periodoDesde, setPeriodoDesde] = useState('')
  const [periodoHasta, setPeriodoHasta] = useState('')

  const periodoActivo = !!(periodoDesde || periodoHasta)
  const hayFiltros = !!(busqueda || proceso || criticidad || soloAlertas || estadosFiltro.size || devsFiltro.size || periodoActivo)
  const limpiarFiltros = () => {
    setBusqueda(''); setProceso(''); setCriticidad(''); setSoloAlertas(false)
    setEstadosFiltro(new Set()); setDevsFiltro(new Set())
    setFasePeriodo('AMBAS'); setPeriodoDesde(''); setPeriodoHasta('')
  }

  const estadosDisponibles = useMemo(() => [...new Set(datos.map(r => r.estado))].sort(), [datos])
  const desarrolladoresDisponibles = useMemo(() => {
    const porId = new Map<string, string>()
    for (const r of datos) for (const d of r.desarrolladores) porId.set(d.id, d.nombre)
    return [...porId].map(([id, nombre]) => ({ id, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre))
  }, [datos])

  /** La fase planeada del requerimiento se cruza con el periodo seleccionado */
  const enPeriodo = (r: RequerimientoPlaneacion) => {
    if (!periodoActivo) return true
    const fases = fasePeriodo === 'AMBAS' ? ['EN_DESARROLLO', 'PRUEBAS_USUARIO'] : [fasePeriodo]
    return r.etapas.some(e => {
      if (!fases.includes(e.estado)) return false
      const inicio = e.planInicio ?? e.planFin
      const fin = e.planFin ?? e.planInicio
      if (!inicio || !fin) return false
      return (!periodoHasta || inicio <= periodoHasta) && (!periodoDesde || fin >= periodoDesde)
    })
  }

  const coincideDesarrollador = (r: RequerimientoPlaneacion) =>
    devsFiltro.size === 0 ||
    (r.desarrolladores.length === 0 ? devsFiltro.has(SIN_ASIGNAR) : r.desarrolladores.some(d => devsFiltro.has(d.id)))

  const { filtrados, visibles } = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    const coinciden = datos.filter(r =>
      (!q || r.nombre.toLowerCase().includes(q) || (r.numero ?? '').toLowerCase().includes(q)) &&
      (!proceso || r.proceso_interno === proceso) &&
      (!criticidad || String(r.prioridad ?? '') === criticidad) &&
      (estadosFiltro.size === 0 || estadosFiltro.has(r.estado)) &&
      coincideDesarrollador(r) &&
      enPeriodo(r) &&
      (!soloAlertas || r.etapas.some(e => CON_ALERTA.includes(e.cumplimiento)))
    )
    // En el Gantt se conservan los ancestros de cada coincidencia para no romper la jerarquía
    const porId = new Map(datos.map(r => [r.id, r]))
    const mostrar = new Set<string>()
    for (const r of coinciden) {
      for (let n: RequerimientoPlaneacion | undefined = r; n && !mostrar.has(n.id); n = n.parent_id ? porId.get(n.parent_id) : undefined) {
        mostrar.add(n.id)
      }
    }
    return {
      // Indicadores, resumen y exportación: solo requerimientos con planeación propia
      filtrados: coinciden.filter(r => r.tienePlan),
      visibles: datos.filter(r => mostrar.has(r.id)),
    }
  }, [datos, busqueda, proceso, criticidad, estadosFiltro, devsFiltro, fasePeriodo, periodoDesde, periodoHasta, soloAlertas]) // eslint-disable-line react-hooks/exhaustive-deps

  const etapasPlaneadas = filtrados.flatMap(r => r.etapas.filter(e => e.cumplimiento !== 'SIN_PLAN'))
  const terminadas = etapasPlaneadas.filter(e => e.cumplimiento === 'A_TIEMPO' || e.cumplimiento === 'RETRASADA')
  const aTiempo = terminadas.filter(e => e.cumplimiento === 'A_TIEMPO').length
  const conAlerta = etapasPlaneadas.filter(e => CON_ALERTA.includes(e.cumplimiento)).length
  const desvPromFin = promedio(terminadas.map(e => e.desvFin).filter((d): d is number => d !== null))

  const resumenEtapas = ETAPAS_PLANEACION.map(etapa => {
    const filas = filtrados.map(r => r.etapas.find(e => e.estado === etapa.estado)!).filter(e => e.cumplimiento !== 'SIN_PLAN')
    const term = filas.filter(e => e.cumplimiento === 'A_TIEMPO' || e.cumplimiento === 'RETRASADA')
    return {
      ...etapa,
      planeadas: filas.length,
      terminadas: term.length,
      aTiempo: filas.filter(e => e.cumplimiento === 'A_TIEMPO').length,
      retrasadas: filas.filter(e => e.cumplimiento === 'RETRASADA').length,
      enAlerta: filas.filter(e => e.cumplimiento === 'VENCIDA' || e.cumplimiento === 'INICIO_ATRASADO').length,
      desvFin: promedio(term.map(e => e.desvFin).filter((d): d is number => d !== null)),
      durPlan: promedio(filas.map(e => e.duracionPlan).filter((d): d is number => d !== null)),
      durReal: promedio(term.map(e => e.duracionReal).filter((d): d is number => d !== null)),
    }
  })

  const exportar = () => {
    const filas = filtrados.flatMap(r => r.etapas
      .filter(e => e.cumplimiento !== 'SIN_PLAN')
      .map(e => ({ req: r, e })))
    exportarReporte('Planeacion_vs_Ejecutado', filas, [
      { titulo: 'N°',               ancho: 8,  render: ({ req }) => req.numero ?? '' },
      { titulo: 'Requerimiento',    ancho: 45, render: ({ req }) => `${'   '.repeat(req.nivel)}${req.nivel > 0 ? '↳ ' : ''}${req.nombre}` },
      { titulo: 'Criticidad',       ancho: 16, render: ({ req }) => req.prioridad ? `${req.etiqueta} ${PRIORIDADES[req.prioridad]?.label ?? ''}`.trim() : 'Sin prioridad' },
      { titulo: 'Requerimiento padre', ancho: 40, render: ({ req }) => req.parent_id ? (datos.find(d => d.id === req.parent_id)?.nombre ?? '') : '' },
      { titulo: 'Inicio Desarrollo planeado', ancho: 18, render: ({ req }) => req.inicioDesarrollo ?? '' },
      { titulo: 'Estado actual',    ancho: 24, render: ({ req }) => getEstadoCfg(req.estado).label },
      { titulo: 'Etapa',            ancho: 28, render: ({ e }) => e.label },
      { titulo: 'Inicio planeado',  ancho: 15, render: ({ e }) => e.planInicio ?? '' },
      { titulo: 'Fin planeado',     ancho: 15, render: ({ e }) => e.planFin ?? '' },
      { titulo: 'Inicio real',      ancho: 15, render: ({ e }) => e.realInicio ?? '' },
      { titulo: 'Fin real',         ancho: 15, render: ({ e }) => e.enCurso ? 'En curso' : e.realFin ?? '' },
      { titulo: 'Desv. inicio (d)', ancho: 14, render: ({ e }) => e.desvInicio ?? '' },
      { titulo: 'Desv. fin (d)',    ancho: 14, render: ({ e }) => e.desvFin ?? '' },
      { titulo: 'Duración plan (d)', ancho: 16, render: ({ e }) => e.duracionPlan ?? '' },
      { titulo: 'Duración real (d)', ancho: 16, render: ({ e }) => e.duracionReal ?? '' },
      { titulo: 'Ingresos a la etapa', ancho: 16, render: ({ e }) => e.veces },
      { titulo: 'Cumplimiento',     ancho: 18, render: ({ e }) => ICONO_CUMPLIMIENTO[e.cumplimiento as CumplimientoEtapa].label },
    ])
  }

  if (datos.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-white py-16 text-center">
        <CalendarRange size={32} className="mx-auto mb-3 text-slate-200" />
        <p className="text-sm font-medium text-slate-500">Aún no hay requerimientos con fechas de planeación</p>
        <p className="mt-1 text-xs text-slate-400">Regístralas en el detalle del requerimiento → Fechas → Fechas de planeación</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-w-52 flex-1 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2">
          <Search size={13} className="shrink-0 text-slate-400" />
          <input
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar requerimiento..."
            className="flex-1 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
          />
        </div>
        <select
          value={proceso}
          onChange={e => setProceso(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
        >
          <option value="">Todos los procesos</option>
          {procesos.todos.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
        <select
          value={criticidad}
          onChange={e => setCriticidad(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
        >
          <option value="">Todas las criticidades</option>
          {Object.entries(PRIORIDADES).map(([valor, p]) => <option key={valor} value={valor}>{p.label}</option>)}
        </select>
        <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
          <input type="checkbox" checked={soloAlertas} onChange={e => setSoloAlertas(e.target.checked)} />
          Solo con alertas
        </label>
        <Button variant="outline" size="sm" onClick={exportar} className="gap-1.5 text-xs">
          <Download size={13} /> Exportar Excel
        </Button>
      </div>

      {/* Estado · Desarrollador · Periodo */}
      <div className="flex flex-wrap items-center gap-2">
        <FiltroMultiple
          etiqueta="Estado"
          Icon={Filter}
          seleccion={estadosFiltro}
          onToggle={e => setEstadosFiltro(alternar(e))}
          onLimpiar={() => setEstadosFiltro(new Set())}
          opciones={estadosDisponibles.map(e => {
            const cfg = getEstadoCfg(e)
            return {
              valor: e,
              contenido: <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', cfg.bgColor, cfg.textColor)}>{cfg.label}</span>,
            }
          })}
        />
        <FiltroMultiple
          etiqueta="Desarrollador"
          Icon={UserCog}
          seleccion={devsFiltro}
          onToggle={d => setDevsFiltro(alternar(d))}
          onLimpiar={() => setDevsFiltro(new Set())}
          opciones={[
            ...desarrolladoresDisponibles.map(d => ({ valor: d.id, contenido: <span className="text-xs text-slate-700">{d.nombre}</span> })),
            { valor: SIN_ASIGNAR, contenido: <span className="text-xs italic text-slate-400">Sin desarrollador asignado</span> },
          ]}
        />

        <div className={cn(
          'flex flex-wrap items-center gap-1.5 rounded-lg border bg-white px-2 py-1',
          periodoActivo ? 'border-blue-400 bg-blue-50/50' : 'border-slate-200'
        )}>
          <CalendarRange size={13} className={periodoActivo ? 'text-blue-600' : 'text-slate-400'} />
          <select
            value={fasePeriodo}
            onChange={e => setFasePeriodo(e.target.value as FasePeriodo)}
            className="bg-transparent py-0.5 text-xs font-medium text-slate-700 outline-none"
            aria-label="Fase del periodo"
          >
            <option value="AMBAS">Desarrollo o pruebas de usuario</option>
            <option value="EN_DESARROLLO">Desarrollo</option>
            <option value="PRUEBAS_USUARIO">Pruebas de usuario</option>
          </select>
          <span className="text-xs text-slate-400">entre</span>
          <input
            type="date"
            value={periodoDesde}
            onChange={e => setPeriodoDesde(e.target.value)}
            className="rounded border border-slate-200 px-1.5 py-0.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-300"
            aria-label="Desde"
          />
          <span className="text-xs text-slate-400">y</span>
          <input
            type="date"
            value={periodoHasta}
            min={periodoDesde || undefined}
            onChange={e => setPeriodoHasta(e.target.value)}
            className="rounded border border-slate-200 px-1.5 py-0.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-300"
            aria-label="Hasta"
          />
        </div>

        {hayFiltros && (
          <Button variant="ghost" size="sm" onClick={limpiarFiltros} className="gap-1 text-xs text-slate-500">
            <X size={13} /> Limpiar filtros
          </Button>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi label="Requerimientos planeados" valor={filtrados.length} />
        <Kpi label="Etapas terminadas" valor={terminadas.length} detalle={`de ${etapasPlaneadas.length} planeadas`} />
        <Kpi
          label="Cumplimiento a tiempo"
          valor={terminadas.length ? `${Math.round((aTiempo / terminadas.length) * 100)}%` : '—'}
          detalle={`${aTiempo} de ${terminadas.length} terminadas`}
        />
        <Kpi label="Etapas con alerta" valor={conAlerta} detalle="retrasadas, vencidas o sin iniciar" tono={conAlerta > 0 ? 'alerta' : undefined} />
        <Kpi label="Desviación prom. de fin" valor={formatDesv(desvPromFin)} detalle="en etapas terminadas" tono={(desvPromFin ?? 0) > 0 ? 'alerta' : undefined} />
      </div>

      {/* Gantt planeado vs. ejecutado */}
      <GanttPlaneacion
        requerimientos={visibles}
        periodo={periodoActivo ? { desde: periodoDesde || null, hasta: periodoHasta || null } : null}
      />

      {/* Resumen por etapa */}
      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-bold text-slate-800">Cumplimiento por etapa</h2>
          <p className="text-xs text-slate-500">Desviación positiva = la etapa terminó después de lo planeado</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                <th className="px-4 py-2.5">Etapa</th>
                <th className="px-3 py-2.5 text-right">Planeadas</th>
                <th className="px-3 py-2.5 text-right">Terminadas</th>
                <th className="px-3 py-2.5 text-right">A tiempo</th>
                <th className="px-3 py-2.5 text-right">Con retraso</th>
                <th className="px-3 py-2.5 text-right">Vencidas / sin iniciar</th>
                <th className="px-3 py-2.5 text-right">Desv. prom. fin</th>
                <th className="px-3 py-2.5 text-right">Duración prom. plan / real</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 tabular-nums">
              {resumenEtapas.map(r => (
                <tr key={r.estado}>
                  <td className="px-4 py-2.5 font-medium text-slate-700">{r.label}</td>
                  <td className="px-3 py-2.5 text-right text-slate-600">{r.planeadas}</td>
                  <td className="px-3 py-2.5 text-right text-slate-600">{r.terminadas}</td>
                  <td className="px-3 py-2.5 text-right text-emerald-700">{r.aTiempo}</td>
                  <td className={cn('px-3 py-2.5 text-right', r.retrasadas ? 'font-semibold text-red-600' : 'text-slate-400')}>{r.retrasadas}</td>
                  <td className={cn('px-3 py-2.5 text-right', r.enAlerta ? 'font-semibold text-orange-600' : 'text-slate-400')}>{r.enAlerta}</td>
                  <td className="px-3 py-2.5 text-right"><TextoDesv dias={r.desvFin} /></td>
                  <td className="px-3 py-2.5 text-right text-slate-600">
                    {r.durPlan ?? '—'}d / {r.durReal ?? '—'}d
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
