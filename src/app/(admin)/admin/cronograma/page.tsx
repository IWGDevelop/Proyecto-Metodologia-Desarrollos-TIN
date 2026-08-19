import { createAdminClient } from '@/lib/supabase/admin'
import { GanttCronograma } from '@/components/cronograma/GanttCronograma'

export const dynamic = 'force-dynamic'

export default async function CronogramaPage() {
  const supabase = createAdminClient()

  const { data } = await (supabase as any)
    .from('requerimientos')
    .select(`
      id, numero, nombre_desarrollo, identificacion, estado, prioridad, sub_prioridad,
      fecha_inicio_desarrollo,
      fecha_estimada_entrega,          fecha_real_entrega,
      fecha_estimada_feedback_pruebas, fecha_real_feedback_pruebas,
      fecha_estimada_salida_vivo,      fecha_salida_vivo
    `)
    .or([
      'fecha_inicio_desarrollo.not.is.null',
      'fecha_estimada_entrega.not.is.null',
      'fecha_estimada_feedback_pruebas.not.is.null',
      'fecha_estimada_salida_vivo.not.is.null',
      'fecha_salida_vivo.not.is.null',
    ].join(','))
    .order('prioridad',     { ascending: true, nullsFirst: false })
    .order('sub_prioridad', { ascending: true, nullsFirst: false })
    .order('created_at',    { ascending: true })

  return (
    <div className="space-y-5 p-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Cronograma</h1>
        <p className="mt-1 text-sm text-slate-500">
          Fechas estimadas y reales de desarrollo, pruebas y salida en vivo
        </p>
      </div>
      <GanttCronograma requerimientos={data ?? []} />
    </div>
  )
}
