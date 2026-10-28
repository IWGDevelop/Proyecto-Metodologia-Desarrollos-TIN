'use server'

import { revalidatePath } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { NO_AUTORIZADO } from '@/lib/supabase/guards'
import {
  contextoTickets,
  idsConRecurso,
  puedeGestionarTicket,
  puedeVerTicketGestion,
  type ContextoTickets,
} from '@/lib/tickets/acceso-gestion'
import { calcularPrioridad, codigoTicket, LABEL_ESTADO_TICKET, RECURSOS_TICKETS, ZONA_HORARIA } from '@/lib/tickets/constantes'
import { registrarEvento, registrarEventos, type EventoTicket } from '@/lib/tickets/historial'
import {
  aplicarCambioEstado,
  despuesDeCrearTicket,
  recalcularTiemposSeguro,
  registrarPrimeraRespuestaSiFalta,
} from '@/lib/tickets/flujo'
import { avisar, enviarAsignacion } from '@/lib/tickets/emails-flujo'
import { crearBug, enlazarTicketABug } from '@/lib/tickets/bugs'
import type {
  ClasificacionBug,
  EstadoTicket,
  ImpactoTicket,
  PrioridadTicket,
  SeveridadBug,
  TipoDocumentoIGSI,
  TipoGestion,
} from '@/lib/tickets/types'

type Resultado = { ok: boolean; error?: string }

export type NuevoBugDatos = {
  titulo: string
  descripcion?: string
  clasificacion: ClasificacionBug
  severidad: SeveridadBug
  tipo_documento?: TipoDocumentoIGSI | null
  modulo?: string | null
  solucion_provisional?: string | null
}

export type DatosResolucion = {
  causaId: string
  respuesta: string
  requiereCapacitacion?: boolean
  requiereAjuste?: boolean
  bugId?: string | null
  nuevoBug?: NuevoBugDatos | null
}

interface TicketBase {
  id: string
  numero: number
  estado: EstadoTicket
  solicitante_id: string
  responsable_id: string | null
  aprobador_id: string | null
  tipologia_id: string
  categoria_id: string
  impacto: ImpactoTicket
  prioridad: PrioridadTicket
  fecha_requerida: string | null
  area: string | null
  asunto: string
  tipologia: {
    nombre: string
    visibilidad_restringida: boolean
    es_novedad_igsi: boolean
    responsable_defecto_id: string | null
  } | null
}

const SELECT_BASE =
  'id, numero, estado, solicitante_id, responsable_id, aprobador_id, tipologia_id, categoria_id, impacto, prioridad, fecha_requerida, area, asunto, tipologia:ticket_tipologias(nombre, visibilidad_restringida, es_novedad_igsi, responsable_defecto_id)'

async function cargarTicket(supabase: SupabaseClient, ticketId: string): Promise<TicketBase | null> {
  if (!ticketId) return null
  const { data } = await supabase.from('tickets').select(SELECT_BASE).eq('id', ticketId).maybeSingle()
  return (data as unknown as TicketBase) ?? null
}

function refrescar(ticketId: string) {
  revalidatePath('/admin/tickets')
  revalidatePath(`/admin/tickets/${ticketId}`)
  revalidatePath('/mis-tickets')
  revalidatePath(`/mis-tickets/${ticketId}`)
  revalidatePath('/mis-tickets/aprobaciones')
}

function mensajeError(e: unknown, defecto: string): string {
  return e instanceof Error && e.message ? e.message : defecto
}

/** Carga el contexto y el ticket, y valida que el usuario pueda gestionarlo como TIN */
async function prepararGestion(ticketId: string): Promise<
  { ok: true; ctx: ContextoTickets; supabase: SupabaseClient; t: TicketBase } | { ok: false; error: string }
> {
  const ctx = await contextoTickets()
  if (!ctx) return { ok: false, error: NO_AUTORIZADO }
  const supabase = createAdminClient()
  const t = await cargarTicket(supabase, ticketId)
  if (!t) return { ok: false, error: 'Ticket no encontrado' }
  const restringida = !!t.tipologia?.visibilidad_restringida
  if (!puedeVerTicketGestion(ctx, t, restringida) || !puedeGestionarTicket(ctx, t)) {
    return { ok: false, error: NO_AUTORIZADO }
  }
  return { ok: true, ctx, supabase, t }
}

async function esResponsableValido(supabase: SupabaseClient, perfilId: string): Promise<boolean> {
  const ids = await idsConRecurso(supabase, RECURSOS_TICKETS.ATENDER)
  return ids.includes(perfilId)
}

