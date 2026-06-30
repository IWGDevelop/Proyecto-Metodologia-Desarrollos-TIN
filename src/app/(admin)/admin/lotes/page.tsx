import { Layers } from 'lucide-react'
import { getLotesConStats, getConfigBloqueo } from '@/actions/lotes'
import { GestionLotes } from '@/components/lotes/GestionLotes'

export const dynamic = 'force-dynamic'

export default async function LotesPage() {
  const [lotes, bloqueo] = await Promise.all([
    getLotesConStats(),
    getConfigBloqueo(),
  ])

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <Layers size={20} className="text-blue-600" />
          Lotes / Plan de Trabajo
        </h1>
        <p className="text-sm text-slate-500">
          Gestión de versiones de requerimientos. Cada lote agrupa un conjunto de desarrollos de un periodo.
        </p>
      </div>

      <GestionLotes lotes={lotes} bloqueoActivo={bloqueo} />
    </div>
  )
}
