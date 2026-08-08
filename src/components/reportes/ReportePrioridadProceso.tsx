'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, Cell,
} from 'recharts'
import { ExternalLink, X } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { ESTADOS, PRIORIDADES } from '@/lib/constants'
import type { MetricaRequerimiento, Estado } from '@/lib/supabase/types'

interface Props {
  datos: MetricaRequerimiento[]
  isLoading: boolean
}

const PROCESO_COLOR: Record<string, string> = {
  FINANCIERO:       '#3b82f6',
  OPERACIONES:      '#10b981',
  COMERCIAL:        '#f59e0b',
  CARGA:            '#8b5cf6',
  SISTEMAS_GESTION: '#06b6d4',
  SERVICIO_CLIENTE: '#ec4899',
  COMPRAS:          '#f97316',
  SEGUROS:          '#84cc16',
  DATOS:            '#a78bfa',
  TI:               '#0ea5e9',
  GENERAL:          '#94a3b8',
  PRICING:          '#fb7185',
  ESTRATEGIA:       '#34d399',
}

const PROCESO_LABEL: Record<string, string> = {
  FINANCIERO:       'Financiero',
  OPERACIONES:      'Operaciones',
  COMERCIAL:        'Comercial',
  CARGA:            'Carga',
  SISTEMAS_GESTION: 'Sistemas de Gestión',
  SERVICIO_CLIENTE: 'Servicio al Cliente',
  COMPRAS:          'Compras',
  SEGUROS:          'Seguros',
  DATOS:            'Datos',
  TI:               'TI',
  GENERAL:          'General',
  PRICING:           'Pricing',
  ESTRATEGIA:        'Estrategia',
  MARKETING:         'Marketing',
  TRAFICO_SEGURIDAD: 'Tráfico y Seguridad',
}

const ESTADO_LABEL: Record<string, string> = {
  SIN_GESTION:                        'Recibido',
  EN_ESPERA_DE_COMITE_DE_PRIORIDADES: 'En espera de comité de prioridades',
  ANALISIS:                           'En estudio y evaluación técnica',
  EN_DEFINICION_USUARIO:              'Definición de usuario',
  EN_DESARROLLO:                      'Desarrollo',
  PRUEBAS_USUARIO:                    'Pruebas usuario',
  STAND_BY:                           'Stand By',
  EN_ESPERA_POR_TERCEROS:             'En espera por terceros',
  AJUSTES_TECNICOS:                   'Ajustes técnicos',
  PROGRAMADO_PARA_SALIDA_EN_VIVO:     'Programado para salida en vivo',
  ENTREGADO:                          'Entregado y en funcionamiento',
  CERRADO:                            'Cerrado',
  DESISTIDO:                          'Desistido',
  NO_VIABLE:                          'No viable',
}

interface Seleccion {
  prioridad: number
  proceso: string | null
}