async function nombrePerfil(supabase: SupabaseClient, id: string | null): Promise<string | null> {
  if (!id) return null
  const { data } = await supabase.from('perfiles').select('nombre_completo').eq('id', id).maybeSingle()
  return (data?.nombre_completo as string | undefined) ?? null
}

function sinAcentos(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

function hoyBogota(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: ZONA_HORARIA })
}

// ── Asignación ───────────────────────────────────────────────────────────────

async function asignarInterno(
  ctx: ContextoTickets,
  supabase: SupabaseClient,
  t: TicketBase,
  responsableId: string,
  motivo: string | null,
): Promise<Resultado> {
  if (!responsableId) return { ok: false, error: 'Selecciona un responsable' }
  if (t.responsable_id === responsableId) return { ok: false, error: 'El ticket ya está asignado a esa persona' }
  if (t.estado === 'CERRADO') return { ok: false, error: 'El ticket está cerrado. Reábrelo antes de reasignarlo.' }
  if (t.estado === 'ESPERA_APROBACION') return { ok: false, error: 'El ticket está en espera de aprobación' }

  const tomaPropia = responsableId === ctx.usuarioId && t.responsable_id === null
  if (!(ctx.esAdmin || ctx.coordinar) && !(ctx.atender && tomaPropia)) {
    return { ok: false, error: 'Solo la Coordinación TIN puede asignar o reasignar tickets' }
  }
  if (!(await esResponsableValido(supabase, responsableId))) {
    return { ok: false, error: 'La persona elegida no puede atender tickets' }
  }

  const ahora = new Date().toISOString()
  const { data: upd, error } = await supabase
    .from('tickets')
    .update({ responsable_id: responsableId, updated_at: ahora })
    .eq('id', t.id)
    .eq('estado', t.estado)
    .select('id')
  if (error) return { ok: false, error: error.message }
  if (!upd || upd.length === 0) return { ok: false, error: 'El ticket cambió mientras se procesaba. Recarga e intenta de nuevo.' }

  const [anteriorNombre, nuevoNombre] = await Promise.all([
    nombrePerfil(supabase, t.responsable_id),
    nombrePerfil(supabase, responsableId),
  ])
  await registrarEvento(supabase, {
    ticketId: t.id,
    tipo: 'ASIGNACION',
    usuarioId: ctx.usuarioId,
    campo: 'responsable_id',
    valorAnterior: anteriorNombre,
    valorNuevo: nuevoNombre,
    comentario: motivo,
    visibleUsuario: false,
    metadata: {
      responsable_anterior_id: t.responsable_id,
      responsable_nuevo_id: responsableId,
      tipo: t.responsable_id ? 'REASIGNACION' : tomaPropia ? 'TOMA' : 'ASIGNACION',
    },
  })

  if (t.estado === 'ABIERTO') {
    // Envía el correo de asignación y registra el cambio de estado
    await aplicarCambioEstado(supabase, {
      ticketId: t.id,
      nuevoEstado: 'ASIGNADO',
      usuarioId: ctx.usuarioId,
      visibleUsuario: true,
      metadata: { motivo },
    })
  } else {
    await supabase.from('tickets').update({ fecha_asignacion: ahora }).eq('id', t.id).is('fecha_asignacion', null)
    if (responsableId !== ctx.usuarioId) await enviarAsignacion(supabase, t.id, motivo)
    if (t.responsable_id && t.responsable_id !== ctx.usuarioId) {
      await avisar(supabase, [t.responsable_id], t.id, `El ticket ${codigoTicket(t.numero)} fue reasignado a ${nuevoNombre ?? 'otra persona'}`)
    }
    await recalcularTiemposSeguro(supabase, t.id)
  }
  return { ok: true }
}

export async function asignarTicket(ticketId: string, responsableId: string, motivo?: string): Promise<Resultado> {
  try {
    const ctx = await contextoTickets()
    if (!ctx) return { ok: false, error: NO_AUTORIZADO }
    const supabase = createAdminClient()
    const t = await cargarTicket(supabase, ticketId)
    if (!t) return { ok: false, error: 'Ticket no encontrado' }
    if (!puedeVerTicketGestion(ctx, t, !!t.tipologia?.visibilidad_restringida)) return { ok: false, error: NO_AUTORIZADO }
    if (t.responsable_id && !motivo?.trim()) return { ok: false, error: 'Indica el motivo de la reasignación' }
    const res = await asignarInterno(ctx, supabase, t, responsableId, motivo?.trim() || null)
    if (res.ok) refrescar(ticketId)
    return res
  } catch (e) {
    return { ok: false, error: mensajeError(e, 'No se pudo asignar el ticket') }
  }
}

