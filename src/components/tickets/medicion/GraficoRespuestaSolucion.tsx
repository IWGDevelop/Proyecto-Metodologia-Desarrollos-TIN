'use client'

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { FilaResponsable } from './indicadores'
import { fmtH } from './indicadores'

// Barras horizontales agrupadas: horas hábiles promedio de respuesta y de solución por
// responsable. Una sola escala (horas). Colores: categórico 1 (azul) y 2 (naranja) de la
// paleta validada del skill dataviz; el texto usa tintas neutras, no el color de la serie.

const COLOR_RESPUESTA = '#2a78d6'
const COLOR_SOLUCION = '#eb6834'
const TINTA = '#475569'
const TINTA_SUAVE = '#94a3b8'
const REJILLA = '#e2e8f0'

interface Punto {
  nombre: string
  respuesta: number | null
  solucion: number | null
  pctRespuesta: number | null
  pctSolucion: number | null
}

function Leyenda() {
  return (
    <div className="flex items-center gap-4 text-xs text-slate-600">
      <span className="flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: COLOR_RESPUESTA }} />Primera respuesta</span>
      <span className="flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: COLOR_SOLUCION }} />Solución</span>
    </div>
  )
}

function Contenido({ active, payload }: { active?: boolean; payload?: { payload: Punto }[] }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-semibold text-slate-800">{p.nombre}</p>
      <p className="flex items-center gap-1.5 text-slate-600">
        <i className="inline-block h-2 w-2 rounded-sm" style={{ background: COLOR_RESPUESTA }} />
        Respuesta: <span className="font-medium text-slate-800">{fmtH(p.respuesta)}</span>
        {p.pctRespuesta != null && <span className="text-slate-500">· {Math.round(p.pctRespuesta)}% a tiempo</span>}
      </p>
      <p className="flex items-center gap-1.5 text-slate-600">
        <i className="inline-block h-2 w-2 rounded-sm" style={{ background: COLOR_SOLUCION }} />
        Solución: <span className="font-medium text-slate-800">{fmtH(p.solucion)}</span>
        {p.pctSolucion != null && <span className="text-slate-500">· {Math.round(p.pctSolucion)}% a tiempo</span>}
      </p>
    </div>
  )
}

export function GraficoRespuestaSolucion({ filas }: { filas: FilaResponsable[] }) {
  const datos: Punto[] = filas
    .filter(f => f.respuestaProm != null || f.solucionProm != null)
    .map(f => ({
      nombre: f.nombre,
      respuesta: f.respuestaProm == null ? null : Math.round(f.respuestaProm * 10) / 10,
      solucion: f.solucionProm == null ? null : Math.round(f.solucionProm * 10) / 10,
      pctRespuesta: f.pctRespuesta,
      pctSolucion: f.pctSolucion,
    }))

  if (!datos.length) {
    return <p className="py-10 text-center text-sm text-slate-500">Aún no hay tiempos medidos en el periodo.</p>
  }

  const alto = Math.max(160, datos.length * 56 + 40)
  return (
    <div className="space-y-2">
      <Leyenda />
      <ResponsiveContainer width="100%" height={alto}>
        <BarChart data={datos} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 8 }} barGap={2} barCategoryGap="28%">
          <CartesianGrid horizontal={false} stroke={REJILLA} strokeDasharray="0" />
          <XAxis
            type="number"
            tick={{ fontSize: 11, fill: TINTA_SUAVE }}
            axisLine={false}
            tickLine={false}
            tickFormatter={v => `${v} h`}
          />
          <YAxis
            type="category"
            dataKey="nombre"
            width={140}
            tick={{ fontSize: 12, fill: TINTA }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<Contenido />} cursor={{ fill: '#f1f5f9' }} />
          <Bar dataKey="respuesta" name="Primera respuesta" fill={COLOR_RESPUESTA} radius={[0, 4, 4, 0]} maxBarSize={16} />
          <Bar dataKey="solucion" name="Solución" fill={COLOR_SOLUCION} radius={[0, 4, 4, 0]} maxBarSize={16} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
