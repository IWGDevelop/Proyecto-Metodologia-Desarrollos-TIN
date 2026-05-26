'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, ClipboardList, Sparkles, Globe, MapPin } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { actualizarRequerimiento } from '@/actions/requerimientos'
import { ORIGENES_REQUERIMIENTO } from '@/lib/constants'
import { cn } from '@/lib/utils'
import type { OrigenRequerimiento } from '@/lib/supabase/types'

const ICONOS: Record<string, React.ElementType> = {
  LISTA_MEJORAS_PENDIENTES: ClipboardList,
  TIN_NOVA:                 Sparkles,
  DESARROLLO_EXTERNO:       Globe,
}

interface Props {
  requerimientoId: string
  origenActual: OrigenRequerimiento | null
}

export function AsignarOrigenBtn({ requerimientoId, origenActual }: Props) {
  const router                      = useRouter()
  const [open, setOpen]             = useState(false)
  const [seleccionado, setSelec]    = useState<OrigenRequerimiento | null>(origenActual)
  const [isPending, startTransition] = useTransition()

  const cfgActual = ORIGENES_REQUERIMIENTO.find(o => o.value === origenActual)

  const handleGuardar = () => {
    startTransition(async () => {
      try {
        await actualizarRequerimiento(requerimientoId, { origen_requerimiento: seleccionado } as any)
        setOpen(false)
        router.refresh()
      } catch {
        // handled silently — router.refresh still runs
      }
    })
  }

  return (
    <>
      <button
        onClick={() => { setSelec(origenActual); setOpen(true) }}
        className={cn(
          'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors hover:opacity-80',
          cfgActual
            ? 'border-violet-300 bg-violet-50 text-violet-700'
            : 'border-dashed border-slate-300 bg-white text-slate-400 hover:border-violet-300 hover:text-violet-600'
        )}
      >
        <MapPin size={12} />
        {cfgActual ? cfgActual.label : 'Sin origen'}
        <ChevronDown size={12} />
      </button>

      <Dialog open={open} onOpenChange={o => !o && setOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin size={16} className="text-violet-600" />
              Origen del requerimiento
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-2 py-1">
            {ORIGENES_REQUERIMIENTO.map(({ value, label, color, iconColor }) => {
              const Icono = ICONOS[value]
              const sel   = seleccionado === value
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setSelec(sel ? null : value as OrigenRequerimiento)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-xl border-2 p-3.5 text-left transition-all',
                    sel
                      ? 'border-violet-400 bg-violet-50 ring-2 ring-violet-200 ring-offset-1'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  )}
                >
                  <div className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                    sel ? color : 'bg-slate-100'
                  )}>
                    <Icono size={18} className={sel ? iconColor : 'text-slate-400'} />
                  </div>
                  <p className={cn('text-sm font-medium', sel ? 'text-violet-800' : 'text-slate-700')}>
                    {label}
                  </p>
                  {sel && (
                    <span className="ml-auto rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-700">
                      Seleccionado
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {seleccionado === null && origenActual !== null && (
            <p className="text-center text-xs text-slate-400">
              Sin selección — se quitará el origen asignado.
            </p>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
              Cancelar
            </Button>
            <Button
              onClick={handleGuardar}
              disabled={isPending || seleccionado === origenActual}
              className="bg-violet-600 hover:bg-violet-700"
            >
              {isPending ? 'Guardando...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
