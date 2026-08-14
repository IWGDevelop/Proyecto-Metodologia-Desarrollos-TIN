'use client'

import { useState, useTransition } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Circle, StickyNote, ChevronDown, ChevronUp } from 'lucide-react'
import { toast } from 'sonner'
import { getFlujoProcesoReq, toggleFlujoPaso, guardarNotasPaso, type PasoFlujo } from '@/actions/flujo-proceso'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'

interface Props { requerimientoId: string }

interface PasoConfig {
  key: string
  label: string
  responsables: string[]
  opcional?: boolean
}

interface FaseConfig {
  key: string
  titulo: string
  estadoSistema: string
  color: { header: string; badge: string; progress: string; dot: string; dotOk: string }
  pasos: PasoConfig[]
}

const FASES: FaseConfig[] = [
  {
    key: 'recepcion',
    titulo: 'Recepción y evaluación',
    estadoSistema: 'Recibido',
    color: { header: 'bg-slate-50 border-slate-200', badge: 'bg-slate-200 text-slate-600', progress: 'bg-slate-400', dot: 'bg-slate-400', dotOk: 'bg-emerald-500' },
    pasos: [
      { key: 'cargue_tinflow', label: 'Cargue de requerimiento en TIN-FLOW', responsables: ['Usuario / Cliente'] },
      { key: 'comite_prioridades', label: 'Comité de evaluación de prioridades', responsables: ['Presidencia', 'Estrategia', 'TIN'] },
    ],
  },
  {
    key: 'analisis',
    titulo: 'Estudio y evaluación técnica',
    estadoSistema: 'En estudio y evaluación técnica',
    color: { header: 'bg-blue-50 border-blue-200', badge: 'bg-blue-100 text-blue-700', progress: 'bg-blue-500', dot: 'bg-blue-400', dotOk: 'bg-emerald-500' },
    pasos: [
      { key: 'estudio_evaluacion', label: 'Estudio y evaluación técnica', responsables: ['TIN'] },
      { key: 'asignacion_ingeniero', label: 'Asignación del desarrollo a uno de los Ingenieros', responsables: ['Director Corporativo TIN'] },
    ],
  },
  {
    key: 'definicion',
    titulo: 'Definición de usuario',
    estadoSistema: 'Definición de usuario',
    color: { header: 'bg-violet-50 border-violet-200', badge: 'bg-violet-100 text-violet-700', progress: 'bg-violet-500', dot: 'bg-violet-400', dotOk: 'bg-emerald-500' },
    pasos: [
      { key: 'reunion_confirmacion', label: 'Reunión de confirmación con desarrolladores y usuarios solicitantes', responsables: ['Director Corporativo TIN', 'Desarrollador', 'Coordinador TIN', 'Partes Interesadas'] },
      { key: 'reunion_definicion', label: 'Reunión y definición de las partes interesadas', responsables: ['TIN'], opcional: true },
      { key: 'creacion_mockup', label: 'Creación de Mockup', responsables: ['Desarrollador'] },
      { key: 'aprobacion_usuario', label: 'Aprobación del Usuario / Cliente', responsables: ['Partes Interesadas'] },
    ],
  },
  {
    key: 'desarrollo',
    titulo: 'Desarrollo',
    estadoSistema: 'Desarrollo',
    color: { header: 'bg-indigo-50 border-indigo-200', badge: 'bg-indigo-100 text-indigo-700', progress: 'bg-indigo-500', dot: 'bg-indigo-400', dotOk: 'bg-emerald-500' },
    pasos: [
      { key: 'inicio_desarrollo', label: 'Inicio del desarrollo', responsables: ['Desarrollador'] },
      { key: 'pruebas_unitarias', label: 'Pruebas unitarias del desarrollo', responsables: ['Desarrollador'] },
      { key: 'pruebas_testing', label: 'Pruebas de testing', responsables: ['Desarrollador', 'Agentes IA', 'Auxiliares TIN'] },
      { key: 'doc_proceso', label: 'Documentación a nivel de proceso (Manual de usuario)', responsables: ['Desarrollador', 'Auxiliar TIN'] },
      { key: 'pruebas_qa', label: 'Pruebas de QA', responsables: ['Coordinador TIN', 'Analista TIN'] },
      { key: 'doc_codigo', label: 'Documentación del desarrollo a nivel de código', responsables: ['Desarrollador'] },
    ],
  },
  {
    key: 'entrega',
    titulo: 'Entrega y pruebas de usuario',
    estadoSistema: 'Pruebas de usuario',
    color: { header: 'bg-amber-50 border-amber-200', badge: 'bg-amber-100 text-amber-700', progress: 'bg-amber-500', dot: 'bg-amber-400', dotOk: 'bg-emerald-500' },
    pasos: [
      { key: 'entrega_usuario_paso', label: 'Entrega al usuario', responsables: ['Desarrollador', 'Coordinador TIN', 'Partes Interesadas'] },
      { key: 'cargue_video', label: 'Cargue del video de entrega en TIN-FLOW', responsables: ['Coordinador TIN'] },
      { key: 'pruebas_usuario_paso', label: 'Pruebas de usuario', responsables: ['Partes Interesadas', 'Funcionarios del proceso'] },
      { key: 'ajustes_tecnicos', label: 'Ajustes técnicos', responsables: ['Desarrollador'], opcional: true },
    ],
  },
  {
    key: 'salida_vivo',
    titulo: 'Salida en vivo',
    estadoSistema: 'Programado para salida en vivo',
    color: { header: 'bg-emerald-50 border-emerald-200', badge: 'bg-emerald-100 text-emerald-700', progress: 'bg-emerald-500', dot: 'bg-emerald-400', dotOk: 'bg-emerald-500' },
    pasos: [
      { key: 'vistos_buenos', label: 'Generación de vistos buenos de todas las partes interesadas', responsables: ['Partes Interesadas'] },
      { key: 'ajustes_manual', label: 'Ajustes del Manual de usuario', responsables: ['Desarrollador', 'Auxiliar TIN'] },
      { key: 'programacion_salida', label: 'Programación de salida en vivo', responsables: ['TIN'] },
      { key: 'socializacion', label: 'Socialización y capacitación a procesos involucrados', responsables: ['Partes Interesadas (solicitantes)'] },
      { key: 'merge_produccion', label: 'Merge de desarrollo a producción', responsables: ['TIN'] },
      { key: 'cargue_doc_tecnica', label: 'Cargue de documentación técnica a TIN-FLOW', responsables: ['Desarrollador', 'Auxiliar TIN'] },
    ],
  },
  {
    key: 'produccion',
    titulo: 'Producción',
    estadoSistema: 'Entregado y en funcionamiento',
    color: { header: 'bg-green-50 border-green-200', badge: 'bg-green-100 text-green-700', progress: 'bg-green-500', dot: 'bg-green-400', dotOk: 'bg-green-600' },
    pasos: [
      { key: 'salida_produccion', label: 'Salida a producción', responsables: ['TIN'] },
      { key: 'comunicado_iwg', label: 'Comunicado IWG', responsables: ['Coordinador TIN'] },
      { key: 'soporte_post', label: 'Soporte post producción', responsables: ['TIN'] },
    ],
  },
]

