'use client'

import { Shield, User, Star } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'

export function RolBadge({ className }: { className?: string }) {
  const { perfil } = useAuth()
  if (!perfil) return null

  if (perfil.rol === 'ADMIN_TIN') {
    return (
      <span className={cn(
        'inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-700',
        className
      )}>
        <Shield size={10} /> ADMIN TIN
      </span>
    )
  }

  if (perfil.rol === 'PRESIDENCIA') {
    return (
      <span className={cn(
        'inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-700',
        className
      )}>
        <Star size={10} /> PRESIDENCIA
      </span>
    )
  }

  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600',
      className
    )}>
      <User size={10} /> Usuario
    </span>
  )
}
