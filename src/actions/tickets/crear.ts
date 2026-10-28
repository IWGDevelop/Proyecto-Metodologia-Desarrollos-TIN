'use server'
/* eslint-disable @typescript-eslint/no-explicit-any -- patrón (supabase as any) del repo */

import { revalidatePath } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { NO_AUTORIZADO } from '@/lib/supabase/guards'
import { getProcesosInternos } from '@/actions/procesos-internos'
import { obtenerConfigTickets } from '@/lib/tickets/config'
import { registrarEvento, registrarEventos, type EventoTicket } from '@/lib/tickets/historial'
import { despuesDeCrearTicket } from '@/lib/tickets/flujo'
import { enlazarTicketABug } from '@/lib/tickets/bugs'
import {
  ACCIONES_IGSI,
  CADENA_IGSI,
  CATEGORIA_OTROS,
  IMPACTOS_OPERACION_IGSI,
  IMPACTOS_TICKET,
  calcularPrioridad,
  codigoTicket,
} from '@/lib/tickets/constantes'
import { accesoTickets, filasAdjuntos, hoyISO } from '@/lib/tickets/solicitante'
import type {
  EstadoTicket,
  ImpactoTicket,
  TicketCampoTipologia,
  TipoGestion,
  PrioridadTicket,
} from '@/lib/tickets/types'
import type {
  CatalogoFormulario,
  CrearDesdePlantillaInput,
  CrearTicketInput,
  DatosPlantillaFormulario,
  ResultadoCrear,
} from '@/components/tickets/funcionario/tipos'

// ── Utilidades internas ─────────────────────────────────────────────────────

