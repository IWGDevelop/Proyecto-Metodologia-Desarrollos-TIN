'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import type { BeneficioCualitativoReal } from '@/lib/supabase/types'

export interface ImpactoRealPayload {
  horas_ahorradas_mes_real: number | null
  ahorro_mensual_cop_real: number | null
  ahorro_anual_cop_real: number | null
  beneficios_cualitativos_real: BeneficioCualitativoReal[]
  total_beneficios_cualitativos_anual_real: number | null
  impacto_economico_total_anual_real: number | null
}

export async function guardarImpactoReal(
  id: string,
  datos: ImpactoRealPayload
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = createAdminClient()
    const { error } = await (supabase as any)
      .from('requerimientos')
      .update({
        horas_ahorradas_mes_real:            datos.horas_ahorradas_mes_real,
        ahorro_mensual_cop_real:             datos.ahorro_mensual_cop_real,
        ahorro_anual_cop_real:               datos.ahorro_anual_cop_real,
        beneficios_cualitativos_real:        datos.beneficios_cualitativos_real,
        total_beneficios_cualitativos_anual_real: datos.total_beneficios_cualitativos_anual_real,
        impacto_economico_total_anual_real:  datos.impacto_economico_total_anual_real,
      })
      .eq('id', id)
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e.message }
  }
}
