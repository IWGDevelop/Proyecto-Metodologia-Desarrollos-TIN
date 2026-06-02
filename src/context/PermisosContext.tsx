'use client'

import { createContext, useContext } from 'react'
import type { PermisosMap } from '@/actions/roles-permisos'

const PermisosContext = createContext<PermisosMap>({})

export function PermisosProvider({
  permisos,
  children,
}: {
  permisos: PermisosMap
  children: React.ReactNode
}) {
  return <PermisosContext.Provider value={permisos}>{children}</PermisosContext.Provider>
}

export function usePermisos(): PermisosMap {
  return useContext(PermisosContext)
}

/** Returns true if the user is ADMIN_TIN (no restrictions) or has the requested permission */
export function usePermiso(recurso: string, tipo: 'puede_ver' | 'puede_editar' | 'puede_crear', isAdmin: boolean): boolean {
  const permisos = useContext(PermisosContext)
  if (isAdmin) return true
  return permisos[recurso]?.[tipo] === true
}
