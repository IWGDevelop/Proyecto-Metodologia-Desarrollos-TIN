import { createClient } from '@/lib/supabase/server'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertCircle, AlertTriangle, Info, CheckCircle, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

interface AlertaItem {
  id: string
  identificacion: string
  responsable: string | null
  dias: number
}

async function getAlertas() {
  const supabase = await createClient()
  const hoy = new Date()

  const { data: todos } = await supabase
    .from('requerimientos')
    .select('id, identificacion, responsable, prioridad, estado, fecha_envio_tin, fecha_inicio_desarrollo, motivo_stand_by, updated_at, inicio_pruebas_usuario, es_borrador')
    .eq('es_borrador', false)
    .not('estado', 'in', '("CERRADO","ENTREGADO")')

  const criticos: AlertaItem[] = []
  const advertencias: AlertaItem[] = []
  const infos: AlertaItem[] = []

  for (const r of todos ?? []) {
    const diasDesdeUpdate = Math.floor(
      (hoy.getTime() - new Date(r.updated_at).getTime()) / 86_400_000
    )

    // P1 que superó SLA (>5 días desde envío TIN sin inicio de desarrollo)
    if (r.prioridad === 1 && r.fecha_envio_tin && !r.fecha_inicio_desarrollo) {
      const diasSinInicio = Math.floor(
        (hoy.getTime() - new Date(r.fecha_envio_tin).getTime()) / 86_400_000
      )
      if (diasSinInicio > 5) {
        criticos.push({ id: r.id, identificacion: r.identificacion, responsable: r.responsable, dias: diasSinInicio })
      }
    }

    // Stand by sin motivo > 30 días
    if (r.estado === 'STAND_BY' && !r.motivo_stand_by && diasDesdeUpdate > 30) {
      advertencias.push({ id: r.id, identificacion: r.identificacion, responsable: r.responsable, dias: diasDesdeUpdate })
    }

    // Pruebas de usuario > 15 días sin cerrarse
    if (r.estado === 'PRUEBAS_USUARIO' && r.inicio_pruebas_usuario) {
      const diasEnPruebas = Math.floor(
        (hoy.getTime() - new Date(r.inicio_pruebas_usuario).getTime()) / 86_400_000
      )
      if (diasEnPruebas > 15) {
        infos.push({ id: r.id, identificacion: r.identificacion, responsable: r.responsable, dias: diasEnPruebas })
      }
    }
  }

  return { criticos, advertencias, infos }
}

function AlertaFila({ item, href }: { item: AlertaItem; href: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2.5">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-slate-700">{item.identificacion}</p>
        <p className="text-xs text-slate-400">
          {item.responsable ?? 'Sin responsable'} · {item.dias} días
        </p>
      </div>
      <Link href={href}>
        <button className="flex shrink-0 items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50">
          Ver <ExternalLink size={11} />
        </button>
      </Link>
    </div>
  )
}

function AlertaGrupo({
  tipo, icono: Icono, titulo, color, items,
}: {
  tipo: 'critico' | 'advertencia' | 'info'
  icono: React.ElementType
  titulo: string
  color: string
  items: AlertaItem[]
}) {
  const bg: Record<string, string> = {
    critico:     'border-red-200 bg-red-50',
    advertencia: 'border-yellow-200 bg-yellow-50',
    info:        'border-blue-200 bg-blue-50',
  }
  return (
    <div className={cn('rounded-xl border p-4', bg[tipo])}>
      <div className="mb-3 flex items-center gap-2">
        <Icono size={16} className={color} />
        <span className={cn('text-sm font-semibold', color)}>{titulo}</span>
        {items.length > 0 && (
          <span className={cn('ml-auto rounded-full px-2 py-0.5 text-xs font-bold', color,
            tipo === 'critico' ? 'bg-red-100' : tipo === 'advertencia' ? 'bg-yellow-100' : 'bg-blue-100'
          )}>
            {items.length}
          </span>
        )}
      </div>
      {items.length === 0 ? (
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <CheckCircle size={13} className="text-emerald-500" />
          Sin alertas en esta categoría
        </div>
      ) : (
        <div className="space-y-1.5">
          {items.map(item => (
            <AlertaFila key={item.id} item={item} href={`/requerimientos/${item.id}`} />
          ))}
        </div>
      )}
    </div>
  )
}

export async function AlertasCriticas() {
  const { criticos, advertencias, infos } = await getAlertas()

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
      <h2 className="mb-4 text-sm font-semibold text-slate-700">Alertas críticas</h2>
      <div className="space-y-3">
        <AlertaGrupo
          tipo="critico"
          icono={AlertCircle}
          titulo="Crítico — P1 fuera de SLA"
          color="text-red-600"
          items={criticos}
        />
        <AlertaGrupo
          tipo="advertencia"
          icono={AlertTriangle}
          titulo="Advertencia — Stand by sin motivo +30 días"
          color="text-yellow-700"
          items={advertencias}
        />
        <AlertaGrupo
          tipo="info"
          icono={Info}
          titulo="Info — Pruebas de usuario +15 días"
          color="text-blue-600"
          items={infos}
        />
      </div>
    </div>
  )
}

export function AlertasCriticasSkeleton() {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
      <Skeleton className="mb-4 h-4 w-32" />
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-slate-200 bg-white p-4">
            <Skeleton className="mb-3 h-4 w-48" />
            <div className="space-y-2">
              <Skeleton className="h-12 w-full rounded-lg" />
              <Skeleton className="h-12 w-full rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
