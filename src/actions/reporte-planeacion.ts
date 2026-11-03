'use server'

import { exigirAccesoAdmin } from '@/lib/supabase/guards'
import { createAdminClient } from '@/lib/supabase/admin'
import { calcularReportePlaneacion, type RequerimientoPlaneacion } from '@/lib/reporte-planeacion'

export type { CumplimientoEtapa, EtapaReporte, RequerimientoPlaneacion } from '@/lib/reporte-planeacion'

export async function getReportePlaneacion(): Promise<RequerimientoPlaneacion[]> {
  await exigirAccesoAdmin()
  return calcularReportePlaneacion(createAdminClient())
}
