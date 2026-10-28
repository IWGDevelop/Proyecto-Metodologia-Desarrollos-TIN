import type { SupabaseClient } from '@supabase/supabase-js'
import { obtenerConfigTickets } from './config'
import type { HorarioLaboral } from './types'

// Calendario laboral y aritmética de horas hábiles (zona America/Bogota).
//
// Colombia no tiene horario de verano: la hora local es siempre UTC-5. Por eso
// los cálculos convierten a "hora local" desplazando el instante 5 horas y usando
// los métodos UTC de Date, sin depender de la zona horaria del servidor.
//
// Las funciones de cálculo son puras (reciben el calendario ya cargado), así se
// pueden usar en el cron, en las Server Actions y en pruebas.

const OFFSET_MS = 5 * 60 * 60 * 1000 // UTC-5 fijo
const MIN_MS = 60 * 1000
const DIA_MS = 24 * 60 * 60 * 1000
/** Tope de días que se recorren en un cálculo (≈ 10 años), por seguridad */
const MAX_DIAS = 3700

export interface ExcepcionCalendario {
  es_habil: boolean
  /** "HH:MM" o "HH:MM:SS"; null = la del horario general */
  hora_inicio: string | null
  hora_fin: string | null
}

export interface CalendarioLaboral {
  horario: HorarioLaboral
  /** Festivos y jornadas especiales, por fecha local "YYYY-MM-DD" */
  excepciones: Record<string, ExcepcionCalendario>
}

/** Carga el horario de ticket_config y las excepciones de ticket_calendario */
export async function cargarCalendarioLaboral(supabase: SupabaseClient): Promise<CalendarioLaboral> {
  const [cfg, { data }] = await Promise.all([
    obtenerConfigTickets(supabase),
    supabase.from('ticket_calendario').select('fecha, es_habil, hora_inicio, hora_fin'),
  ])
  const excepciones: Record<string, ExcepcionCalendario> = {}
  for (const r of (data ?? []) as { fecha: string; es_habil: boolean; hora_inicio: string | null; hora_fin: string | null }[]) {
    excepciones[String(r.fecha).slice(0, 10)] = { es_habil: r.es_habil, hora_inicio: r.hora_inicio, hora_fin: r.hora_fin }
  }
  return { horario: cfg.horarioLaboral, excepciones }
}

// ── Utilidades de fecha local ────────────────────────────────────────────────

/** "HH:MM[:SS]" → minutos desde la medianoche */
function minutos(hhmm: string | null | undefined): number | null {
  if (!hhmm) return null
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm)
  if (!m) return null
  return Number(m[1]) * 60 + Number(m[2])
}

/** Fecha local (Bogotá) "YYYY-MM-DD" de un instante */
export function fechaLocal(d: Date): string {
  return new Date(d.getTime() - OFFSET_MS).toISOString().slice(0, 10)
}

/** Hora local (Bogotá) "HH:MM" de un instante */
export function horaLocal(d: Date): string {
  return new Date(d.getTime() - OFFSET_MS).toISOString().slice(11, 16)
}

/** Medianoche local de una fecha "YYYY-MM-DD", como instante UTC (ms) */
function inicioDiaMs(fecha: string): number {
  const [y, m, d] = fecha.split('-').map(Number)
  return Date.UTC(y, m - 1, d) + OFFSET_MS
}

function sumarDias(fecha: string, n: number): string {
  return new Date(inicioDiaMs(fecha) - OFFSET_MS + n * DIA_MS).toISOString().slice(0, 10)
}

