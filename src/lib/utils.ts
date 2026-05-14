import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistanceToNow, differenceInDays } from 'date-fns'
import { es } from 'date-fns/locale'
import type { ActividadImpacto } from './supabase/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCOP(valor: number | null | undefined): string {
  if (valor == null) return '—'
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(valor)
}

export function formatFecha(fecha: string | Date | null | undefined): string {
  if (!fecha) return '—'
  try {
    return format(new Date(fecha), 'dd/MM/yyyy', { locale: es })
  } catch {
    return '—'
  }
}

export function formatFechaRelativa(fecha: string | Date | null | undefined): string {
  if (!fecha) return '—'
  try {
    return formatDistanceToNow(new Date(fecha), { addSuffix: true, locale: es })
  } catch {
    return '—'
  }
}

export function calcularDiasEntre(
  fecha1: string | Date | null | undefined,
  fecha2: string | Date | null | undefined
): number | null {
  if (!fecha1 || !fecha2) return null
  try {
    return differenceInDays(new Date(fecha2), new Date(fecha1))
  } catch {
    return null
  }
}

export function calcularSLA(
  prioridad: number | null | undefined,
  diasRespuesta: number | null | undefined
): boolean | null {
  if (prioridad == null || diasRespuesta == null) return null
  const limites: Record<number, number> = { 1: 5, 2: 15, 3: 30, 4: 60 }
  const limite = limites[prioridad]
  if (!limite) return null
  return diasRespuesta <= limite
}

export function getColorEstado(estado: string): string {
  const colores: Record<string, string> = {
    SIN_GESTION:      'bg-slate-100 text-slate-700 border-slate-300',
    ANALISIS:         'bg-blue-100 text-blue-700 border-blue-300',
    EN_DESARROLLO:    'bg-indigo-100 text-indigo-700 border-indigo-300',
    PRUEBAS_USUARIO:  'bg-amber-100 text-amber-700 border-amber-300',
    STAND_BY:         'bg-orange-100 text-orange-700 border-orange-300',
    ENTREGADO:        'bg-green-100 text-green-700 border-green-300',
    CERRADO:          'bg-gray-100 text-gray-500 border-gray-300',
  }
  return colores[estado] ?? 'bg-slate-100 text-slate-700 border-slate-300'
}

export function getColorPrioridad(prioridad: number | null | undefined): string {
  const colores: Record<number, string> = {
    1: 'bg-red-100 text-red-700 border-red-300',
    2: 'bg-orange-100 text-orange-700 border-orange-300',
    3: 'bg-yellow-100 text-yellow-700 border-yellow-300',
    4: 'bg-green-100 text-green-700 border-green-300',
  }
  if (!prioridad) return 'bg-slate-100 text-slate-600 border-slate-300'
  return colores[prioridad] ?? 'bg-slate-100 text-slate-600 border-slate-300'
}

export function calcularHorasAhorradasMes(
  actividades: ActividadImpacto[] | null | undefined
): number {
  if (!actividades?.length) return 0
  return actividades.reduce((total, act) => {
    return total + act.horas_mes * (act.porcentaje_automatizable / 100)
  }, 0)
}

export function calcularAhorroCOP(
  horasMes: number | null | undefined,
  valorHoraHombre: number | null | undefined
): { mensual: number; anual: number } {
  if (!horasMes || !valorHoraHombre) return { mensual: 0, anual: 0 }
  const mensual = horasMes * valorHoraHombre
  return { mensual, anual: mensual * 12 }
}
