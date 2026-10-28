import type { SupabaseClient } from '@supabase/supabase-js'
import { cargarCalendarioLaboral, diferenciaDiasHabiles, fechaLocal, horasHabilesEntre, horasJornada, type CalendarioLaboral } from './horas-habiles'
import type { EstadoTicket, PrioridadTicket, SeMideContra, TicketHistorial, TicketTiempos } from './types'

// Tiempos de un ticket calculados desde su historial (ticket_historial), en horas
// hábiles. El historial es la fuente de verdad: los cambios de estado definen
// tramos [desde, hasta) en cada estado y sobre ellos se miden todas las medidas.
//
// Reglas (pestaña "Tiempos" de la especificación):
// - Asignación: creación → primera entrada a Asignado (sin contar espera de aprobación).
// - Primera respuesta: creación → primer evento PRIMERA_RESPUESTA (primer comentario
//   visible de TIN), primer paso a En proceso o a Resuelto, sin contar esperas.
// - Solución: creación → último Resuelto (la reapertura mantiene el reloj original),
//   descontando las esperas de aprobación, usuario y proveedor y el tiempo en Cerrado.
// - Esperas: horas en cada estado de espera, por tipo.
// - Confirmación: último Resuelto → Cerrado. Total: creación → Cerrado (con esperas).
// - Cumplimiento: contra el objetivo de la prioridad actual del ticket.
// - Fecha requerida: días hábiles entre el último Resuelto (o hoy, si sigue abierto y
//   ya pasó la fecha) y la fecha requerida; en FECHA_SIN_APROBACION se le suman los
//   días hábiles que estuvo en espera de aprobación.

const ESTADOS_VALIDOS: EstadoTicket[] = [
  'ABIERTO', 'ASIGNADO', 'EN_PROCESO', 'ESPERA_APROBACION', 'ESPERA_USUARIO', 'ESPERA_PROVEEDOR', 'RESUELTO', 'CERRADO',
]
/** Estados en los que el reloj del indicador no corre */
const SIN_RELOJ: EstadoTicket[] = ['ESPERA_APROBACION', 'ESPERA_USUARIO', 'ESPERA_PROVEEDOR', 'CERRADO']
/** Primeras acciones de TIN visibles para el usuario (cuentan como primera respuesta) */
const ESTADOS_RESPUESTA: EstadoTicket[] = ['EN_PROCESO', 'RESUELTO']
const ESPERAS: EstadoTicket[] = ['ESPERA_APROBACION', 'ESPERA_USUARIO', 'ESPERA_PROVEEDOR']

export interface ObjetivoTiempo {
  prioridad: PrioridadTicket
  horas_respuesta: number
  horas_solucion: number
  vigente_desde: string
  aprobado: boolean
}

export interface TicketParaTiempos {
  fecha_creacion: string
  estado: EstadoTicket
  prioridad: PrioridadTicket
  fecha_requerida: string | null
  /** Se toma de la tipología */
  se_mide_contra: SeMideContra
  /** Respaldo si el historial no tiene el hito */
  fecha_primera_respuesta?: string | null
}

export type EventoParaTiempos = Pick<TicketHistorial, 'tipo_evento' | 'valor_anterior' | 'valor_nuevo' | 'fecha'> & { id?: number }

export interface TramoEstado {
  estado: EstadoTicket
  desde: Date
  /** null = estado actual */
  hasta: Date | null
}

export type FilaTiempos = Omit<TicketTiempos, 'ticket_id' | 'calculado_en'>

export interface ResultadoTiempos extends FilaTiempos {
  /** Datos auxiliares para recordatorios y dashboard (no se guardan) */
  detalle: {
    tramos: TramoEstado[]
    estadoActual: EstadoTicket
    entradaEstadoActual: Date
    /** Veces que el ticket entró a cada estado (el inicial cuenta como 1) */
    entradas: Partial<Record<EstadoTicket, number>>
    respondido: boolean
    /** Horas hábiles con reloj corriendo hasta la respuesta o hasta `ahora` si no hay respuesta */
    horasRespuestaConsumidas: number
    ultimoResuelto: Date | null
    fechaCierre: Date | null
  }
}