export async function tomarTicket(ticketId: string): Promise<Resultado> {
  try {
    const ctx = await contextoTickets()
    if (!ctx) return { ok: false, error: NO_AUTORIZADO }
    if (!(ctx.atender || ctx.coordinar || ctx.esAdmin)) return { ok: false, error: NO_AUTORIZADO }
    const supabase = createAdminClient()
    const t = await cargarTicket(supabase, ticketId)
    if (!t) return { ok: false, error: 'Ticket no encontrado' }
    if (!puedeVerTicketGestion(ctx, t, !!t.tipologia?.visibilidad_restringida)) return { ok: false, error: NO_AUTORIZADO }
    if (t.responsable_id && !(ctx.esAdmin || ctx.coordinar)) {
      return { ok: false, error: 'El ticket ya tiene responsable' }
    }
    const res = await asignarInterno(ctx, supabase, t, ctx.usuarioId, t.responsable_id ? 'Tomado por el coordinador' : 'Tomado por el responsable')
    if (res.ok) refrescar(ticketId)
    return res
  } catch (e) {
    return { ok: false, error: mensajeError(e, 'No se pudo tomar el ticket') }
  }
}

// ── Estados ──────────────────────────────────────────────────────────────────

/** Estados que se pueden pedir con esta acción (los demás tienen acción propia) */
const ESTADOS_MANUALES: EstadoTicket[] = ['EN_PROCESO', 'ESPERA_USUARIO', 'ESPERA_PROVEEDOR', 'ESPERA_APROBACION', 'CERRADO']

export async function cambiarEstadoTicket(ticketId: string, estado: EstadoTicket, comentario?: string): Promise<Resultado> {
  try {
    if (!ESTADOS_MANUALES.includes(estado)) {
      return { ok: false, error: estado === 'RESUELTO' ? 'Usa "Resolver" para registrar la causa y la respuesta' : estado === 'ASIGNADO' ? 'Usa "Asignar" para elegir el responsable' : 'Estado no válido' }
    }
    const prep = await prepararGestion(ticketId)
    if (!prep.ok) return prep
    const { ctx, supabase, t } = prep
    const texto = comentario?.trim() || null

    if (estado === 'EN_PROCESO' && (t.estado === 'RESUELTO' || t.estado === 'CERRADO')) {
      if (!texto) return { ok: false, error: 'Indica el motivo de la reapertura' }
    }
    if (estado === 'ESPERA_USUARIO' && !texto) return { ok: false, error: 'Escribe qué información necesitas del usuario' }
    if (estado === 'ESPERA_PROVEEDOR' && !texto) return { ok: false, error: 'Indica el proveedor y el caso que se espera' }
    if (estado === 'ESPERA_APROBACION' && !t.aprobador_id) {
      // Toma el jefe inmediato del solicitante como aprobador
      const { data: sol } = await supabase.from('perfiles').select('jefe_id').eq('id', t.solicitante_id).maybeSingle()
      if (sol?.jefe_id) await supabase.from('tickets').update({ aprobador_id: sol.jefe_id }).eq('id', t.id)
    }

    await aplicarCambioEstado(supabase, {
      ticketId: t.id,
      nuevoEstado: estado,
      usuarioId: ctx.usuarioId,
      comentario: texto,
      visibleUsuario: true,
    })
    refrescar(ticketId)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: mensajeError(e, 'No se pudo cambiar el estado') }
  }
}

// ── Comentarios ──────────────────────────────────────────────────────────────