/** Compara nombres sin tildes ni mayúsculas (el catálogo es editable) */
function norm(s: string | null | undefined): string {
  return (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase()
}

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/

interface TipologiaFila {
  id: string
  categoria_id: string
  nombre: string
  tipo_gestion: TipoGestion
  prioridad_defecto: PrioridadTicket | null
  requiere_aprobacion: boolean
  visibilidad_restringida: boolean
  adjunto_obligatorio: boolean
  es_novedad_igsi: boolean
  responsable_defecto_id: string | null
  activa: boolean
  categoria: { id: string; nombre: string; activa: boolean } | null
}

const SELECT_TIPOLOGIA =
  'id, categoria_id, nombre, tipo_gestion, prioridad_defecto, requiere_aprobacion, visibilidad_restringida, adjunto_obligatorio, es_novedad_igsi, responsable_defecto_id, activa, categoria:ticket_categorias(id, nombre, activa)'

interface PerfilSolicitante {
  id: string
  nombre_completo: string
  proceso_interno: string | null
  sede: string | null
  jefe_id: string | null
}

async function cargarPerfil(supabase: SupabaseClient, id: string): Promise<PerfilSolicitante | null> {
  const { data } = await (supabase as any)
    .from('perfiles')
    .select('id, nombre_completo, proceso_interno, sede, jefe_id')
    .eq('id', id)
    .maybeSingle()
  return (data as PerfilSolicitante | null) ?? null
}

async function cargarCampos(supabase: SupabaseClient, tipologiaId: string): Promise<TicketCampoTipologia[]> {
  const { data } = await (supabase as any)
    .from('ticket_campos_tipologia')
    .select('*')
    .eq('tipologia_id', tipologiaId)
    .eq('activo', true)
    .order('orden', { ascending: true })
  return (data ?? []) as TicketCampoTipologia[]
}

/**
 * Valida y normaliza los valores de los campos específicos.
 * exigirObligatorios = false en plantillas: lo que falte lo completa TIN.
 */
async function validarValores(
  supabase: SupabaseClient,
  campos: TicketCampoTipologia[],
  valores: Record<string, string>,
  exigirObligatorios: boolean,
): Promise<{ ok: true; filas: { campo_id: string; valor: string }[]; fechaRequerida: string | null } | { ok: false; error: string }> {
  const filas: { campo_id: string; valor: string }[] = []
  let fechaRequerida: string | null = null
  const usuariosAValidar: string[] = []

  for (const c of campos) {
    const crudo = valores?.[c.id]
    let v = crudo == null ? '' : String(crudo).trim()
    if (c.tipo_dato === 'CASILLA') v = v === 'true' ? 'true' : 'false'

    if (!v) {
      if (exigirObligatorios && c.obligatorio) return { ok: false, error: `Completa el campo "${c.etiqueta}"` }
      continue
    }
    if (v.length > 5000) return { ok: false, error: `El campo "${c.etiqueta}" es demasiado largo` }

    switch (c.tipo_dato) {
      case 'NUMERO':
        if (!Number.isFinite(Number(v.replace(',', '.')))) return { ok: false, error: `"${c.etiqueta}" debe ser un número` }
        break
      case 'FECHA':
        if (!FECHA_RE.test(v) || Number.isNaN(Date.parse(v))) return { ok: false, error: `"${c.etiqueta}" debe ser una fecha válida` }
        break
      case 'LISTA': {
        const opciones = Array.isArray(c.opciones) ? c.opciones : []
        if (opciones.length > 0 && !opciones.includes(v)) return { ok: false, error: `Elige una opción válida en "${c.etiqueta}"` }
        break
      }
      case 'USUARIO':
        usuariosAValidar.push(v)
        break
      default:
        break
    }
    if (c.es_fecha_requerida && c.tipo_dato === 'FECHA') fechaRequerida = v
    filas.push({ campo_id: c.id, valor: v })
  }

  if (usuariosAValidar.length > 0) {
    const { data } = await (supabase as any).from('perfiles').select('id').in('id', usuariosAValidar)
    if ((data ?? []).length !== new Set(usuariosAValidar).size) return { ok: false, error: 'Un funcionario seleccionado no existe' }
  }
  return { ok: true, filas, fechaRequerida }
}

interface DatosInsercion {
  solicitante: PerfilSolicitante
  area: string | null
  sede: string | null
  tipologia: TipologiaFila
  impacto: ImpactoTicket
  asunto: string
  descripcion: string
  valores: { campo_id: string; valor: string }[]
  fechaRequerida: string | null
  ticketPadreId?: string | null
  plantillaId?: string | null
  /** Quien ejecuta la acción (normalmente el solicitante) */
  usuarioId: string
  metadataCreacion?: Record<string, unknown>
  /** Antes de registrar el historial; si falla, el ticket se borra */
  extras?: (ticketId: string) => Promise<string | null>
}

/**
 * Inserta el ticket con su estado inicial, valores y eventos del historial.
 * Si algo falla antes del historial, borra el ticket (las tablas hijas caen en cascada).
 */
async function insertarTicket(
  supabase: SupabaseClient,
  d: DatosInsercion,
): Promise<{ id: string; numero: number; estado: EstadoTicket; prioridad: PrioridadTicket }> {
  const esAuditoriaVencida =
    norm(d.tipologia.categoria?.nombre) === 'auditoria' && !!d.fechaRequerida && d.fechaRequerida < hoyISO()
  const prioridad = calcularPrioridad({
    impacto: d.impacto,
    tipoGestion: d.tipologia.tipo_gestion,
    prioridadDefecto: d.tipologia.prioridad_defecto,
    esAuditoriaVencida,
  })

  const ahora = new Date().toISOString()
  let estado: EstadoTicket = 'ABIERTO'
  let responsableId: string | null = null
  let aprobadorId: string | null = null
  if (d.tipologia.requiere_aprobacion) {
    estado = 'ESPERA_APROBACION'
    aprobadorId = d.solicitante.jefe_id ?? null
  } else if (d.tipologia.responsable_defecto_id) {
    estado = 'ASIGNADO'
    responsableId = d.tipologia.responsable_defecto_id
  }

  const { data: ticket, error } = await (supabase as any)
    .from('tickets')
    .insert({
      solicitante_id: d.solicitante.id,
      area: d.area,
      sede: d.sede,
      categoria_id: d.tipologia.categoria_id,
      tipologia_id: d.tipologia.id,
      impacto: d.impacto,
      prioridad,
      estado,
      responsable_id: responsableId,
      aprobador_id: aprobadorId,
      ticket_padre_id: d.ticketPadreId ?? null,
      plantilla_id: d.plantillaId ?? null,
      canal: 'FORMULARIO',
      asunto: d.asunto.slice(0, 300),
      descripcion: d.descripcion,
      fecha_requerida: d.fechaRequerida,
      fecha_creacion: ahora,
      fecha_asignacion: responsableId ? ahora : null,
      updated_at: ahora,
    })
    .select('id, numero')
    .single()
  if (error || !ticket) throw new Error(error?.message ?? 'No se pudo crear el ticket')

  const borrar = async () => { await (supabase as any).from('tickets').delete().eq('id', ticket.id) }

  try {
    if (d.valores.length > 0) {
      const { error: eVal } = await (supabase as any)
        .from('ticket_valores_campo')
        .insert(d.valores.map(v => ({ ticket_id: ticket.id, campo_id: v.campo_id, valor: v.valor })))
      if (eVal) throw new Error(eVal.message)
    }
    if (d.extras) {
      const err = await d.extras(ticket.id)
      if (err) throw new Error(err)
    }
  } catch (e) {
    await borrar()
    throw e
  }

  const eventos: EventoTicket[] = [{
    ticketId: ticket.id,
    tipo: 'CREACION',
    usuarioId: d.usuarioId,
    valorNuevo: 'ABIERTO',
    visibleUsuario: true,
    metadata: {
      canal: 'FORMULARIO',
      impacto: d.impacto,
      prioridad,
      tipologia_id: d.tipologia.id,
      tipologia: d.tipologia.nombre,
      categoria: d.tipologia.categoria?.nombre ?? null,
      solicitante_id: d.solicitante.id,
      ...(esAuditoriaVencida ? { auditoria_vencida: true } : {}),
      ...(d.ticketPadreId ? { ticket_padre_id: d.ticketPadreId } : {}),
      ...(d.plantillaId ? { plantilla_id: d.plantillaId } : {}),
      ...(d.metadataCreacion ?? {}),
    },
  }]
  if (estado === 'ESPERA_APROBACION') {
    eventos.push({
      ticketId: ticket.id,
      tipo: 'CAMBIO_ESTADO',
      usuarioId: null,
      campo: 'estado',
      valorAnterior: 'ABIERTO',
      valorNuevo: 'ESPERA_APROBACION',
      comentario: aprobadorId
        ? 'La tipología requiere aprobación del jefe inmediato'
        : 'La tipología requiere aprobación; el solicitante no tiene jefe configurado, la aprueba un coordinador TIN',
      visibleUsuario: true,
      metadata: { aprobador_id: aprobadorId, automatico: true },
    })
  } else if (estado === 'ASIGNADO') {
    eventos.push(
      {
        ticketId: ticket.id,
        tipo: 'ASIGNACION',
        usuarioId: null,
        campo: 'responsable_id',
        valorAnterior: null,
        valorNuevo: responsableId,
        comentario: 'Asignado por regla automática',
        metadata: { regla: 'responsable_defecto', automatico: true },
      },
      {
        ticketId: ticket.id,
        tipo: 'CAMBIO_ESTADO',
        usuarioId: null,
        campo: 'estado',
        valorAnterior: 'ABIERTO',
        valorNuevo: 'ASIGNADO',
        comentario: 'Asignado por regla automática',
        visibleUsuario: true,
        metadata: { automatico: true },
      },
    )
  }
  await registrarEventos(supabase, eventos)

  return { id: ticket.id, numero: Number(ticket.numero), estado, prioridad }
}

async function registrarEventosAdjuntos(supabase: SupabaseClient, ticketId: string, usuarioId: string, filas: Record<string, unknown>[]) {
  if (filas.length === 0) return
  await registrarEventos(supabase, filas.map(f => ({
    ticketId,
    tipo: 'ADJUNTO' as const,
    usuarioId,
    valorNuevo: String(f.nombre_archivo),
    visibleUsuario: true,
    metadata: { url: f.url, tipo_archivo: f.tipo_archivo, tamano: f.tamano },
  })))
}

async function buscarTipologiaPorNombre(supabase: SupabaseClient, categoria: string, tipologia: string): Promise<TipologiaFila | null> {
  const { data } = await (supabase as any).from('ticket_tipologias').select(SELECT_TIPOLOGIA).eq('activa', true)
  const t = ((data ?? []) as TipologiaFila[]).find(x =>
    norm(x.nombre) === norm(tipologia) && norm(x.categoria?.nombre) === norm(categoria) && x.categoria?.activa !== false)
  return t ?? null
}

async function avisarCreacion(ids: string[]) {
  for (const id of ids) {
    try {
      await despuesDeCrearTicket(id)
    } catch (e) {
      console.error('[tickets] despuesDeCrearTicket', id, e)
    }
  }
}

function refrescar() {
  revalidatePath('/mis-tickets')
  revalidatePath('/admin/tickets')
}

// ── Catálogo del formulario ─────────────────────────────────────────────────

export async function obtenerCatalogoFormulario(): Promise<CatalogoFormulario | null> {
  const acceso = await accesoTickets()
  if (!acceso) return null
  const supabase = createAdminClient()

  const [cats, tips, perfil, config, usuarios] = await Promise.all([
    (supabase as any).from('ticket_categorias').select('id, nombre, descripcion').eq('activa', true)
      .order('orden', { ascending: true }).order('nombre', { ascending: true }),
    (supabase as any).from('ticket_tipologias')
      .select('id, categoria_id, nombre, descripcion_ayuda, tipo_gestion, se_mide_contra, prioridad_defecto, requiere_aprobacion, visibilidad_restringida, adjunto_obligatorio, es_novedad_igsi')
      .eq('activa', true).order('orden', { ascending: true }).order('nombre', { ascending: true }),
    cargarPerfil(supabase, acceso.usuarioId),
    obtenerConfigTickets(supabase),
    (supabase as any).from('perfiles').select('id, nombre_completo').eq('activo', true).order('nombre_completo'),
  ])

  const categorias = (cats.data ?? []) as CatalogoFormulario['categorias']
  const idsCat = new Set(categorias.map(c => c.id))
  const verRestringidas = acceso.esAdmin || acceso.restringidas
  const tipologias = ((tips.data ?? []) as CatalogoFormulario['tipologias'])
    .filter(t => idsCat.has(t.categoria_id) && (!t.visibilidad_restringida || verRestringidas))

  let campos: TicketCampoTipologia[] = []
  if (tipologias.length > 0) {
    const { data } = await (supabase as any)
      .from('ticket_campos_tipologia')
      .select('*')
      .in('tipologia_id', tipologias.map(t => t.id))
      .eq('activo', true)
      .order('orden', { ascending: true })
    campos = (data ?? []) as TicketCampoTipologia[]
  }

  let jefeNombre: string | null = null
  if (perfil?.jefe_id) {
    const jefe = await cargarPerfil(supabase, perfil.jefe_id)
    jefeNombre = jefe?.nombre_completo ?? null
  }

  return {
    categorias: categorias.filter(c => tipologias.some(t => t.categoria_id === c.id)),
    tipologias,
    campos,
    serviciosIGSI: config.serviciosIGSI ?? {},
    usuarios: (usuarios.data ?? []) as { id: string; nombre_completo: string }[],
    solicitante: {
      id: acceso.usuarioId,
      nombre: perfil?.nombre_completo ?? '',
      area: perfil?.proceso_interno ?? null,
      sede: perfil?.sede ?? null,
      jefeNombre,
    },
    puedePlantillas: acceso.esAdmin || acceso.atender || acceso.coordinar,
  }
}

// ── Crear ticket ────────────────────────────────────────────────────────────

const RE_BUG = /\bB\s*-\s*(\d{1,7})\b/gi

export async function crearTicket(input: CrearTicketInput): Promise<ResultadoCrear> {
  try {
    const acceso = await accesoTickets()
    if (!acceso) return { ok: false, error: 'Debes iniciar sesión' }
    if (!input || typeof input !== 'object') return { ok: false, error: 'Datos inválidos' }

    const supabase = createAdminClient()

    // Tipología activa, de categoría activa y visible para el usuario
    const { data: tip } = await (supabase as any)
      .from('ticket_tipologias').select(SELECT_TIPOLOGIA).eq('id', String(input.tipologiaId ?? '')).maybeSingle()
    const tipologia = tip as TipologiaFila | null
    if (!tipologia || !tipologia.activa || !tipologia.categoria?.activa) {
      return { ok: false, error: 'La tipología seleccionada no está disponible' }
    }
    if (tipologia.visibilidad_restringida && !(acceso.esAdmin || acceso.restringidas)) {
      return { ok: false, error: NO_AUTORIZADO }
    }

    const perfil = await cargarPerfil(supabase, acceso.usuarioId)
    if (!perfil) return { ok: false, error: 'No se encontró tu perfil' }

    // Novedad IGSI
    let impacto = input.impacto
    let asunto = String(input.asunto ?? '').trim()
    let descripcion = String(input.descripcion ?? '').trim()
    let filaIgsi: Record<string, unknown> | null = null

    if (tipologia.es_novedad_igsi) {
      const n = input.igsi
      if (!n) return { ok: false, error: 'Completa el formulario de la novedad IGSI' }
      const doc = CADENA_IGSI.find(c => c.value === n.tipo_documento)
      if (!doc) return { ok: false, error: 'Elige el documento afectado' }
      const docOtro = String(n.tipo_documento_otro ?? '').trim()
      if (doc.value === 'OTRO' && !docOtro) return { ok: false, error: 'Indica cuál es el documento afectado' }
      const numero = String(n.numero_documento ?? '').trim()
      if (!numero && !n.sin_numero) return { ok: false, error: 'Escribe el número del documento (o marca que no se pudo crear)' }
      const servicio = String(n.servicio ?? '').trim()
      const modalidad = String(n.modalidad ?? '').trim()
      if (!servicio) return { ok: false, error: 'Elige el servicio' }
      if (!modalidad) return { ok: false, error: 'Elige la modalidad' }
      const { serviciosIGSI } = await obtenerConfigTickets(supabase)
      if (Object.keys(serviciosIGSI).length > 0) {
        const mods = serviciosIGSI[servicio]
        if (!mods) return { ok: false, error: 'El servicio elegido no es válido' }
        if (mods.length > 0 && !mods.includes(modalidad)) return { ok: false, error: 'La modalidad no corresponde al servicio' }
      }
      const accion = ACCIONES_IGSI.find(a => a.value === n.accion)
      if (!accion) return { ok: false, error: 'Elige la acción que intentabas hacer' }
      const quePaso = String(n.que_paso ?? '').trim()
      const queEsperaba = String(n.que_esperaba ?? '').trim()
      if (!quePaso) return { ok: false, error: 'Describe qué pasó' }
      if (!queEsperaba) return { ok: false, error: 'Describe qué esperabas que pasara' }
      if (n.validacion_previa !== true) return { ok: false, error: 'Confirma que revisaste los datos del documento antes de reportar' }
      const impOp = IMPACTOS_OPERACION_IGSI.find(i => i.value === n.impacto_operacion)
      if (!impOp) return { ok: false, error: 'Indica el impacto en la operación' }
      if (!(input.adjuntos ?? []).some(a => String(a?.tipo_archivo ?? '').startsWith('image/'))) {
        return { ok: false, error: 'Adjunta al menos una captura de pantalla de la novedad' }
      }

      impacto = impOp.impacto
      const docLabel = doc.value === 'OTRO' ? docOtro : doc.label
      if (!asunto) asunto = `Novedad IGSI · ${docLabel} ${numero || '(sin número)'} · ${accion.label}`
      if (!descripcion) {
        descripcion = [
          `Qué pasó: ${quePaso}`,
          `Qué esperaba: ${queEsperaba}`,
          n.mensaje_error ? `Mensaje de error: ${String(n.mensaje_error).trim()}` : null,
        ].filter(Boolean).join('\n')
      }
      filaIgsi = {
        tipo_documento: doc.value,
        tipo_documento_otro: doc.value === 'OTRO' ? docOtro : null,
        numero_documento: numero || null,
        documentos_relacionados: String(n.documentos_relacionados ?? '').trim() || null,
        servicio,
        modalidad,
        accion: accion.value,
        que_paso: quePaso,
        que_esperaba: queEsperaba,
        mensaje_error: String(n.mensaje_error ?? '').trim() || null,
        validacion_previa: true,
        impacto_operacion: impOp.value,
      }
    }

    if (!IMPACTOS_TICKET.some(i => i.value === impacto)) return { ok: false, error: 'Elige el impacto' }
    if (!asunto) return { ok: false, error: 'Escribe el asunto' }
    if (asunto.length > 300) return { ok: false, error: 'El asunto es demasiado largo (máx. 300 caracteres)' }
    if (!descripcion) return { ok: false, error: 'Escribe la descripción' }
    if (descripcion.length > 20000) return { ok: false, error: 'La descripción es demasiado larga' }

    // Campos específicos
    const campos = await cargarCampos(supabase, tipologia.id)
    const val = await validarValores(supabase, campos, input.valores ?? {}, true)
    if (!val.ok) return { ok: false, error: val.error }

    // Adjuntos
    const adjuntos = input.adjuntos ?? []
    const adj = filasAdjuntos('__pendiente__', adjuntos, acceso.usuarioId)
    if (!adj.ok) return { ok: false, error: adj.error }
    if (tipologia.adjunto_obligatorio && !adj.filas.some(f => f.es_imagen)) {
      return { ok: false, error: 'Esta tipología exige al menos una imagen o captura de pantalla' }
    }

    const creado = await insertarTicket(supabase, {
      solicitante: perfil,
      area: perfil.proceso_interno,
      sede: perfil.sede,
      tipologia,
      impacto,
      asunto,
      descripcion,
      valores: val.filas,
      fechaRequerida: val.fechaRequerida,
      usuarioId: acceso.usuarioId,
      metadataCreacion: { adjuntos: adj.filas.length, ...(filaIgsi ? { novedad_igsi: true } : {}) },
      extras: async ticketId => {
        if (filaIgsi) {
          const { error } = await (supabase as any).from('ticket_novedades_igsi').insert({ ticket_id: ticketId, ...filaIgsi })
          if (error) return error.message
        }
        if (adj.filas.length > 0) {
          const { error } = await (supabase as any)
            .from('ticket_adjuntos').insert(adj.filas.map(f => ({ ...f, ticket_id: ticketId })))
          if (error) return error.message
        }
        return null
      },
    })
    await registrarEventosAdjuntos(supabase, creado.id, acceso.usuarioId, adj.filas)

    const creados = [creado.id]
    const hijos: string[] = []
    const nombreTip = norm(tipologia.nombre)
    const nombreCat = norm(tipologia.categoria?.nombre)

    // Regla: atención de hallazgo (Auditoría) → hijo en Sistemas de gestión / Acción correctiva o de mejora
    if (nombreCat === 'auditoria' && nombreTip === 'atencion de hallazgo') {
      try {
        const destino = await buscarTipologiaPorNombre(supabase, 'Sistemas de gestión', 'Acción correctiva o de mejora')
        if (destino) {
          const camposHijo = await cargarCampos(supabase, destino.id)
          const porClave = new Map(campos.map(c => [c.clave, val.filas.find(f => f.campo_id === c.id)?.valor]))
          const valoresHijo: Record<string, string> = {}
          for (const c of camposHijo) {
            const k = norm(c.clave)
            const copia = porClave.get(c.clave)
            if (copia) valoresHijo[c.id] = copia
            else if (k.includes('origen')) {
              const opt = (c.opciones ?? []).find(o => norm(o).includes('hallazgo'))
              valoresHijo[c.id] = c.tipo_dato === 'LISTA' ? (opt ?? '') : 'Hallazgo de auditoría'
            } else if (k.includes('padre')) valoresHijo[c.id] = codigoTicket(creado.numero)
            else if (k.includes('descripcion')) valoresHijo[c.id] = descripcion
            else if (c.tipo_dato === 'FECHA' && c.es_fecha_requerida && val.fechaRequerida) valoresHijo[c.id] = val.fechaRequerida
          }
          const valHijo = await validarValores(supabase, camposHijo, valoresHijo, false)
          const hijo = await insertarTicket(supabase, {
            solicitante: perfil,
            area: perfil.proceso_interno,
            sede: perfil.sede,
            tipologia: destino,
            impacto,
            asunto: `Acción correctiva: ${asunto}`.slice(0, 300),
            descripcion: `Generado por el hallazgo de auditoría ${codigoTicket(creado.numero)}.\n\n${descripcion}`,
            valores: valHijo.ok ? valHijo.filas : [],
            fechaRequerida: valHijo.ok ? (valHijo.fechaRequerida ?? val.fechaRequerida) : val.fechaRequerida,
            ticketPadreId: creado.id,
            usuarioId: acceso.usuarioId,
            metadataCreacion: { origen: 'HALLAZGO_AUDITORIA' },
          })
          creados.push(hijo.id)
          hijos.push(codigoTicket(hijo.numero))
        } else {
          console.warn('[tickets] No existe la tipología "Sistemas de gestión / Acción correctiva o de mejora"; no se creó el ticket hijo')
        }
      } catch (e) {
        console.error('[tickets] Error al crear el ticket hijo del hallazgo', e)
      }
    }

    // Regla: pruebas de desarrollos con número de bug → enlazar (y en "Prueba con fallas", devolver a En desarrollo)
    const esPruebaFallas = nombreTip === 'prueba con fallas'
    if (esPruebaFallas || nombreTip === 'prueba de correccion de bug') {
      try {
        const numeros = new Set<number>()
        for (const f of val.filas) for (const m of f.valor.matchAll(RE_BUG)) numeros.add(Number(m[1]))
        if (numeros.size > 0) {
          const { data: bugs } = await (supabase as any)
            .from('ticket_bugs').select('id, numero, estado').in('numero', [...numeros])
          for (const b of (bugs ?? []) as { id: string; numero: number; estado: string }[]) {
            await enlazarTicketABug(supabase, creado.id, b.id, acceso.usuarioId)
            if (esPruebaFallas && b.estado !== 'EN_DESARROLLO') {
              const { error } = await (supabase as any)
                .from('ticket_bugs').update({ estado: 'EN_DESARROLLO', updated_at: new Date().toISOString() }).eq('id', b.id)
              if (!error) {
                await registrarEvento(supabase, {
                  ticketId: creado.id,
                  tipo: 'COMENTARIO',
                  usuarioId: null,
                  comentario: `El bug B-${String(b.numero).padStart(3, '0')} volvió a En desarrollo por una prueba con fallas`,
                  metadata: { bug_id: b.id, estado_anterior: b.estado, estado_nuevo: 'EN_DESARROLLO', automatico: true },
                })
              }
            }
          }
        }
      } catch (e) {
        console.error('[tickets] Error al enlazar el ticket con el bug', e)
      }
    }

    await avisarCreacion(creados)
    refrescar()
    return { ok: true, id: creado.id, codigo: codigoTicket(creado.numero), hijos }
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'Error al crear el ticket' }
  }
}

