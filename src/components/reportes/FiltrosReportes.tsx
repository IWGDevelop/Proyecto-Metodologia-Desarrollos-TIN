'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { PROCESOS_INTERNOS } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { calcularRango, type FiltrosReportes } from '@/hooks/useReportesData'

const PRESETS: { value: FiltrosReportes['preset']; label: string }[] = [
  { value: 'mes',          label: 'Este mes' },
  { value: 'trimestre',    label: 'Trimestre' },
  { value: 'semestre',     label: 'Semestre' },
  { value: 'año',          label: 'Este año' },
  { value: 'personalizado', label: 'Personalizado' },
]

const ALCANCES = [
  { value: '', label: 'Todos' },
  { value: 'IWF', label: 'IWF' },
  { value: 'ILT', label: 'ILT' },
  { value: 'IWG', label: 'IWG' },
]

interface Props {
  filtros: FiltrosReportes
  onChange: (f: FiltrosReportes) => void
  total: number
}

export function FiltrosReportes({ filtros, onChange, total }: Props) {
  const setPreset = (preset: FiltrosReportes['preset']) => {
    if (preset === 'personalizado') {
      onChange({ ...filtros, preset })
    } else {
      const rango = calcularRango(preset)
      onChange({ ...filtros, preset, ...rango })
    }
  }

  return (
    <div className="sticky top-0 z-10 rounded-xl border border-slate-200 bg-white/95 p-4 shadow-sm backdrop-blur-sm">
      <div className="flex flex-wrap items-end gap-3">
        {/* Presets de fecha */}
        <div className="space-y-1">
          <Label className="text-xs text-slate-500">Período</Label>
          <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 gap-0.5">
            {PRESETS.map(p => (
              <button
                key={p.value}
                onClick={() => setPreset(p.value)}
                className={cn(
                  'rounded-md px-2.5 py-1 text-xs font-medium transition-all',
                  filtros.preset === p.value
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Fechas personalizadas */}
        {filtros.preset === 'personalizado' && (
          <div className="flex items-center gap-2">
            <div className="space-y-1">
              <Label className="text-xs text-slate-500">Desde</Label>
              <Input
                type="date"
                value={filtros.desde}
                onChange={e => onChange({ ...filtros, desde: e.target.value })}
                className="h-8 text-xs w-36"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-slate-500">Hasta</Label>
              <Input
                type="date"
                value={filtros.hasta}
                onChange={e => onChange({ ...filtros, hasta: e.target.value })}
                className="h-8 text-xs w-36"
              />
            </div>
          </div>
        )}

        {/* Alcance */}
        <div className="space-y-1">
          <Label className="text-xs text-slate-500">Alcance</Label>
          <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 gap-0.5">
            {ALCANCES.map(a => (
              <button
                key={a.value}
                onClick={() => onChange({ ...filtros, alcance: a.value })}
                className={cn(
                  'rounded-md px-2.5 py-1 text-xs font-medium transition-all',
                  filtros.alcance === a.value
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                )}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>

        {/* Proceso */}
        <div className="space-y-1">
          <Label className="text-xs text-slate-500">Proceso</Label>
          <Select
            value={filtros.proceso_interno || '_all'}
            onValueChange={(v: string | null) => onChange({ ...filtros, proceso_interno: (!v || v === '_all') ? '' : v })}
          >
            <SelectTrigger className="h-8 w-44 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">Todos los procesos</SelectItem>
              {PROCESOS_INTERNOS.map(p => (
                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Contador */}
        <span className="ml-auto text-xs text-slate-400">
          <span className="font-semibold text-slate-600">{total}</span> requerimientos en el período
        </span>
      </div>
    </div>
  )
}