const red = (n: number) => Math.round(n * 100) / 100

function ordenar(historial: EventoParaTiempos[]): EventoParaTiempos[] {
  return [...historial].sort((a, b) => {
    const d = new Date(a.fecha).getTime() - new Date(b.fecha).getTime()
    return d !== 0 ? d : (a.id ?? 0) - (b.id ?? 0)
  })
}

const esEstado = (v: string | null | undefined): v is EstadoTicket => !!v && (ESTADOS_VALIDOS as string[]).includes(v)

/** Tramos de estado reconstruidos desde los eventos CAMBIO_ESTADO */
export function tramosDeEstado(ticket: Pick<TicketParaTiempos, 'fecha_creacion' | 'estado'>, historial: EventoParaTiempos[]): TramoEstado[] {
  const cambios = ordenar(historial).filter(e => e.tipo_evento === 'CAMBIO_ESTADO' && esEstado(e.valor_nuevo))
  const creacion = new Date(ticket.fecha_creacion)
  const inicial: EstadoTicket = cambios.length
    ? (esEstado(cambios[0].valor_anterior) ? cambios[0].valor_anterior : 'ABIERTO')
    : ticket.estado
  const tramos: TramoEstado[] = [{ estado: inicial, desde: creacion, hasta: null }]
  for (const c of cambios) {
    const f = new Date(c.fecha)
    const actual = tramos[tramos.length - 1]
    const nuevo = c.valor_nuevo as EstadoTicket
    if (nuevo === actual.estado) continue
    const desde = f < actual.desde ? actual.desde : f
    actual.hasta = desde
    tramos.push({ estado: nuevo, desde, hasta: null })
  }
  return tramos
}

/** Horas hábiles en los tramos de `estados` dentro de [desde, hasta] */
function horasEnEstados(tramos: TramoEstado[], estados: EstadoTicket[], desde: Date, hasta: Date, ahora: Date, cal: CalendarioLaboral): number {
  let h = 0
  for (const t of tramos) {
    if (!estados.includes(t.estado)) continue
    const s = t.desde > desde ? t.desde : desde
    const fin = t.hasta ?? ahora
    const e = fin < hasta ? fin : hasta
    if (e > s) h += horasHabilesEntre(s, e, cal)
  }
  return h
}

/** Horas hábiles con el reloj corriendo (sin esperas ni Cerrado) entre dos instantes */
function horasConReloj(tramos: TramoEstado[], desde: Date, hasta: Date, ahora: Date, cal: CalendarioLaboral): number {
  const bruto = horasHabilesEntre(desde, hasta, cal)
  return Math.max(0, bruto - horasEnEstados(tramos, SIN_RELOJ, desde, hasta, ahora, cal))
}