export async function agregarComentarioTicket(ticketId: string, texto: string, visibleUsuario: boolean): Promise<Resultado> {
  try {
    const ctx = await contextoTickets()
    if (!ctx) return { ok: false, error: NO_AUTORIZADO }
    const contenido = String(texto ?? '').trim()
    if (!contenido) return { ok: false, error: 'Escribe el comentario' }
    if (contenido.length > 5000) return { ok: false, error: 'El comentario es demasiado largo (máximo 5000 caracteres)' }

    const supabase = createAdminClient()
    const t = await cargarTicket(supabase, ticketId)
    if (!t) return { ok: false, error: 'Ticket no encontrado' }

    const esSolicitante = t.solicitante_id === ctx.usuarioId
    const gestiona = puedeVerTicketGestion(ctx, t, !!t.tipologia?.visibilidad_restringida) && puedeGestionarTicket(ctx, t)
    if (!esSolicitante && !gestiona) return { ok: false, error: NO_AUTORIZADO }
    if (esSolicitante && !gestiona && t.estado === 'CERRADO') {
      return { ok: false, error: 'El ticket está cerrado. Reábrelo si el problema continúa.' }
    }
    // El solicitante siempre escribe comentarios visibles
    const visible = esSolicitante && !gestiona ? true : !!visibleUsuario

    await registrarEvento(supabase, {
      ticketId: t.id,
      tipo: 'COMENTARIO',
      usuarioId: ctx.usuarioId,
      comentario: contenido,
      visibleUsuario: visible,
      metadata: { autor: esSolicitante ? 'SOLICITANTE' : 'TIN' },
    })
    await supabase.from('tickets').update({ updated_at: new Date().toISOString() }).eq('id', t.id)

    if (esSolicitante) {
      if (t.estado === 'ESPERA_USUARIO') {
        await aplicarCambioEstado(supabase, {
          ticketId: t.id,
          nuevoEstado: 'EN_PROCESO',
          usuarioId: ctx.usuarioId,
          comentario: 'El solicitante respondió',
          visibleUsuario: true,
        })
      } else if (t.responsable_id && t.responsable_id !== ctx.usuarioId) {
        await avisar(supabase, [t.responsable_id], t.id, `Nuevo comentario del solicitante en ${codigoTicket(t.numero)}`)
      }
    } else if (visible) {
      const primera = await registrarPrimeraRespuestaSiFalta(supabase, t.id, ctx.usuarioId, 'COMENTARIO')
      if (primera) await recalcularTiemposSeguro(supabase, t.id)
      await avisar(supabase, [t.solicitante_id], t.id, `TIN comentó tu ticket ${codigoTicket(t.numero)}`)
    }

    refrescar(ticketId)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: mensajeError(e, 'No se pudo guardar el comentario') }
  }
}

// ── Resolución ───────────────────────────────────────────────────────────────

async function crearTicketCapacitacion(
  supabase: SupabaseClient,
  t: TicketBase,
  usuarioId: string,
  subcausa: string,
): Promise<string | null> {
  const nombreTipologia = t.tipologia?.es_novedad_igsi ? 'Capacitación en IGSI' : 'Capacitación en otra herramienta'
  const { data: cat } = await supabase.from('ticket_categorias').select('id').eq('nombre', 'Capacitación').maybeSingle()
  if (!cat) throw new Error('No existe la categoría "Capacitación" en el catálogo')
  const { data: tip } = await supabase
    .from('ticket_tipologias')
    .select('id, tipo_gestion, prioridad_defecto, responsable_defecto_id')
    .eq('categoria_id', cat.id)
    .eq('nombre', nombreTipologia)
    .maybeSingle()
  if (!tip) throw new Error(`No existe la tipología "Capacitación / ${nombreTipologia}" en el catálogo`)

  const [{ data: resolutor }, { data: funcionario }] = await Promise.all([
    supabase.from('perfiles').select('proceso_interno, sede').eq('id', usuarioId).maybeSingle(),
    supabase.from('perfiles').select('nombre_completo, proceso_interno').eq('id', t.solicitante_id).maybeSingle(),
  ])
  const areaCodigo = t.area ?? funcionario?.proceso_interno ?? null
  let areaLabel = areaCodigo ? String(areaCodigo).replace(/_/g, ' ') : 'Sin área'
  if (areaCodigo) {
    const { data: proc } = await supabase.from('procesos_internos').select('label').eq('valor', areaCodigo).maybeSingle()
    if (proc?.label) areaLabel = proc.label
  }
  const nombreFuncionario = funcionario?.nombre_completo ?? 'Funcionario'
  const prioridad = calcularPrioridad({
    impacto: 'SOLO_YO',
    tipoGestion: tip.tipo_gestion as TipoGestion,
    prioridadDefecto: tip.prioridad_defecto as PrioridadTicket | null,
  })
  const responsable = (tip.responsable_defecto_id as string | null) ?? null
  const ahora = new Date().toISOString()

  const { data: hijo, error } = await supabase
    .from('tickets')
    .insert({
      solicitante_id: usuarioId,
      area: resolutor?.proceso_interno ?? null,
      sede: resolutor?.sede ?? null,
      categoria_id: cat.id,
      tipologia_id: tip.id,
      impacto: 'SOLO_YO',
      prioridad,
      estado: responsable ? 'ASIGNADO' : 'ABIERTO',
      responsable_id: responsable,
      fecha_asignacion: responsable ? ahora : null,
      ticket_padre_id: t.id,
      canal: 'FORMULARIO',
      asunto: `${nombreTipologia} — ${areaLabel} — ${nombreFuncionario}`.slice(0, 250),
      descripcion:
        `Capacitación sugerida al resolver el ticket ${codigoTicket(t.numero)} (${t.asunto}).\n` +
        `Funcionario: ${nombreFuncionario}\nÁrea: ${areaLabel}\nCausa: ${subcausa}`,
    })
    .select('id, numero')
    .single()
  if (error || !hijo) throw new Error(`No se pudo crear el ticket de capacitación: ${error?.message ?? ''}`)

  const eventos: EventoTicket[] = [{
    ticketId: hijo.id,
    tipo: 'CREACION',
    usuarioId,
    comentario: `Creado desde ${codigoTicket(t.numero)} por requerir capacitación`,
    visibleUsuario: true,
    metadata: { canal: 'FORMULARIO', prioridad, impacto: 'SOLO_YO', ticket_padre_id: t.id, tipologia: nombreTipologia },
  }]
  if (responsable) {
    eventos.push({
      ticketId: hijo.id,
      tipo: 'ASIGNACION',
      usuarioId: null,
      campo: 'responsable_id',
      valorNuevo: await nombrePerfil(supabase, responsable),
      comentario: 'Asignación automática por tipología',
      metadata: { responsable_nuevo_id: responsable, tipo: 'AUTOMATICA' },
    })
  }
  await registrarEventos(supabase, eventos)
  await despuesDeCrearTicket(hijo.id)
  return hijo.id as string
}

