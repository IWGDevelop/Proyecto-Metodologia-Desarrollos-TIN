import { Suspense } from 'react'
import Link from 'next/link'
import { Brain, Plus, Download } from 'lucide-react'
import { MetricasAdminIA, MetricasAdminIASkeleton } from '@/components/cultura-ia/MetricasAdminIA'

export const dynamic = 'force-dynamic'

export default function AdminCulturaIAPage() {
  return (
    <div className="space-y-5 p-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100">
              <Brain size={16} className="text-violet-600" />
            </div>
            <h1 className="text-xl font-bold text-slate-800">Cultura IA — Métricas</h1>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Adopción de inteligencia artificial por funcionario · Impacto en eficiencia y ahorro
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/cultura-ia/nuevo">
            <button className="flex items-center gap-1.5 rounded-lg border border-violet-200 bg-white px-3 py-2 text-sm font-medium text-violet-600 hover:bg-violet-50">
              <Plus size={14} /> Registrar mi uso
            </button>
          </Link>
        </div>
      </div>

      <div className="rounded-xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-800">
        <strong>Programa de Incentivos por Adopción de IA:</strong> Los funcionarios con mayor adopción demostrada
        a través de registros periódicos serán elegibles para reconocimientos e incentivos de desempeño.
        Los datos se agrupan por cédula para seguimiento individual.
      </div>

      <Suspense fallback={<MetricasAdminIASkeleton />}>
        <MetricasAdminIA />
      </Suspense>
    </div>
  )
}
