import { createAdminClient } from '@/lib/supabase/admin'
import { ReportePrioridades } from '@/components/reportes/ReportePrioridades'

export const dynamic = 'force-dynamic'

async function fetchDatos() {
  try {
    const supabase = createAdminClient()
    const [{ data: metricas }, { data: parentIds }] = await Promise.all([
      (supabase as any)
        .from('v_metricas_requerimientos')
        .select('*')
        .eq('es_borrador', false)
        .neq('origen_requerimiento', 'DESARROLLO_EXTERNO')
        .neq('estado', 'DESISTIDO')
        .order('prioridad', { ascending: true, nullsFirst: false })
        .order('sub_prioridad', { ascending: true, nullsFirst: false })
        .order('nombre_desarrollo', { ascending: true }),
      (supabase as any)
        .from('requerimientos')
        .select('id, parent_id')
        .eq('es_borrador', false)
        .neq('origen_requerimiento', 'DESARROLLO_EXTERNO')
        .neq('estado', 'DESISTIDO'),
    ])
    const parentMap = new Map((parentIds ?? []).map((r: any) => [r.id, r.parent_id]))
    return (metricas ?? []).map((r: any) => ({ ...r, parent_id: parentMap.get(r.id) ?? null }))
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