export async function resolverTicket(ticketId: string, datos: DatosResolucion): Promise<Resultado & { ticketHijoId?: string }> {
  try {
    const prep = await prepararGestion(ticketId)
    if (!prep.ok) return prep
    const { ctx, supabase, t } = prep

    if (!['ASIGNADO', 'EN_PROCESO', 'ESPERA_USUARIO', 'ESPERA_PROVEEDOR'].includes(t.estado)) {
      return { ok: false, error: `No se puede resolver un ticket en estado "${LABEL_ESTADO_TICKET[t.estado]}"` }
    }
    const respuesta = String(datos?.respuesta ?? '').trim()
    if (!datos?.causaId) return { ok: false, error: 'Selecciona la causa' }
    if (!respuesta) return { ok: false, error: 'Escribe la respuesta para el usuario' }

    const esIGSI = !!t.tipologia?.es_novedad_igsi
    const ambito = esIGSI ? 'IGSI' : 'GENERAL'
    const { data: causa } = await supabase
      .from('ticket_causas')
      .select('id, ambito, tipo_causa, subcausa, activa')
      .eq('id', datos.causaId)
      .maybeSingle()
    if (!causa || !causa.activa) return { ok: false, error: 'La causa seleccionada no existe o está inactiva' }
    if (causa.ambito !== ambito) {
      return { ok: false, error: esIGSI ? 'Usa una causa de Novedades IGSI (técnica o conceptual)' : 'Usa una causa general' }
    }
    const tipoNorm = sinAcentos(causa.tipo_causa)
    const tecnica = tipoNorm.startsWith('tecnic')
    const conceptual = tipoNorm.startsWith('conceptual')

    const requiereAjuste = !!datos.requiereAjuste
    const requiereCapacitacion = !!datos.requiereCapacitacion
    const necesitaBug = (esIGSI && tecnica) || requiereAjuste
    let bugId = datos.bugId || null

    if (bugId) {
      const { data: bug } = await supabase.from('ticket_bugs').select('id').eq('id', bugId).maybeSingle()
      if (!bug) return { ok: false, error: 'El bug seleccionado no existe' }
    }
    if (!bugId && datos.nuevoBug) {
      const nb = datos.nuevoBug
      if (!nb.titulo?.trim()) return { ok: false, error: 'Escribe el título del bug' }
      if (!nb.clasificacion || !nb.severidad) return { ok: false, error: 'Indica la clasificación y la severidad del bug' }
    }
    if (necesitaBug && !bugId && !datos.nuevoBug) {
      return { ok: false, error: requiereAjuste && !(esIGSI && tecnica)
        ? 'Un ajuste en IGSI exige enlazar un bug existente o crear uno nuevo'
        : 'Una causa técnica exige enlazar un bug existente o crear uno nuevo' }
    }

    // Bug: crear (si viene) y enlazar
    let bugCreado: { id: string; numero: number } | null = null
    if (!bugId && datos.nuevoBug) {
      const nb = datos.nuevoBug
      const creado = await crearBug(supabase, {
        titulo: nb.titulo.trim(),
        descripcion: nb.descripcion?.trim() || undefined,
        clasificacion: nb.clasificacion,
        severidad: nb.severidad,
        tipo_documento: nb.tipo_documento ?? null,
        modulo: nb.modulo?.trim() || null,
        solucion_provisional: nb.solucion_provisional?.trim() || null,
      }, ctx.usuarioId)
      bugCreado = creado
      bugId = creado.id
    }
    if (bugId) await enlazarTicketABug(supabase, t.id, bugId, ctx.usuarioId)

    // Cierre (uno por ticket; si se reabrió y se vuelve a resolver, se reemplaza: el historial guarda ambos)
    const { error: errCierre } = await supabase.from('ticket_cierres').upsert({
      ticket_id: t.id,
      causa_id: causa.id,
      respuesta,
      requiere_capacitacion: requiereCapacitacion,
      requiere_ajuste: requiereAjuste,
      cerrado_por: ctx.usuarioId,
      fecha: new Date().toISOString(),
    }, { onConflict: 'ticket_id' })
    if (errCierre) return { ok: false, error: errCierre.message }

    await registrarEvento(supabase, {
      ticketId: t.id,
      tipo: 'CLASIFICACION_CAUSA',
      usuarioId: ctx.usuarioId,
      campo: 'causa',
      valorNuevo: `${causa.tipo_causa} · ${causa.subcausa}`,
      visibleUsuario: false,
      metadata: {
        causa_id: causa.id,
        ambito: causa.ambito,
        tipo_causa: causa.tipo_causa,
        subcausa: causa.subcausa,
        tecnica,
        conceptual,
        bug_id: bugId,
        bug_numero: bugCreado?.numero ?? null,
        requiere_capacitacion: requiereCapacitacion,
        requiere_ajuste: requiereAjuste,
      },
    })

    let ticketHijoId: string | undefined
    if (requiereCapacitacion) {
      ticketHijoId = (await crearTicketCapacitacion(supabase, t, ctx.usuarioId, `${causa.tipo_causa} · ${causa.subcausa}`)) ?? undefined
    }

    await aplicarCambioEstado(supabase, {
      ticketId: t.id,
      nuevoEstado: 'RESUELTO',
      usuarioId: ctx.usuarioId,
      comentario: respuesta,
      visibleUsuario: true,
      metadata: { causa_id: causa.id, bug_id: bugId, ticket_hijo_id: ticketHijoId ?? null },
    })

    refrescar(ticketId)
    if (ticketHijoId) refrescar(ticketHijoId)
    return { ok: true, ticketHijoId }
  } catch (e) {
    return { ok: false, error: mensajeError(e, 'No se pudo resolver el ticket') }
  }
}

