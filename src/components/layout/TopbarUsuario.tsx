'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Menu, Bell, LogOut, User, ChevronDown } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import type { Perfil } from '@/lib/supabase/types'
import Link from 'next/link'

interface Props {
  perfil: Perfil
  onMenuClick: () => void
}

function AvatarLetras({ nombre }: { nombre: string }) {
  const initials = nombre.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
      {initials}
    </div>
  )
}

export function TopbarUsuario({ perfil, onMenuClick }: Props) {
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const [notiCount, setNotiCount] = useState(0)

  useEffect(() => {
    const supabase = createClient()

    const fetchCount = async () => {
      try {
        const { count } = await (supabase as any)
          .from('notificaciones')
          .select('*', { count: 'exact', head: true })
          .eq('usuario_id', perfil.id)
          .eq('leida', false)
        setNotiCount(count ?? 0)
      } catch {
        // notificaciones table may not exist yet
      }
    }

    fetchCount()

    const channel = supabase
      .channel('noti-count')
      .on('postgres_changes' as any, {
        event: '*',
        schema: 'public',
        table: 'notificaciones',
        filter: `usuario_id=eq.${perfil.id}`,
      }, () => fetchCount())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [perfil.id])

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 shadow-sm">
      {/* Left */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="rounded-md p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
        >
          <Menu size={20} />
        </button>
        <div>
          <p className="text-sm font-semibold text-slate-800">
            Hola, {perfil.nombre_completo.split(' ')[0]}
          </p>
          {perfil.proceso_interno && (
            <span className="text-xs text-slate-400">{perfil.proceso_interno}</span>
          )}
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-2">
        {/* Notification bell */}
        <Link href="/mis-requerimientos/notificaciones" className="relative rounded-md p-2 text-slate-500 hover:bg-slate-100">
          <Bell size={18} />
          {notiCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
              {notiCount > 9 ? '9+' : notiCount}
            </span>
          )}
        </Link>

        {/* Avatar + menu */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen(o => !o)}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-100"
          >
            <AvatarLetras nombre={perfil.nombre_completo} />
            <ChevronDown size={14} className={cn('text-slate-400 transition', menuOpen && 'rotate-180')} />
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-full z-20 mt-1 w-52 rounded-xl border border-slate-200 bg-white py-1.5 shadow-lg">
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
                <button
                  onClick={handleSignOut}
                  className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                >
                  <LogOut size={14} /> Cerrar sesión
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
