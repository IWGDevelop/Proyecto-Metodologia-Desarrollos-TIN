'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { TinTicketsLogo } from '@/components/layout/TinTicketsLogo'

/** Rutas que pertenecen a la solución TIN-TICKETS. */
export function esRutaTickets(pathname: string): boolean {
  return pathname.startsWith('/admin/tickets') || pathname === '/mis-tickets' || pathname.startsWith('/mis-tickets/')
}

const CLAVE_SESION = 'tin-tickets-splash'
const DURACION_MS = 1400

/**
 * Pantalla de bienvenida con el logo de TIN-TICKETS. Se muestra al entrar a la
 * solución desde TIN-FLOW, y una vez por sesión si se abre directamente una ruta de tickets.
 */
export function TinTicketsSplash() {
  const pathname = usePathname()
  const anterior = useRef<string | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const enTickets = esRutaTickets(pathname)
    const prev = anterior.current
    anterior.current = pathname
    if (!enTickets) return

    let mostrar = false
    if (prev === null) {
      // Carga inicial directa en una ruta de tickets: solo una vez por sesión
      try {
        mostrar = sessionStorage.getItem(CLAVE_SESION) !== '1'
        sessionStorage.setItem(CLAVE_SESION, '1')
      } catch {
        mostrar = false
      }
    } else {
      mostrar = !esRutaTickets(prev)
    }
    if (!mostrar) return

    setVisible(true)
    const t = setTimeout(() => setVisible(false), DURACION_MS)
    return () => clearTimeout(t)
  }, [pathname])

  if (!visible) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/95 backdrop-blur-sm animate-in fade-in duration-300"
      onClick={() => setVisible(false)}
      role="status"
      aria-label="Entrando a TIN-TICKETS"
    >
      <div className="flex flex-col items-center gap-6 animate-in zoom-in-90 fade-in duration-500">
        <TinTicketsLogo size="xl" />
        <div className="h-1 w-48 overflow-hidden rounded-full bg-slate-700">
          <div className="h-full w-full origin-left animate-[tt-progreso_1.3s_ease-out_forwards] rounded-full bg-gradient-to-r from-violet-500 to-pink-500" />
        </div>
      </div>
      <style>{`@keyframes tt-progreso { from { transform: scaleX(0) } to { transform: scaleX(1) } }`}</style>
    </div>
  )
}