// ── Confirmación, reapertura y cierre ────────────────────────────────────────

export async function confirmarSolucionTicket(ticketId: string): Promise<Resultado> {
  try {
    const ctx = await contextoTickets()
    if (!ctx) return { ok: false, error: NO_AUTORIZADO }
    const supabase = createAdminClient()
    const t = await cargarTicket(supabase, ticketId)
    if (!t) return { ok: false, error: 'Ticket no encontrado' }
    if (t.solicitante_id !== ctx.usuarioId) return { ok: false, error: 'Solo el solicitante puede confirmar la solución' }
    if (t.estado !== 'RESUELTO') return { ok: false, error: 'El ticket no está resuelto' }
    await aplicarCambioEstado(supabase, {
      ticketId: t.id,
      nuevoEstado: 'CERRADO',
      usuarioId: ctx.usuarioId,
      comentario: 'Solución confirmada por el usuario',
      visibleUsuario: true,
      metadata: { confirmado_por_usuario: true },
    })
    refrescar(ticketId)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: mensajeError(e, 'No se pudo confirmar la solución') }
  }
}

export async function reabrirTicket(ticketId: string, motivo: string): Promise<Resultado> {
  try {
    const ctx = await contextoTickets()
    if (!ctx) return { ok: false, error: NO_AUTORIZADO }
    const texto = String(motivo ?? '').trim()
    if (!texto) return { ok: false, error: 'Indica el motivo de la reapertura' }
    const supabase = createAdminClient()
    const t = await cargarTicket(supabase, ticketId)
    if (!t) return { ok: false, error: 'Ticket no encontrado' }
    const esSolicitante = t.solicitante_id === ctx.usuarioId
    const gestiona = puedeVerTicketGestion(ctx, t, !!t.tipologia?.visibilidad_restringida) && puedeGestionarTicket(ctx, t)
    if (!esSolicitante && !gestiona) return { ok: false, error: NO_AUTORIZADO }
    if (t.estado !== 'RESUELTO' && t.estado !== 'CERRADO') return { ok: false, error: 'Solo se reabren tickets resueltos o cerrados' }
    if (!t.responsable_id) return { ok: false, error: 'El ticket no tiene responsable; pide a la Coordinación TIN que lo asigne' }
    await aplicarCambioEstado(supabase, {
      ticketId: t.id,
      nuevoEstado: 'EN_PROCESO',
      usuarioId: ctx.usuarioId,
      comentario: texto,
      visibleUsuario: true,
      metadata: { reabierto_por: esSolicitante ? 'SOLICITANTE' : 'TIN' },
    })
    refrescar(ticketId)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: mensajeError(e, 'No se pudo reabrir el ticket') }
  }
}

