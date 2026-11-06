'use client'

import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { MOTIVOS_DESISTIMIENTO } from '@/lib/constants'

interface Props {
  value: string
  onChange: (v: string) => void
}

/** Lista desplegable obligatoria del motivo cuando un requerimiento pasa a Desistido */
export function MotivoDesistimientoSelect({ value, onChange }: Props) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor="motivo-desistimiento" className="text-sm">
        Motivo del desistimiento <span className="text-red-500">*</span>
      </Label>
      <Select value={value} onValueChange={v => onChange(v ?? '')}>
        <SelectTrigger id="motivo-desistimiento" className="w-full">
          <SelectValue placeholder="Selecciona un motivo..." />
        </SelectTrigger>
        <SelectContent>
          {MOTIVOS_DESISTIMIENTO.map(m => (
            <SelectItem key={m} value={m}>{m}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

/** Valida motivo + observación (si el motivo es "Otro", la observación es obligatoria) */
export function errorMotivoDesistimiento(motivo: string, observacion: string): string | null {
  if (!motivo) return 'Selecciona el motivo del desistimiento'
  if (motivo === 'Otro' && !observacion.trim()) return 'Describe el motivo en la observación'
  return null
}