// ── Plantillas de ingreso y retiro ──────────────────────────────────────────

async function puedeUsarPlantillas() {
  const acceso = await accesoTickets()
  if (!acceso) return null
  return acceso.esAdmin || acceso.atender || acceso.coordinar ? acceso : null
}

export async function obtenerDatosPlantilla(): Promise<DatosPlantillaFormulario | null> {
  const acceso = await puedeUsarPlantillas()
  if (!acceso) return null
  const supabase = createAdminClient()
  const [pls, config, procesos] = await Promise.all([
    (supabase as any)
      .from('ticket_plantillas')
      .select('id, nombre, descripcion, items:ticket_plantilla_items(id, asunto, orden, tipologia:ticket_tipologias(nombre, activa, categoria:ticket_categorias(nombre, activa)))')
      .eq('activa', true)
      .order('nombre'),
    obtenerConfigTickets(supabase),
    getProcesosInternos(),
  ])
  const plantillas = ((pls.data ?? []) as any[]).map(p => ({
    id: p.id as string,
    nombre: p.nombre as string,
    descripcion: (p.descripcion ?? null) as string | null,
    items: ((p.items ?? []) as any[])
      .map(i => ({
        id: i.id as string,
        asunto: (i.asunto ?? null) as string | null,
        orden: Number(i.orden ?? 0),
        tipologia: (i.tipologia?.nombre ?? '') as string,
        categoria: (i.tipologia?.categoria?.nombre ?? '') as string,
        activa: !!i.tipologia?.activa && i.tipologia?.categoria?.activa !== false,
      }))
      .sort((a, b) => a.orden - b.orden),
  }))
  return {
    plantillas,
    sedes: config.sedes ?? [],
    areas: procesos.filter(p => p.activo !== false).map(p => ({ value: p.value, label: p.label })),
  }
}

