'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect, useMemo } from 'react'
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
  Star,
  ShieldCheck,
  Monitor,
  Layers,
  Code2,
  ListOrdered,
  GanttChartSquare,
  CalendarClock,
  Brain,
  AlarmClock,
  CalendarRange,
  AlertOctagon,
  Ticket,
  Gauge,
  Bug,
  SlidersHorizontal,
  Bot,
  ArrowLeft,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { InterflowLogo, InterflowLogoIcon } from '@/components/layout/InterflowLogo'
import { TinTicketsLogo, TinTicketsLogoIcon } from '@/components/layout/TinTicketsLogo'
import { esRutaTickets } from '@/components/layout/TinTicketsSplash'
import type { RolUsuario } from '@/lib/supabase/types'
import type { PermisosMap } from '@/actions/roles-permisos'

interface NavItem {
  href: string
  label: string
  Icon: React.ComponentType<{ size?: number; className?: string }>
  menuResource: string
}

// Menú propio de la solución TIN-TICKETS (mismas rutas, acceso independiente)
const NAV_ITEMS_TICKETS: NavItem[] = [
  { href: '/admin/tickets',               label: 'Tickets',               Icon: Ticket,           menuResource: 'menu:tickets' },
  { href: '/admin/tickets-dashboard',     label: 'Dashboard Tickets',     Icon: Gauge,            menuResource: 'menu:tickets-dashboard' },
  { href: '/admin/tickets-bugs',          label: 'Bugs IGSI',             Icon: Bug,              menuResource: 'menu:tickets-bugs' },
  { href: '/admin/tickets-configuracion', label: 'Config. Tickets',       Icon: SlidersHorizontal, menuResource: 'menu:tickets-config' },
]

const TICKETS_ENTRADA = '#tin-tickets'

const NAV_ITEMS_ADMIN: NavItem[] = [
  { href: '/admin/dashboard',             label: 'Dashboard',         Icon: LayoutDashboard, menuResource: 'menu:dashboard' },
  { href: '/admin/requerimientos',        label: 'Requerimientos',    Icon: ClipboardList,   menuResource: 'menu:requerimientos' },
  { href: '/admin/kanban',               label: 'Kanban',            Icon: Kanban,           menuResource: 'menu:kanban' },
  { href: '/admin/reportes',             label: 'Reportes',          Icon: BarChart2,        menuResource: 'menu:reportes' },
  { href: '/admin/reporte-presidencial',  label: 'Rep. Presidencial',  Icon: Star,  menuResource: 'menu:reporte-presidencial' },
  { href: '/admin/reporte-desarrolladores', label: 'Rep. Desarrolladores', Icon: Code2,        menuResource: 'menu:reporte-desarrolladores' },
  { href: '/admin/reporte-prioridades',   label: 'Rep. Prioridades',    Icon: ListOrdered,      menuResource: 'menu:reporte-prioridades' },
  { href: '/admin/reporte-planeacion',    label: 'Rep. Planeación',     Icon: CalendarRange,    menuResource: 'menu:reporte-planeacion' },
  { href: '/admin/reporte-penalizaciones', label: 'Rep. Penalizaciones', Icon: AlertOctagon,    menuResource: 'menu:reporte-penalizaciones' },
  // Acceso a la solución TIN-TICKETS: se resuelve al primer menú de tickets permitido
  { href: TICKETS_ENTRADA,                label: 'TIN-TICKETS',           Icon: Ticket,           menuResource: 'menu:tin-tickets' },
  { href: '/admin/pendientes',            label: 'Pendientes',            Icon: AlarmClock,       menuResource: 'menu:pendientes' },
  { href: '/admin/cronograma',            label: 'Cronograma',           Icon: GanttChartSquare, menuResource: 'menu:cronograma' },
  { href: '/admin/cronograma-tin',       label: 'Cronograma TIN',       Icon: CalendarClock,    menuResource: 'menu:cronograma-tin' },
  { href: '/admin/casos-uso-ia',         label: 'Casos de Uso IA',       Icon: Brain,            menuResource: 'menu:casos-uso-ia' },  { href: '/admin/usuarios',             label: 'Usuarios',              Icon: Users,         menuResource: 'menu:usuarios' },
  { href: '/admin/sesiones',            label: 'Sesiones',          Icon: Monitor,          menuResource: 'menu:sesiones' },
  { href: '/admin/lotes',              label: 'Lotes',             Icon: Layers,           menuResource: 'menu:lotes' },
  { href: '/admin/roles',               label: 'Roles y Permisos',  Icon: ShieldCheck,      menuResource: 'menu:roles' },
  { href: '/admin/configuracion',        label: 'Configuración',     Icon: Settings2,        menuResource: 'menu:configuracion' },
  // Solo ADMIN_TIN: 'menu:conexion-mcp' no está en recursos-sistema, así que no se puede otorgar a otros roles
  { href: '/admin/conexion-mcp',         label: 'Conexión MCP',      Icon: Bot,              menuResource: 'menu:conexion-mcp' },
]

