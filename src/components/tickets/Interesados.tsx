'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, Search, UserPlus, Users, X } from 'lucide-react'
import { agregarInteresados, buscarFuncionarios, quitarInteresado, type FuncionarioOpcion } from '@/actions/tickets/interesados'
import { cn } from '@/lib/utils'

// Partes interesadas de un ticket: funcionarios que el solicitante (o TIN) involucra para
// que vean el ticket, comenten y reciban sus novedades.

export interface InteresadoUI {
  id: string
  nombre_completo: string
  cargo?: string | null
}

const MAX = 15

function iniciales(nombre: string) {
  return nombre.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase()).join('')
}

/** Buscador de funcionarios activos por nombre o correo */
function BuscadorFuncionarios({ excluir, onElegir, disabled, placeholder }: {
  excluir: string[]
  onElegir: (f: FuncionarioOpcion) => void
  disabled?: boolean
  placeholder?: string
}) {
  const [q, setQ] = useState('')
  const [opciones, setOpciones] = useState<FuncionarioOpcion[]>([])
  const [buscando, setBuscando] = useState(false)
  const [abierto, setAbierto] = useState(false)
  const caja = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const texto = q.trim()
    if (texto.length < 2) return
    let cancelado = false
    const id = setTimeout(async () => {
      setBuscando(true)
      try {
        const r = await buscarFuncionarios(texto)
        if (!cancelado) setOpciones(r)
      } finally {
        if (!cancelado) setBuscando(false)
      }
    }, 250)
    return () => { cancelado = true; clearTimeout(id) }
  }, [q])

  useEffect(() => {
    const cerrar = (e: MouseEvent) => { if (!caja.current?.contains(e.target as Node)) setAbierto(false) }
    document.addEventListener('mousedown', cerrar)
    return () => document.removeEventListener('mousedown', cerrar)
  }, [])

  const visibles = q.trim().length >= 2 ? opciones.filter(o => !excluir.includes(o.id)) : []

  return (
    <div ref={caja} className="relative">
      <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100">
        <Search size={14} className="shrink-0 text-slate-400" />
        <input
          value={q}
          onChange={e => { setQ(e.target.value); setAbierto(true) }}
          onFocus={() => setAbierto(true)}
          disabled={disabled}
          placeholder={placeholder ?? 'Buscar funcionario por nombre o correo…'}
          className="h-9 w-full bg-transparent text-sm outline-none disabled:opacity-50"
        />
        {buscando && <Loader2 size={14} className="shrink-0 animate-spin text-slate-400" />}
      </div>
      {abierto && q.trim().length >= 2 && !buscando && (
        <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          {visibles.length === 0 ? (
            <li className="px-3 py-2 text-xs text-slate-400">Sin resultados</li>
          ) : visibles.map(o => (
            <li key={o.id}>
              <button
                type="button"
                onClick={() => { onElegir(o); setQ(''); setOpciones([]); setAbierto(false) }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-slate-50"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[10px] font-semibold text-blue-700">{iniciales(o.nombre_completo)}</span>
                <span className="min-w-0">
                  <span className="block truncate text-sm text-slate-700">{o.nombre_completo}</span>
                  <span className="block truncate text-[11px] text-slate-400">{[o.cargo, o.proceso_interno].filter(Boolean).join(' · ')}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Chip({ p, onQuitar, disabled, etiquetaQuitar }: { p: InteresadoUI; onQuitar?: () => void; disabled?: boolean; etiquetaQuitar?: string }) {
  return (
    <li className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 py-0.5 pl-0.5 pr-2 text-xs text-slate-700">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[10px] font-semibold text-blue-700">{iniciales(p.nombre_completo)}</span>
      <span className="truncate" title={p.cargo ?? undefined}>{p.nombre_completo}</span>
      {onQuitar && (
        <button type="button" onClick={onQuitar} disabled={disabled} title={etiquetaQuitar ?? 'Quitar'} className="rounded-full p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600 disabled:opacity-50">
          <X size={12} />
        </button>
      )}
    </li>
  )
}

/** Selector para el formulario de creación (estado local; se guardan al crear el ticket) */
export function SelectorInteresados({ value, onChange, disabled }: {
  value: InteresadoUI[]
  onChange: (v: InteresadoUI[]) => void
  disabled?: boolean
}) {
  return (
    <div className="space-y-2">
      {value.length < MAX && (
        <BuscadorFuncionarios
          excluir={value.map(v => v.id)}
          disabled={disabled}
          onElegir={f => onChange([...value, { id: f.id, nombre_completo: f.nombre_completo, cargo: f.cargo }])}
        />
      )}
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {value.map(p => <Chip key={p.id} p={p} disabled={disabled} onQuitar={() => onChange(value.filter(x => x.id !== p.id))} />)}
        </ul>
      )}
    </div>
  )
}

/** Partes interesadas de un ticket ya creado: ver, agregar y quitar */
export function GestorInteresados({ ticketId, interesados, puedeEditar, usuarioId, cerrado, solicitante, className }: {
  ticketId: string
  interesados: InteresadoUI[]
  /** Solicitante o TIN: agrega y quita a cualquiera */
  puedeEditar: boolean
  /** Usuario actual: puede retirarse a sí mismo */
  usuarioId: string
  cerrado?: boolean
  solicitante?: string | null
  className?: string
}) {
  const router = useRouter()
  const [pendiente, iniciar] = useTransition()
  const [agregando, setAgregando] = useState(false)

  const ejecutar = (fn: () => Promise<{ ok: boolean; error?: string }>, exito: string) => {
    iniciar(async () => {
      const r = await fn()
      if (!r.ok) { toast.error(r.error ?? 'No se pudo completar la acción'); return }
      toast.success(exito)
      setAgregando(false)
      router.refresh()
    })
  }

  return (
    <section className={cn('rounded-xl border border-slate-200 bg-white p-5', className)}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
          <Users size={12} /> Partes interesadas ({interesados.length})
        </p>
        {puedeEditar && !cerrado && interesados.length < MAX && !agregando && (
          <button type="button" onClick={() => setAgregando(true)} className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium text-blue-700 hover:bg-blue-50">
            <UserPlus size={13} /> Agregar
          </button>
        )}
      </div>
      {solicitante && <p className="mb-2 text-xs text-slate-500">Solicitante: <span className="font-medium text-slate-700">{solicitante}</span></p>}
      {interesados.length === 0 ? (
        <p className="text-xs text-slate-400">
          {puedeEditar ? 'Involucra a otros funcionarios para que vean el ticket, comenten y reciban sus novedades.' : 'Nadie más sigue este ticket.'}
        </p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {interesados.map(p => {
            const esYo = p.id === usuarioId
            const puedeQuitar = !cerrado && (puedeEditar || esYo)
            return (
              <Chip
                key={p.id}
                p={esYo ? { ...p, nombre_completo: `${p.nombre_completo} (tú)` } : p}
                disabled={pendiente}
                etiquetaQuitar={esYo && !puedeEditar ? 'Dejar de seguir' : 'Quitar'}
                onQuitar={puedeQuitar ? () => ejecutar(() => quitarInteresado(ticketId, p.id), esYo ? 'Dejaste de seguir el ticket' : 'Parte interesada quitada') : undefined}
              />
            )
          })}
        </ul>
      )}
      {agregando && (
        <div className="mt-3 space-y-1.5">
          <BuscadorFuncionarios
            excluir={interesados.map(p => p.id)}
            disabled={pendiente}
            onElegir={f => ejecutar(() => agregarInteresados(ticketId, [f.id]), `${f.nombre_completo} quedó como parte interesada`)}
          />
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-slate-400">Recibirá un correo y podrá ver y comentar el ticket.</p>
            <button type="button" onClick={() => setAgregando(false)} className="text-xs text-slate-500 hover:text-slate-700">Cancelar</button>
          </div>
        </div>
      )}
      {pendiente && <p className="mt-2 flex items-center gap-1 text-xs text-slate-400"><Loader2 size={12} className="animate-spin" /> Guardando…</p>}
    </section>
  )
}
