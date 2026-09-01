import { Suspense } from 'react'
import Link from 'next/link'
import { Plus, Brain } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TablaCasosUsoIA, TablaCasosUsoIASkeleton } from '@/components/casos-uso-ia/TablaCasosUsoIA'
import { ESTADOS_CASO_IA } from '@/components/casos-uso-ia/BadgeEstadoCasoIA'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{ estado?: string; alcance?: string; q?: string }>
}

export default async function CasosUsoIAPage({ searchParams }: PageProps) {
  const params = await searchParams

  return (
    <div className="space-y-5 p-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100">
              <Brain size={16} className="text-violet-600" />
            </div>
            <h1 className="text-xl font-bold text-slate-800">Casos de Uso IA</h1>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Autorizaciones de uso de inteligencia artificial — Procedimiento TIN-P-008
          </p>
        </div>
        <Link href="/admin/casos-uso-ia/nuevo">
          <Button size="sm" className="gap-1.5 bg-violet-600 hover:bg-violet-700">
            <Plus size={15} /> Nueva solicitud
          </Button>
        </Link>
      </div>

      {/* Filtros */}
      <form method="get" className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <input
          name="q"
          defaultValue={params.q}
          placeholder="Buscar por proceso, herramienta..."
          className="h-9 flex-1 min-w-[200px] rounded-md border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
        <select
          name="estado"
          defaultValue={params.estado ?? ''}
          className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
        >
          <option value="">Todos los estados</option>
          {ESTADOS_CASO_IA.map(e => (
            <option key={e.value} value={e.value}>{e.label}</option>
          ))}
        </select>
        <select
          name="alcance"
          defaultValue={params.alcance ?? ''}
          className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
        >
          <option value="">Todos los alcances</option>
          <option value="IWF">IWF</option>
          <option value="ILT">ILT</option>
          <option value="IWG">IWG</option>
        </select>
        <Button type="submit" size="sm" variant="outline">Filtrar</Button>
        {(params.estado || params.alcance || params.q) && (
          <Link href="/admin/casos-uso-ia">
            <Button size="sm" variant="ghost" className="text-slate-500">Limpiar</Button>
          </Link>
        )}
      </form>

      {/* Tabla */}
      <Suspense fallback={<TablaCasosUsoIASkeleton />}>
        <TablaCasosUsoIA
          estado={params.estado}
          alcance={params.alcance}
          search={params.q}
        />
      </Suspense>

      {/* Info del procedimiento */}
      <div className="rounded-xl border border-violet-100 bg-violet-50 p-4 text-xs text-violet-700">
        <strong>TIN-P-008</strong> — Procedimiento para Autorización de Uso de Inteligencia Artificial v1.0.
        Las autorizaciones tienen vigencia máxima de <strong>12 meses</strong> y requieren aprobación conjunta de la
        Dirección Corporativa de TIN y la Dirección de IA y Ciencia de Datos.
      </div>
    </div>
  )
}