// ── Aprobación ───────────────────────────────────────────────────────────────

export async function decidirAprobacionTicket(ticketId: string, aprobado: boolean, observacion?: string): Promise<Resultado> {
  try {
    const ctx = await contextoTickets()
    if (!ctx) return { ok: false, error: NO_AUTORIZADO }
    const supabase = createAdminClient()
    const t = await cargarTicket(supabase, ticketId)
    if (!t) return { ok: false, error: 'Ticket no encontrado' }
    const esAprobador = !!t.aprobador_id && t.aprobador_id === ctx.usuarioId
    if (!esAprobador && !(ctx.coordinar || ctx.esAdmin)) return { ok: false, error: NO_AUTORIZADO }
    if (!esAprobador && t.tipologia?.visibilidad_restringida && !ctx.restringidas) return { ok: false, error: NO_AUTORIZADO }
    if (t.estado !== 'ESPERA_APROBACION') return { ok: false, error: 'El ticket no está en espera de aprobación' }
    const obs = observacion?.trim() || null
    if (!aprobado && !obs) return { ok: false, error: 'Indica el motivo del rechazo' }

    await registrarEvento(supabase, {
      ticketId: t.id,
      tipo: aprobado ? 'APROBACION' : 'RECHAZO',
      usuarioId: ctx.usuarioId,
      campo: 'aprobacion',
      valorNuevo: aprobado ? 'APROBADO' : 'RECHAZADO',
      comentario: obs,
      visibleUsuario: true,
      metadata: { aprobador_id: ctx.usuarioId, como: esAprobador ? 'APROBADOR' : 'COORDINADOR' },
    })

    if (!aprobado) {
      await aplicarCambioEstado(supabase, {
        ticketId: t.id,
        nuevoEstado: 'CERRADO',
        usuarioId: ctx.usuarioId,
        comentario: obs,
        visibleUsuario: true,
        metadata: { rechazo: true },
      })
    } else {
      let responsable = t.responsable_id
      if (!responsable && t.tipologia?.responsable_defecto_id) {
        responsable = t.tipologia.responsable_defecto_id
        await supabase.from('tickets').update({ responsable_id: responsable }).eq('id', t.id)
        await registrarEvento(supabase, {
          ticketId: t.id,
          tipo: 'ASIGNACION',
          usuarioId: null,
          campo: 'responsable_id',
          valorNuevo: await nombrePerfil(supabase, responsable),
          comentario: 'Asignación automática por tipología',
          metadata: { responsable_nuevo_id: responsable, tipo: 'AUTOMATICA' },
        })
      }
      await aplicarCambioEstado(supabase, {
        ticketId: t.id,
        nuevoEstado: responsable ? 'ASIGNADO' : 'ABIERTO',
        usuarioId: ctx.usuarioId,
        comentario: obs,
        visibleUsuario: true,
        metadata: { aprobado: true },
      })
    }
    refrescar(ticketId)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: mensajeError(e, 'No se pudo registrar la decisión') }
  }
}

// ── Prioridad y tipología ────────────────────────────────────────────────────

const PRIORIDADES: PrioridadTicket[] = ['CRITICA', 'ALTA', 'MEDIA', 'BAJA']

export async function cambiarPrioridadTicket(ticketId: string, prioridad: PrioridadTicket, motivo: string): Promise<Resultado> {
  try {
    if (!PRIORIDADES.includes(prioridad)) return { ok: false, error: 'Prioridad no válida' }
    const texto = String(motivo ?? '').trim()
    if (!texto) return { ok: false, error: 'Indica el motivo del cambio de prioridad' }
    const prep = await prepararGestion(ticketId)
    if (!prep.ok) return prep
    const { ctx, supabase, t } = prep
    if (t.estado === 'CERRADO') return { ok: false, error: 'El ticket está cerrado' }
    if (t.prioridad === prioridad) return { ok: false, error: 'El ticket ya tiene esa prioridad' }

    const { error } = await supabase.from('tickets').update({ prioridad, updated_at: new Date().toISOString() }).eq('id', t.id)
    if (error) return { ok: false, error: error.message }
    await registrarEvento(supabase, {
      ticketId: t.id,
      tipo: 'CAMBIO_PRIORIDAD',
      usuarioId: ctx.usuarioId,
      campo: 'prioridad',
      valorAnterior: t.prioridad,
      valorNuevo: prioridad,
      comentario: texto,
      visibleUsuario: true,
    })
    await recalcularTiemposSeguro(supabase, t.id)
    refrescar(ticketId)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: mensajeError(e, 'No se pudo cambiar la prioridad') }
  }
}

