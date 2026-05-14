'use client'

import {
  PieChart, Pie, Cell, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'

interface DataPoint {
  proceso: string
  label: string
  count: number
  pct: number
}

const COLORES = [
  '#3b82f6','#6366f1','#f59e0b','#22c55e','#f97316',
  '#ec4899','#14b8a6','#8b5cf6','#06b6d4','#84cc16','#ef4444',
]

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null
  const d: DataPoint = payload[0].payload
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-md text-sm">
      <p className="font-semibold text-slate-700">{d.label}</p>
      <p className="text-slate-600">{d.count} requerimientos</p>
      <p className="text-slate-500">{d.pct}% del total</p>
    </div>
  )
}

const CustomLegend = ({ payload }: any) => (
  <ul className="mt-2 space-y-1.5 text-xs">
    {payload?.map((entry: any, i: number) => (
      <li key={i} className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 truncate text-slate-600">
          <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: entry.color }} />
          {entry.value}
        </span>
        <span className="shrink-0 font-medium text-slate-700">
          {entry.payload.count} <span className="text-slate-400">({entry.payload.pct}%)</span>
        </span>
      </li>
    ))}
  </ul>
)

export function GraficaProcesosChart({ data }: { data: DataPoint[] }) {
  const visible = data.filter(d => d.count > 0)
  return (
    <div className="flex flex-col items-center gap-2 lg:flex-row lg:items-start">
      <ResponsiveContainer width={200} height={200}>
        <PieChart>
          <Pie
            data={visible}
            dataKey="count"
            nameKey="label"
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={88}
            paddingAngle={2}
          >
            {visible.map((_, i) => (
              <Cell key={i} fill={COLORES[i % COLORES.length]} strokeWidth={0} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            content={<CustomLegend />}
            layout="vertical"
            align="right"
            verticalAlign="middle"
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex-1 w-full lg:hidden">
        <CustomLegend payload={visible.map((d, i) => ({
          value: d.label,
          color: COLORES[i % COLORES.length],
          payload: d,
        }))} />
      </div>
    </div>
  )
}
