import { createClient } from '@/lib/supabase/server'
import { Skeleton } from '@/components/ui/skeleton'
import { formatFechaRelativa } from '@/lib/utils'
import { ESTADOS } from '@/lib/constants'
import { ArrowRight, Activity } from 'lucide-react'
import Link from 'next/link'
import type { Estado } from '@/lib/supabase/types'

async function getActividad() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('historial_estados')
    .select(`
      id,
      estado_anterior,
      estado_nuevo,
      observacion,
      usuario,
      created_at,
      requerimiento_id,
      requerimientos (
        id,
        identificacion,
        numero
      )
    `)
    .order('created_at', { ascending: false })
    .limit(8)

  return data ?? []
}

function BadgeEstado({ estado }: { estado: Estado | null }) {
  if (!estado) return <span className="text-xs text-slate-400">—</span>
  const cfg = ESTADOS[estado]
  return (
    <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-xs font-medium ${cfg.bgColor} ${cfg.textColor}`}>
      {cfg.label}
    </span>
  )
}

export async function ActividadReciente() {
  const actividad = await getActividad()

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <Activity size={16} className="text-blue-500" />
        <h2 className="text-sm font-semibold text-slate-700">Actividad reciente</h2>
      </div>

      {actividad.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">Sin cambios de estado registrados</p>
      ) : (
        <ol className="space-y-0 divide-y divide-slate-50">
          {actividad.map((item) => {
            const req = Array.isArray(item.requerimientos)
              ? item.requerimientos[0]
              : item.requerimientos

            return (
              <li key={item.id} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                {/* Línea de tiempo */}
                <div className="relative flex flex-col items-center">
                  <div className="mt-1 h-2 w-2 rounded-full bg-blue-400 ring-2 ring-blue-100" />
                </div>

                <div className="min-w-0 flex-1">
                  {/* Requerimiento */}
                  {req ? (
                    <Link
                      href={`/requerimientos/${req.id}`}
                      className="text-sm font-medium text-slate-700 hover:text-blue-600 hover:underline"
                    >
                      <span className="line-clamp-1">{req.identificacion}</span>
                    </Link>
                  ) : (
                    <span className="text-sm text-slate-500">Requerimiento eliminado</span>
                  )}

                  {/* Transición de estado */}
                  <div className="mt-0.5 flex flex-wrap items-center gap-1 text-xs">
                    <BadgeEstado estado={item.estado_anterior as Estado | null} />
                    <ArrowRight size={10} className="text-slate-400" />
                    <BadgeEstado estado={item.estado_nuevo as Estado} />
                  </div>

                  {/* Observación */}
                  {item.observacion && (
                    <p className="mt-0.5 line-clamp-1 text-xs text-slate-400">
                      "{item.observacion}"
                    </p>
                  )}

                  {/* Meta */}
                  <p className="mt-0.5 text-xs text-slate-400">
                    {item.usuario ?? 'Sistema'} · {formatFechaRelativa(item.created_at)}
                  </p>
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}

export function ActividadRecienteSkeleton() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <Skeleton className="mb-4 h-4 w-36" />
      <div className="space-y-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="mt-1 h-2 w-2 shrink-0 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
