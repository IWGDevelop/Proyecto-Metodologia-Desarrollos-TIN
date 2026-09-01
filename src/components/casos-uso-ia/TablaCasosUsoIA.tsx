import Link from 'next/link'
import { Building2, Calendar, ChevronRight } from 'lucide-react'
import { getCasosUsoIA } from '@/actions/casos-uso-ia'
import { BadgeEstadoCasoIA } from './BadgeEstadoCasoIA'

interface Props {
  estado?: string
  alcance?: string
  search?: string
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

const ALCANCE_LABEL: Record<string, string> = { IWF: 'IWF', ILT: 'ILT', IWG: 'IWG' }

export async function TablaCasosUsoIA({ estado, alcance, search }: Props) {
  const casos = await getCasosUsoIA({ estado, alcance, search })

  if (casos.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-12 text-center">
        <p className="text-sm font-medium text-slate-500">No hay casos de uso IA registrados</p>
        <p className="mt-1 text-xs text-slate-400">Crea el primero con el botón "Nueva solicitud"</p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">N°</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Proceso solicitante</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Herramienta / Producto</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Alcance</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Estado</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Solicitante</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Fecha</th>
            <th className="w-8" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {casos.map((caso) => (
            <tr key={caso.id} className="group transition-colors hover:bg-violet-50">
              <td className="px-4 py-3 font-mono text-xs font-medium text-slate-700">
                #{String(caso.numero).padStart(4, '0')}
              </td>
              <td className="max-w-[180px] px-4 py-3">
                <p className="truncate font-medium text-slate-800">{caso.proceso_solicitante}</p>
                <p className="truncate text-xs text-slate-400">{caso.proposito}</p>
              </td>
              <td className="px-4 py-3">
                <p className="font-medium text-slate-800">{caso.herramienta_producto}</p>
                <p className="text-xs text-slate-400">{caso.herramienta_proveedor}</p>
              </td>
              <td className="px-4 py-3">
                <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                  <Building2 size={10} />
                  {ALCANCE_LABEL[caso.alcance] ?? caso.alcance}
                </span>
              </td>
              <td className="px-4 py-3">
                <BadgeEstadoCasoIA estado={caso.estado} />
              </td>
              <td className="px-4 py-3 text-xs text-slate-600">
                {caso.solicitante?.nombre_completo ?? '—'}
              </td>
              <td className="px-4 py-3">
                <span className="flex items-center gap-1 text-xs text-slate-400">
                  <Calendar size={11} />
                  {fmtDate(caso.created_at)}
                </span>
              </td>
              <td className="pr-3">
                <Link
                  href={`/admin/casos-uso-ia/${caso.id}`}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 opacity-0 transition group-hover:opacity-100 hover:bg-violet-100 hover:text-violet-700"
                >
                  <ChevronRight size={15} />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function TablaCasosUsoIASkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="divide-y divide-slate-100">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-4">
            <div className="h-4 w-12 animate-pulse rounded bg-slate-100" />
            <div className="h-4 w-40 animate-pulse rounded bg-slate-100" />
            <div className="h-4 w-32 animate-pulse rounded bg-slate-100" />
            <div className="h-4 w-16 animate-pulse rounded bg-slate-100" />
            <div className="h-5 w-24 animate-pulse rounded-full bg-slate-100" />
          </div>
        ))}
      </div>
    </div>
  )
}