export function ReportePrioridadProceso({ datos, isLoading }: Props) {
  const [seleccion, setSeleccion] = useState<Seleccion | null>(null)

  const activos = useMemo(() => datos.filter(r => !r.es_borrador), [datos])

  // Procesos presentes en los datos
  const procesosPresentes = useMemo(() => {
    const set = new Set<string>()
    activos.forEach(r => { if (r.proceso_interno) set.add(r.proceso_interno) })
    return Array.from(set).sort()
  }, [activos])

  // Datos para la gráfica: una fila por prioridad con conteos por proceso
  const chartData = useMemo(() => {
    const prioridades = [1, 2, 3, 4, 5]
    return prioridades.map(p => {
      const base: Record<string, number | string> = { prioridad: `P${p}`, _num: p }
      procesosPresentes.forEach(proc => {
        base[proc] = activos.filter(r => r.prioridad === p && r.proceso_interno === proc).length
      })
      // Reqs sin proceso
      const sinProceso = activos.filter(r => r.prioridad === p && !r.proceso_interno).length
      if (sinProceso > 0) base['SIN_PROCESO'] = sinProceso
      return base
    }).filter(row => {
      const total = procesosPresentes.reduce((s, p) => s + ((row[p] as number) || 0), 0) +
        ((row['SIN_PROCESO'] as number) || 0)
      return total > 0
    })
  }, [activos, procesosPresentes])

  const todosLosProcesos = useMemo(() => {
    const set = new Set([...procesosPresentes])
    activos.forEach(r => { if (!r.proceso_interno) set.add('SIN_PROCESO') })
    return Array.from(set)
  }, [procesosPresentes, activos])

  // Reqs del segmento seleccionado
  const reqsFiltrados = useMemo(() => {
    if (!seleccion) return []
    return activos.filter(r =>
      r.prioridad === seleccion.prioridad &&
      (seleccion.proceso === 'SIN_PROCESO'
        ? !r.proceso_interno
        : r.proceso_interno === seleccion.proceso)
    ).sort((a, b) => (a.nombre_desarrollo ?? '').localeCompare(b.nombre_desarrollo ?? ''))
  }, [seleccion, activos])

  const handleBarClick = (data: any, proceso: string) => {
    const num = data._num as number
    if (seleccion?.prioridad === num && seleccion?.proceso === proceso) {
      setSeleccion(null)
    } else {
      setSeleccion({ prioridad: num, proceso })
    }
  }

  if (isLoading) return <Skeleton className="h-80 w-full rounded-xl" />

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold text-slate-800">Requerimientos por prioridad y proceso</h3>
        <p className="text-xs text-slate-500 mt-0.5">Haz clic en un segmento para ver los desarrollos correspondientes</p>
      </div>

      {/* Gráfica */}
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="prioridad" tick={{ fontSize: 12, fill: '#64748b' }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
          <Tooltip
            formatter={(value: any, name: any) => [
              value as number,
              name === 'SIN_PROCESO' ? 'Sin proceso' : (PROCESO_LABEL[name as string] ?? name),
            ]}
            contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
          />
          <Legend
            formatter={(v: string) => v === 'SIN_PROCESO' ? 'Sin proceso' : (PROCESO_LABEL[v] ?? v)}
            wrapperStyle={{ fontSize: 11 }}
          />
          {todosLosProcesos.map(proc => (
            <Bar
              key={proc}
              dataKey={proc}
              stackId="a"
              fill={proc === 'SIN_PROCESO' ? '#cbd5e1' : (PROCESO_COLOR[proc] ?? '#94a3b8')}
              cursor="pointer"
              onClick={(data) => handleBarClick(data, proc)}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>

      {/* Drilldown */}
      {seleccion && (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-700">
                P{seleccion.prioridad} —{' '}
                {seleccion.proceso === 'SIN_PROCESO'
                  ? 'Sin proceso'
                  : (PROCESO_LABEL[seleccion.proceso ?? ''] ?? seleccion.proceso)}
              </span>
              <span className="text-xs text-slate-400">{reqsFiltrados.length} desarrollo{reqsFiltrados.length !== 1 ? 's' : ''}</span>
            </div>
            <button onClick={() => setSeleccion(null)} className="text-slate-400 hover:text-slate-600">
              <X size={15} />
            </button>
          </div>

          {reqsFiltrados.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">Sin requerimientos en este segmento</p>
          ) : (
            <ol className="divide-y divide-slate-100">
              {reqsFiltrados.map(r => {
                const estadoCfg = ESTADOS[r.estado as Estado]
                return (
                  <li key={r.id}>
                    <Link
                      href={`/admin/requerimientos/${r.id}`}
                      className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50 transition-colors group"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-800 truncate group-hover:text-blue-600 transition-colors">
                          {r.nombre_desarrollo ?? r.identificacion}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {r.responsable && (
                            <span className="text-xs text-slate-400 truncate">{r.responsable}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border', estadoCfg?.bgColor ?? 'bg-slate-100', estadoCfg?.textColor ?? 'text-slate-600', estadoCfg?.borderColor ?? 'border-slate-200')}
                        >
                          {ESTADO_LABEL[r.estado] ?? r.estado}
                        </span>
                        <ExternalLink size={13} className="text-slate-300 group-hover:text-blue-400 transition-colors" />
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ol>
          )}
        </div>
      )}
    </div>
  )
}
