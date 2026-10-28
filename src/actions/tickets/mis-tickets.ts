'use server'
/* eslint-disable @typescript-eslint/no-explicit-any -- patrón (supabase as any) del repo */

import { createAdminClient } from '@/lib/supabase/admin'
import { getUsuarioActual } from '@/lib/supabase/guards'
import { ESTADOS_TICKET, codigoTicket } from '@/lib/tickets/constantes'
import { nombresPerfiles } from '@/lib/tickets/solicitante'
import type { EstadoTicket, TicketHistorial } from '@/lib/tickets/types'
import type {
  EventoVisible,
  FiltrosMisTickets,
  MiTicketDetalle,
  MiTicketFila,
} from '@/components/tickets/funcionario/tipos'

// Vista del funcionario: solo sus propios tickets (solicitante_id = usuario actual).

export async function listarMisTickets(filtros: FiltrosMisTickets = {}): Promise<MiTicketFila[]> {
  const actual = await getUsuarioActual()
  if (!actual) return []
  const supabase = createAdminClient()

  let q = (supabase as any)
    .from('tickets')
    .select('id, numero, asunto, estado, prioridad, responsable_id, ticket_padre_id, fecha_creacion, fecha_requerida, fecha_resuelto, fecha_cierre, updated_at, categoria:ticket_categorias(nombre), tipologia:ticket_tipologias(nombre, tipo_gestion)')
    .eq('solicitante_id', actual.user.id)
    .order('fecha_creacion', { ascending: false })
    .limit(500)

  const estado = filtros.estado
  if (estado === 'ABIERTOS') q = q.neq('estado', 'CERRADO')
  else if (estado && estado !== 'TODOS' && ESTADOS_TICKET.some(e => e.value === estado)) q = q.eq('estado', estado)

  const texto = String(filtros.q ?? '').trim().slice(0, 100)
  const num = texto.match(/^(?:tk)?\s*-?\s*0*(\d+)$/i)
  if (num) q = q.eq('numero', Number(num[1]))
  else if (texto) q = q.ilike('asunto', `%${texto.replace(/[\\%_]/g, c => `\\${c}`)}%`)

  const { data, error } = await q
  if (error) {
    console.error('[tickets] listarMisTickets', error.message)
    return []
  }
  const filas = (data ?? []) as any[]
  const nombres = await nombresPerfiles(supabase, filas.map(f => f.responsable_id))
  return filas.map(f => ({
    id: f.id,
    codigo: codigoTicket(Number(f.numero)),
    asunto: f.asunto,
    categoria: f.categoria?.nombre ?? '',
    tipologia: f.tipologia?.nombre ?? '',
    tipo_gestion: f.tipologia?.tipo_gestion ?? null,
    estado: f.estado,
    prioridad: f.prioridad,
    responsable: f.responsable_id ? (nombres.get(f.responsable_id) ?? null) : null,
    fecha_creacion: f.fecha_creacion,
    fecha_requerida: f.fecha_requerida,
    fecha_resuelto: f.fecha_resuelto,
    fecha_cierre: f.fecha_cierre,
    updated_at: f.updated_at,
    es_hijo: !!f.ticket_padre_id,
  }))
}

