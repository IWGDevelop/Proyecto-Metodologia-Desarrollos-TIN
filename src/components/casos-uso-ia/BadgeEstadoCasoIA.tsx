import { cn } from '@/lib/utils'
import type { EstadoCasoUsoIA } from '@/lib/supabase/types'

const CONFIG: Record<EstadoCasoUsoIA, { label: string; className: string }> = {
  RECIBIDO:            { label: 'Recibido',             className: 'bg-blue-100 text-blue-800 border-blue-200' },
  EN_EVALUACION:       { label: 'En Evaluación',        className: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
  EN_AJUSTE:           { label: 'En Ajuste',            className: 'bg-amber-100 text-amber-800 border-amber-200' },
  AUTORIZADO:          { label: 'Autorizado',           className: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  HABILITADO:          { label: 'Habilitado',           className: 'bg-teal-100 text-teal-800 border-teal-200' },
  EN_OPERACION:        { label: 'En Operación',         className: 'bg-green-100 text-green-800 border-green-200' },
  RENOVACION_PENDIENTE:{ label: 'Renovación Pendiente', className: 'bg-orange-100 text-orange-800 border-orange-200' },
  SUSPENDIDO:          { label: 'Suspendido',           className: 'bg-red-100 text-red-800 border-red-200' },
  REVOCADO_VENCIDO:    { label: 'Revocado / Vencido',  className: 'bg-slate-100 text-slate-600 border-slate-200' },
}

export function BadgeEstadoCasoIA({ estado }: { estado: EstadoCasoUsoIA }) {
  const cfg = CONFIG[estado] ?? { label: estado, className: 'bg-slate-100 text-slate-600 border-slate-200' }
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium', cfg.className)}>
      {cfg.label}
    </span>
  )
}

export function labelEstadoCasoIA(estado: EstadoCasoUsoIA): string {
  return CONFIG[estado]?.label ?? estado
}

export const ESTADOS_CASO_IA = Object.entries(CONFIG).map(([value, { label }]) => ({ value, label }))