/** Pre-llena un campo del hijo con los datos del funcionario, si el nombre del campo coincide */
function valorPrellenado(c: TicketCampoTipologia, d: CrearDesdePlantillaInput): string | null {
  if (c.tipo_dato === 'USUARIO' || c.tipo_dato === 'CASILLA' || c.tipo_dato === 'NUMERO' || c.tipo_dato === 'LISTA') return null
  const k = `${norm(c.clave)} ${norm(c.etiqueta)}`
  if (c.tipo_dato === 'FECHA') return c.es_fecha_requerida || k.includes('fecha') ? d.fecha : null
  const esFuncionario = k.includes('funcionario') || k.includes('nombre') || k.includes('usuario que')
  const esCargo = k.includes('cargo')
  if (esFuncionario && esCargo) return `${d.nombre} — ${d.cargo}`
  if (esCargo) return d.cargo || null
  if (esFuncionario) return d.nombre
  if (k.includes('sede')) return d.sede || null
  if (k.includes('area')) return d.area || null
  return null
}

/**
 * Crea un ticket padre y un ticket hijo por cada item de la plantilla.
 * Supuesto: el padre se crea en "Otros / Sin clasificar" (es un ticket que agrupa); si esa tipología
 * no existe o está inactiva, usa la tipología del primer item activo.
 */