/** Detalle para el solicitante. null si no existe o no es suyo (la página responde 404). */
export async function obtenerMiTicket(id: string): Promise<MiTicketDetalle | null> {
  const actual = await getUsuarioActual()
  if (!actual || !/^[0-9a-f-]{36}$/i.test(String(id ?? ''))) return null
  const yo = actual.user.id
  const supabase = createAdminClient()

  const { data: t } = await (supabase as any)
    .from('tickets')
    .select('*, categoria:ticket_categorias(nombre), tipologia:ticket_tipologias(nombre, tipo_gestion, requiere_aprobacion)')
    .eq('id', id)
    .maybeSingle()
  if (!t || t.solicitante_id !== yo) return null

  const [valoresR, novedadR, adjuntosR, historialR, cierreR, padreR, hijosR] = await Promise.all([
    (supabase as any).from('ticket_valores_campo')
      .select('valor, campo:ticket_campos_tipologia(etiqueta, tipo_dato, orden)').eq('ticket_id', id),
    (supabase as any).from('ticket_novedades_igsi').select('*').eq('ticket_id', id).maybeSingle(),
    (supabase as any).from('ticket_adjuntos')
      .select('id, nombre_archivo, tipo_archivo, tamano, url, es_imagen, fecha, cargado_por').eq('ticket_id', id).order('fecha'),
    (supabase as any).from('ticket_historial').select('*').eq('ticket_id', id).order('fecha', { ascending: true }).order('id', { ascending: true }),
    (supabase as any).from('ticket_cierres').select('respuesta, fecha').eq('ticket_id', id).maybeSingle(),
    t.ticket_padre_id
      ? (supabase as any).from('tickets').select('id, numero, asunto, solicitante_id').eq('id', t.ticket_padre_id).maybeSingle()
      : Promise.resolve({ data: null }),
    (supabase as any).from('tickets').select('id, numero, asunto, estado').eq('ticket_padre_id', id).eq('solicitante_id', yo).order('numero'),
  ])

  // Historial: solo eventos visibles para el usuario y los cambios de estado (sin comentario interno)
  const eventos = ((historialR.data ?? []) as TicketHistorial[])
    .filter(e => e.visible_usuario || e.tipo_evento === 'CAMBIO_ESTADO')
  const valoresCrudos = ((valoresR.data ?? []) as any[])
  const idsUsuario = valoresCrudos.filter(v => v.campo?.tipo_dato === 'USUARIO').map(v => v.valor)
  const nombres = await nombresPerfiles(supabase, [
    t.responsable_id, t.aprobador_id,
    ...eventos.map(e => e.usuario_id),
    ...((adjuntosR.data ?? []) as any[]).map(a => a.cargado_por),
    ...idsUsuario,
  ])

  const historial: EventoVisible[] = eventos.map(e => ({
    id: e.id,
    tipo_evento: e.tipo_evento,
    fecha: e.fecha,
    usuario: e.usuario_id ? (nombres.get(e.usuario_id) ?? 'Usuario') : null,
    es_mio: e.usuario_id === yo,
    valor_anterior: e.tipo_evento === 'CAMBIO_ESTADO' || e.tipo_evento === 'ADJUNTO' ? e.valor_anterior : null,
    valor_nuevo: e.tipo_evento === 'CAMBIO_ESTADO' || e.tipo_evento === 'ADJUNTO' || e.tipo_evento === 'CREACION' ? e.valor_nuevo : null,
    comentario: e.visible_usuario ? e.comentario : null,
  }))

  // Qué se le pidió al usuario: comentario del paso a ESPERA_USUARIO y comentarios visibles de TIN posteriores
  let solicitudPendiente: MiTicketDetalle['solicitudPendiente'] = null
  if (t.estado === 'ESPERA_USUARIO') {
    const todos = (historialR.data ?? []) as TicketHistorial[]
    const idx = todos.map(e => e.tipo_evento === 'CAMBIO_ESTADO' && e.valor_nuevo === 'ESPERA_USUARIO').lastIndexOf(true)
    if (idx >= 0) {
      const textos: string[] = []
      const paso = todos[idx]
      if (paso.visible_usuario && paso.comentario) textos.push(paso.comentario)
      for (const e of todos.slice(idx + 1)) {
        if (e.tipo_evento === 'COMENTARIO' && e.visible_usuario && e.usuario_id !== yo && e.comentario) textos.push(e.comentario)
      }
      solicitudPendiente = { fecha: paso.fecha, textos }
    } else {
      solicitudPendiente = { fecha: t.updated_at, textos: [] }
    }
  }

  const n = novedadR.data
  const padre = padreR.data && padreR.data.solicitante_id === yo
    ? { id: padreR.data.id, codigo: codigoTicket(Number(padreR.data.numero)), asunto: padreR.data.asunto }
    : null

  return {
    id: t.id,
    codigo: codigoTicket(Number(t.numero)),
    asunto: t.asunto,
    descripcion: t.descripcion,
    estado: t.estado,
    prioridad: t.prioridad,
    impacto: t.impacto,
    canal: t.canal,
    area: t.area,
    sede: t.sede,
    categoria: t.categoria?.nombre ?? '',
    tipologia: t.tipologia?.nombre ?? '',
    tipo_gestion: t.tipologia?.tipo_gestion ?? null,
    requiere_aprobacion: !!t.tipologia?.requiere_aprobacion,
    responsable: t.responsable_id ? (nombres.get(t.responsable_id) ?? null) : null,
    aprobador: t.aprobador_id ? (nombres.get(t.aprobador_id) ?? null) : null,
    fecha_creacion: t.fecha_creacion,
    fecha_requerida: t.fecha_requerida,
    fecha_asignacion: t.fecha_asignacion,
    fecha_primera_respuesta: t.fecha_primera_respuesta,
    fecha_resuelto: t.fecha_resuelto,
    fecha_cierre: t.fecha_cierre,
    cierre_automatico: !!t.cierre_automatico,
    reaperturas: Number(t.reaperturas ?? 0),
    valores: valoresCrudos
      .filter(v => v.campo && v.valor != null && v.valor !== '')
      .sort((a, b) => (a.campo.orden ?? 0) - (b.campo.orden ?? 0))
      .map(v => ({
        etiqueta: v.campo.etiqueta,
        tipo_dato: v.campo.tipo_dato,
        valor: v.campo.tipo_dato === 'USUARIO' ? (nombres.get(v.valor) ?? v.valor)
          : v.campo.tipo_dato === 'CASILLA' ? (v.valor === 'true' ? 'Sí' : 'No')
          : v.valor,
      })),
    novedad: n ? {
      tipo_documento: n.tipo_documento,
      tipo_documento_otro: n.tipo_documento_otro,
      numero_documento: n.numero_documento,
      documentos_relacionados: n.documentos_relacionados,
      servicio: n.servicio,
      modalidad: n.modalidad,
      accion: n.accion,
      que_paso: n.que_paso,
      que_esperaba: n.que_esperaba,
      mensaje_error: n.mensaje_error,
      validacion_previa: !!n.validacion_previa,
      impacto_operacion: n.impacto_operacion,
    } : null,
    adjuntos: ((adjuntosR.data ?? []) as any[]).map(a => ({
      id: a.id,
      nombre_archivo: a.nombre_archivo,
      tipo_archivo: a.tipo_archivo,
      tamano: a.tamano,
      url: a.url,
      es_imagen: !!a.es_imagen,
      fecha: a.fecha,
      cargado_por: a.cargado_por ? (nombres.get(a.cargado_por) ?? null) : null,
    })),
    historial,
    cierre: cierreR.data ? { respuesta: cierreR.data.respuesta, fecha: cierreR.data.fecha } : null,
    solicitudPendiente,
    padre,
    hijos: ((hijosR.data ?? []) as any[]).map(h => ({
      id: h.id, codigo: codigoTicket(Number(h.numero)), asunto: h.asunto, estado: h.estado as EstadoTicket,
    })),
  }
}
