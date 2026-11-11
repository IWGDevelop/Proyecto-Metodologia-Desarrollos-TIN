'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ClipboardList, Plus, Bell, User, X, Brain, Ticket, CheckSquare, ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { InterflowLogo } from '@/components/layout/InterflowLogo'
import { TinTicketsLogo } from '@/components/layout/TinTicketsLogo'
import { esRutaTickets } from '@/components/layout/TinTicketsSplash'

const NAV_ITEMS = [
  { href: '/mis-requerimientos',               label: 'Mis solicitudes',   Icon: ClipboardList },
  { href: '/mis-requerimientos/nuevo',          label: 'Nueva solicitud',   Icon: Plus },
  { href: '/mis-requerimientos/notificaciones', label: 'Notificaciones',    Icon: Bell },
  { href: '/mis-tickets',                      label: 'TIN-TICKETS',       Icon: Ticket },
  { href: '/casos-uso-ia',                      label: 'Mis casos de uso IA', Icon: Brain },
  { href: '/perfil',                           label: 'Mi perfil',         Icon: User },
]

// Menú propio de la solución TIN-TICKETS (mismas rutas, acceso independiente)
const NAV_ITEMS_TICKETS = [
  { href: '/mis-tickets',              label: 'Mis tickets de TI', Icon: Ticket },
  { href: '/mis-tickets/aprobaciones', label: 'Aprobar tickets',   Icon: CheckSquare },
]

interface Props {
  mobileOpen: boolean
  onMobileClose: () => void
}

export function SidebarUsuario({ mobileOpen, onMobileClose }: Props) {
  const pathname = usePathname()
  const enTickets = esRutaTickets(pathname)
  const items = enTickets ? NAV_ITEMS_TICKETS : NAV_ITEMS

  const navContent = (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex h-16 items-center border-b border-slate-700 px-4">
        {enTickets ? <TinTicketsLogo size="sm" /> : <InterflowLogo size="sm" />}
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-4">
        {enTickets && (
          <Link
            href="/mis-requerimientos"
            onClick={onMobileClose}
            className="mb-3 flex items-center gap-3 rounded-lg border border-slate-700 px-3 py-2 text-xs font-medium text-slate-400 transition-colors hover:bg-slate-700 hover:text-white"
          >
            <ArrowLeft size={16} className="shrink-0" />
            <span>Volver a TIN-FLOW</span>
          </Link>
        )}
        {items.map(({ href, label, Icon }) => {
          const esAccesoTickets = !enTickets && label === 'TIN-TICKETS'
          const isActive =
            href === '/mis-requerimientos'
              ? pathname === href || (pathname.startsWith(href + '/') && !pathname.includes('/notificaciones') && !pathname.includes('/nuevo'))
              : href === '/mis-tickets' && enTickets
                ? pathname === href || (pathname.startsWith(href + '/') && !pathname.includes('/aprobaciones'))
                : pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              onClick={onMobileClose}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? enTickets ? 'bg-gradient-to-r from-violet-600 to-pink-600 text-white' : 'bg-blue-600 text-white'
                  : esAccesoTickets
                    ? 'text-fuchsia-300 hover:bg-gradient-to-r hover:from-violet-600 hover:to-pink-600 hover:text-white'
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
