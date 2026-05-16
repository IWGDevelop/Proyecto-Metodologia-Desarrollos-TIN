'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ShieldAlert, ChevronDown, ChevronUp, Download,
  AlertTriangle, DollarSign, Clock, Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCOP, cn } from '@/lib/utils'
import { exportarReporte } from '@/lib/exportar'
import { getTareasIncumplidas } from '@/actions/reportes-incumplimiento'
import type { IncumplimientoUsuario, TareaIncumplida } from '@/actions/reportes-incumplimiento'

function formatFecha(str: string | null) {
  if (!str) return '—'
  return new Date(str + 'T12:00:00').toLocaleDateString('es-CO', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

function AvatarIniciales({ nombre }: { nombre: string }) {
  const initials = nombre.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase()
  return (
    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-100 text-xs font-bold text-red-600">
      {initials}
    </div>
  )
}

/* ── Fila expandible por usuario ─────────────────────────────────────────── */
function FilaUsuario({ usuario, rank }: { usuario: IncumplimientoUsuario; rank: number }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <>
      {/* Fila resumen */}
      <tr
        onClick={() => setExpanded(e => !e)}
        className={cn(
          'cursor-pointer border-b border-slate-100 transition-colors hover:bg-slate-50',
          expanded && 'bg-red-50/30 hover:bg-red-50/40'
        )}
      >
        <td className="px-4 py-3 text-xs font-bold text-slate-400 text-center w-10">{rank}</td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2.5">
            <AvatarIniciales nombre={usuario.responsable_nombre} />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-800 leading-tight">{usuario.responsable_nombre}</p>
              <p className="text-xs text-slate-400 truncate">{usuario.responsable_email}</p>
            </div>
          </div>
        </td>
        <td className="px-4 py-3 text-center">
          <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-red-100 px-2 text-xs font-bold text-red-600">
            {usuario.total_incumplidas}
          </span>
        </td>
        <td className="px-4 py-3 text-center">
          <span className="rounded-full bg-orange-50 px-2.5 py-0.5 text-xs font-semibold text-orange-600">
            {usuario.dias_promedio_retraso}d
          </span>
        </td>
        <td className="px-4 py-3 text-right">
          {usuario.penalizacion_total > 0 ? (
            <span className="text-sm font-bold text-red-600">
              {formatCOP(usuario.penalizacion_total)}
            </span>
          ) : (
            <span className="text-xs text-slate-300">—</span>
          )}
        </td>
        <td className="px-4 py-3 text-center w-10">
          {expanded
            ? <ChevronUp size={14} className="mx-auto text-slate-400" />
            : <ChevronDown size={14} className="mx-auto text-slate-400" />}
        </td>
      </tr>

      {/* Detalle de tareas expandidas */}
      {expanded && (
        <tr>
          <td colSpan={6} className="px-4 pb-4 pt-1">
            <div className="rounded-xl border border-red-100 bg-white overflow-hidden shadow-sm">
              <div className="border-b border-red-50 bg-red-50/40 px-3 py-2">
                <p className="text-xs font-semibold text-red-600">
                  {usuario.total_incumplidas} tarea{usuario.total_incumplidas !== 1 ? 's' : ''} incumplida{usuario.total_incumplidas !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50">
                    <tr>
                      {['Tarea', 'Reunión', 'Requerimiento', 'Compromiso', 'Cumplió', 'Días tarde', 'Penalización', 'Motivo'].map(h => (
                        <th key={h} className="px-3 py-2 text-left font-medium text-slate-400 whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {usuario.tareas.map(t => (
                      <tr key={t.id} className="hover:bg-slate-50/50">
                        <td className="px-3 py-2.5 max-w-[200px]">
                          <p className="font-medium text-slate-700 line-clamp-2">{t.descripcion}</p>
                        </td>
                        <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">
                          {t.reunion_titulo ?? '—'}
                        </td>
                        <td className="px-3 py-2.5 max-w-[160px]">
                          <p className="truncate text-slate-500">{t.requerimiento_nombre ?? '—'}</p>
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap text-slate-600">
                          {formatFecha(t.fecha_compromiso)}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap text-slate-600">
                          {formatFecha(t.fecha_cumplimiento)}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <span className="rounded-full bg-red-50 px-2 py-0.5 font-bold text-red-600">
                            {t.dias_tarde}d
                          </span>
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          {t.penalizacion_cop != null ? (
                            <span className="font-semibold text-orange-600">{formatCOP(t.penalizacion_cop)}</span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 max-w-[200px]">
                          {t.motivo_incumplimiento ? (
                            <p className="italic text-slate-500 line-clamp-2">{t.motivo_incumplimiento}</p>
                          ) : (
                            <span className="text-slate-300">Sin motivo registrado</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {/* Subtotal por usuario */}
                  {usuario.penalizacion_total > 0 && (
                    <tfoot className="border-t border-slate-200 bg-orange-50/50">
                      <tr>
                        <td colSpan={6} className="px-3 py-2 text-xs font-semibold text-slate-500 text-right">
                          Total penalización {usuario.responsable_nombre.split(' ')[0]}:
                        </td>
                        <td className="px-3 py-2 font-bold text-orange-600 whitespace-nowrap">
                          {formatCOP(usuario.penalizacion_total)}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

/* ── Componente principal ────────────────────────────────────────────────── */
export function ReporteIncumplimiento() {
  const { data: usuarios = [], isLoading } = useQuery({
    queryKey: ['reporte-incumplimiento'],
    queryFn: getTareasIncumplidas,
    staleTime: 60_000,
  })

  const totalIncumplidas    = usuarios.reduce((s, u) => s + u.total_incumplidas, 0)
  const penalizacionTotal   = usuarios.reduce((s, u) => s + u.penalizacion_total, 0)
  const diasPromedioGlobal  = usuarios.length
    ? Math.round(usuarios.reduce((s, u) => s + u.dias_promedio_retraso, 0) / usuarios.length)
    : 0

  const exportar = () => {
    const filas = usuarios.flatMap(u => u.tareas)
    exportarReporte('Incumplimiento_Tareas_Reunion', filas, [
      { titulo: 'Usuario',        ancho: 30, render: (r: TareaIncumplida) => r.responsable_nombre },
      { titulo: 'Email',          ancho: 30, render: (r: TareaIncumplida) => r.responsable_email ?? '' },
      { titulo: 'Tarea',          ancho: 45, render: (r: TareaIncumplida) => r.descripcion },
      { titulo: 'Reunión',        ancho: 30, render: (r: TareaIncumplida) => r.reunion_titulo ?? '' },
      { titulo: 'Requerimiento',  ancho: 45, render: (r: TareaIncumplida) => r.requerimiento_nombre ?? '' },
      { titulo: 'Compromiso',     ancho: 16, render: (r: TareaIncumplida) => formatFecha(r.fecha_compromiso) },
      { titulo: 'Cumplió',        ancho: 16, render: (r: TareaIncumplida) => formatFecha(r.fecha_cumplimiento) },
      { titulo: 'Días retraso',   ancho: 13, render: (r: TareaIncumplida) => r.dias_tarde },
      { titulo: 'Penalización COP', ancho: 22, render: (r: TareaIncumplida) => r.penalizacion_cop ?? 0 },
      { titulo: 'Motivo',         ancho: 50, render: (r: TareaIncumplida) => r.motivo_incumplimiento ?? '' },
    ])
  }

  if (isLoading) return <Skeleton className="h-64 w-full rounded-xl" />

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldAlert size={18} className="text-red-500" />
          <h2 className="text-base font-bold text-slate-800">Incumplimiento de tareas y penalizaciones</h2>
        </div>
        {usuarios.length > 0 && (
          <Button variant="outline" size="sm" onClick={exportar} className="gap-1.5 text-xs">
            <Download size={13} /> Exportar Excel
          </Button>
        )}
      </div>

      {/* Tarjetas resumen */}
      {usuarios.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-red-100 bg-red-50/60 px-4 py-3">
            <div className="flex items-center gap-1.5 text-xs font-medium text-red-400 mb-1">
              <AlertTriangle size={11} /> Tareas incumplidas
            </div>
            <p className="text-2xl font-bold text-red-600">{totalIncumplidas}</p>
          </div>
          <div className="rounded-xl border border-orange-100 bg-orange-50/60 px-4 py-3">
            <div className="flex items-center gap-1.5 text-xs font-medium text-orange-400 mb-1">
              <Users size={11} /> Usuarios
            </div>
            <p className="text-2xl font-bold text-orange-600">{usuarios.length}</p>
          </div>
          <div className="rounded-xl border border-amber-100 bg-amber-50/60 px-4 py-3">
            <div className="flex items-center gap-1.5 text-xs font-medium text-amber-500 mb-1">
              <Clock size={11} /> Días prom. retraso
            </div>
            <p className="text-2xl font-bold text-amber-600">{diasPromedioGlobal}d</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400 mb-1">
              <DollarSign size={11} /> Penalización total
            </div>
            {penalizacionTotal > 0 ? (
              <p className="text-lg font-bold text-slate-800">{formatCOP(penalizacionTotal)}</p>
            ) : (
              <p className="text-sm text-slate-400 mt-1">Sin penalizaciones</p>
            )}
          </div>
        </div>
      )}

      {/* Tabla principal */}
      {usuarios.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 py-14 text-center">
          <ShieldAlert size={30} className="mx-auto mb-2 text-slate-200" />
          <p className="text-sm font-semibold text-slate-500">Sin tareas incumplidas</p>
          <p className="text-xs text-slate-400 mt-1">
            Todas las tareas de reunión se cumplieron dentro del plazo acordado.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <p className="border-b border-slate-100 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Ranking de incumplimiento — haz clic en una fila para ver el detalle
          </p>
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-4 py-3 text-center text-xs font-medium text-slate-400 w-10">#</th>
                <th className="px-4 py-3 text-left   text-xs font-medium text-slate-400">Usuario</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-slate-400">Tareas incumplidas</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-slate-400">Días prom. retraso</th>
                <th className="px-4 py-3 text-right  text-xs font-medium text-slate-400">Penalización total</th>
                <th className="px-4 py-3 w-10" />
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u, i) => (
                <FilaUsuario key={u.responsable_email} usuario={u} rank={i + 1} />
              ))}
            </tbody>
            {/* Total global */}
            {penalizacionTotal > 0 && (
              <tfoot className="border-t-2 border-slate-200 bg-red-50/40">
                <tr>
                  <td colSpan={4} className="px-4 py-3 text-sm font-bold text-slate-700 text-right">
                    Total penalizaciones:
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-base font-bold text-red-600">{formatCOP(penalizacionTotal)}</span>
                  </td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  )
}
