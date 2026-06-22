'use server'

import { createAdminClient } from '@/lib/supabase/admin'

export interface SesionLog {
  id: string
  user_id: string | null
  email: string
  nombre: string | null
  metodo: 'email' | 'google'
  ip: string | null
  user_agent: string | null
  created_at: string
}

export interface EstadisticasSesiones {
  totalHoy: number
  totalSemana: number
  totalMes: number
  usuariosActivosHoy: number
  usuariosActivosSemana: number
}

export async function registrarSesion(payload: {
  user_id: string
  email: string
  nombre?: string | null
  metodo: 'email' | 'google'
  ip?: string | null
  user_agent?: string | null
}) {
  try {
    const supabase = createAdminClient()
    await (supabase as any).from('sesiones_log').insert(payload)
  } catch {
    // Silent — no interrumpir el flujo de login
  }
}

export async function getSesionesLog(limite = 200): Promise<SesionLog[]> {
  try {
    const supabase = createAdminClient()
    const { data } = await (supabase as any)
      .from('sesiones_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limite)
    return (data ?? []) as SesionLog[]
  } catch {
    return []
  }
}

export async function getEstadisticasSesiones(): Promise<EstadisticasSesiones> {
  try {
    const supabase = createAdminClient()
    const ahora = new Date()
    const inicioDia    = new Date(ahora); inicioDia.setHours(0, 0, 0, 0)
    const inicioSemana = new Date(ahora); inicioSemana.setDate(ahora.getDate() - 7)
    const inicioMes    = new Date(ahora); inicioMes.setDate(ahora.getDate() - 30)

    const [hoy, semana, mes] = await Promise.all([
      (supabase as any).from('sesiones_log').select('user_id', { count: 'exact' }).gte('created_at', inicioDia.toISOString()),
      (supabase as any).from('sesiones_log').select('user_id', { count: 'exact' }).gte('created_at', inicioSemana.toISOString()),
      (supabase as any).from('sesiones_log').select('user_id', { count: 'exact' }).gte('created_at', inicioMes.toISOString()),
    ])

    const uniqueHoy    = new Set((hoy.data    ?? []).map((r: any) => r.user_id)).size
    const uniqueSemana = new Set((semana.data ?? []).map((r: any) => r.user_id)).size

    return {
      totalHoy:              hoy.count    ?? 0,
      totalSemana:           semana.count ?? 0,
      totalMes:              mes.count    ?? 0,
      usuariosActivosHoy:    uniqueHoy,
      usuariosActivosSemana: uniqueSemana,
    }
  } catch {
    return { totalHoy: 0, totalSemana: 0, totalMes: 0, usuariosActivosHoy: 0, usuariosActivosSemana: 0 }
  }
}
