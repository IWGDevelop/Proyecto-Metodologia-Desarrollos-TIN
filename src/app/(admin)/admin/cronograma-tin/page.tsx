import { GanttCronogramaTIN } from '@/components/cronograma/GanttCronogramaTIN'
import { getAsignacionesCronogramaTIN } from '@/actions/desarrolladores-req'

export const dynamic = 'force-dynamic'

export default async function CronogramaTINPage() {
  const asignaciones = await getAsignacionesCronogramaTIN()

  return (
    <div className="space-y-5 p-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Cronograma de Trabajo TIN</h1>
        <p className="mt-1 text-sm text-slate-500">
          Proyección del trabajo planificado por desarrollador — fechas configuradas en el tab Desarrollo de cada requerimiento
        </p>
      </div>
      <GanttCronogramaTIN asignaciones={asignaciones} />
    </div>
  )
}
