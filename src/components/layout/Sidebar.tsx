'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import {
  LayoutDashboard,
  ClipboardList,
  Kanban,
  BarChart2,
  Users,
  Settings2,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { href: '/admin/dashboard',               label: 'Dashboard',      Icon: LayoutDashboard },
  { href: '/admin/requerimientos',          label: 'Requerimientos', Icon: ClipboardList },
  { href: '/admin/kanban',                  label: 'Kanban',         Icon: Kanban },
  { href: '/admin/reportes',               label: 'Reportes',       Icon: BarChart2 },
  { href: '/admin/usuarios',               label: 'Usuarios',       Icon: Users },
  { href: '/admin/configuracion',          label: 'Configuración',  Icon: Settings2 },
]

interface Props {
  mobileOpen: boolean
  onMobileClose: () => void
  onCollapsedChange?: (collapsed: boolean) => void
}

export function Sidebar({ mobileOpen, onMobileClose, onCollapsedChange }: Props) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('sidebar-collapsed')
    const initial = stored === 'true'
    setCollapsed(initial)
    onCollapsedChange?.(initial)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev
      localStorage.setItem('sidebar-collapsed', String(next))
      onCollapsedChange?.(next)
      return next
    })
  }

  const navContent = (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div
        className={cn(
          'flex h-16 items-center border-b border-slate-700 px-4',
          collapsed ? 'justify-center' : 'justify-between'
        )}
      >
        {!collapsed && (
          <span className="text-lg font-bold tracking-tight text-white">
            IGSI <span className="text-blue-400">Dev</span>
          </span>
        )}
        <button
          onClick={toggleCollapsed}
          className="hidden rounded-md p-1.5 text-slate-400 transition hover:bg-slate-700 hover:text-white lg:flex"
          aria-label={collapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-4">
        {NAV_ITEMS.map(({ href, label, Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              onClick={onMobileClose}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:bg-slate-700 hover:text-white',
                collapsed && 'justify-center px-2'
              )}
              title={collapsed ? label : undefined}
            >
              <Icon size={18} className="shrink-0" />
              {!collapsed && <span>{label}</span>}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className={cn('border-t border-slate-700 px-4 py-3', collapsed && 'text-center')}>
        <span className="text-xs text-slate-500">v1.0.0</span>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop fixed sidebar */}
      <aside
        className={cn(
          'hidden lg:flex lg:flex-col',
          'fixed inset-y-0 left-0 z-30 bg-slate-800 transition-all duration-300',
          collapsed ? 'w-16' : 'w-60'
        )}
      >
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
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-60 bg-slate-800 transition-transform duration-300 lg:hidden',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
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