/** Función pura: todas las medidas de tiempo de un ticket */
export function calcularTiempos(
  ticket: TicketParaTiempos,
  historial: EventoParaTiempos[],
  objetivo: Pick<ObjetivoTiempo, 'horas_respuesta' | 'horas_solucion'> | null,
  cal: CalendarioLaboral,
  ahora: Date = new Date(),
): ResultadoTiempos {
  const eventos = ordenar(historial)
  const tramos = tramosDeEstado(ticket, eventos)
  const creacion = new Date(ticket.fecha_creacion)
  const actual = tramos[tramos.length - 1]

  const entradas: Partial<Record<EstadoTicket, number>> = {}
  for (const t of tramos) entradas[t.estado] = (entradas[t.estado] ?? 0) + 1

  const primeraEntrada = (estados: EstadoTicket[]) => tramos.find(t => estados.includes(t.estado))?.desde ?? null
  const esperaAprob: EstadoTicket[] = ['ESPERA_APROBACION']

  // Asignación
  const fAsig = primeraEntrada(['ASIGNADO']) ?? primeraEntrada(['EN_PROCESO', 'ESPERA_USUARIO', 'ESPERA_PROVEEDOR', 'RESUELTO'])
  const t_asignacion = fAsig
    ? Math.max(0, horasHabilesEntre(creacion, fAsig, cal) - horasEnEstados(tramos, esperaAprob, creacion, fAsig, ahora, cal))
    : null

  // Primera respuesta
  const candidatos: Date[] = []
  const evResp = eventos.find(e => e.tipo_evento === 'PRIMERA_RESPUESTA')
  if (evResp) candidatos.push(new Date(evResp.fecha))
  const fEstadoResp = primeraEntrada(ESTADOS_RESPUESTA)
  if (fEstadoResp) candidatos.push(fEstadoResp)
  if (ticket.fecha_primera_respuesta) candidatos.push(new Date(ticket.fecha_primera_respuesta))
  const fResp = candidatos.length ? new Date(Math.min(...candidatos.map(d => d.getTime()))) : null
  const hastaResp = fResp ?? ahora
  const horasRespuestaConsumidas = Math.max(
    0,
    horasHabilesEntre(creacion, hastaResp, cal) - horasEnEstados(tramos, ESPERAS, creacion, hastaResp, ahora, cal),
  )
  const t_primera_respuesta = fResp ? horasRespuestaConsumidas : null

  // Resuelto / cerrado
  const resueltos = tramos.filter(t => t.estado === 'RESUELTO')
  const ultimoResuelto = resueltos.length ? resueltos[resueltos.length - 1].desde : null
  const cerrado = actual.estado === 'CERRADO'
  const fechaCierre = cerrado ? actual.desde : null
  const resuelto = actual.estado === 'RESUELTO' || cerrado

  const t_solucion = resuelto && ultimoResuelto ? horasConReloj(tramos, creacion, ultimoResuelto, ahora, cal) : null

  // Esperas (hasta ahora para la espera en curso)
  const t_espera_aprobacion = horasEnEstados(tramos, ['ESPERA_APROBACION'], creacion, ahora, ahora, cal)
  const t_espera_usuario = horasEnEstados(tramos, ['ESPERA_USUARIO'], creacion, ahora, ahora, cal)
  const t_espera_proveedor = horasEnEstados(tramos, ['ESPERA_PROVEEDOR'], creacion, ahora, ahora, cal)

  const t_confirmacion = cerrado && fechaCierre && ultimoResuelto && ultimoResuelto <= fechaCierre
    ? horasHabilesEntre(ultimoResuelto, fechaCierre, cal)
    : null
  const t_total = cerrado && fechaCierre ? horasHabilesEntre(creacion, fechaCierre, cal) : null

  // Reaperturas: Resuelto o Cerrado → En proceso
  let reaperturas = 0
  for (let i = 1; i < tramos.length; i++) {
    const prev = tramos[i - 1].estado
    if ((prev === 'RESUELTO' || prev === 'CERRADO') && tramos[i].estado !== 'CERRADO') reaperturas++
  }

  const t_consumido = resuelto ? t_solucion : horasConReloj(tramos, creacion, ahora, ahora, cal)

  const cumple_respuesta = objetivo && t_primera_respuesta !== null ? t_primera_respuesta <= Number(objetivo.horas_respuesta) : null
  const cumple_solucion = objetivo && t_solucion !== null ? t_solucion <= Number(objetivo.horas_solucion) : null

  // Cumplimiento de fecha
  let dias_vs_fecha_requerida: number | null = null
  if (ticket.fecha_requerida && ticket.se_mide_contra !== 'SLA') {
    const req = ticket.fecha_requerida.slice(0, 10)
    const ref = resuelto && ultimoResuelto ? fechaLocal(ultimoResuelto) : fechaLocal(ahora)
    let dias = diferenciaDiasHabiles(ref, req, cal)
    if (ticket.se_mide_contra === 'FECHA_SIN_APROBACION' && t_espera_aprobacion > 0) {
      dias += Math.round(t_espera_aprobacion / horasJornada(cal))
    }
    // Abierto: solo se informa cuando ya pasó la fecha (negativo); antes no hay medida
    dias_vs_fecha_requerida = resuelto || dias < 0 ? dias : null
  }

  return {
    t_asignacion: t_asignacion === null ? null : red(t_asignacion),
    t_primera_respuesta: t_primera_respuesta === null ? null : red(t_primera_respuesta),
    t_solucion: t_solucion === null ? null : red(t_solucion),
    t_espera_aprobacion: red(t_espera_aprobacion),
    t_espera_usuario: red(t_espera_usuario),
    t_espera_proveedor: red(t_espera_proveedor),
    t_confirmacion: t_confirmacion === null ? null : red(t_confirmacion),
    t_total: t_total === null ? null : red(t_total),
    t_consumido: t_consumido === null ? null : red(t_consumido),
    reaperturas,
    cumple_respuesta,
    cumple_solucion,
    dias_vs_fecha_requerida,
    detalle: {
      tramos,
      estadoActual: actual.estado,
      entradaEstadoActual: actual.desde,
      entradas,
      respondido: fResp !== null,
      horasRespuestaConsumidas: red(horasRespuestaConsumidas),
      ultimoResuelto,
      fechaCierre,
    },
  }
}

