import { createAdminClient } from '@/lib/supabase/admin'
import { ReportePrioridades } from '@/components/reportes/ReportePrioridades'

export const dynamic = 'force-dynamic'

async function fetchDatos() {
  try {
    const supabase = createAdminClient()
    const { data } = await (supabase as any)
      .from('v_metricas_requerimientos')
      .select('*')
      .eq('es_borrador', false)
      .order('prioridad', { ascending: true, nullsFirst: false })
      .order('sub_prioridad', { ascending: true, nullsFirst: false })
      .order('nombre_desarrollo', { ascending: true })
    return data ?? []
  } catch {
    return []
  }
}

export default async function ReportePrioridadesPage() {
  const datos = await fetchDatos()
  return (
    <div className="space-y-8 p-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Reporte de Prioridades</h1>
        <p className="text-sm text-slate-500">Distribución, impacto y estado de los desarrollos por nivel de prioridad</p>
      </div>
      <ReportePrioridades datos={datos} />
    </div>
  )
}
