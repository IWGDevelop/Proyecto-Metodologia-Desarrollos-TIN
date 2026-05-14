'use client'

import { usePathname, useRouter } from 'next/navigation'
import { Menu, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard':      'Dashboard',
  '/requerimientos': 'Requerimientos',
  '/kanban':         'Kanban',
  '/reportes':       'Reportes',
}

function getPageTitle(pathname: string): string {
  if (pathname === '/requerimientos/nuevo') return 'Nuevo Requerimiento'
  if (pathname.includes('/requerimientos/') && pathname.includes('/editar')) return 'Editar Requerimiento'
  if (pathname.match(/^\/requerimientos\/[^/]+$/)) return 'Detalle del Requerimiento'

  for (const [key, label] of Object.entries(PAGE_TITLES)) {
    if (pathname === key || pathname.startsWith(key + '/')) return label
  }
  return 'IGSI Dev'
}

interface Props {
  onMenuClick: () => void
}

export function Topbar({ onMenuClick }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const [connected, setConnected] = useState<boolean | null>(null)
  const title = getPageTitle(pathname)

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
      {/* Left: hamburger + title */}
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

      {/* Right: connection indicator + new button */}
      <div className="flex items-center gap-3">
        {/* Supabase connection indicator */}
        <div className="flex items-center gap-1.5" title={connected ? 'Conectado a Supabase' : 'Sin conexión a Supabase'}>
          <div
            className={cn(
              'h-2 w-2 rounded-full',
              connected === null ? 'bg-slate-300' :
              connected ? 'bg-emerald-500' : 'bg-red-500'
            )}
          />
          <span className="hidden text-xs text-slate-500 sm:inline">
            {connected === null ? 'Verificando...' : connected ? 'Conectado' : 'Sin conexión'}
          </span>
        </div>

        <Button
          size="sm"
          onClick={() => router.push('/requerimientos/nuevo')}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Plus size={16} className="mr-1" />
          <span className="hidden sm:inline">Nuevo Requerimiento</span>
          <span className="sm:hidden">Nuevo</span>
        </Button>
      </div>
    </header>
  )
}
