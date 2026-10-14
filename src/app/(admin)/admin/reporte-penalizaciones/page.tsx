import { getReportePenalizaciones } from '@/actions/reporte-penalizaciones'
import { ReportePenalizaciones } from '@/components/reportes/ReportePenalizaciones'

export const dynamic = 'force-dynamic'

export default async function ReportePenalizacionesPage() {
  const registros = await getReportePenalizaciones().catch(() => [])
  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Reporte de Penalizaciones e Incumplimientos</h1>
        <p className="text-sm text-slate-500">
          Penalizaciones registradas y tareas incumplidas en todos los requerimientos, por usuario y por proceso, con su impacto en días
        </p>
      </div>
      <ReportePenalizaciones registros={registros} />
    </div>
  )
}
