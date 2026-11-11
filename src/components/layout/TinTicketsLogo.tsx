'use client'

import { useId } from 'react'
import { cn } from '@/lib/utils'

interface Props {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const sizes = {
  sm: { icon: 32, text: 'text-sm',   sub: 'text-[9px]'  },
  md: { icon: 40, text: 'text-base', sub: 'text-[10px]' },
  lg: { icon: 56, text: 'text-2xl',  sub: 'text-xs'     },
  xl: { icon: 88, text: 'text-4xl',  sub: 'text-sm'     },
}

/** Ícono de TIN-TICKETS: un tiquete con muescas laterales y un check de resolución. */
export function TinTicketsLogoIcon({ px = 36 }: { px?: number }) {
  const uid = useId().replace(/:/g, '')
  const bg = `tt-bg-${uid}`
  const shine = `tt-shine-${uid}`

  return (
    <svg width={px} height={px} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <defs>
        <linearGradient id={bg} x1="0" y1="0" x2="36" y2="36" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#7c3aed" />
          <stop offset="100%" stopColor="#db2777" />
        </linearGradient>
        <linearGradient id={shine} x1="6" y1="10" x2="30" y2="26" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#fbcfe8" />
        </linearGradient>
      </defs>

      {/* Fondo */}
      <rect width="36" height="36" rx="9" fill={`url(#${bg})`} />

      {/* Tiquete con muescas laterales */}
      <path
        d="M 7 11 H 29 V 15.2 A 2.8 2.8 0 0 0 29 20.8 V 25 H 7 V 20.8 A 2.8 2.8 0 0 0 7 15.2 Z"
        fill={`url(#${shine})`}
        fillOpacity="0.16"
        stroke={`url(#${shine})`}
        strokeWidth="2.2"
        strokeLinejoin="round"
      />

      {/* Línea de corte punteada */}
      <path d="M 22 12.6 V 23.4" stroke="#ffffff" strokeOpacity="0.75" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="1.4 2" />

      {/* Check de resolución */}
      <path
        d="M 11.5 18.2 L 14.2 20.8 L 18.6 15.6"
        stroke="#ffffff"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      {/* Destello */}
      <circle cx="25.6" cy="18" r="1.3" fill="#ffffff" opacity="0.95" />
    </svg>
  )
}

export function TinTicketsLogo({ size = 'md', className }: Props) {
  const cfg = sizes[size]
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <TinTicketsLogoIcon px={cfg.icon} />
      <div className="flex flex-col leading-none">
        <span className={cn('font-bold tracking-tight text-white', cfg.text)}>
          TIN-<span className="text-fuchsia-400">TICKETS</span>
        </span>
        <span className={cn('text-slate-400 font-normal tracking-wide uppercase', cfg.sub)}>
          Mesa de ayuda TI
        </span>
      </div>
    </div>
  )
}
