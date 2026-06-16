import { cn } from '@/lib/utils'

interface Props {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizes = {
  sm: { icon: 32, text: 'text-sm',  sub: 'text-[9px]'  },
  md: { icon: 40, text: 'text-base', sub: 'text-[10px]' },
  lg: { icon: 56, text: 'text-2xl', sub: 'text-xs'     },
}

export function InterflowLogoIcon({ px = 36 }: { px?: number }) {
  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="if-bg" x1="0" y1="0" x2="36" y2="36" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#1d4ed8" />
          <stop offset="100%" stopColor="#0ea5e9" />
        </linearGradient>
        <linearGradient id="if-stroke1" x1="4" y1="11" x2="32" y2="25" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#ffffff" stopOpacity="1" />
          <stop offset="100%" stopColor="#bae6fd" stopOpacity="0.9" />
        </linearGradient>
        <linearGradient id="if-stroke2" x1="4" y1="25" x2="32" y2="11" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#93c5fd" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#ffffff"  stopOpacity="0.95" />
        </linearGradient>
      </defs>

      {/* Fondo con gradiente */}
      <rect width="36" height="36" rx="9" fill="url(#if-bg)" />

      {/* Flujo superior: de izquierda-arriba a derecha-abajo */}
      <path
        d="M 5 13 C 10 13 10 18 18 18 C 26 18 26 23 31 23"
        stroke="url(#if-stroke1)"
        strokeWidth="2.8"
        strokeLinecap="round"
        fill="none"
      />
      {/* Punta de flecha superior */}
      <path
        d="M 28 21 L 31 23 L 28 25"
        stroke="url(#if-stroke1)"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      {/* Flujo inferior: de izquierda-abajo a derecha-arriba */}
      <path
        d="M 5 23 C 10 23 10 18 18 18 C 26 18 26 13 31 13"
        stroke="url(#if-stroke2)"
        strokeWidth="2.8"
        strokeLinecap="round"
        fill="none"
      />
      {/* Punta de flecha inferior */}
      <path
        d="M 28 11 L 31 13 L 28 15"
        stroke="url(#if-stroke2)"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      {/* Punto de intersección central */}
      <circle cx="18" cy="18" r="2.2" fill="white" opacity="0.95" />
    </svg>
  )
}

export function InterflowLogo({ size = 'md', className }: Props) {
  const cfg = sizes[size]
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <InterflowLogoIcon px={cfg.icon} />
      <div className="flex flex-col leading-none">
        <span className={cn('font-bold tracking-tight text-white', cfg.text)}>
          INTER<span className="text-sky-400">FLOW</span>
        </span>
        <span className={cn('text-slate-400 font-normal tracking-wide uppercase', cfg.sub)}>
          Interworld Group
        </span>
      </div>
    </div>
  )
}
