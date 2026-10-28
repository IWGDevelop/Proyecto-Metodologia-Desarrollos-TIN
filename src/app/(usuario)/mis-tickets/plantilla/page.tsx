import { notFound } from 'next/navigation'
import { obtenerDatosPlantilla } from '@/actions/tickets/crear'
import { PlantillaIngresoForm } from '@/components/tickets/funcionario/PlantillaIngresoForm'

export const dynamic = 'force-dynamic'

export default async function PlantillaTicketsPage() {
  // Solo quien tiene tickets:atender / tickets:coordinar o ADMIN_TIN
  const datos = await obtenerDatosPlantilla()
  if (!datos) notFound()

  return (
    <div className="mx-auto max-w-3xl p-6">
      {datos.plantillas.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white py-12 text-center text-sm text-slate-500">
          No hay plantillas activas. Configúralas en Configuración de tickets.
        </div>
      ) : (
        <PlantillaIngresoForm datos={datos} />
      )}
    </div>
  )
}
