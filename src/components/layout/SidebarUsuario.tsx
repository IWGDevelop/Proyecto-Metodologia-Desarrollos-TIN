'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ClipboardList, Plus, Bell, User, X, Brain, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { InterflowLogo } from '@/components/layout/InterflowLogo'

const NAV_ITEMS = [
  { href: '/mis-requerimientos',               label: 'Mis solicitudes',   Icon: ClipboardList },
  { href: '/mis-requerimientos/nuevo',          label: 'Nueva solicitud',   Icon: Plus },
  { href: '/mis-requerimientos/notificaciones', label: 'Notificaciones',    Icon: Bell },
  { href: '/cultura-ia',                        label: 'Mi uso de IA',      Icon: Brain },
  { href: '/cultura-ia/nuevo',                  label: 'Registrar uso IA',  Icon: Zap },
  { href: '/perfil',                            label: 'Mi perfil',         Icon: User },
]

interface Props {
  mobileOpen: boolean
  onMobileClose: () => void
}

export function SidebarUsuario({ mobileOpen, onMobileClose }: Props) {
  const pathname = usePathname()

  const navContent = (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex h-16 items-center border-b border-slate-700 px-4">
        <InterflowLogo size="sm" />
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-4">
        {NAV_ITEMS.map(({ href, label, Icon }) => {
          const isActive =
            href === '/mis-requerimientos'
              ? pathname === href || (pathname.startsWith(href + '/') && !pathname.includes('/notificaciones') && !pathname.includes('/nuevo'))
              : pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              onClick={onMobileClose}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:bg-slate-700 hover:text-white'
              )}
            >
              <Icon size={18} className="shrink-0" />
              <span>{label}</span>
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-slate-700 px-4 py-3">
        <span className="text-xs text-slate-500">v1.0.0</span>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop */}
      <aside className="hidden lg:flex lg:flex-col fixed inset-y-0 left-0 z-30 w-60 bg-slate-800">
        {navContent}
      </aside>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onMobileClose}
        />
      )}

      {/* Mobile drawer */}
      <aside className={cn(
        'fixed inset-y-0 left-0 z-50 w-60 bg-slate-800 transition-transform duration-300 lg:hidden',
        mobileOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        <button
          onClick={onMobileClose}
          className="absolute right-3 top-3 rounded-md p-1.5 text-slate-400 hover:bg-slate-700 hover:text-white"
        >
          <X size={18} />
        </button>
        {navContent}
      </aside>
    </>
  )
}
