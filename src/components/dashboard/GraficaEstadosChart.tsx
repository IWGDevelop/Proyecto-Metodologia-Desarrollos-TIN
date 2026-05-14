'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, LabelList,
} from 'recharts'

interface DataPoint {
  estado: string
  label: string
  count: number
  pct: number
  color: string
}

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

export function GraficaEstadosChart({ data }: { data: DataPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 48, left: 8, bottom: 4 }}
      >
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
        <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
        <YAxis
          dataKey="label"
          type="category"
          tick={{ fontSize: 11, fill: '#64748b' }}
          axisLine={false}
          tickLine={false}
          width={110}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
        <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={28}>
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.color} />
          ))}
          <LabelList
            dataKey="pct"
            position="right"
            formatter={(v: unknown) => `${v}%`}
            style={{ fontSize: 11, fill: '#94a3b8' }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