// ── Objetivos de tiempo ──────────────────────────────────────────────────────

export async function cargarObjetivos(supabase: SupabaseClient): Promise<ObjetivoTiempo[]> {
  const { data } = await supabase
    .from('ticket_objetivos_tiempo')
    .select('prioridad, horas_respuesta, horas_solucion, vigente_desde, aprobado')
    .order('vigente_desde', { ascending: true })
  return ((data ?? []) as ObjetivoTiempo[]).map(o => ({
    ...o,
    horas_respuesta: Number(o.horas_respuesta),
    horas_solucion: Number(o.horas_solucion),
  }))
}

/**
 * Objetivo de una prioridad vigente en una fecha: el de mayor `vigente_desde` que no
 * sea posterior a la fecha. Si todos son posteriores (objetivos creados después del
 * ticket), se usa el más antiguo.
 */
export function elegirObjetivo(objetivos: ObjetivoTiempo[], prioridad: PrioridadTicket, enFecha: Date | string = new Date()): ObjetivoTiempo | null {
  const dia = typeof enFecha === 'string' ? enFecha.slice(0, 10) : fechaLocal(enFecha)
  const deLaPrioridad = objetivos
    .filter(o => o.prioridad === prioridad)
    .sort((a, b) => a.vigente_desde.localeCompare(b.vigente_desde))
  if (!deLaPrioridad.length) return null
  const vigentes = deLaPrioridad.filter(o => o.vigente_desde.slice(0, 10) <= dia)
  return vigentes.length ? vigentes[vigentes.length - 1] : deLaPrioridad[0]
}

/** Objetivo vigente de una prioridad (hoy, o en la fecha indicada) */
export async function objetivoVigente(supabase: SupabaseClient, prioridad: PrioridadTicket, enFecha?: Date | string): Promise<ObjetivoTiempo | null> {
  return elegirObjetivo(await cargarObjetivos(supabase), prioridad, enFecha ?? new Date())
}

// ── Recalcular y guardar ─────────────────────────────────────────────────────

/** Lee todas las filas de una consulta paginando de a 1000 (límite de PostgREST) */
export async function leerTodo<T>(consulta: (desde: number, hasta: number) => PromiseLike<{ data: unknown; error: unknown }>): Promise<T[]> {
  const out: T[] = []
  const paso = 1000
  for (let desde = 0; ; desde += paso) {
    const { data, error } = await consulta(desde, desde + paso - 1)
    if (error) throw new Error((error as { message?: string }).message ?? 'Error de consulta')
    const filas = (data ?? []) as T[]
    out.push(...filas)
    if (filas.length < paso) break
  }
  return out
}

/** Eventos que usa el cálculo de tiempos, agrupados por ticket */
export async function cargarHistorialTiempos(supabase: SupabaseClient, ticketIds: string[]): Promise<Map<string, EventoParaTiempos[]>> {
  const mapa = new Map<string, EventoParaTiempos[]>()
  for (let i = 0; i < ticketIds.length; i += 100) {
    const lote = ticketIds.slice(i, i + 100)
    const filas = await leerTodo<EventoParaTiempos & { ticket_id: string }>((d, h) =>
      supabase
        .from('ticket_historial')
        .select('id, ticket_id, tipo_evento, valor_anterior, valor_nuevo, fecha')
        .in('ticket_id', lote)
        .in('tipo_evento', ['CAMBIO_ESTADO', 'PRIMERA_RESPUESTA'])
        .order('id', { ascending: true })
        .range(d, h),
    )
    for (const f of filas) {
      const arr = mapa.get(f.ticket_id) ?? []
      arr.push(f)
      mapa.set(f.ticket_id, arr)
    }
  }
  return mapa
}