export async function crearTicketsDesdePlantilla(input: CrearDesdePlantillaInput): Promise<ResultadoCrear> {
  try {
    const acceso = await puedeUsarPlantillas()
    if (!acceso) return { ok: false, error: NO_AUTORIZADO }

    const d: CrearDesdePlantillaInput = {
      plantillaId: String(input?.plantillaId ?? ''),
      nombre: String(input?.nombre ?? '').trim(),
      cargo: String(input?.cargo ?? '').trim(),
      area: String(input?.area ?? '').trim(),
      sede: String(input?.sede ?? '').trim(),
      fecha: String(input?.fecha ?? '').trim(),
      observaciones: String(input?.observaciones ?? '').trim(),
    }
    if (!d.nombre) return { ok: false, error: 'Escribe el nombre del funcionario' }
    if (!d.cargo) return { ok: false, error: 'Escribe el cargo' }
    if (!FECHA_RE.test(d.fecha) || Number.isNaN(Date.parse(d.fecha))) return { ok: false, error: 'Indica una fecha válida' }

    const supabase = createAdminClient()
    const { data: plantilla } = await (supabase as any)
      .from('ticket_plantillas')
      .select('id, nombre, activa, items:ticket_plantilla_items(id, tipologia_id, asunto, orden)')
      .eq('id', d.plantillaId)
      .maybeSingle()
    if (!plantilla || !plantilla.activa) return { ok: false, error: 'La plantilla no está disponible' }

    const items = ((plantilla.items ?? []) as { id: string; tipologia_id: string; asunto: string | null; orden: number }[])
      .sort((a, b) => a.orden - b.orden)
    const { data: tips } = await (supabase as any)
      .from('ticket_tipologias').select(SELECT_TIPOLOGIA).in('id', items.map(i => i.tipologia_id))
    const tipPorId = new Map(((tips ?? []) as TipologiaFila[]).map(t => [t.id, t]))
    const itemsActivos = items.filter(i => {
      const t = tipPorId.get(i.tipologia_id)
      return t && t.activa && t.categoria?.activa !== false
    })
    if (itemsActivos.length === 0) return { ok: false, error: 'La plantilla no tiene tipologías activas' }

    const perfil = await cargarPerfil(supabase, acceso.usuarioId)
    if (!perfil) return { ok: false, error: 'No se encontró tu perfil' }

    const tipPadre =
      (await buscarTipologiaPorNombre(supabase, CATEGORIA_OTROS, 'Sin clasificar')) ??
      tipPorId.get(itemsActivos[0].tipologia_id)!

    // Área y sede del ticket: las del funcionario que ingresa/se retira; si no se indican, las del solicitante
    const area = d.area || perfil.proceso_interno
    const sede = d.sede || perfil.sede
    const detalle = [
      `Plantilla: ${plantilla.nombre}`,
      `Funcionario: ${d.nombre}`,
      `Cargo: ${d.cargo}`,
      d.area ? `Área: ${d.area}` : null,
      d.sede ? `Sede: ${d.sede}` : null,
      `Fecha: ${d.fecha}`,
      d.observaciones ? `\nObservaciones: ${d.observaciones}` : null,
    ].filter(Boolean).join('\n')

    const padre = await insertarTicket(supabase, {
      solicitante: perfil,
      area,
      sede,
      tipologia: tipPadre,
      impacto: 'SOLO_YO',
      asunto: `${plantilla.nombre}: ${d.nombre}`,
      descripcion: detalle,
      valores: [],
      fechaRequerida: d.fecha,
      plantillaId: plantilla.id,
      usuarioId: acceso.usuarioId,
      metadataCreacion: { plantilla: plantilla.nombre, rol_plantilla: 'PADRE', items: itemsActivos.length },
    })

    const creados = [padre.id]
    const hijos: string[] = []
    const errores: string[] = []
    for (const item of itemsActivos) {
      const tip = tipPorId.get(item.tipologia_id)!
      try {
        const campos = await cargarCampos(supabase, tip.id)
        const valores: Record<string, string> = {}
        for (const c of campos) {
          const v = valorPrellenado(c, d)
          if (v) valores[c.id] = v
        }
        const val = await validarValores(supabase, campos, valores, false)
        const hijo = await insertarTicket(supabase, {
          solicitante: perfil,
          area,
          sede,
          tipologia: tip,
          impacto: 'SOLO_YO',
          asunto: `${item.asunto?.trim() || tip.nombre} · ${d.nombre}`,
          descripcion: detalle,
          valores: val.ok ? val.filas : [],
          fechaRequerida: (val.ok ? val.fechaRequerida : null) ?? d.fecha,
          ticketPadreId: padre.id,
          plantillaId: plantilla.id,
          usuarioId: acceso.usuarioId,
          metadataCreacion: { plantilla: plantilla.nombre, rol_plantilla: 'HIJO', plantilla_item_id: item.id },
        })
        creados.push(hijo.id)
        hijos.push(codigoTicket(hijo.numero))
      } catch (e: any) {
        errores.push(`${tip.nombre}: ${e?.message ?? 'error'}`)
      }
    }

    await avisarCreacion(creados)
    refrescar()
    return {
      ok: true,
      id: padre.id,
      codigo: codigoTicket(padre.numero),
      hijos,
      ...(errores.length > 0 ? { error: `No se pudieron crear algunos tickets hijos: ${errores.join('; ')}` } : {}),
    }
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'Error al crear los tickets de la plantilla' }
  }
}
