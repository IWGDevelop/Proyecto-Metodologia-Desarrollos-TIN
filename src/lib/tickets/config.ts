import type { SupabaseClient } from '@supabase/supabase-js'
import { CONFIG_CLAVES } from './constantes'
import type { HorarioLaboral, ServiciosIGSI } from './types'

// Parámetros generales del módulo (tabla ticket_config, clave/valor).
// Solo servidor. Si una clave no existe se usa el valor por defecto, así el
// módulo funciona aunque la semilla no se haya cargado completa.

export interface ConfigTickets {
  horarioLaboral: HorarioLaboral
  diasCierreAutomatico: number
  emailsCoordinador: string[]
  emailsDireccion: string[]
  horaResumenDiario: string
  serviciosIGSI: ServiciosIGSI
  sedes: string[]
  umbralCapacitacion: number
}

export const CONFIG_TICKETS_DEFECTO: ConfigTickets = {
  horarioLaboral: { dias: [1, 2, 3, 4, 5], inicio: '08:00', fin: '17:00', almuerzo_inicio: '12:00', almuerzo_fin: '13:00' },
  diasCierreAutomatico: 3,
  emailsCoordinador: [],
  emailsDireccion: [],
  horaResumenDiario: '08:00',
  serviciosIGSI: {},
  sedes: [],
  umbralCapacitacion: 3,
}

export async function obtenerConfigTickets(supabase: SupabaseClient): Promise<ConfigTickets> {
  const { data } = await supabase.from('ticket_config').select('clave, valor')
  const v = new Map<string, unknown>((data ?? []).map((r: { clave: string; valor: unknown }) => [r.clave, r.valor]))
  const d = CONFIG_TICKETS_DEFECTO
  return {
    horarioLaboral: (v.get(CONFIG_CLAVES.HORARIO_LABORAL) as HorarioLaboral | undefined) ?? d.horarioLaboral,
    diasCierreAutomatico: Number(v.get(CONFIG_CLAVES.DIAS_CIERRE_AUTOMATICO) ?? d.diasCierreAutomatico),
    emailsCoordinador: (v.get(CONFIG_CLAVES.EMAILS_COORDINADOR) as string[] | undefined) ?? d.emailsCoordinador,
    emailsDireccion: (v.get(CONFIG_CLAVES.EMAILS_DIRECCION) as string[] | undefined) ?? d.emailsDireccion,
    horaResumenDiario: (v.get(CONFIG_CLAVES.HORA_RESUMEN_DIARIO) as string | undefined) ?? d.horaResumenDiario,
    serviciosIGSI: (v.get(CONFIG_CLAVES.IGSI_SERVICIOS) as ServiciosIGSI | undefined) ?? d.serviciosIGSI,
    sedes: (v.get(CONFIG_CLAVES.SEDES) as string[] | undefined) ?? d.sedes,
    umbralCapacitacion: Number(v.get(CONFIG_CLAVES.UMBRAL_CAPACITACION) ?? d.umbralCapacitacion),
  }
}
