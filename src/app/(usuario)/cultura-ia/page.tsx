import { Suspense } from 'react'
import Link from 'next/link'
import { Brain, Plus } from 'lucide-react'
import { MisDashboardIA, MisDashboardIASkeleton } from '@/components/cultura-ia/MisDashboardIA'

export const dynamic = 'force-dynamic'

export default function CulturaIAUsuarioPage() {
  return (
    <div className="space-y-5 p-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100">
              <Brain size={16} className="text-violet-600" />
            </div>
            <h1 className="text-xl font-bold text-slate-800">Mi uso de IA</h1>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Registra cómo estás usando la inteligencia artificial y el impacto que genera en tu trabajo.
          </p>
        </div>
        <Link href="/cultura-ia/nuevo">
          <button className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700">
            <Plus size={15} /> Registrar uso
          </button>
        </Link>
      </div>

      <div className="rounded-xl border border-violet-100 bg-gradient-to-r from-violet-50 to-purple-50 p-4 text-sm text-violet-700">
        <strong>💡 ¿Por qué registrar?</strong> Cada reporte cuenta: tus datos de uso de IA son parte del programa de
        incentivos por innovación. Los funcionarios con mayor adopción e impacto demostrado serán reconocidos.
      </div>

      <Suspense fallback={<MisDashboardIASkeleton />}>
        <MisDashboardIA />
      </Suspense>
    </div>
  )
}
