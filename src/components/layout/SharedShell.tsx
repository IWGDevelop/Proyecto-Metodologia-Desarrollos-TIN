'use client'

import { AdminShell } from './AdminShell'
import { UserShell } from './UserShell'
import type { Perfil } from '@/lib/supabase/types'

export function SharedShell({ children, perfil }: { children: React.ReactNode; perfil: Perfil }) {
  if (perfil.rol === 'ADMIN_TIN') return <AdminShell perfil={perfil}>{children}</AdminShell>
  return <UserShell perfil={perfil}>{children}</UserShell>
}