/** Día de la semana de una fecha local: 0 = domingo … 6 = sábado */
function diaSemana(fecha: string): number {
  const [y, m, d] = fecha.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

/**
 * Tramos laborables de una fecha local, en minutos desde la medianoche,
 * ya sin la pausa de almuerzo. [] si no es día hábil.
 */
function tramosDelDia(fecha: string, cal: CalendarioLaboral): [number, number][] {
  const h = cal.horario
  const exc = cal.excepciones[fecha]
  let ini: number | null
  let fin: number | null
  if (exc) {
    if (!exc.es_habil) return []
    ini = minutos(exc.hora_inicio) ?? minutos(h.inicio)
    fin = minutos(exc.hora_fin) ?? minutos(h.fin)
  } else {
    if (!h.dias.includes(diaSemana(fecha))) return []
    ini = minutos(h.inicio)
    fin = minutos(h.fin)
  }
  if (ini === null || fin === null || fin <= ini) return []

  const aIni = minutos(h.almuerzo_inicio)
  const aFin = minutos(h.almuerzo_fin)
  if (aIni === null || aFin === null || aFin <= aIni || aFin <= ini || aIni >= fin) return [[ini, fin]]
  const tramos: [number, number][] = []
  if (aIni > ini) tramos.push([ini, aIni])
  if (aFin < fin) tramos.push([aFin, fin])
  return tramos
}

/** true si la fecha local "YYYY-MM-DD" tiene horas laborables */
export function esDiaHabil(fecha: string, cal: CalendarioLaboral): boolean {
  return tramosDelDia(fecha, cal).length > 0
}

/** Horas de una jornada normal según el horario general (para convertir horas en días hábiles) */
export function horasJornada(cal: CalendarioLaboral): number {
  const h = cal.horario
  const ini = minutos(h.inicio) ?? 0
  const fin = minutos(h.fin) ?? 0
  let total = Math.max(0, fin - ini)
  const aIni = minutos(h.almuerzo_inicio)
  const aFin = minutos(h.almuerzo_fin)
  if (aIni !== null && aFin !== null && aFin > aIni) {
    total -= Math.max(0, Math.min(fin, aFin) - Math.max(ini, aIni))
  }
  return total > 0 ? total / 60 : 8
}

// ── Cálculos ─────────────────────────────────────────────────────────────────

/** Horas hábiles entre dos instantes. 0 si fin <= inicio. */
export function horasHabilesEntre(inicio: Date, fin: Date, cal: CalendarioLaboral): number {
  const a = inicio.getTime()
  const b = fin.getTime()
  if (!(b > a)) return 0

  let fecha = fechaLocal(inicio)
  const ultima = fechaLocal(fin)
  let totalMs = 0
  for (let i = 0; i <= MAX_DIAS; i++) {
    const base = inicioDiaMs(fecha)
    for (const [ti, tf] of tramosDelDia(fecha, cal)) {
      const s = Math.max(a, base + ti * MIN_MS)
      const e = Math.min(b, base + tf * MIN_MS)
      if (e > s) totalMs += e - s
    }
    if (fecha >= ultima) break
    fecha = sumarDias(fecha, 1)
  }
  return totalMs / 3_600_000
}

/**
 * Días hábiles (con decimales) entre dos instantes: horas hábiles ÷ horas de una
 * jornada normal. Ej.: lunes 9:30 → martes 9:30 = 1 día hábil.
 * Negativo si fin < inicio.
 */
export function diasHabilesEntre(inicio: Date, fin: Date, cal: CalendarioLaboral): number {
  if (fin.getTime() < inicio.getTime()) return -diasHabilesEntre(fin, inicio, cal)
  return horasHabilesEntre(inicio, fin, cal) / horasJornada(cal)
}

/**
 * Diferencia en días hábiles completos entre dos fechas locales "YYYY-MM-DD":
 * cuántos días hábiles hay después de `desde` hasta `hasta` (inclusive).
 * Positivo si `hasta` es posterior, negativo si es anterior, 0 si es el mismo día.
 * Ej.: resuelto el lunes con fecha requerida el miércoles = +2.
 */
export function diferenciaDiasHabiles(desde: string, hasta: string, cal: CalendarioLaboral): number {
  const a = desde.slice(0, 10)
  const b = hasta.slice(0, 10)
  if (a === b) return 0
  if (b < a) return -diferenciaDiasHabiles(b, a, cal)
  let n = 0
  let f = a
  for (let i = 0; i < MAX_DIAS && f < b; i++) {
    f = sumarDias(f, 1)
    if (esDiaHabil(f, cal)) n++
  }
  return n
}

/** Instante que resulta de sumar `horas` hábiles a `desde` */
export function sumarHorasHabiles(desde: Date, horas: number, cal: CalendarioLaboral): Date {
  if (!(horas > 0)) return new Date(desde.getTime())
  let restanteMs = horas * 3_600_000
  const a = desde.getTime()
  let fecha = fechaLocal(desde)
  for (let i = 0; i <= MAX_DIAS; i++) {
    const base = inicioDiaMs(fecha)
    for (const [ti, tf] of tramosDelDia(fecha, cal)) {
      const s = Math.max(a, base + ti * MIN_MS)
      const e = base + tf * MIN_MS
      if (e <= s) continue
      if (e - s >= restanteMs) return new Date(s + restanteMs)
      restanteMs -= e - s
    }
    fecha = sumarDias(fecha, 1)
  }
  return new Date(a + horas * 3_600_000)
}
