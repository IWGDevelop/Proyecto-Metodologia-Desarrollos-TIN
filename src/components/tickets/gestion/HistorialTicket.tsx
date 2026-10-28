import {
  ArrowRight, Bell, Bug, CheckCircle2, CircleDot, Eye, EyeOff, Flag, GitBranch, Lock, MessageSquare,
  Paperclip, PlusCircle, RotateCcw, ShieldCheck, ShieldX, Tag, UserPlus, Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { LABEL_ESTADO_TICKET, LABEL_EVENTO_TICKET, LABEL_PRIORIDAD_TICKET } from '@/lib/tickets/constantes'
import type { EstadoTicket, PrioridadTicket, TicketHistorial, TipoEventoTicket } from '@/lib/tickets/types'
import { formatFechaHora } from './ui'

const ICONOS: Record<TipoEventoTicket, typeof CircleDot> = {
  CREACION: PlusCircle,
  ASIGNACION: UserPlus,
  CAMBIO_ESTADO: CircleDot,
  CAMBIO_PRIORIDAD: Flag,
  CAMBIO_TIPOLOGIA: Tag,
  COMENTARIO: MessageSquare,
  ADJUNTO: Paperclip,
  RECORDATORIO: Bell,
  APROBACION: ShieldCheck,
  RECHAZO: ShieldX,
  CLASIFICACION_CAUSA: GitBranch,
  ENLACE_BUG: Bug,
  REAPERTURA: RotateCcw,
  CIERRE: Lock,
  PRIMERA_RESPUESTA: Zap,
}

const COLORES: Partial<Record<TipoEventoTicket, string>> = {
  COMENTARIO: 'bg-blue-100 text-blue-700',
  APROBACION: 'bg-emerald-100 text-emerald-700',
  RECHAZO: 'bg-red-100 text-red-700',
  REAPERTURA: 'bg-amber-100 text-amber-700',
  RECORDATORIO: 'bg-violet-100 text-violet-700',
  CLASIFICACION_CAUSA: 'bg-teal-100 text-teal-700',
  ENLACE_BUG: 'bg-rose-100 text-rose-700',
  CIERRE: 'bg-slate-200 text-slate-700',
  PRIMERA_RESPUESTA: 'bg-emerald-100 text-emerald-700',
}

function etiquetaValor(e: TicketHistorial, v: string | null): string {
  if (!v) return '—'
  if (e.tipo_evento === 'CAMBIO_ESTADO' || e.tipo_evento === 'REAPERTURA') return LABEL_ESTADO_TICKET[v as EstadoTicket] ?? v
  if (e.tipo_evento === 'CAMBIO_PRIORIDAD') return LABEL_PRIORIDAD_TICKET[v as PrioridadTicket] ?? v
  return v
}

function resumen(e: TicketHistorial): React.ReactNode {
  const m = (e.metadata ?? {}) as Record<string, unknown>
  switch (e.tipo_evento) {
    case 'CAMBIO_ESTADO':
    case 'CAMBIO_PRIORIDAD':
    case 'CAMBIO_TIPOLOGIA':
    case 'REAPERTURA':
      return (
        <span className="inline-flex flex-wrap items-center gap-1">
          <span className="text-slate-500">{etiquetaValor(e, e.valor_anterior)}</span>
          <ArrowRight size={11} className="text-slate-400" />
          <span className="font-semibold text-slate-700">{etiquetaValor(e, e.valor_nuevo)}</span>
          {m.cierre_automatico ? <span className="ml-1 rounded bg-slate-100 px-1.5 text-[10px] text-slate-600">automático</span> : null}
        </span>
      )
    case 'ASIGNACION':
      return (
        <span className="inline-flex flex-wrap items-center gap-1">
          <span className="text-slate-500">{e.valor_anterior ?? 'Sin responsable'}</span>
          <ArrowRight size={11} className="text-slate-400" />
          <span className="font-semibold text-slate-700">{e.valor_nuevo ?? '—'}</span>
        </span>
      )
    case 'CLASIFICACION_CAUSA':
      return (
        <span>
          <span className="font-semibold text-slate-700">{e.valor_nuevo}</span>
          {m.requiere_capacitacion ? <span className="ml-1.5 rounded bg-violet-100 px-1.5 text-[10px] text-violet-700">capacitación</span> : null}
          {m.requiere_ajuste ? <span className="ml-1.5 rounded bg-rose-100 px-1.5 text-[10px] text-rose-700">ajuste IGSI</span> : null}
        </span>
      )
    case 'CIERRE':
      return <span className="text-slate-600">{e.valor_nuevo === 'AUTOMATICO' ? 'Cierre automático' : 'Cierre manual'}</span>
    case 'PRIMERA_RESPUESTA':
      return <span className="text-slate-600">Primera respuesta al usuario registrada</span>
    case 'COMENTARIO':
      return null
    default:
      return e.valor_nuevo ? <span className="text-slate-600">{e.valor_nuevo}</span> : null
  }
}

export function HistorialTicket({ eventos }: { eventos: (TicketHistorial & { autor: string | null })[] }) {
  if (eventos.length === 0) return <p className="text-sm text-slate-400">Sin eventos registrados.</p>
  return (
    <ol className="relative space-y-3 border-l border-slate-200 pl-5">
      {eventos.map(e => {
        const Icon = ICONOS[e.tipo_evento] ?? CheckCircle2
        const esComentario = e.tipo_evento === 'COMENTARIO'
        return (
          <li key={e.id} className="relative">
            <span className={cn('absolute -left-[31px] top-0.5 flex h-5 w-5 items-center justify-center rounded-full ring-4 ring-white', COLORES[e.tipo_evento] ?? 'bg-slate-100 text-slate-600')}>
              <Icon size={11} />
            </span>
            <div className={cn('rounded-lg', esComentario && (e.visible_usuario ? 'border border-blue-100 bg-blue-50/40 p-3' : 'border border-amber-100 bg-amber-50/50 p-3'))}>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                <span className="font-semibold text-slate-700">{LABEL_EVENTO_TICKET[e.tipo_evento]}</span>
                <span className="text-slate-500">· {e.autor ?? 'Sistema'}</span>
                <span className="text-slate-400">· {formatFechaHora(e.fecha)}</span>
                <span
                  className={cn('ml-auto inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px]', e.visible_usuario ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-500')}
                  title={e.visible_usuario ? 'Visible para el solicitante' : 'Solo TIN'}
                >
                  {e.visible_usuario ? <Eye size={10} /> : <EyeOff size={10} />}
                  {e.visible_usuario ? 'Visible' : 'Interno'}
                </span>
              </div>
              {resumen(e) && <div className="mt-0.5 text-xs">{resumen(e)}</div>}
              {e.comentario && (
                <p className={cn('mt-1 whitespace-pre-wrap text-sm', esComentario ? 'text-slate-800' : 'text-slate-600')}>{e.comentario}</p>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
