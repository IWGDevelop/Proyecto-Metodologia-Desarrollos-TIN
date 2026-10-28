import type { ClasificacionBug, EstadoBug, SeveridadBug } from '@/lib/tickets/types'

// Estilos compartidos del tablero de bugs y del dashboard de tickets

export const BORDE_SEVERIDAD: Record<SeveridadBug, string> = {
  BLOQUEANTE: 'border-l-red-600',
  ALTA: 'border-l-orange-500',
  MEDIA: 'border-l-yellow-400',
  BAJA: 'border-l-slate-300',
}

export const PILL_SEVERIDAD: Record<SeveridadBug, string> = {
  BLOQUEANTE: 'bg-red-100 text-red-700',
  ALTA: 'bg-orange-100 text-orange-700',
  MEDIA: 'bg-yellow-100 text-yellow-800',
  BAJA: 'bg-slate-100 text-slate-600',
}

export const PILL_CLASIFICACION: Record<ClasificacionBug, string> = {
  BUG: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200',
  DEUDA_TECNICA: 'bg-amber-50 text-amber-800 ring-1 ring-amber-200',
  PARAMETRIZACION: 'bg-violet-50 text-violet-700 ring-1 ring-violet-200',
  INFRAESTRUCTURA: 'bg-slate-50 text-slate-700 ring-1 ring-slate-200',
}

export const CORTO_CLASIFICACION: Record<ClasificacionBug, string> = {
  BUG: 'Bug',
  DEUDA_TECNICA: 'Deuda técnica',
  PARAMETRIZACION: 'Parametrización',
  INFRAESTRUCTURA: 'Infraestructura',
}

export const COLOR_ESTADO_BUG: Record<EstadoBug, string> = {
  REPORTADO: 'bg-slate-100 text-slate-700',
  CONFIRMADO: 'bg-blue-100 text-blue-700',
  PRIORIZADO: 'bg-indigo-100 text-indigo-700',
  EN_DESARROLLO: 'bg-purple-100 text-purple-700',
  EN_PRUEBAS: 'bg-amber-100 text-amber-800',
  DESPLEGADO: 'bg-emerald-100 text-emerald-700',
}

export const SELECT_CLASE =
  'h-8 rounded-lg border border-input bg-white px-2.5 text-sm text-slate-700 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'
