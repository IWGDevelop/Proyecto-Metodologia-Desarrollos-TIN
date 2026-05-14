'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import type { Perfil } from '@/lib/supabase/types'

export async function getPerfilesActivos(): Promise<Perfil[]> {
  try {
    const supabase = createAdminClient()
    const { data, error } = await (supabase as any)
      .from('perfiles')
      .select('id, email, nombre_completo, cargo, proceso_interno, empresa, rol, activo')
      .eq('activo', true)
      .order('nombre_completo', { ascending: true })
    if (error) return []
    return data ?? []
  } catch {
    return []
  }
}
