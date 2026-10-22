'use client'

import { createContext, useContext, useMemo } from 'react'
import {
  ESTADOS_POR_DEFECTO, labelDeEstado, cfgDeEstado, codigosDeEstado, type EstadoCatalogo,
} from '@/lib/estados'

interface EstadosContextValue {
  /** Catálogo completo, incluidos los inactivos */
  todos: EstadoCatalogo[]
  /** Nombre visible de un estado a partir de su código */
  label: (nombre: string | null | undefined) => string
  /** Colores e ícono del estado con su nombre visible */
  cfg: (nombre: string) => ReturnType<typeof cfgDeEstado>
  /** Códigos para filtros y selectores, en el orden configurado */
  codigos: (extra?: string[]) => string[]
}

const EstadosContext = createContext<EstadosContextValue | null>(null)

function construir(catalogo: EstadoCatalogo[]): EstadosContextValue {
  return {
    todos: catalogo,
    label: nombre => labelDeEstado(catalogo, nombre),
    cfg: nombre => cfgDeEstado(catalogo, nombre),
    codigos: extra => codigosDeEstado(catalogo, extra),
  }
}

export function EstadosProvider({ estados, children }: { estados: EstadoCatalogo[]; children: React.ReactNode }) {
  const valor = useMemo(() => construir(estados), [estados])
  return <EstadosContext.Provider value={valor}>{children}</EstadosContext.Provider>
}

const RESPALDO = construir(ESTADOS_POR_DEFECTO)

/** Nombres de los estados tal como se configuraron en Configuración → Estados */
export function useEstados(): EstadosContextValue {
  return useContext(EstadosContext) ?? RESPALDO
}
