'use client'

import { useState, useEffect } from 'react'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import type { Perfil } from '@/lib/supabase/types'

interface Props {
  children: React.ReactNode
  perfil: Perfil
}

export function AdminShell({ children, perfil }: Props) {
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
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
        onCollapsedChange={setCollapsed}
        rol={perfil.rol}
      />

      <div
        className="hidden lg:block shrink-0 transition-all duration-300"
        style={{ width: collapsed ? 64 : 240 }}
      />

      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <Topbar onMenuClick={() => setMobileOpen(true)} perfil={perfil} />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  )
}
