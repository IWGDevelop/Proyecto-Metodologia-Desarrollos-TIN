'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import { ChevronDown, ChevronUp, ToggleLeft, ToggleRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export type Resultado = { ok: boolean; error?: string }

/** Ejecuta una Server Action con toast de error/éxito y estado pendiente */
export function useAccion() {
  const [pendiente, startTransition] = useTransition()
  const ejecutar = (accion: () => Promise<Resultado>, exito?: string, despues?: () => void) =>
    startTransition(async () => {
      try {
        const r = await accion()
        if (!r.ok) { toast.error(r.error ?? 'No se pudo guardar'); return }
        if (exito) toast.success(exito)
        despues?.()
      } catch (e) {
        toast.error((e as Error)?.message ?? 'No se pudo guardar')
      }
    })
  return { pendiente, ejecutar }
}

export const claseInput =
  'h-8 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:opacity-50'

export const claseTextarea =
  'w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:opacity-50'

export function SelectNativo({
  value, onChange, opciones, placeholder, className, disabled, ariaLabel,
}: {
  value: string
  onChange: (v: string) => void
  opciones: { value: string; label: string }[]
  placeholder?: string
  className?: string
  disabled?: boolean
  ariaLabel?: string
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cn(claseInput, 'pr-7', className)}
    >
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {opciones.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

export function Campo({
  etiqueta, ayuda, children, className,
}: { etiqueta: string; ayuda?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn('block space-y-1', className)}>
      <span className="text-xs font-medium text-slate-600">{etiqueta}</span>
      {children}
      {ayuda && <span className="block text-[11px] text-slate-400">{ayuda}</span>}
    </label>
  )
}

export function Casilla({
  checked, onChange, etiqueta, ayuda, disabled,
}: { checked: boolean; onChange: (v: boolean) => void; etiqueta: string; ayuda?: string; disabled?: boolean }) {
  return (
    <label className={cn('flex items-start gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm', disabled ? 'opacity-50' : 'cursor-pointer hover:bg-slate-50')}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={e => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 accent-blue-600"
      />
      <span>
        <span className="font-medium text-slate-700">{etiqueta}</span>
        {ayuda && <span className="block text-[11px] text-slate-400">{ayuda}</span>}
      </span>
    </label>
  )
}

export function BotonActivo({
  activo, onClick, disabled, textos = ['Activa', 'Inactiva'],
}: { activo: boolean; onClick: () => void; disabled?: boolean; textos?: [string, string] }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors disabled:opacity-50',
        activo ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-slate-100 text-slate-500 hover:bg-slate-200',
      )}
      title={activo ? 'Desactivar' : 'Activar'}
    >
      {activo ? <ToggleRight size={15} /> : <ToggleLeft size={15} />}
      {activo ? textos[0] : textos[1]}
    </button>
  )
}

export function BotonesOrden({
  onArriba, onAbajo, primero, ultimo, disabled,
}: { onArriba: () => void; onAbajo: () => void; primero: boolean; ultimo: boolean; disabled?: boolean }) {
  const cls = 'rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30'
  return (
    <div className="flex shrink-0 flex-col">
      <button type="button" onClick={onArriba} disabled={primero || disabled} className={cls} aria-label="Subir">
        <ChevronUp size={13} />
      </button>
      <button type="button" onClick={onAbajo} disabled={ultimo || disabled} className={cls} aria-label="Bajar">
        <ChevronDown size={13} />
      </button>
    </div>
  )
}

export function Seccion({
  titulo, descripcion, acciones, children,
}: { titulo: string; descripcion?: string; acciones?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">{titulo}</h2>
          {descripcion && <p className="mt-0.5 text-xs text-slate-500">{descripcion}</p>}
        </div>
        {acciones}
      </div>
      {children}
    </section>
  )
}

/** Texto multilínea ↔ lista de strings (una por línea o separadas por coma) */
export function textoALista(texto: string): string[] {
  return texto.split(/[\n,;]/).map(x => x.trim()).filter(Boolean)
}
