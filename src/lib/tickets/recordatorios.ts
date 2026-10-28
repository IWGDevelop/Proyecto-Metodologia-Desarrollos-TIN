import type { SupabaseClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/email'
import { obtenerConfigTickets, type ConfigTickets } from './config'
import { ESTADOS_ABIERTOS, ESTADOS_ESPERA, LABEL_ESTADO_TICKET, LABEL_PRIORIDAD_TICKET, codigoTicket } from './constantes'
import { aplicarCambioEstado } from './flujo'
import { registrarEvento } from './historial'
import { cargarCalendarioLaboral, diasHabilesEntre, diferenciaDiasHabiles, esDiaHabil, fechaLocal, horaLocal, type CalendarioLaboral } from './horas-habiles'
import { crearNotificacion } from './notificar'
import { nivelRecordatorio } from './semaforo'
import { cargarObjetivos, elegirObjetivo, leerTodo, recalcularTiemposTickets, type ObjetivoTiempo, type ResultadoTiempos } from './tiempos'
import {
  asuntoTicket, templateRecordatorioTicket, templateResumenDiarioTickets,
  type TicketResumenDiario, type TonoAviso,
} from './emails-recordatorios'
import type { DestinatarioRecordatorio, EstadoTicket, PrioridadTicket, SeMideContra, TicketReglaRecordatorio } from './types'

// Motor de recordatorios y escalamientos (lo ejecuta el cron cada hora).
// En cada corrida:
//  1. Recalcula los tiempos de los tickets abiertos y resueltos (ticket_tiempos).
//  2. Evalúa las reglas activas de ticket_reglas_recordatorio sobre cada ticket.
//     No repite: ticket_recordatorios.clave_unica = ticket + regla + ciclo, donde el
//     ciclo es el número de entrada al estado de espera, el número de reaperturas
//     (solución) o la fecha requerida. Si una regla de umbral mayor ya se alcanzó, las
//     menores del mismo disparador no se envían (evita ráfagas tras una caída del cron).
//  3. Aplica la acción de la regla (marcar respuesta vencida / vencido / cierre automático).
//  4. Cierra automáticamente los Resueltos sin confirmación tras `diasCierreAutomatico`.
//  5. Envía el resumen diario (una vez por día hábil, desde `horaResumenDiario`).

export interface ResultadoCron {
  tickets: number
  recordatorios: number
  cierres: number
  resumenes: number
  errores: string[]
}

interface Persona {
  id: string
  nombre_completo: string | null
  email: string | null
  jefe_id?: string | null
  activo?: boolean | null
}

interface TicketCron {
  id: string
  numero: number
  asunto: string
  estado: EstadoTicket
  prioridad: PrioridadTicket
  fecha_creacion: string
  fecha_requerida: string | null
  respuesta_vencida: boolean
  solucion_vencida: boolean
  solicitante_id: string
  responsable_id: string | null
  aprobador_id: string | null
  tipologia: { nombre: string; se_mide_contra: SeMideContra } | null
}

type Audiencia = 'tin' | 'usuario' | 'aprobador'

interface Destinos {
  /** Usuarios de TIN-FLOW (canal APP) */
  ids: Set<string>
  /** Correos por audiencia (cada una recibe el enlace que le corresponde) */
  emails: Record<Audiencia, Set<string>>
}

const AUDIENCIA_ROL: Record<DestinatarioRecordatorio, Audiencia> = {
  RESPONSABLE: 'tin',
  COORDINADOR: 'tin',
  DIRECCION: 'tin',
  SOLICITANTE: 'usuario',
  JEFE_SOLICITANTE: 'usuario',
  APROBADOR: 'aprobador',
}

function getAppUrl(): string {
  if (process.env.APP_URL) return process.env.APP_URL
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return ''
}

const h1 = (n: number) => `${(Math.round(n * 10) / 10).toLocaleString('es-CO')} h`
const fechaLarga = (d: Date) =>
  d.toLocaleDateString('es-CO', { timeZone: 'America/Bogota', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
const fechaHora = (d: Date) =>
  d.toLocaleString('es-CO', { timeZone: 'America/Bogota', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const fechaCorta = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString('es-CO', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' })
}

export async function ejecutarRecordatoriosTickets(
  supabase: SupabaseClient,
  opciones: { ahora?: Date; appUrl?: string } = {},
): Promise<ResultadoCron> {
  const ahora = opciones.ahora ?? new Date()
  const appUrl = opciones.appUrl ?? getAppUrl()
  const res: ResultadoCron = { tickets: 0, recordatorios: 0, cierres: 0, resumenes: 0, errores: [] }

  const [cfg, cal, objetivos, { data: reglasData }] = await Promise.all([
    obtenerConfigTickets(supabase),
    cargarCalendarioLaboral(supabase),
    cargarObjetivos(supabase),
    supabase.from('ticket_reglas_recordatorio').select('*').eq('activa', true).order('orden', { ascending: true }),
  ])
  const reglas = ((reglasData ?? []) as TicketReglaRecordatorio[]).map(r => ({
    ...r,
    porcentaje: r.porcentaje == null ? null : Number(r.porcentaje),
    dias_habiles: r.dias_habiles == null ? null : Number(r.dias_habiles),
    destinatarios: r.destinatarios ?? [],
  }))

  // ── Tickets abiertos y resueltos ───────────────────────────────────────────
  const tickets = await leerTodo<TicketCron>((d, h) =>
    supabase
      .from('tickets')
      .select('id, numero, asunto, estado, prioridad, fecha_creacion, fecha_requerida, respuesta_vencida, solucion_vencida, solicitante_id, responsable_id, aprobador_id, tipologia:ticket_tipologias(nombre, se_mide_contra)')
      .in('estado', [...ESTADOS_ABIERTOS, 'RESUELTO'])
      .order('numero', { ascending: true })
      .range(d, h),
  )
  res.tickets = tickets.length

  let tiempos = new Map<string, ResultadoTiempos>()
  try {
    tiempos = await recalcularTiemposTickets(supabase, tickets.map(t => t.id), { cal, objetivos, ahora })
  } catch (e) {
    res.errores.push(`tiempos: ${(e as Error).message}`)
  }

  // ── Personas ───────────────────────────────────────────────────────────────
  const personas = await cargarPersonas(supabase, tickets, cfg)

  // ── Claves ya enviadas ─────────────────────────────────────────────────────
  const enviadas = new Set<string>()
  const ids = tickets.map(t => t.id)
  for (let i = 0; i < ids.length; i += 100) {
    const lote = ids.slice(i, i + 100)
    try {
      const filas = await leerTodo<{ clave_unica: string }>((d, h) =>
        supabase.from('ticket_recordatorios').select('clave_unica').in('ticket_id', lote).range(d, h),
      )
      filas.forEach(f => enviadas.add(f.clave_unica))
    } catch (e) {
      res.errores.push(`claves: ${(e as Error).message}`)
    }
  }

  const ctx: Ctx = { supabase, cfg, cal, reglas, personas, enviadas, appUrl, ahora, res }

  // ── Reglas por ticket ──────────────────────────────────────────────────────
  for (const t of tickets) {
    const r = tiempos.get(t.id)
    if (!r) continue
    try {
      const cerrado = await evaluarTicket(ctx, t, r, elegirObjetivo(objetivos, t.prioridad, t.fecha_creacion))
      if (cerrado) continue

      // Cierre automático de Resueltos sin confirmación
      if (r.detalle.estadoActual === 'RESUELTO' && r.detalle.ultimoResuelto && cfg.diasCierreAutomatico > 0) {
        const dias = diasHabilesEntre(r.detalle.ultimoResuelto, ahora, cal)
        if (dias >= cfg.diasCierreAutomatico) {
          await aplicarCambioEstado(supabase, {
            ticketId: t.id,
            nuevoEstado: 'CERRADO',
            usuarioId: null,
            cierreAutomatico: true,
            visibleUsuario: true,
            comentario: `Cierre automático: ${cfg.diasCierreAutomatico} días hábiles en Resuelto sin confirmación del usuario.`,
            metadata: { origen: 'cron', motivo: 'RESUELTO_SIN_CONFIRMACION' },
          })
          res.cierres++
        }
      }
    } catch (e) {
      res.errores.push(`${codigoTicket(t.numero)}: ${(e as Error).message}`)
    }
  }

  // ── Resumen diario ─────────────────────────────────────────────────────────
  for (const regla of reglas.filter(x => x.disparador === 'RESUMEN_DIARIO')) {
    try {
      res.resumenes += await enviarResumenDiario(ctx, regla, tickets, tiempos, objetivos)
    } catch (e) {
      res.errores.push(`resumen ${regla.codigo}: ${(e as Error).message}`)
    }
  }

  return res
}

// ─────────────────────────────────────────────────────────────────────────────

type Regla = TicketReglaRecordatorio

interface Ctx {
  supabase: SupabaseClient
  cfg: ConfigTickets
  cal: CalendarioLaboral
  reglas: Regla[]
  personas: Map<string, Persona>
  enviadas: Set<string>
  appUrl: string
  ahora: Date
  res: ResultadoCron
}

async function cargarPersonas(supabase: SupabaseClient, tickets: TicketCron[], cfg: ConfigTickets): Promise<Map<string, Persona>> {
  const mapa = new Map<string, Persona>()
  const leer = async (campo: 'id' | 'email', valores: string[]) => {
    const vals = [...new Set(valores.filter(Boolean))]
    for (let i = 0; i < vals.length; i += 200) {
      const lote = vals.slice(i, i + 200)
      const sel = (cols: string) => supabase.from('perfiles').select(cols).in(campo, lote)
      let r = await sel('id, nombre_completo, email, jefe_id, activo')
      // Si la columna jefe_id aún no existe, se lee sin ella
      if (r.error) r = await sel('id, nombre_completo, email, activo')
      for (const p of (r.data ?? []) as unknown as Persona[]) mapa.set(p.id, p)
    }
  }
  await leer('id', tickets.flatMap(t => [t.solicitante_id, t.responsable_id ?? '', t.aprobador_id ?? '']))
  await leer('id', [...mapa.values()].map(p => p.jefe_id ?? '').filter(id => id && !mapa.has(id)))
  await leer('email', [...cfg.emailsCoordinador, ...cfg.emailsDireccion])
  return mapa
}

function resolverDestinos(ctx: Ctx, roles: DestinatarioRecordatorio[], t: TicketCron | null): Destinos {
  const d: Destinos = { ids: new Set(), emails: { tin: new Set(), usuario: new Set(), aprobador: new Set() } }
  const agregarPersona = (id: string | null | undefined, aud: Audiencia) => {
    if (!id) return
    const p = ctx.personas.get(id)
    if (p && p.activo === false) return
    d.ids.add(id)
    if (p?.email) d.emails[aud].add(p.email.toLowerCase())
  }
  const agregarCorreos = (correos: string[], aud: Audiencia) => {
    for (const c of correos) {
      const email = c.trim().toLowerCase()
      if (!email) continue
      d.emails[aud].add(email)
      const p = [...ctx.personas.values()].find(x => x.email?.toLowerCase() === email)
      if (p) d.ids.add(p.id)
    }
  }
  for (const rol of roles) {
    const aud = AUDIENCIA_ROL[rol]
    if (rol === 'RESPONSABLE') agregarPersona(t?.responsable_id, aud)
    else if (rol === 'COORDINADOR') agregarCorreos(ctx.cfg.emailsCoordinador, aud)
    else if (rol === 'DIRECCION') agregarCorreos(ctx.cfg.emailsDireccion, aud)
    else if (rol === 'SOLICITANTE') agregarPersona(t?.solicitante_id, aud)
    else if (rol === 'JEFE_SOLICITANTE') agregarPersona(t ? ctx.personas.get(t.solicitante_id)?.jefe_id : null, aud)
    else if (rol === 'APROBADOR') agregarPersona(t?.aprobador_id, aud)
  }
  // Un mismo correo recibe solo una versión (prioridad: TIN > aprobador > usuario)
  for (const e of d.emails.tin) { d.emails.usuario.delete(e); d.emails.aprobador.delete(e) }
  for (const e of d.emails.aprobador) d.emails.usuario.delete(e)
  return d
}

const usaCorreo = (r: Regla) => r.canal === 'CORREO' || r.canal === 'AMBOS'
const usaApp = (r: Regla) => r.canal === 'APP' || r.canal === 'AMBOS'

/** Nivel 1..n de la regla entre las de su disparador */
function nivelDe(reglas: Regla[], regla: Regla): number {
  const mismas = reglas
    .filter(r => r.disparador === regla.disparador)
    .sort((a, b) => Number(a.porcentaje ?? a.dias_habiles ?? 0) - Number(b.porcentaje ?? b.dias_habiles ?? 0))
  return Math.max(1, mismas.findIndex(r => r.id === regla.id) + 1)
}

/** Reserva la clave (insert con clave_unica). false si ya existía. */
async function reservar(ctx: Ctx, clave: string, ticketId: string | null, regla: Regla, destinatarios: string[]): Promise<boolean> {
  if (ctx.enviadas.has(clave)) return false
  const { error } = await ctx.supabase.from('ticket_recordatorios').insert({
    ticket_id: ticketId,
    regla_id: regla.id,
    nivel: nivelDe(ctx.reglas, regla),
    destinatarios,
    clave_unica: clave,
    fecha_envio: ctx.ahora.toISOString(),
  })
  if (error) {
    if ((error as { code?: string }).code === '23505') {
      ctx.enviadas.add(clave)
      return false
    }
    throw new Error(`No se pudo registrar el recordatorio: ${error.message}`)
  }
  ctx.enviadas.add(clave)
  return true
}

interface Disparo {
  regla: Regla
  ciclo: string
  /** Contenido del aviso */
  titulo: string
  intro: string
  tono: TonoAviso
  filas: [string, string][]
  aviso?: string | null
  mensajeApp: string
}

/**
 * Evalúa las reglas de un ticket. Devuelve true si el ticket quedó cerrado por una
 * acción de cierre automático.
 */
async function evaluarTicket(ctx: Ctx, t: TicketCron, r: ResultadoTiempos, objetivo: ObjetivoTiempo | null): Promise<boolean> {
  const { cal, ahora } = ctx
  const estado = r.detalle.estadoActual
  const abierto = ESTADOS_ABIERTOS.includes(estado)
  const enEspera = ESTADOS_ESPERA.includes(estado)
  const codigo = codigoTicket(t.numero)
  const solicitante = ctx.personas.get(t.solicitante_id)?.nombre_completo ?? '—'
  const responsable = t.responsable_id ? ctx.personas.get(t.responsable_id)?.nombre_completo ?? '—' : 'Sin asignar'
  const base: [string, string][] = [
    ['Solicitante', solicitante],
    ['Responsable', responsable],
    ['Prioridad', LABEL_PRIORIDAD_TICKET[t.prioridad] ?? t.prioridad],
    ['Estado', LABEL_ESTADO_TICKET[estado] ?? estado],
  ]
  const disparos: Disparo[] = []

  /** Recorre las reglas de mayor a menor urgencia: dispara la primera alcanzada no enviada; si ya se envió, no baja */
  const escoger = (lista: Regla[], alcanzada: (r: Regla) => boolean, ciclo: string, contenido: (r: Regla) => Omit<Disparo, 'regla' | 'ciclo'>) => {
    for (const regla of lista) {
      if (!alcanzada(regla)) continue
      if (!ctx.enviadas.has(`${t.id}:${regla.id}:${ciclo}`)) disparos.push({ regla, ciclo, ...contenido(regla) })
      return
    }
  }
  const porDisparador = (d: Regla['disparador'], campo: 'porcentaje' | 'dias_habiles', desc: boolean) =>
    ctx.reglas
      .filter(x => x.disparador === d && x[campo] != null)
      .sort((a, b) => (desc ? -1 : 1) * (Number(a[campo]) - Number(b[campo])))

  // RESPUESTA: % del tiempo de primera respuesta sin responder
  if (objetivo && !r.detalle.respondido && abierto && !enEspera) {
    const pct = (r.detalle.horasRespuestaConsumidas / objetivo.horas_respuesta) * 100
    escoger(porDisparador('RESPUESTA', 'porcentaje', true), x => pct >= Number(x.porcentaje), '0', x => ({
      titulo: pct >= 100 ? 'Respuesta vencida' : 'Ticket sin primera respuesta',
      intro: `Se ha consumido el ${Math.round(pct)}% del tiempo de primera respuesta (${h1(r.detalle.horasRespuestaConsumidas)} de ${h1(objetivo.horas_respuesta)} hábiles).`,
      tono: pct >= 100 ? 'vencido' : 'alerta',
      filas: [...base, ['Tiempo que queda', h1(Math.max(0, objetivo.horas_respuesta - r.detalle.horasRespuestaConsumidas))]],
      aviso: x.accion === 'MARCAR_RESPUESTA_VENCIDA' ? 'El ticket queda marcado como respuesta vencida.' : null,
      mensajeApp: `${codigo}: ${Math.round(pct)}% del tiempo de primera respuesta sin responder (${t.asunto}).`,
    }))
  }

  // SOLUCION: % del tiempo de solución consumido
  if (objetivo && abierto && r.t_consumido != null) {
    const pct = (r.t_consumido / objetivo.horas_solucion) * 100
    escoger(porDisparador('SOLUCION', 'porcentaje', true), x => pct >= Number(x.porcentaje), String(r.reaperturas), x => ({
      titulo: pct >= 100 ? 'Ticket vencido' : 'Tiempo de solución por vencer',
      intro: `Se ha consumido el ${Math.round(pct)}% del tiempo de solución (${h1(r.t_consumido ?? 0)} de ${h1(objetivo.horas_solucion)} hábiles, sin contar esperas).`,
      tono: pct >= 100 ? 'vencido' : 'alerta',
      filas: [...base, ['Último movimiento', `${LABEL_ESTADO_TICKET[estado]} desde el ${fechaHora(r.detalle.entradaEstadoActual)}`]],
      aviso: x.accion === 'MARCAR_VENCIDO' ? 'El ticket queda marcado como vencido y entra al reporte de vencidos.' : null,
      mensajeApp: `${codigo}: ${Math.round(pct)}% del tiempo de solución consumido (${t.asunto}).`,
    }))
  }

  // ESPERA_USUARIO / ESPERA_APROBACION: días hábiles en el estado
  for (const d of ['ESPERA_USUARIO', 'ESPERA_APROBACION'] as const) {
    if (estado !== d) continue
    const dias = diasHabilesEntre(r.detalle.entradaEstadoActual, ahora, cal)
    const ciclo = String(r.detalle.entradas[d] ?? 1)
    const lista = porDisparador(d, 'dias_habiles', true)
    const cierre = lista.find(x => x.accion === 'CIERRE_AUTOMATICO')
    let pendiente: string | null = null
    if (d === 'ESPERA_USUARIO' && lista.some(x => dias >= Number(x.dias_habiles))) {
      pendiente = await pendienteDelUsuario(ctx.supabase, t.id)
    }
    escoger(lista, x => dias >= Number(x.dias_habiles), ciclo, x => {
      const diasTxt = `${Math.floor(dias)} ${Math.floor(dias) === 1 ? 'día hábil' : 'días hábiles'}`
      const cierraAhora = x.accion === 'CIERRE_AUTOMATICO'
      const avisoCierre = cierraAhora
        ? 'El ticket se cerró automáticamente por falta de respuesta. Si aún lo necesitas, puedes reabrirlo desde TIN-FLOW.'
        : cierre ? `Si no hay respuesta, el ticket se cerrará automáticamente al completar ${cierre.dias_habiles} días hábiles en espera.` : null
      return d === 'ESPERA_USUARIO'
        ? {
            titulo: cierraAhora ? 'Ticket cerrado por falta de respuesta' : 'Tu ticket espera tu respuesta',
            intro: `El ticket lleva ${diasTxt} en espera de información del solicitante.`,
            tono: cierraAhora ? 'vencido' : 'alerta',
            filas: [...base, ['En espera desde', fechaHora(r.detalle.entradaEstadoActual)], ...(pendiente ? [['Qué se necesita', pendiente] as [string, string]] : [])],
            aviso: avisoCierre,
            mensajeApp: `${codigo}: ${cierraAhora ? 'cerrado por falta de respuesta' : `lleva ${diasTxt} esperando respuesta del solicitante`} (${t.asunto}).`,
          }
        : {
            titulo: 'Solicitud pendiente de aprobación',
            intro: `El ticket lleva ${diasTxt} esperando aprobación. Revísalo para aprobarlo o rechazarlo.`,
            tono: 'alerta',
            filas: [...base, ['Tipología', t.tipologia?.nombre ?? '—'], ['En espera desde', fechaHora(r.detalle.entradaEstadoActual)]],
            aviso: cierraAhora ? 'El ticket se cerró automáticamente por falta de aprobación.' : null,
            mensajeApp: `${codigo}: pendiente de aprobación hace ${diasTxt} (${t.asunto}).`,
          }
    })
  }

  // FECHA_REQUERIDA: días hábiles antes de la fecha
  if (t.fecha_requerida && abierto) {
    const faltan = diferenciaDiasHabiles(fechaLocal(ahora), t.fecha_requerida, cal)
    if (faltan >= 0) {
      escoger(porDisparador('FECHA_REQUERIDA', 'dias_habiles', false), x => faltan <= Number(x.dias_habiles), t.fecha_requerida.slice(0, 10), () => ({
        titulo: 'Fecha requerida próxima',
        intro: faltan === 0
          ? `La fecha requerida del ticket es hoy, ${fechaCorta(t.fecha_requerida!)}.`
          : `La fecha requerida del ticket es el ${fechaCorta(t.fecha_requerida!)} (en ${faltan} ${faltan === 1 ? 'día hábil' : 'días hábiles'}).`,
        tono: faltan === 0 ? 'vencido' : 'alerta',
        filas: [...base, ['Tipología', t.tipologia?.nombre ?? '—'], ['Fecha requerida', fechaCorta(t.fecha_requerida!)]],
        mensajeApp: `${codigo}: la fecha requerida es ${faltan === 0 ? 'hoy' : `en ${faltan} ${faltan === 1 ? 'día hábil' : 'días hábiles'}`} (${t.asunto}).`,
      }))
    }
  }

  let cerrado = false
  for (const dsp of disparos) {
    if (cerrado) break
    cerrado = await ejecutarDisparo(ctx, t, dsp, codigo)
  }
  return cerrado
}

/** Último comentario visible para el usuario: suele decir qué información falta */
async function pendienteDelUsuario(supabase: SupabaseClient, ticketId: string): Promise<string | null> {
  const { data } = await supabase
    .from('ticket_historial')
    .select('comentario')
    .eq('ticket_id', ticketId)
    .eq('visible_usuario', true)
    .not('comentario', 'is', null)
    .neq('tipo_evento', 'RECORDATORIO')
    .order('fecha', { ascending: false })
    .limit(1)
  const c = (data?.[0] as { comentario?: string } | undefined)?.comentario?.trim()
  return c ? c.slice(0, 500) : null
}

async function ejecutarDisparo(ctx: Ctx, t: TicketCron, dsp: Disparo, codigo: string): Promise<boolean> {
  const { supabase, appUrl } = ctx
  const { regla } = dsp
  const destinos = resolverDestinos(ctx, regla.destinatarios, t)
  const correos = [...destinos.emails.tin, ...destinos.emails.aprobador, ...destinos.emails.usuario]
  const clave = `${t.id}:${regla.id}:${dsp.ciclo}`
  if (!(await reservar(ctx, clave, t.id, regla, correos.length ? correos : [...destinos.ids]))) return false

  // Acción de la regla
  let cerrado = false
  if (regla.accion === 'MARCAR_RESPUESTA_VENCIDA' && !t.respuesta_vencida) {
    await supabase.from('tickets').update({ respuesta_vencida: true, updated_at: ctx.ahora.toISOString() }).eq('id', t.id)
  } else if (regla.accion === 'MARCAR_VENCIDO' && !t.solucion_vencida) {
    await supabase.from('tickets').update({ solucion_vencida: true, updated_at: ctx.ahora.toISOString() }).eq('id', t.id)
  } else if (regla.accion === 'CIERRE_AUTOMATICO' && (regla.disparador === 'ESPERA_USUARIO' || regla.disparador === 'ESPERA_APROBACION')) {
    await aplicarCambioEstado(supabase, {
      ticketId: t.id,
      nuevoEstado: 'CERRADO',
      usuarioId: null,
      cierreAutomatico: true,
      visibleUsuario: true,
      comentario: `Cierre automático: ${regla.dias_habiles} días hábiles en ${LABEL_ESTADO_TICKET[regla.disparador as EstadoTicket].toLowerCase()} sin respuesta.`,
      metadata: { origen: 'cron', regla: regla.codigo },
    })
    cerrado = true
    ctx.res.cierres++
  }

  // El cierre ya le envió al solicitante el correo de cierre (flujo): no se duplica
  if (cerrado) {
    const emailSolicitante = ctx.personas.get(t.solicitante_id)?.email?.toLowerCase()
    if (emailSolicitante) destinos.emails.usuario.delete(emailSolicitante)
  }

  // Envío
  const intro =regla.plantilla && !/^[A-Z0-9_]+$/.test(regla.plantilla.trim()) ? `${regla.plantilla.trim()} ${dsp.intro}` : dsp.intro
  if (usaCorreo(regla)) {
    const enlaces: Record<Audiencia, string | undefined> = {
      tin: appUrl ? `${appUrl}/admin/tickets/${t.id}` : undefined,
      usuario: appUrl ? `${appUrl}/mis-tickets/${t.id}` : undefined,
      aprobador: appUrl ? `${appUrl}/mis-tickets/aprobaciones` : undefined,
    }
    for (const aud of ['tin', 'aprobador', 'usuario'] as Audiencia[]) {
      const to = [...destinos.emails[aud]]
      if (!to.length) continue
      // Al usuario no se le muestran los datos internos de TIN
      const filas = aud === 'tin' ? dsp.filas : dsp.filas.filter(([k]) => k !== 'Tiempo que queda')
      await sendEmail({
        to,
        subject: asuntoTicket(codigo, t.asunto, dsp.titulo),
        html: templateRecordatorioTicket({
          titulo: dsp.titulo, intro, tono: dsp.tono, aviso: dsp.aviso, codigo, asunto: t.asunto, filas,
          enlace: enlaces[aud], textoBoton: aud === 'aprobador' ? 'Aprobar o rechazar' : 'Ver ticket',
        }),
      }).catch(err => console.error(`[cron tickets] correo ${regla.codigo} ${codigo}:`, err))
    }
  }
  if (usaApp(regla)) await crearNotificacion(supabase, [...destinos.ids], t.id, dsp.mensajeApp)

  await registrarEvento(supabase, {
    ticketId: t.id,
    tipo: 'RECORDATORIO',
    usuarioId: null,
    campo: regla.codigo,
    valorNuevo: dsp.titulo,
    comentario: `${regla.nombre}. Enviado a: ${correos.length ? correos.join(', ') : 'avisos en TIN-FLOW'}.`,
    visibleUsuario: regla.destinatarios.includes('SOLICITANTE'),
    metadata: {
      regla_id: regla.id,
      codigo: regla.codigo,
      disparador: regla.disparador,
      nivel: nivelDe(ctx.reglas, regla),
      canal: regla.canal,
      destinatarios: correos,
      usuarios: [...destinos.ids],
      accion: regla.accion,
      ciclo: dsp.ciclo,
    },
  })
  ctx.res.recordatorios++
  return cerrado
}

async function enviarResumenDiario(
  ctx: Ctx,
  regla: Regla,
  tickets: TicketCron[],
  tiempos: Map<string, ResultadoTiempos>,
  objetivos: ObjetivoTiempo[],
): Promise<number> {
  const { cal, cfg, ahora, appUrl } = ctx
  const hoy = fechaLocal(ahora)
  if (!esDiaHabil(hoy, cal)) return 0
  if (horaLocal(ahora) < (cfg.horaResumenDiario || '08:00').slice(0, 5)) return 0

  const abiertos = tickets
    .map(t => ({ t, r: tiempos.get(t.id) }))
    .filter((x): x is { t: TicketCron; r: ResultadoTiempos } => !!x.r && ESTADOS_ABIERTOS.includes(x.r.detalle.estadoActual))
  const umbrales = ctx.reglas.map(x => ({ disparador: x.disparador, porcentaje: x.porcentaje, nombre: x.nombre }))
  const fila = ({ t, r }: { t: TicketCron; r: ResultadoTiempos }): TicketResumenDiario & { orden: number } => {
    const obj = elegirObjetivo(objetivos, t.prioridad, t.fecha_creacion)
    const nivel = nivelRecordatorio(
      { respondido: r.detalle.respondido, horasRespuesta: r.detalle.horasRespuestaConsumidas, horasConsumidas: r.t_consumido ?? 0 },
      obj, umbrales,
    )
    return {
      codigo: codigoTicket(t.numero),
      asunto: t.asunto,
      estado: LABEL_ESTADO_TICKET[r.detalle.estadoActual],
      prioridad: LABEL_PRIORIDAD_TICKET[t.prioridad],
      horas: r.t_consumido,
      porcentaje: nivel ? nivel.u * 100 : null,
      clase: nivel?.clase ?? 'ok',
      responsable: t.responsable_id ? ctx.personas.get(t.responsable_id)?.nombre_completo ?? undefined : 'Sin asignar',
      enlace: appUrl ? `${appUrl}/admin/tickets/${t.id}` : undefined,
      orden: r.t_consumido ?? 0,
    }
  }
  const ordenar = (xs: (TicketResumenDiario & { orden: number })[]) => xs.sort((a, b) => b.orden - a.orden)
  const fechaTxt = fechaLarga(ahora)
  const bandeja = appUrl ? `${appUrl}/admin/tickets` : undefined
  let enviados = 0

  const enviar = async (clave: string, ids: string[], emails: string[], nombre: string, lista: TicketResumenDiario[], conResponsable: boolean) => {
    if (!lista.length || (!ids.length && !emails.length)) return
    if (!(await reservar(ctx, clave, null, regla, emails.length ? emails : ids))) return
    if (usaCorreo(regla) && emails.length) {
      await sendEmail({
        to: emails,
        subject: `TIN-FLOW | Resumen diario de tickets · ${lista.length} abiertos`,
        html: templateResumenDiarioTickets({ nombre, fecha: fechaTxt, tickets: lista, conResponsable, enlaceBandeja: bandeja }),
      }).catch(err => console.error('[cron tickets] resumen diario:', err))
    }
    if (usaApp(regla) && ids.length) {
      const vencidos = lista.filter(x => x.clase === 'vencido').length
      await crearNotificacion(ctx.supabase, ids, null, `Resumen diario: ${lista.length} tickets abiertos${vencidos ? `, ${vencidos} vencidos` : ''}.`)
    }
    enviados++
  }

  // Cada responsable: sus tickets abiertos
  if (regla.destinatarios.includes('RESPONSABLE')) {
    const porResp = new Map<string, { t: TicketCron; r: ResultadoTiempos }[]>()
    for (const x of abiertos) {
      if (!x.t.responsable_id) continue
      const arr = porResp.get(x.t.responsable_id) ?? []
      arr.push(x)
      porResp.set(x.t.responsable_id, arr)
    }
    for (const [respId, lista] of porResp) {
      const p = ctx.personas.get(respId)
      if (!p || p.activo === false) continue
      await enviar(`resumen:${regla.id}:${respId}:${hoy}`, [respId], p.email ? [p.email] : [], p.nombre_completo ?? '', ordenar(lista.map(fila)), false)
    }
  }

  // Coordinador / Dirección: todos los abiertos
  const globales = regla.destinatarios.filter(d => d === 'COORDINADOR' || d === 'DIRECCION')
  if (globales.length) {
    const destinos = resolverDestinos(ctx, globales, null)
    await enviar(`resumen:${regla.id}:global:${hoy}`, [...destinos.ids], [...destinos.emails.tin], 'equipo de TIN', ordenar(abiertos.map(fila)), true)
  }
  return enviados
}