const NAV_ITEMS_PRESIDENCIA: NavItem[] = [
  { href: '/admin/dashboard',             label: 'Dashboard',         Icon: LayoutDashboard, menuResource: 'menu:dashboard' },
  { href: '/admin/requerimientos',        label: 'Requerimientos',    Icon: ClipboardList,   menuResource: 'menu:requerimientos' },
  { href: '/admin/reportes',             label: 'Reportes',          Icon: BarChart2,        menuResource: 'menu:reportes' },
  { href: '/admin/reporte-presidencial', label: 'Rep. Presidencial', Icon: Star,             menuResource: 'menu:reporte-presidencial' },
]

interface Props {
  mobileOpen: boolean
  onMobileClose: () => void
  onCollapsedChange?: (collapsed: boolean) => void
  rol?: RolUsuario
  permisos?: PermisosMap
  pendientesCount?: number
}

export function Sidebar({ mobileOpen, onMobileClose, onCollapsedChange, rol, permisos = {}, pendientesCount = 0 }: Props) {
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

  const enTickets = esRutaTickets(pathname)

  // Menús de tickets que el rol puede ver
  const ticketItems = useMemo(() => {
    if (rol === 'ADMIN_TIN') return NAV_ITEMS_TICKETS
    if (rol === 'PRESIDENCIA') return []
    return NAV_ITEMS_TICKETS.filter(item => permisos[item.menuResource]?.puede_ver === true)
  }, [rol, permisos])

  const flowItems = useMemo(() => {
    let base: NavItem[]
    if (rol === 'ADMIN_TIN') base = NAV_ITEMS_ADMIN
    else if (rol === 'PRESIDENCIA') base = NAV_ITEMS_PRESIDENCIA
    // USUARIO and other roles: filter based on configured permissions
    else base = NAV_ITEMS_ADMIN.filter(item => item.href === TICKETS_ENTRADA || permisos[item.menuResource]?.puede_ver === true)
    // El acceso a TIN-TICKETS lleva al primer menú de tickets permitido; se oculta si no hay ninguno
    return base.flatMap(item =>
      item.href !== TICKETS_ENTRADA
        ? [item]
        : ticketItems.length > 0 ? [{ ...item, href: ticketItems[0].href }] : []
    )
  }, [ticketItems, rol, permisos])

  const navItems = enTickets ? ticketItems : flowItems
  // Destino de "Volver a TIN-FLOW": primer menú de TIN-FLOW permitido que no sea de tickets
  const hrefVolver = flowItems.find(item => !esRutaTickets(item.href))?.href ?? '/mis-requerimientos'

  const navContent = (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div
        className={cn(
          'flex h-16 items-center border-b border-slate-700 px-4',
          collapsed ? 'justify-center' : 'justify-between'
        )}
      >
        {enTickets ? (
          collapsed ? <TinTicketsLogoIcon px={30} /> : <TinTicketsLogo size="sm" />
        ) : collapsed ? (
          <InterflowLogoIcon px={30} />
        ) : (
          <div className="flex flex-col gap-0.5">
            <InterflowLogo size="sm" />
            {rol === 'PRESIDENCIA' && (
              <span className="ml-10 text-[9px] font-semibold tracking-widest text-amber-400 uppercase">
                Presidencia
              </span>
            )}
          </div>
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
        {enTickets && (
          <Link
            href={hrefVolver}
            onClick={onMobileClose}
            className={cn(
              'mb-3 flex items-center gap-3 rounded-lg border border-slate-700 px-3 py-2 text-xs font-medium text-slate-400 transition-colors hover:bg-slate-700 hover:text-white',
              collapsed && 'justify-center px-2'
            )}
            title={collapsed ? 'Volver a TIN-FLOW' : undefined}
          >
            <ArrowLeft size={16} className="shrink-0" />
            {!collapsed && <span>Volver a TIN-FLOW</span>}
          </Link>
        )}
        {navItems.map(({ href, label, Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + '/')
          const esAccesoTickets = !enTickets && label === 'TIN-TICKETS'
          const esPendientes = href === '/admin/pendientes'
          const badge = esPendientes && pendientesCount > 0 ? pendientesCount : 0
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
                    : 'text-slate-300 hover:bg-slate-700 hover:text-white',
                collapsed && 'justify-center px-2'
              )}
              title={collapsed ? label : undefined}
            >
              <div className="relative shrink-0">
                <Icon size={18} />
                {badge > 0 && collapsed && (
                  <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}
              </div>
              {!collapsed && <span className="flex-1">{label}</span>}
              {!collapsed && badge > 0 && (
                <span className="ml-auto rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white min-w-[20px] text-center">
                  {badge > 99 ? '99+' : badge}
                </span>
              )}
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
