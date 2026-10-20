'use client'

import { createContext, useContext, useMemo } from 'react'
import { PROCESOS_POR_DEFECTO, labelDeProceso, type ProcesoInternoCfg } from '@/lib/procesos'

interface ProcesosContextValue {
  /** Catálogo completo, incluidos los inactivos (para mostrar registros existentes) */
  todos: ProcesoInternoCfg[]
  /** Procesos activos, en orden: los que se ofrecen en los formularios y filtros */
  activos: ProcesoInternoCfg[]
  /** Nombre visible de un proceso a partir de su código */
  label: (valor: string | null | undefined) => string
}

const ProcesosContext = createContext<ProcesosContextValue | null>(null)

function construir(catalogo: ProcesoInternoCfg[]): ProcesosContextValue {
  return {
    todos: catalogo,
    activos: catalogo.filter(p => p.activo),
    label: valor => labelDeProceso(catalogo, valor),
  }
}

export function ProcesosProvider({ procesos, children }: { procesos: ProcesoInternoCfg[]; children: React.ReactNode }) {
  const valor = useMemo(() => construir(procesos), [procesos])
  return <ProcesosContext.Provider value={valor}>{children}</ProcesosContext.Provider>
}

const RESPALDO = construir(PROCESOS_POR_DEFECTO)

/** Catálogo de procesos internos administrado en Configuración → Procesos */
export function useProcesos(): ProcesosContextValue {
  return useContext(ProcesosContext) ?? RESPALDO
}

/**
 * Opciones para un selector: los activos más el valor actual si está inactivo,
 * para no perderlo al editar un registro antiguo.
 */
export function opcionesProceso(ctx: ProcesosContextValue, actual?: string | null): ProcesoInternoCfg[] {
  if (!actual || ctx.activos.some(p => p.value === actual)) return ctx.activos
  const inactivo = ctx.todos.find(p => p.value === actual) ?? { value: actual, label: ctx.label(actual), activo: false, orden: 0 }
  return [...ctx.activos, inactivo]
}
