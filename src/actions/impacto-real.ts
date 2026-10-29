'use server'

import { exigirAccesoAdmin } from '@/lib/supabase/guards'
import { createAdminClient } from '@/lib/supabase/admin'
import { calcularVariacionHH } from '@/lib/utils'
import type { BeneficioCualitativoReal } from '@/lib/supabase/types'

export interface ImpactoRealPayload {
  horas_ahorradas_mes_real: number | null
  ahorro_mensual_cop_real: number | null
  ahorro_anual_cop_real: number | null
  beneficios_cualitativos_real: BeneficioCualitativoReal[]
  total_beneficios_cualitativos_anual_real: number | null
  impacto_economico_total_anual_real: number | null
  /** Obligatoria cuando las HH reales quedan por debajo de las estimadas */
  justificacion_variacion_hh?: string | null
}

export async function guardarImpactoReal(
  id: string,
  datos: ImpactoRealPayload
): Promise<{ ok: boolean; error?: string }> {
  await exigirAccesoAdmin()
  try {
    const supabase = createAdminClient()

    const { data: req, error: errReq } = await (supabase as any)
      .from('requerimientos')
      .select('horas_ahorradas_mes')
      .eq('id', id)
      .single()
    if (errReq) return { ok: false, error: errReq.message }

    const variacion     = calcularVariacionHH(req?.horas_ahorradas_mes, datos.horas_ahorradas_mes_real)
    const esNegativa    = variacion !== null && variacion < 0
    const justificacion = datos.justificacion_variacion_hh?.trim() || null
    if (esNegativa && !justificacion) {
      return { ok: false, error: 'Las HH reales son inferiores a las estimadas: debes justificar la variación' }
    }

    const { error } = await (supabase as any)
      .from('requerimientos')
      .update({
        horas_ahorradas_mes_real:            datos.horas_ahorradas_mes_real,
        ahorro_mensual_cop_real:             datos.ahorro_mensual_cop_real,
        ahorro_anual_cop_real:               datos.ahorro_anual_cop_real,
        beneficios_cualitativos_real:        datos.beneficios_cualitativos_real,
        total_beneficios_cualitativos_anual_real: datos.total_beneficios_cualitativos_anual_real,
        impacto_economico_total_anual_real:  datos.impacto_economico_total_anual_real,
        justificacion_variacion_hh:          esNegativa ? justificacion : null,
      })
      .eq('id', id)
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e.message }
  }
}