function formatRelativa(d: string): string {
  try {
    const diff = Date.now() - new Date(d).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'ahora'
    if (mins < 60) return `hace ${mins} min`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `hace ${hrs}h`
    const days = Math.floor(hrs / 24)
    if (days < 30) return `hace ${days}d`
    return new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch { return d }
}

/* ── Fila de un paso ─────────────────────────────────────────────────────── */
function FilaPaso({
  paso, estado, requerimientoId, onRefresh,
}: {
  paso: PasoConfig
  estado: PasoFlujo | undefined
  requerimientoId: string
  onRefresh: () => void
}) {
  const [isPending, startT]         = useTransition()
  const [savingNota, startSavingT]  = useTransition()
  const [showNota, setShowNota]     = useState(!!(estado?.notas))
  const [nota, setNota]             = useState(estado?.notas ?? '')

  const completado  = estado?.completado ?? false
  const notaCambiada = nota.trim() !== (estado?.notas ?? '').trim()

  const handleToggle = () => {
    startT(async () => {
      const res = await toggleFlujoPaso(requerimientoId, paso.key, !completado)
      if (!res.ok) toast.error(res.error ?? 'Error al guardar')
      else onRefresh()
    })
  }

  const handleGuardarNota = () => {
    startSavingT(async () => {
      const res = await guardarNotasPaso(requerimientoId, paso.key, nota)
      if (res.ok) { toast.success('Nota guardada'); onRefresh() }
      else toast.error(res.error ?? 'Error')
    })
  }

  return (
    <li className={cn(
      'rounded-xl border transition-colors',
      completado ? 'border-emerald-100 bg-emerald-50/40' : 'border-slate-100 bg-white'
    )}>
      <div className="flex items-start gap-3 px-3 py-3">
        {/* Checkbox */}
        <button onClick={handleToggle} disabled={isPending} className="mt-0.5 shrink-0">
          {isPending
            ? <div className="h-[18px] w-[18px] animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
            : completado
              ? <CheckCircle2 size={18} className="text-emerald-500" />
              : <Circle size={18} className="text-slate-300 hover:text-emerald-400 transition-colors" />
          }
        </button>

        <div className="flex-1 min-w-0 space-y-1.5">
          {/* Título + opcional */}
          <div className="flex items-start gap-2">
            <p className={cn(
              'text-sm font-medium leading-snug flex-1',
              completado ? 'line-through text-slate-400' : 'text-slate-700'
            )}>
              {paso.label}
            </p>
            {paso.opcional && (
              <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                Opcional
              </span>
            )}
          </div>

          {/* Responsables */}
          <div className="flex flex-wrap items-center gap-1">
            {paso.responsables.map(r => (
              <span key={r} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">
                {r}
              </span>
            ))}
          </div>

          {/* Completado por */}
          {completado && estado?.completado_at && (
            <p className="text-[11px] text-emerald-600">
              ✓ {estado.completado_por ?? 'Sistema'} · {formatRelativa(estado.completado_at)}
            </p>
          )}

          {/* Nota colapsada */}
          {!showNota && estado?.notas && (
            <p className="text-[11px] italic text-slate-400">📝 {estado.notas}</p>
          )}

          {/* Panel de nota expandido */}
          {showNota && (
            <div className="space-y-1.5 pt-1">
              <textarea
                value={nota}
                onChange={e => setNota(e.target.value)}
                placeholder="Agregar nota (fecha de reunión, resultado, enlace...)"
                rows={2}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 resize-none"
              />
              {notaCambiada && (
                <button onClick={handleGuardarNota} disabled={savingNota}
                  className="rounded-lg bg-blue-600 px-3 py-1 text-[11px] font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                  {savingNota ? 'Guardando...' : 'Guardar nota'}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Botón nota */}
        <button
          onClick={() => setShowNota(s => !s)}
          title={showNota ? 'Ocultar nota' : 'Agregar nota'}
          className={cn(
            'mt-0.5 shrink-0 rounded-lg p-1 transition-colors',
            showNota || estado?.notas ? 'text-blue-400 hover:text-blue-600' : 'text-slate-200 hover:text-blue-400'
          )}
        >
          <StickyNote size={13} />
        </button>
      </div>
    </li>
  )
}

/* ── Tarjeta de fase ─────────────────────────────────────────────────────── */
function TarjetaFase({
  fase, estadosPasos, requerimientoId, onRefresh,
}: {
  fase: FaseConfig
  estadosPasos: Map<string, PasoFlujo>
  requerimientoId: string
  onRefresh: () => void
}) {
  const [expanded, setExpanded] = useState(true)

  const total       = fase.pasos.length
  const completados = fase.pasos.filter(p => estadosPasos.get(p.key)?.completado).length
  const porcentaje  = total > 0 ? Math.round((completados / total) * 100) : 0
  const todoOk      = completados === total

  return (
    <div className={cn('rounded-xl border overflow-hidden', fase.color.header)}>
      {/* Cabecera */}
      <div className={cn('px-4 py-3 border-b', fase.color.header)}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className={cn('h-2 w-2 rounded-full shrink-0', todoOk ? fase.color.dotOk : fase.color.dot)} />
            <h3 className="text-sm font-semibold text-slate-700 truncate">{fase.titulo}</h3>
            <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium shrink-0', fase.color.badge)}>
              {fase.estadoSistema}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={cn('text-xs font-semibold', todoOk ? 'text-emerald-600' : 'text-slate-400')}>
              {completados}/{total}
            </span>
            <button onClick={() => setExpanded(e => !e)}
              className="rounded-lg p-1 text-slate-400 hover:bg-white/60">
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>
        </div>
        {/* Barra de progreso */}
        <div className="mt-2 h-1.5 rounded-full bg-slate-200/70">
          <div
            className={cn('h-1.5 rounded-full transition-all duration-500', todoOk ? 'bg-emerald-500' : fase.color.progress)}
            style={{ width: `${porcentaje}%` }}
          />
        </div>
      </div>

      {/* Pasos */}
      {expanded && (
        <div className="bg-white/80 p-3">
          <ul className="space-y-2">
            {fase.pasos.map(paso => (
              <FilaPaso
                key={paso.key}
                paso={paso}
                estado={estadosPasos.get(paso.key)}
                requerimientoId={requerimientoId}
                onRefresh={onRefresh}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

/* ── Componente principal ────────────────────────────────────────────────── */
export function TabFlujo({ requerimientoId }: Props) {
  const qc = useQueryClient()

  const { data: pasos = [], isLoading } = useQuery<PasoFlujo[]>({
    queryKey: ['flujo-proceso', requerimientoId],
    queryFn: () => getFlujoProcesoReq(requerimientoId),
    staleTime: 30_000,
  })

  const estadosPasos = new Map(pasos.map(p => [p.paso_key, p]))

  const totalPasos      = FASES.reduce((s, f) => s + f.pasos.length, 0)
  const totalCompletados = FASES.reduce((s, f) =>
    s + f.pasos.filter(p => estadosPasos.get(p.key)?.completado).length, 0)
  const porcentajeGlobal = totalPasos > 0 ? Math.round((totalCompletados / totalPasos) * 100) : 0

  const refresh = () => qc.invalidateQueries({ queryKey: ['flujo-proceso', requerimientoId] })

  if (isLoading) {
    return (
      <div className="mt-4 space-y-3">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
      </div>
    )
  }

  return (
    <div className="mt-4 space-y-4">
      {/* Progreso global */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold text-slate-700">Progreso general del proceso</p>
          <span className={cn(
            'text-sm font-bold',
            porcentajeGlobal === 100 ? 'text-emerald-600' : 'text-slate-600'
          )}>
            {porcentajeGlobal}%
          </span>
        </div>
        <div className="h-2 rounded-full bg-slate-100">
          <div
            className={cn(
              'h-2 rounded-full transition-all duration-500',
              porcentajeGlobal === 100 ? 'bg-emerald-500' : 'bg-blue-500'
            )}
            style={{ width: `${porcentajeGlobal}%` }}
          />
        </div>
        <p className="mt-1.5 text-xs text-slate-400">
          {totalCompletados} de {totalPasos} pasos completados
        </p>
      </div>

      {/* Fases */}
      {FASES.map(fase => (
        <TarjetaFase
          key={fase.key}
          fase={fase}
          estadosPasos={estadosPasos}
          requerimientoId={requerimientoId}
          onRefresh={refresh}
        />
      ))}
    </div>
  )
}