export async function reclasificarTicket(ticketId: string, tipologiaId: string, motivo: string): Promise<Resultado> {
  try {
    const texto = String(motivo ?? '').trim()
    if (!texto) return { ok: false, error: 'Indica el motivo de la reclasificación' }
    const prep = await prepararGestion(ticketId)
    if (!prep.ok) return prep
    const { ctx, supabase, t } = prep
    if (t.estado === 'CERRADO') return { ok: false, error: 'El ticket está cerrado' }
    if (t.tipologia_id === tipologiaId) return { ok: false, error: 'El ticket ya tiene esa tipología' }

    const { data: nueva } = await supabase
      .from('ticket_tipologias')
      .select('id, nombre, categoria_id, tipo_gestion, prioridad_defecto, activa, visibilidad_restringida, responsable_defecto_id, categoria:ticket_categorias(nombre)')
      .eq('id', tipologiaId)
      .maybeSingle()
    if (!nueva || !nueva.activa) return { ok: false, error: 'La tipología no existe o está inactiva' }
    if (nueva.visibilidad_restringida && !ctx.restringidas) return { ok: false, error: NO_AUTORIZADO }

    const nuevaCat = (nueva as unknown as { categoria: { nombre: string } | null }).categoria?.nombre ?? ''
    const esAuditoriaVencida = sinAcentos(nuevaCat) === 'auditoria' && !!t.fecha_requerida && t.fecha_requerida < hoyBogota()
    const prioridad = calcularPrioridad({
      impacto: t.impacto,
      tipoGestion: nueva.tipo_gestion as TipoGestion,
      prioridadDefecto: nueva.prioridad_defecto as PrioridadTicket | null,
      esAuditoriaVencida,
    })

    const { data: catAnterior } = await supabase.from('ticket_categorias').select('nombre').eq('id', t.categoria_id).maybeSingle()
    const ahora = new Date().toISOString()
    const { error } = await supabase
      .from('tickets')
      .update({ tipologia_id: nueva.id, categoria_id: nueva.categoria_id, prioridad, updated_at: ahora })
      .eq('id', t.id)
    if (error) return { ok: false, error: error.message }

    const eventos: EventoTicket[] = [{
      ticketId: t.id,
      tipo: 'CAMBIO_TIPOLOGIA',
      usuarioId: ctx.usuarioId,
      campo: 'tipologia_id',
      valorAnterior: `${catAnterior?.nombre ?? ''} / ${t.tipologia?.nombre ?? ''}`,
      valorNuevo: `${nuevaCat} / ${nueva.nombre}`,
      comentario: texto,
      visibleUsuario: true,
      metadata: {
        tipologia_anterior_id: t.tipologia_id,
        tipologia_nueva_id: nueva.id,
        categoria_anterior_id: t.categoria_id,
        categoria_nueva_id: nueva.categoria_id,
      },
    }]
    if (prioridad !== t.prioridad) {
      eventos.push({
        ticketId: t.id,
        tipo: 'CAMBIO_PRIORIDAD',
        usuarioId: ctx.usuarioId,
        campo: 'prioridad',
        valorAnterior: t.prioridad,
        valorNuevo: prioridad,
        comentario: `Recalculada por reclasificación: ${texto}`,
        visibleUsuario: true,
        metadata: { por_reclasificacion: true },
      })
    }
    await registrarEventos(supabase, eventos)

    // Si no tiene responsable y la nueva tipología tiene uno por defecto, se asigna
    if (!t.responsable_id && nueva.responsable_defecto_id && t.estado === 'ABIERTO') {
      {
        await supabase.from('tickets').update({ responsable_id: nueva.responsable_defecto_id }).eq('id', t.id)
        await registrarEvento(supabase, {
          ticketId: t.id,
          tipo: 'ASIGNACION',
          usuarioId: null,
          campo: 'responsable_id',
          valorNuevo: await nombrePerfil(supabase, nueva.responsable_defecto_id),
          comentario: 'Asignación automática por tipología (reclasificación)',
          metadata: { responsable_nuevo_id: nueva.responsable_defecto_id, tipo: 'AUTOMATICA' },
        })
        await aplicarCambioEstado(supabase, {
          ticketId: t.id,
          nuevoEstado: 'ASIGNADO',
          usuarioId: ctx.usuarioId,
          visibleUsuario: true,
          metadata: { motivo: 'Asignación automática por tipología' },
        })
      }
    } else {
      await recalcularTiemposSeguro(supabase, t.id)
    }

    refrescar(ticketId)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: mensajeError(e, 'No se pudo reclasificar el ticket') }
  }
}

