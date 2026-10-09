import { getReportePlaneacion } from '@/actions/reporte-planeacion'
import { ReportePlaneacion } from '@/components/reportes/ReportePlaneacion'

export const dynamic = 'force-dynamic'

export default async function ReportePlaneacionPage() {
  const datos = await getReportePlaneacion().catch(() => [])
  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Reporte de Planeación</h1>
        <p className="text-sm text-slate-500">Fechas planeadas por etapa contrastadas con la ejecución real según el historial de estados</p>
      </div>
      <ReportePlaneacion datos={datos} />
    </div>
  )
}