export interface ContextoTiempos {
  cal?: CalendarioLaboral
  objetivos?: ObjetivoTiempo[]
  ahora?: Date
}

interface FilaTicketTiempos {
  id: string
  fecha_creacion: string
  estado: EstadoTicket
  prioridad: PrioridadTicket
  fecha_requerida: string | null
  fecha_primera_respuesta: string | null
  tipologia: { se_mide_contra: SeMideContra } | null
}

/** Recalcula y guarda (upsert en ticket_tiempos) los tiempos de varios tickets */
export async function recalcularTiemposTickets(
  supabase: SupabaseClient,
  ticketIds: string[],
  ctx: ContextoTiempos = {},
): Promise<Map<string, ResultadoTiempos>> {
  const resultado = new Map<string, ResultadoTiempos>()
  const ids = [...new Set(ticketIds.filter(Boolean))]
  if (!ids.length) return resultado

  const [cal, objetivos] = await Promise.all([
    ctx.cal ?? cargarCalendarioLaboral(supabase),
    ctx.objetivos ?? cargarObjetivos(supabase),
  ])
  const ahora = ctx.ahora ?? new Date()

  const tickets: FilaTicketTiempos[] = []
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await supabase
      .from('tickets')
      .select('id, fecha_creacion, estado, prioridad, fecha_requerida, fecha_primera_respuesta, tipologia:ticket_tipologias(se_mide_contra)')
      .in('id', ids.slice(i, i + 200))
    if (error) throw new Error(`No se pudieron leer los tickets: ${error.message}`)
    tickets.push(...((data ?? []) as unknown as FilaTicketTiempos[]))
  }
  const historial = await cargarHistorialTiempos(supabase, ids)

  const filas: (FilaTiempos & { ticket_id: string; calculado_en: string })[] = []
  for (const t of tickets) {
    const objetivo = elegirObjetivo(objetivos, t.prioridad, t.fecha_creacion)
    const r = calcularTiempos(
      {
        fecha_creacion: t.fecha_creacion,
        estado: t.estado,
        prioridad: t.prioridad,
        fecha_requerida: t.fecha_requerida,
        fecha_primera_respuesta: t.fecha_primera_respuesta,
        se_mide_contra: t.tipologia?.se_mide_contra ?? 'SLA',
      },
      historial.get(t.id) ?? [],
      objetivo,
      cal,
      ahora,
    )
    resultado.set(t.id, r)
    const fila: FilaTiempos = {
      t_asignacion: r.t_asignacion, t_primera_respuesta: r.t_primera_respuesta, t_solucion: r.t_solucion,
      t_espera_aprobacion: r.t_espera_aprobacion, t_espera_usuario: r.t_espera_usuario, t_espera_proveedor: r.t_espera_proveedor,
      t_confirmacion: r.t_confirmacion, t_total: r.t_total, t_consumido: r.t_consumido, reaperturas: r.reaperturas,
      cumple_respuesta: r.cumple_respuesta, cumple_solucion: r.cumple_solucion, dias_vs_fecha_requerida: r.dias_vs_fecha_requerida,
    }
    filas.push({ ticket_id: t.id, ...fila, calculado_en: ahora.toISOString() })
  }

  for (let i = 0; i < filas.length; i += 200) {
    const { error } = await supabase.from('ticket_tiempos').upsert(filas.slice(i, i + 200), { onConflict: 'ticket_id' })
    if (error) throw new Error(`No se pudieron guardar los tiempos: ${error.message}`)
  }
  return resultado
}

/** Recalcula y guarda los tiempos de un ticket (lo llaman el flujo y el cron) */
export async function recalcularTiemposTicket(supabase: SupabaseClient, ticketId: string): Promise<void> {
  await recalcularTiemposTickets(supabase, [ticketId])
}
