'use client'

import { useState } from 'react'
import { SidebarUsuario } from './SidebarUsuario'
import { TopbarUsuario } from './TopbarUsuario'
import type { Perfil } from '@/lib/supabase/types'

interface Props {
  children: React.ReactNode
  perfil: Perfil
}

export function UserShell({ children, perfil }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden">
      <SidebarUsuario
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      {/* Offset for fixed sidebar on desktop */}
      <div className="hidden lg:block shrink-0 w-60" />

      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <TopbarUsuario perfil={perfil} onMenuClick={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  )
}
