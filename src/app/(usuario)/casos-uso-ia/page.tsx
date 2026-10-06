import Link from 'next/link'
import { Brain, Calendar, ChevronRight, Plus, Timer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getMisCasosUsoIA } from '@/actions/casos-uso-ia'
import { BadgeEstadoCasoIA } from '@/components/casos-uso-ia/BadgeEstadoCasoIA'
import {
  TIPOS_REGISTRO_CASO_IA, labelTipoRegistroCasoIA, minutosAhorradosMes, fmtMinutos,
} from '@/lib/casos-uso-ia'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{ tipo?: string }>
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default async function MisCasosUsoIAPage({ searchParams }: PageProps) {
  const { tipo } = await searchParams
  const casos = await getMisCasosUsoIA({ tipo })

  const totalMinMes = casos.reduce(
    (acc, c) => acc + (c.tipo_registro === 'USO_EXISTENTE' ? minutosAhorradosMes(c.minutos_ahorrados, c.frecuencia_uso) ?? 0 : 0),
    0,
  )

  return (
    <div className="space-y-5 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100">
              <Brain size={16} className="text-violet-600" />
            </div>
            <h1 className="text-xl font-bold text-slate-800">Mis casos de uso IA</h1>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Solicita el uso de una herramienta de IA o registra la que ya estás usando — Procedimiento TIN-P-008
          </p>
        </div>
        <Link href="/casos-uso-ia/nuevo">
          <Button size="sm" className="gap-1.5 bg-violet-600 hover:bg-violet-700">
            <Plus size={15} /> Nuevo registro
          </Button>
        </Link>
      </div>

      {/* Impacto total */}
      {totalMinMes > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <Timer size={18} className="text-emerald-600" />
          <p className="text-sm text-emerald-800">
            Tus usos de IA registrados te ahorran aprox. <strong>{fmtMinutos(totalMinMes)}</strong> al mes.
          </p>
        </div>
      )}

      {/* Filtro por tipo */}
      <div className="flex flex-wrap gap-2">
        {[{ value: '', label: 'Todos' }, ...TIPOS_REGISTRO_CASO_IA].map(t => {
          const activo = (tipo ?? '') === t.value
          return (
            <Link
              key={t.value || 'todos'}
              href={t.value ? `/casos-uso-ia?tipo=${t.value}` : '/casos-uso-ia'}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors
                ${activo ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-violet-100'}`}
            >
              {t.label}
            </Link>
          )
        })}
      </div>

      {/* Lista */}
      {casos.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-12 text-center">
          <p className="text-sm font-medium text-slate-500">Aún no tienes casos de uso IA registrados</p>
          <p className="mt-1 text-xs text-slate-400">Crea el primero con el botón &quot;Nuevo registro&quot;</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {casos.map(caso => {
            const esUso = caso.tipo_registro === 'USO_EXISTENTE'
            const minMes = esUso ? minutosAhorradosMes(caso.minutos_ahorrados, caso.frecuencia_uso) : null
            return (
              <li key={caso.id}>
                <Link
                  href={`/casos-uso-ia/${caso.id}`}
                  className="group flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-violet-300 hover:bg-violet-50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-violet-700">
                        #{String(caso.numero).padStart(4, '0')}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium
                        ${esUso ? 'bg-emerald-100 text-emerald-700' : 'bg-violet-100 text-violet-700'}`}>
                        {labelTipoRegistroCasoIA(caso.tipo_registro)}
                      </span>
                      <BadgeEstadoCasoIA estado={caso.estado} />
                    </div>
                    <p className="mt-1 font-medium text-slate-800">
                      {caso.herramienta_producto} <span className="text-slate-400">· {caso.herramienta_proveedor}</span>
                    </p>
                    <p className="truncate text-xs text-slate-500">{caso.proposito}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                      <span className="flex items-center gap-1"><Calendar size={11} /> {fmtDate(caso.created_at)}</span>
                      {minMes != null && (
                        <span className="flex items-center gap-1 text-emerald-600"><Timer size={11} /> {fmtMinutos(minMes)}/mes</span>
                      )}
                    </div>
                  </div>
                  <ChevronRight size={16} className="shrink-0 text-slate-300 group-hover:text-violet-600" />
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
