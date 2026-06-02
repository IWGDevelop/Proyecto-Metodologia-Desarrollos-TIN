'use client'

import { useState, useEffect, useTransition } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Menu, Plus, ChevronDown, LogOut, User, Users, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { signOutAction } from '@/actions/auth'
import { cn } from '@/lib/utils'
import type { Perfil } from '@/lib/supabase/types'
import type { PermisosMap } from '@/actions/roles-permisos'
import Link from 'next/link'

const PAGE_TITLES: Record<string, string> = {
  '/admin/dashboard':      'Dashboard',
  '/admin/requerimientos': 'Requerimientos',
  '/admin/kanban':         'Kanban',
  '/admin/reportes':       'Reportes',
  '/admin/usuarios':       'Usuarios',
  '/dashboard':            'Dashboard',
  '/requerimientos':       'Requerimientos',
  '/kanban':               'Kanban',
  '/reportes':             'Reportes',
}

function getPageTitle(pathname: string): string {
  if (pathname.includes('/requerimientos/nuevo'))  return 'Nuevo Requerimiento'
  if (pathname.includes('/requerimientos/') && pathname.includes('/editar')) return 'Editar Requerimiento'
  if (pathname.match(/\/requerimientos\/[^/]+$/))  return 'Detalle del Requerimiento'
  for (const [key, label] of Object.entries(PAGE_TITLES)) {
    if (pathname === key || pathname.startsWith(key + '/')) return label
  }
  return 'IGSI'
}

function AvatarLetras({ nombre }: { nombre: string }) {
  const initials = nombre.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
      {initials}
    </div>
  )
}

interface Props {
  onMenuClick: () => void
  perfil?: Perfil
  permisos?: PermisosMap
}

export function Topbar({ onMenuClick, perfil, permisos = {} }: Props) {
  const pathname = usePathname()
  const router   = useRouter()
  const [connected, setConnected]   = useState<boolean | null>(null)
  const [menuOpen, setMenuOpen]     = useState(false)
  const [isPending, startTransition] = useTransition()
  const title = getPageTitle(pathname)
  const isAdmin = perfil?.rol === 'ADMIN_TIN'
  const puedeCrearReq = isAdmin || permisos['req:general']?.puede_crear === true
  const puedeVerUsuarios = isAdmin || permisos['menu:usuarios']?.puede_ver === true

  const handleSignOut = () => {
    startTransition(async () => {
      await signOutAction()
      window.location.href = '/login'
    })
  }

  useEffect(() => {
    const checkConnection = async () => {
      try {
        const supabase = createClient()
        const { error } = await supabase.from('requerimientos').select('id').limit(1)
        setConnected(!error)
      } catch {
        setConnected(false)
      }
    }
    checkConnection()
  }, [])

  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 shadow-sm">
      {/* Left */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="rounded-md p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
          aria-label="Abrir menú"
        >
          <Menu size={20} />
        </button>
        <h1 className="text-base font-semibold text-slate-800">{title}</h1>
      </div>

      {/* Right */}
      <div className="flex items-center gap-3">
        {/* Connection indicator */}
        <div className="flex items-center gap-1.5" title={connected ? 'Conectado a Supabase' : 'Sin conexión'}>
          <div className={cn(
            'h-2 w-2 rounded-full',
            connected === null ? 'bg-slate-300' : connected ? 'bg-emerald-500' : 'bg-red-500'
          )} />
          <span className="hidden text-xs text-slate-500 sm:inline">
            {connected === null ? 'Verificando...' : connected ? 'Conectado' : 'Sin conexión'}
          </span>
        </div>

        {/* New requirement button */}
        {puedeCrearReq && (
          <Button
            size="sm"
            onClick={() => router.push('/admin/requerimientos/nuevo')}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus size={16} className="mr-1" />
            <span className="hidden sm:inline">Nuevo</span>
          </Button>
        )}

        {/* Admin avatar/menu */}
        {perfil && (
          <div className="relative">
            <button
              onClick={() => setMenuOpen(o => !o)}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-100"
            >
              <AvatarLetras nombre={perfil.nombre_completo} />
              <div className="hidden sm:block text-left">
                <p className="text-xs font-semibold text-slate-700 leading-none">{perfil.nombre_completo.split(' ')[0]}</p>
                <span className="inline-flex items-center gap-0.5 rounded-full bg-blue-100 px-1.5 py-0.5 text-[9px] font-bold text-blue-700 mt-0.5">
                  <Shield size={8} /> ADMIN TIN
                </span>
              </div>
              <ChevronDown size={14} className={cn('text-slate-400 transition', menuOpen && 'rotate-180')} />
            </button>

            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-full z-20 mt-1 w-56 rounded-xl border border-slate-200 bg-white py-1.5 shadow-lg">
                  <div className="border-b border-slate-100 px-4 py-2.5">
                    <p className="text-xs font-semibold text-slate-700">{perfil.nombre_completo}</p>
                    <p className="text-xs text-slate-400">{perfil.email}</p>
                  </div>
                  <Link
                    href="/perfil"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
                  >
                    <User size={14} /> Mi perfil
                  </Link>
                  {puedeVerUsuarios && (
                    <Link
                      href="/admin/usuarios"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
                    >
                      <Users size={14} /> Gestión de usuarios
                    </Link>
                  )}
                  <div className="border-t border-slate-100 mt-1 pt-1">
                    <button
                      onClick={handleSignOut}
                      disabled={isPending}
                      className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      <LogOut size={14} /> {isPending ? 'Cerrando...' : 'Cerrar sesión'}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </header>
  )
}
