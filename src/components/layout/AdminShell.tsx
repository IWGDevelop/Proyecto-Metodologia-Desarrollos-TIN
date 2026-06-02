'use client'

import { useState, useEffect } from 'react'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { PermisosProvider } from '@/context/PermisosContext'
import type { Perfil } from '@/lib/supabase/types'
import type { PermisosMap } from '@/actions/roles-permisos'

interface Props {
  children: React.ReactNode
  perfil: Perfil
  permisos?: PermisosMap
}

export function AdminShell({ children, perfil, permisos = {} }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('sidebar-collapsed')
    if (stored) setCollapsed(stored === 'true')

    const handler = (e: StorageEvent) => {
      if (e.key === 'sidebar-collapsed') setCollapsed(e.newValue === 'true')
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])

  return (
    <PermisosProvider permisos={permisos}>
      <div className="flex h-screen overflow-hidden">
        <Sidebar
          mobileOpen={mobileOpen}
          onMobileClose={() => setMobileOpen(false)}
          onCollapsedChange={setCollapsed}
          rol={perfil.rol}
          permisos={permisos}
        />

        <div
          className="hidden lg:block shrink-0 transition-all duration-300"
          style={{ width: collapsed ? 64 : 240 }}
        />

        <div className="flex flex-1 flex-col overflow-hidden min-w-0">
          <Topbar onMenuClick={() => setMobileOpen(true)} perfil={perfil} permisos={permisos} />
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>
    </PermisosProvider>
  )
}
