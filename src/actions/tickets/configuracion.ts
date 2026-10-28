'use server'

// Configuración del módulo Tickets: catálogo, campos por tipología, causas de cierre,
// tiempos objetivo, calendario laboral, recordatorios, plantillas y parámetros.
// Todas las escrituras exigen el permiso `menu:tickets-config` (ADMIN_TIN lo tiene siempre).

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getUsuarioActual, puedeGestionar, NO_AUTORIZADO } from '@/lib/supabase/guards'
import { obtenerConfigTickets, type ConfigTickets } from '@/lib/tickets/config'
import { CONFIG_CLAVES, RECURSOS_TICKETS, ZONA_HORARIA } from '@/lib/tickets/constantes'
import type {
  AccionRecordatorio,
  AmbitoCausa,
  CanalRecordatorio,
  DestinatarioRecordatorio,
  DisparadorRecordatorio,
  HorarioLaboral,
  PrioridadTicket,
  SeMideContra,
  ServiciosIGSI,
  TicketCalendarioDia,
  TicketCampoTipologia,
  TicketCategoria,
  TicketCausa,
  TicketObjetivoTiempo,
  TicketPlantilla,
  TicketPlantillaItem,
  TicketReglaRecordatorio,
  TicketTipologia,
  TipoDatoCampo,
  TipoGestion,
} from '@/lib/tickets/types'

type Resultado = { ok: boolean; error?: string }

const RUTA = '/admin/tickets-configuracion'

const PRIORIDADES: PrioridadTicket[] = ['CRITICA', 'ALTA', 'MEDIA', 'BAJA']
const TIPOS_GESTION: TipoGestion[] = ['INCIDENTE', 'SOLICITUD', 'PLANIFICADA']
const MEDICIONES: SeMideContra[] = ['SLA', 'FECHA', 'FECHA_SIN_APROBACION']
const TIPOS_DATO: TipoDatoCampo[] = ['TEXTO', 'TEXTO_LARGO', 'NUMERO', 'FECHA', 'LISTA', 'CASILLA', 'USUARIO']
const DISPARADORES: DisparadorRecordatorio[] = ['RESPUESTA', 'SOLUCION', 'ESPERA_USUARIO', 'ESPERA_APROBACION', 'FECHA_REQUERIDA', 'RESUMEN_DIARIO']
const DESTINATARIOS: DestinatarioRecordatorio[] = ['RESPONSABLE', 'COORDINADOR', 'DIRECCION', 'SOLICITANTE', 'JEFE_SOLICITANTE', 'APROBADOR']
const CANALES: CanalRecordatorio[] = ['APP', 'CORREO', 'AMBOS']
const ACCIONES: AccionRecordatorio[] = ['MARCAR_RESPUESTA_VENCIDA', 'MARCAR_VENCIDO', 'CIERRE_AUTOMATICO']

// ── Utilidades internas ──────────────────────────────────────────────────────

async function autorizado(): Promise<boolean> {
  return puedeGestionar(RECURSOS_TICKETS.MENU_CONFIG)
}

// Mismo patrón del repo: (supabase as any) porque las tablas de tickets no están en los tipos generados
function db() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createAdminClient() as any
}

function refrescar() {
  revalidatePath(RUTA)
}

function fallo(e: unknown, def: string): Resultado {
  return { ok: false, error: (e as { message?: string })?.message ?? def }
}

function textoONull(v: string | null | undefined): string | null {
  const t = (v ?? '').trim()
  return t ? t : null
}

/** Fecha de hoy (YYYY-MM-DD) en la zona horaria del módulo */
function hoyISO(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONA_HORARIA, year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date())
}

function esFechaISO(v: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v))
}

function esHora(v: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(v)
}

function esCorreo(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
}

/** Clave estable snake_case a partir de un texto (sin tildes) */
function claveDesdeTexto(texto: string): string {
  return texto
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 50)
}

async function siguienteOrden(tabla: string, filtro?: { col: string; val: string }): Promise<number> {
  let q = db().from(tabla).select('orden').order('orden', { ascending: false }).limit(1)
  if (filtro) q = q.eq(filtro.col, filtro.val)
  const { data } = await q
  return ((data?.[0]?.orden as number | undefined) ?? 0) + 10
}

/**
 * Intercambia el elemento con su vecino y renumera el grupo de 10 en 10,
 * para que el orden sea estable aunque haya valores repetidos.
 */
async function moverEnGrupo(
  tabla: string,
  id: string,
  direccion: 'arriba' | 'abajo',
  filtro?: { col: string; val: string },
  ordenSecundario = 'id',
): Promise<Resultado> {
  let q = db().from(tabla).select('id, orden').order('orden', { ascending: true }).order(ordenSecundario, { ascending: true })
  if (filtro) q = q.eq(filtro.col, filtro.val)
  const { data, error } = await q
  if (error) return { ok: false, error: error.message }
  const lista = (data ?? []) as { id: string; orden: number }[]
  const i = lista.findIndex(x => x.id === id)
  const j = direccion === 'arriba' ? i - 1 : i + 1
  if (i < 0 || j < 0 || j >= lista.length) return { ok: true }
  ;[lista[i], lista[j]] = [lista[j], lista[i]]
  return renumerar(tabla, lista)
}

async function renumerar(tabla: string, lista: { id: string; orden: number }[]): Promise<Resultado> {
  for (const [k, x] of lista.entries()) {
    const orden = (k + 1) * 10
    if (x.orden === orden) continue
    const { error } = await db().from(tabla).update({ orden }).eq('id', x.id)
    if (error) return { ok: false, error: error.message }
  }
  return { ok: true }
}

async function contar(tabla: string, col: string, val: string): Promise<number> {
  const { count } = await db().from(tabla).select(col, { count: 'exact', head: true }).eq(col, val)
  return count ?? 0
}

// ── Lectura de toda la configuración ─────────────────────────────────────────

export type PerfilResponsable = { id: string; nombre_completo: string; rol: string; email: string }

export type DatosConfigTickets = {
  categorias: TicketCategoria[]
  tipologias: TicketTipologia[]
  campos: TicketCampoTipologia[]
  causas: TicketCausa[]
  objetivos: TicketObjetivoTiempo[]
  calendario: TicketCalendarioDia[]
  reglas: TicketReglaRecordatorio[]
  plantillas: TicketPlantilla[]
  plantillaItems: TicketPlantillaItem[]
  config: ConfigTickets
  /** Perfiles activos que pueden ser responsables (tickets:atender o ADMIN_TIN) */
  responsables: PerfilResponsable[]
  /** Tickets existentes por tipología (para advertir antes de desactivar) */
  ticketsPorTipologia: Record<string, number>
  hoy: string
}

/** Perfiles activos con permiso `tickets:atender` o rol ADMIN_TIN */
async function cargarResponsables(): Promise<PerfilResponsable[]> {
  const supabase = db()
  const { data: permisos } = await supabase
    .from('permisos_rol')
    .select('rol_id')
    .eq('recurso', RECURSOS_TICKETS.ATENDER)
    .eq('puede_ver', true)
  const rolIds = (permisos ?? []).map((p: { rol_id: string }) => p.rol_id)
  let roles: string[] = ['ADMIN_TIN']
  if (rolIds.length) {
    const { data: rs } = await supabase.from('roles_personalizados').select('nombre').in('id', rolIds)
    roles = [...new Set([...roles, ...(rs ?? []).map((r: { nombre: string }) => r.nombre)])]
  }
  const { data } = await supabase
    .from('perfiles')
    .select('id, nombre_completo, rol, email')
    .eq('activo', true)
    .in('rol', roles)
    .order('nombre_completo')
  return (data ?? []) as PerfilResponsable[]
}

export async function obtenerDatosConfigTickets(): Promise<DatosConfigTickets | null> {
  if (!(await autorizado())) return null
  const supabase = db()
  const [cat, tip, cam, cau, obj, cal, reg, pla, ite, tks, config, responsables] = await Promise.all([
    supabase.from('ticket_categorias').select('*').order('orden').order('nombre'),
    supabase.from('ticket_tipologias').select('*').order('orden').order('nombre'),
    supabase.from('ticket_campos_tipologia').select('*').order('orden').order('etiqueta'),
    supabase.from('ticket_causas').select('*').order('ambito').order('orden').order('subcausa'),
    supabase.from('ticket_objetivos_tiempo').select('*').order('vigente_desde', { ascending: false }),
    supabase.from('ticket_calendario').select('*').order('fecha'),
    supabase.from('ticket_reglas_recordatorio').select('*').order('orden').order('nombre'),
    supabase.from('ticket_plantillas').select('*').order('nombre'),
    supabase.from('ticket_plantilla_items').select('*').order('orden'),
    supabase.from('tickets').select('tipologia_id'),
    obtenerConfigTickets(supabase),
    cargarResponsables(),
  ])
  const ticketsPorTipologia: Record<string, number> = {}
  for (const t of (tks.data ?? []) as { tipologia_id: string }[]) {
    ticketsPorTipologia[t.tipologia_id] = (ticketsPorTipologia[t.tipologia_id] ?? 0) + 1
  }
  return {
    categorias: cat.data ?? [],
    tipologias: tip.data ?? [],
    campos: cam.data ?? [],
    causas: cau.data ?? [],
    objetivos: (obj.data ?? []).map((o: TicketObjetivoTiempo) => ({
      ...o, horas_respuesta: Number(o.horas_respuesta), horas_solucion: Number(o.horas_solucion),
    })),
    calendario: cal.data ?? [],
    reglas: (reg.data ?? []).map((r: TicketReglaRecordatorio) => ({
      ...r,
      porcentaje: r.porcentaje == null ? null : Number(r.porcentaje),
      dias_habiles: r.dias_habiles == null ? null : Number(r.dias_habiles),
    })),
    plantillas: pla.data ?? [],
    plantillaItems: ite.data ?? [],
    config,
    responsables,
    ticketsPorTipologia,
    hoy: hoyISO(),
  }
}

/**
 * Campos activos de una tipología, en orden. Lectura del catálogo: cualquier usuario autenticado
 * (lo usa la vista previa y puede usarlo el formulario del funcionario).
 */
export async function obtenerCamposTipologia(tipologiaId: string): Promise<TicketCampoTipologia[]> {
  const actual = await getUsuarioActual()
  if (!actual) return []
  const { data } = await db()
    .from('ticket_campos_tipologia')
    .select('*')
    .eq('tipologia_id', tipologiaId)
    .eq('activo', true)
    .order('orden')
  return (data ?? []) as TicketCampoTipologia[]
}

// ── Categorías ───────────────────────────────────────────────────────────────

export async function crearCategoria(datos: { nombre: string; descripcion?: string | null }): Promise<Resultado> {
  if (!(await autorizado())) return { ok: false, error: NO_AUTORIZADO }
  try {
    const nombre = datos.nombre.trim()
    if (!nombre) return { ok: false, error: 'Escribe el nombre de la categoría' }
    const orden = await siguienteOrden('ticket_categorias')
    const { error } = await db().from('ticket_categorias').insert({
      nombre, descripcion: textoONull(datos.descripcion), orden, activa: true,
    })
    if (error) return { ok: false, error: error.code === '23505' ? `Ya existe la categoría "${nombre}"` : error.message }
    refrescar()
    return { ok: true }
  } catch (e) { return fallo(e, 'Error al crear la categoría') }
}

export async function actualizarCategoria(
  id: string,
  cambios: { nombre?: string; descripcion?: string | null; activa?: boolean },
): Promise<Resultado> {
  if (!(await autorizado())) return { ok: false, error: NO_AUTORIZADO }
  try {
    const datos: Record<string, unknown> = {}
    if (cambios.nombre !== undefined) {
      const nombre = cambios.nombre.trim()
      if (!nombre) return { ok: false, error: 'El nombre no puede quedar vacío' }
      datos.nombre = nombre
    }
    if (cambios.descripcion !== undefined) datos.descripcion = textoONull(cambios.descripcion)
    if (cambios.activa !== undefined) datos.activa = cambios.activa
    if (!Object.keys(datos).length) return { ok: true }
    const { error } = await db().from('ticket_categorias').update(datos).eq('id', id)
    if (error) return { ok: false, error: error.code === '23505' ? 'Ya existe una categoría con ese nombre' : error.message }
    refrescar()
    return { ok: true }
  } catch (e) { return fallo(e, 'Error al actualizar la categoría') }
}

export async function moverCategoria(id: string, direccion: 'arriba' | 'abajo'): Promise<Resultado> {
  if (!(await autorizado())) return { ok: false, error: NO_AUTORIZADO }
  try {
    const r = await moverEnGrupo('ticket_categorias', id, direccion, undefined, 'nombre')
    if (r.ok) refrescar()
    return r
  } catch (e) { return fallo(e, 'Error al reordenar') }
}

/** Solo se borra una categoría vacía; con tipologías se desactiva */
export async function eliminarCategoria(id: string): Promise<Resultado> {
  if (!(await autorizado())) return { ok: false, error: NO_AUTORIZADO }
  try {
    if (await contar('ticket_tipologias', 'categoria_id', id)) {
      return { ok: false, error: 'La categoría tiene tipologías: desactívala en lugar de borrarla' }
    }
    if (await contar('tickets', 'categoria_id', id)) {
      return { ok: false, error: 'La categoría tiene tickets: desactívala en lugar de borrarla' }
    }
    const { error } = await db().from('ticket_categorias').delete().eq('id', id)
    if (error) return { ok: false, error: error.message }
    refrescar()
    return { ok: true }
  } catch (e) { return fallo(e, 'Error al eliminar la categoría') }
}

// ── Tipologías ───────────────────────────────────────────────────────────────

export type TipologiaInput = {
  id?: string
  categoria_id: string
  nombre: string
  descripcion_ayuda?: string | null
  tipo_gestion: TipoGestion
  se_mide_contra: SeMideContra
  prioridad_defecto?: PrioridadTicket | null
  requiere_aprobacion: boolean
  visibilidad_restringida: boolean
  adjunto_obligatorio: boolean
  es_novedad_igsi: boolean
  area_responsable?: string | null
  responsable_defecto_id?: string | null
  activa: boolean
}

export async function guardarTipologia(datos: TipologiaInput): Promise<Resultado & { id?: string }> {
  if (!(await autorizado())) return { ok: false, error: NO_AUTORIZADO }
  try {
    const nombre = datos.nombre.trim()
    if (!nombre) return { ok: false, error: 'Escribe el nombre de la tipología' }
    if (!datos.categoria_id) return { ok: false, error: 'Elige la categoría' }
    if (!TIPOS_GESTION.includes(datos.tipo_gestion)) return { ok: false, error: 'Tipo de gestión no válido' }
    if (!MEDICIONES.includes(datos.se_mide_contra)) return { ok: false, error: 'Medición no válida' }
    if (datos.prioridad_defecto && !PRIORIDADES.includes(datos.prioridad_defecto)) {
      return { ok: false, error: 'Prioridad no válida' }
    }

    let responsableSinCambio = false
    if (datos.id && datos.responsable_defecto_id) {
      const { data: actual } = await db().from('ticket_tipologias').select('responsable_defecto_id').eq('id', datos.id).single()
      responsableSinCambio = actual?.responsable_defecto_id === datos.responsable_defecto_id
    }
    if (datos.responsable_defecto_id && !responsableSinCambio) {
      const validos = await cargarResponsables()
      if (!validos.some(r => r.id === datos.responsable_defecto_id)) {
        return { ok: false, error: 'El responsable por defecto debe ser un perfil activo que pueda atender tickets' }
      }
    }

    const fila = {
      categoria_id: datos.categoria_id,
      nombre,
      descripcion_ayuda: textoONull(datos.descripcion_ayuda),
      tipo_gestion: datos.tipo_gestion,
      se_mide_contra: datos.se_mide_contra,
      prioridad_defecto: datos.prioridad_defecto || null,
      requiere_aprobacion: !!datos.requiere_aprobacion,
      visibilidad_restringida: !!datos.visibilidad_restringida,
      adjunto_obligatorio: !!datos.adjunto_obligatorio,
      es_novedad_igsi: !!datos.es_novedad_igsi,
      area_responsable: textoONull(datos.area_responsable),
      responsable_defecto_id: datos.responsable_defecto_id || null,
      activa: !!datos.activa,
    }

    const supabase = db()
    if (datos.id) {
      const { error } = await supabase.from('ticket_tipologias').update(fila).eq('id', datos.id)
      if (error) return { ok: false, error: error.code === '23505' ? `Ya existe "${nombre}" en esa categoría` : error.message }
      refrescar()
      return { ok: true, id: datos.id }
    }
    const orden = await siguienteOrden('ticket_tipologias', { col: 'categoria_id', val: datos.categoria_id })
    const { data, error } = await supabase.from('ticket_tipologias').insert({ ...fila, orden }).select('id').single()
    if (error) return { ok: false, error: error.code === '23505' ? `Ya existe "${nombre}" en esa categoría` : error.message }
    refrescar()
    return { ok: true, id: data?.id }
  } catch (e) { return fallo(e, 'Error al guardar la tipología') }
}

export async function alternarTipologia(id: string, activa: boolean): Promise<Resultado> {
  if (!(await autorizado())) return { ok: false, error: NO_AUTORIZADO }
  try {
    const { error } = await db().from('ticket_tipologias').update({ activa }).eq('id', id)
    if (error) return { ok: false, error: error.message }
    refrescar()
    return { ok: true }
  } catch (e) { return fallo(e, 'Error al actualizar la tipología') }
}

export async function moverTipologia(id: string, direccion: 'arriba' | 'abajo'): Promise<Resultado> {
  if (!(await autorizado())) return { ok: false, error: NO_AUTORIZADO }
  try {
    const { data } = await db().from('ticket_tipologias').select('categoria_id').eq('id', id).single()
    if (!data) return { ok: false, error: 'Tipología no encontrada' }
    const r = await moverEnGrupo('ticket_tipologias', id, direccion, { col: 'categoria_id', val: data.categoria_id }, 'nombre')
    if (r.ok) refrescar()
    return r
  } catch (e) { return fallo(e, 'Error al reordenar') }
}

/** Nunca se borra una tipología con tickets o usada en plantillas: se desactiva */
export async function eliminarTipologia(id: string): Promise<Resultado> {
  if (!(await autorizado())) return { ok: false, error: NO_AUTORIZADO }
  try {
    if (await contar('tickets', 'tipologia_id', id)) {
      return { ok: false, error: 'La tipología tiene tickets: desactívala en lugar de borrarla' }
    }
    if (await contar('ticket_plantilla_items', 'tipologia_id', id)) {
      return { ok: false, error: 'La tipología está en una plantilla de ingreso o retiro: quítala de la plantilla o desactívala' }
    }
    const { error } = await db().from('ticket_tipologias').delete().eq('id', id)
    if (error) return { ok: false, error: error.message }
    refrescar()
    return { ok: true }
  } catch (e) { return fallo(e, 'Error al eliminar la tipología') }
}

// ── Campos de la tipología ───────────────────────────────────────────────────

export type CampoInput = {
  id?: string
  tipologia_id: string
  etiqueta: string
  tipo_dato: TipoDatoCampo
  obligatorio: boolean
  opciones?: string[] | null
  ayuda?: string | null
  es_fecha_requerida: boolean
  activo: boolean
}

export async function guardarCampo(datos: CampoInput): Promise<Resultado> {
  if (!(await autorizado())) return { ok: false, error: NO_AUTORIZADO }
  try {
    const etiqueta = datos.etiqueta.trim()
    if (!etiqueta) return { ok: false, error: 'Escribe la etiqueta del campo' }
    if (!TIPOS_DATO.includes(datos.tipo_dato)) return { ok: false, error: 'Tipo de dato no válido' }

    let opciones: string[] | null = null
    if (datos.tipo_dato === 'LISTA') {
      opciones = [...new Set((datos.opciones ?? []).map(o => o.trim()).filter(Boolean))]
      if (!opciones.length) return { ok: false, error: 'Una lista necesita al menos una opción' }
    }
    if (datos.es_fecha_requerida && datos.tipo_dato !== 'FECHA') {
      return { ok: false, error: 'Solo un campo de tipo Fecha puede ser la fecha requerida' }
    }

    const supabase = db()
    const fila: Record<string, unknown> = {
      etiqueta,
      tipo_dato: datos.tipo_dato,
      obligatorio: !!datos.obligatorio,
      opciones,
      ayuda: textoONull(datos.ayuda),
      es_fecha_requerida: !!datos.es_fecha_requerida,
      activo: !!datos.activo,
    }

    let id = datos.id
    if (id) {
      // La clave no cambia al renombrar: es estable para exportes e informes
      const { error } = await supabase.from('ticket_campos_tipologia').update(fila).eq('id', id)
      if (error) return { ok: false, error: error.message }
    } else {
      const base = claveDesdeTexto(etiqueta) || 'campo'
      const { data: existentes } = await supabase
        .from('ticket_campos_tipologia').select('clave').eq('tipologia_id', datos.tipologia_id)
      const usadas = new Set((existentes ?? []).map((c: { clave: string }) => c.clave))
      let clave = base
      for (let n = 2; usadas.has(clave); n++) clave = `${base}_${n}`
      const orden = await siguienteOrden('ticket_campos_tipologia', { col: 'tipologia_id', val: datos.tipologia_id })
      const { data, error } = await supabase
        .from('ticket_campos_tipologia')
        .insert({ ...fila, tipologia_id: datos.tipologia_id, clave, orden })
        .select('id').single()
      if (error) return { ok: false, error: error.message }
      id = data?.id
    }

    // Máximo un campo de fecha requerida por tipología
    if (datos.es_fecha_requerida && id) {
      const { error } = await supabase
        .from('ticket_campos_tipologia')
        .update({ es_fecha_requerida: false })
        .eq('tipologia_id', datos.tipologia_id)
        .neq('id', id)
      if (error) return { ok: false, error: error.message }
    }
    refrescar()
    return { ok: true }
  } catch (e) { return fallo(e, 'Error al guardar el campo') }
}

export async function alternarCampo(id: string, activo: boolean): Promise<Resultado> {
  if (!(await autorizado())) return { ok: false, error: NO_AUTORIZADO }
  try {
    const { error } = await db().from('ticket_campos_tipologia').update({ activo }).eq('id', id)
    if (error) return { ok: false, error: error.message }
    refrescar()
    return { ok: true }
  } catch (e) { return fallo(e, 'Error al actualizar el campo') }
}

/** Guarda el orden de los campos de una tipología según la lista de ids recibida */
export async function reordenarCampos(tipologiaId: string, ids: string[]): Promise<Resultado> {
  if (!(await autorizado())) return { ok: false, error: NO_AUTORIZADO }
  try {
    const { data } = await db().from('ticket_campos_tipologia').select('id, orden').eq('tipologia_id', tipologiaId)
    const actuales = (data ?? []) as { id: string; orden: number }[]
    const porId = new Map(actuales.map(c => [c.id, c]))
    if (ids.length !== actuales.length || ids.some(id => !porId.has(id))) {
      return { ok: false, error: 'La lista de campos cambió; recarga la página' }
    }
    const r = await renumerar('ticket_campos_tipologia', ids.map(id => porId.get(id)!))
    if (r.ok) refrescar()
    return r
  } catch (e) { return fallo(e, 'Error al reordenar los campos') }
}

/** Un campo con respuestas guardadas no se borra: se desactiva */
export async function eliminarCampo(id: string): Promise<Resultado> {
  if (!(await autorizado())) return { ok: false, error: NO_AUTORIZADO }
  try {
    if (await contar('ticket_valores_campo', 'campo_id', id)) {
      return { ok: false, error: 'El campo ya tiene respuestas en tickets: desactívalo en lugar de borrarlo' }
    }
    const { error } = await db().from('ticket_campos_tipologia').delete().eq('id', id)
    if (error) return { ok: false, error: error.message }
    refrescar()
    return { ok: true }
  } catch (e) { return fallo(e, 'Error al eliminar el campo') }
}

// ── Causas de cierre ─────────────────────────────────────────────────────────

export async function guardarCausa(datos: {
  id?: string
  ambito: AmbitoCausa
  tipo_causa: string
  subcausa: string
  activa: boolean
}): Promise<Resultado> {
  if (!(await autorizado())) return { ok: false, error: NO_AUTORIZADO }
  try {
    if (datos.ambito !== 'IGSI' && datos.ambito !== 'GENERAL') return { ok: false, error: 'Ámbito no válido' }
    const tipo_causa = datos.tipo_causa.trim()
    const subcausa = datos.subcausa.trim()
    if (!tipo_causa || !subcausa) return { ok: false, error: 'Escribe el tipo de causa y la subcausa' }
    const fila = { ambito: datos.ambito, tipo_causa, subcausa, activa: !!datos.activa }
    const supabase = db()
    const { error } = datos.id
      ? await supabase.from('ticket_causas').update(fila).eq('id', datos.id)
      : await supabase.from('ticket_causas').insert({ ...fila, orden: await siguienteOrden('ticket_causas', { col: 'ambito', val: datos.ambito }) })
    if (error) return { ok: false, error: error.code === '23505' ? 'Esa causa ya existe' : error.message }
    refrescar()
    return { ok: true }
  } catch (e) { return fallo(e, 'Error al guardar la causa') }
}

export async function alternarCausa(id: string, activa: boolean): Promise<Resultado> {
  if (!(await autorizado())) return { ok: false, error: NO_AUTORIZADO }
  try {
    const { error } = await db().from('ticket_causas').update({ activa }).eq('id', id)
    if (error) return { ok: false, error: error.message }
    refrescar()
    return { ok: true }
  } catch (e) { return fallo(e, 'Error al actualizar la causa') }
}

export async function moverCausa(id: string, direccion: 'arriba' | 'abajo'): Promise<Resultado> {
  if (!(await autorizado())) return { ok: false, error: NO_AUTORIZADO }
  try {
    const { data } = await db().from('ticket_causas').select('ambito').eq('id', id).single()
    if (!data) return { ok: false, error: 'Causa no encontrada' }
    const r = await moverEnGrupo('ticket_causas', id, direccion, { col: 'ambito', val: data.ambito }, 'subcausa')
    if (r.ok) refrescar()
    return r
  } catch (e) { return fallo(e, 'Error al reordenar') }
}

export async function eliminarCausa(id: string): Promise<Resultado> {
  if (!(await autorizado())) return { ok: false, error: NO_AUTORIZADO }
  try {
    if (await contar('ticket_cierres', 'causa_id', id)) {
      return { ok: false, error: 'La causa ya se usó para cerrar tickets: desactívala en lugar de borrarla' }
    }
    const { error } = await db().from('ticket_causas').delete().eq('id', id)
    if (error) return { ok: false, error: error.message }
    refrescar()
    return { ok: true }
  } catch (e) { return fallo(e, 'Error al eliminar la causa') }
}

// ── Tiempos objetivo (versionados) ───────────────────────────────────────────

/**
 * Crea una versión nueva de los tiempos objetivo (una fila por prioridad con el mismo vigente_desde).
 * Las versiones ya vigentes no se sobrescriben, para no alterar las mediciones históricas;
 * solo se puede reemplazar una versión programada a futuro.
 */
export async function crearVersionObjetivos(datos: {
  vigente_desde: string
  aprobado: boolean
  filas: { prioridad: PrioridadTicket; horas_respuesta: number; horas_solucion: number }[]
}): Promise<Resultado> {
  if (!(await autorizado())) return { ok: false, error: NO_AUTORIZADO }
  try {
    if (!esFechaISO(datos.vigente_desde)) return { ok: false, error: 'Fecha de vigencia no válida' }
    if (datos.vigente_desde < hoyISO()) {
      return { ok: false, error: 'Una versión nueva no puede empezar en el pasado: alteraría mediciones ya hechas' }
    }
    const filas = PRIORIDADES.map(p => datos.filas.find(f => f.prioridad === p))
    if (filas.some(f => !f)) return { ok: false, error: 'Define los tiempos de las cuatro prioridades' }
    for (const f of filas) {
      const r = Number(f!.horas_respuesta), s = Number(f!.horas_solucion)
      if (!(r > 0) || !(s > 0)) return { ok: false, error: 'Los tiempos deben ser mayores que cero' }
      if (s < r) return { ok: false, error: `En ${f!.prioridad} la solución no puede ser menor que la respuesta` }
    }

    const supabase = db()
    const { data: existentes } = await supabase
      .from('ticket_objetivos_tiempo').select('id').eq('vigente_desde', datos.vigente_desde)
    if ((existentes ?? []).length) {
      if (datos.vigente_desde <= hoyISO()) {
        return { ok: false, error: 'Ya existe una versión vigente con esa fecha. Crea una versión nueva con otra fecha de inicio.' }
      }
      const { error } = await supabase.from('ticket_objetivos_tiempo').delete().eq('vigente_desde', datos.vigente_desde)
      if (error) return { ok: false, error: error.message }
    }

    const { error } = await supabase.from('ticket_objetivos_tiempo').insert(
      filas.map(f => ({
        prioridad: f!.prioridad,
        horas_respuesta: Number(f!.horas_respuesta),
        horas_solucion: Number(f!.horas_solucion),
        vigente_desde: datos.vigente_desde,
        aprobado: !!datos.aprobado,
      })),
    )
    if (error) return { ok: false, error: error.message }
    refrescar()
    return { ok: true }
  } catch (e) { return fallo(e, 'Error al crear la versión de tiempos') }
}

/** Marca (o desmarca) como aprobada por la Dirección de TI una versión completa */
export async function aprobarVersionObjetivos(vigenteDesde: string, aprobado: boolean): Promise<Resultado> {
  if (!(await autorizado())) return { ok: false, error: NO_AUTORIZADO }
  try {
    if (!esFechaISO(vigenteDesde)) return { ok: false, error: 'Fecha no válida' }
    const { error } = await db().from('ticket_objetivos_tiempo').update({ aprobado }).eq('vigente_desde', vigenteDesde)
    if (error) return { ok: false, error: error.message }
    refrescar()
    return { ok: true }
  } catch (e) { return fallo(e, 'Error al aprobar la versión') }
}

/** Solo se puede borrar una versión que aún no ha entrado en vigencia */
export async function eliminarVersionObjetivos(vigenteDesde: string): Promise<Resultado> {
  if (!(await autorizado())) return { ok: false, error: NO_AUTORIZADO }
  try {
    if (!esFechaISO(vigenteDesde)) return { ok: false, error: 'Fecha no válida' }
    if (vigenteDesde <= hoyISO()) {
      return { ok: false, error: 'Una versión que ya entró en vigencia no se borra: crea una versión nueva' }
    }
    const { error } = await db().from('ticket_objetivos_tiempo').delete().eq('vigente_desde', vigenteDesde)
    if (error) return { ok: false, error: error.message }
    refrescar()
    return { ok: true }
  } catch (e) { return fallo(e, 'Error al eliminar la versión') }
}

// ── Calendario laboral ───────────────────────────────────────────────────────

async function guardarConfig(clave: string, valor: unknown): Promise<Resultado> {
  const { error } = await db()
    .from('ticket_config')
    .upsert({ clave, valor, updated_at: new Date().toISOString() }, { onConflict: 'clave' })
  return error ? { ok: false, error: error.message } : { ok: true }
}

export async function guardarHorarioLaboral(h: HorarioLaboral): Promise<Resultado> {
  if (!(await autorizado())) return { ok: false, error: NO_AUTORIZADO }
  try {
    const dias = [...new Set((h.dias ?? []).map(Number))].filter(d => d >= 0 && d <= 6).sort()
    if (!dias.length) return { ok: false, error: 'Elige al menos un día hábil' }
    if (!esHora(h.inicio) || !esHora(h.fin) || h.inicio >= h.fin) {
      return { ok: false, error: 'La hora de inicio debe ser anterior a la hora de fin' }
    }
    const ai = textoONull(h.almuerzo_inicio), af = textoONull(h.almuerzo_fin)
    if ((ai && !af) || (!ai && af)) return { ok: false, error: 'Indica el inicio y el fin del almuerzo, o deja ambos vacíos' }
    if (ai && af) {
      if (!esHora(ai) || !esHora(af) || ai >= af || ai < h.inicio || af > h.fin) {
        return { ok: false, error: 'El almuerzo debe quedar dentro de la jornada' }
      }
    }
    const r = await guardarConfig(CONFIG_CLAVES.HORARIO_LABORAL, {
      dias, inicio: h.inicio, fin: h.fin, almuerzo_inicio: ai, almuerzo_fin: af,
    } satisfies HorarioLaboral)
    if (r.ok) refrescar()
    return r
  } catch (e) { return fallo(e, 'Error al guardar el horario') }
}

export async function guardarDiaCalendario(d: {
  fecha: string
  es_habil: boolean
  hora_inicio?: string | null
  hora_fin?: string | null
  descripcion?: string | null
}): Promise<Resultado> {
  if (!(await autorizado())) return { ok: false, error: NO_AUTORIZADO }
  try {
    if (!esFechaISO(d.fecha)) return { ok: false, error: 'Fecha no válida' }
    let hora_inicio: string | null = null, hora_fin: string | null = null
    if (d.es_habil) {
      hora_inicio = textoONull(d.hora_inicio)
      hora_fin = textoONull(d.hora_fin)
      if (!hora_inicio || !hora_fin || !esHora(hora_inicio) || !esHora(hora_fin) || hora_inicio >= hora_fin) {
        return { ok: false, error: 'Para una jornada especial indica hora de inicio y de fin válidas' }
      }
    }
    const { error } = await db().from('ticket_calendario').upsert({
      fecha: d.fecha, es_habil: !!d.es_habil, hora_inicio, hora_fin, descripcion: textoONull(d.descripcion),
    }, { onConflict: 'fecha' })
    if (error) return { ok: false, error: error.message }
    refrescar()
    return { ok: true }
  } catch (e) { return fallo(e, 'Error al guardar la fecha') }
}

export async function eliminarDiaCalendario(fecha: string): Promise<Resultado> {
  if (!(await autorizado())) return { ok: false, error: NO_AUTORIZADO }
  try {
    if (!esFechaISO(fecha)) return { ok: false, error: 'Fecha no válida' }
    const { error } = await db().from('ticket_calendario').delete().eq('fecha', fecha)
    if (error) return { ok: false, error: error.message }
    refrescar()
    return { ok: true }
  } catch (e) { return fallo(e, 'Error al quitar la fecha') }
}

// ── Reglas de recordatorio ───────────────────────────────────────────────────

export type ReglaInput = {
  id?: string
  nombre: string
  disparador: DisparadorRecordatorio
  porcentaje?: number | null
  dias_habiles?: number | null
  destinatarios: DestinatarioRecordatorio[]
  canal: CanalRecordatorio
  plantilla?: string | null
  accion?: AccionRecordatorio | null
  activa: boolean
}

export async function guardarReglaRecordatorio(datos: ReglaInput): Promise<Resultado> {
  if (!(await autorizado())) return { ok: false, error: NO_AUTORIZADO }
  try {
    const nombre = datos.nombre.trim()
    if (!nombre) return { ok: false, error: 'Escribe el nombre de la regla' }
    if (!DISPARADORES.includes(datos.disparador)) return { ok: false, error: 'Disparador no válido' }
    if (!CANALES.includes(datos.canal)) return { ok: false, error: 'Canal no válido' }
    if (datos.accion && !ACCIONES.includes(datos.accion)) return { ok: false, error: 'Acción no válida' }
    const destinatarios = [...new Set(datos.destinatarios)].filter(d => DESTINATARIOS.includes(d))
    if (!destinatarios.length) return { ok: false, error: 'Elige al menos un destinatario' }

    let porcentaje: number | null = null, dias_habiles: number | null = null
    if (datos.disparador === 'RESPUESTA' || datos.disparador === 'SOLUCION') {
      porcentaje = Number(datos.porcentaje)
      if (!(porcentaje > 0)) return { ok: false, error: 'Indica el porcentaje del tiempo objetivo' }
    } else if (datos.disparador !== 'RESUMEN_DIARIO') {
      dias_habiles = Number(datos.dias_habiles)
      if (!(dias_habiles >= 0) || Number.isNaN(dias_habiles)) return { ok: false, error: 'Indica los días hábiles' }
    }

    const fila = {
      nombre, disparador: datos.disparador, porcentaje, dias_habiles, destinatarios,
      canal: datos.canal, plantilla: textoONull(datos.plantilla), accion: datos.accion || null, activa: !!datos.activa,
    }
    const supabase = db()
    if (datos.id) {
      const { error } = await supabase.from('ticket_reglas_recordatorio').update(fila).eq('id', datos.id)
      if (error) return { ok: false, error: error.message }
    } else {
      const base = claveDesdeTexto(`${datos.disparador}_${porcentaje ?? dias_habiles ?? ''}`).toUpperCase() || 'REGLA'
      const { data: existentes } = await supabase.from('ticket_reglas_recordatorio').select('codigo')
      const usados = new Set((existentes ?? []).map((r: { codigo: string }) => r.codigo))
      let codigo = base
      for (let n = 2; usados.has(codigo); n++) codigo = `${base}_${n}`
      const orden = await siguienteOrden('ticket_reglas_recordatorio')
      const { error } = await supabase.from('ticket_reglas_recordatorio').insert({ ...fila, codigo, orden })
      if (error) return { ok: false, error: error.message }
    }
    refrescar()
    return { ok: true }
  } catch (e) { return fallo(e, 'Error al guardar la regla') }
}

export async function alternarReglaRecordatorio(id: string, activa: boolean): Promise<Resultado> {
  if (!(await autorizado())) return { ok: false, error: NO_AUTORIZADO }
  try {
    const { error } = await db().from('ticket_reglas_recordatorio').update({ activa }).eq('id', id)
    if (error) return { ok: false, error: error.message }
    refrescar()
    return { ok: true }
  } catch (e) { return fallo(e, 'Error al actualizar la regla') }
}

export async function moverReglaRecordatorio(id: string, direccion: 'arriba' | 'abajo'): Promise<Resultado> {
  if (!(await autorizado())) return { ok: false, error: NO_AUTORIZADO }
  try {
    const r = await moverEnGrupo('ticket_reglas_recordatorio', id, direccion, undefined, 'nombre')
    if (r.ok) refrescar()
    return r
  } catch (e) { return fallo(e, 'Error al reordenar') }
}

/** Una regla que ya envió recordatorios no se borra (perdería el registro de envíos): se desactiva */
export async function eliminarReglaRecordatorio(id: string): Promise<Resultado> {
  if (!(await autorizado())) return { ok: false, error: NO_AUTORIZADO }
  try {
    if (await contar('ticket_recordatorios', 'regla_id', id)) {
      return { ok: false, error: 'La regla ya envió recordatorios: desactívala en lugar de borrarla' }
    }
    const { error } = await db().from('ticket_reglas_recordatorio').delete().eq('id', id)
    if (error) return { ok: false, error: error.message }
    refrescar()
    return { ok: true }
  } catch (e) { return fallo(e, 'Error al eliminar la regla') }
}

// ── Plantillas de ingreso y retiro ───────────────────────────────────────────

export async function guardarPlantilla(datos: {
  id?: string
  nombre: string
  descripcion?: string | null
  activa: boolean
}): Promise<Resultado> {
  if (!(await autorizado())) return { ok: false, error: NO_AUTORIZADO }
  try {
    const nombre = datos.nombre.trim()
    if (!nombre) return { ok: false, error: 'Escribe el nombre de la plantilla' }
    const fila = { nombre, descripcion: textoONull(datos.descripcion), activa: !!datos.activa }
    const supabase = db()
    const { error } = datos.id
      ? await supabase.from('ticket_plantillas').update(fila).eq('id', datos.id)
      : await supabase.from('ticket_plantillas').insert(fila)
    if (error) return { ok: false, error: error.code === '23505' ? `Ya existe la plantilla "${nombre}"` : error.message }
    refrescar()
    return { ok: true }
  } catch (e) { return fallo(e, 'Error al guardar la plantilla') }
}

export async function eliminarPlantilla(id: string): Promise<Resultado> {
  if (!(await autorizado())) return { ok: false, error: NO_AUTORIZADO }
  try {
    if (await contar('tickets', 'plantilla_id', id)) {
      return { ok: false, error: 'La plantilla ya generó tickets: desactívala en lugar de borrarla' }
    }
    const { error } = await db().from('ticket_plantillas').delete().eq('id', id)
    if (error) return { ok: false, error: error.message }
    refrescar()
    return { ok: true }
  } catch (e) { return fallo(e, 'Error al eliminar la plantilla') }
}

export async function guardarItemPlantilla(datos: {
  id?: string
  plantilla_id: string
  tipologia_id: string
  asunto?: string | null
}): Promise<Resultado> {
  if (!(await autorizado())) return { ok: false, error: NO_AUTORIZADO }
  try {
    if (!datos.plantilla_id || !datos.tipologia_id) return { ok: false, error: 'Elige la tipología del ticket hijo' }
    const fila = { tipologia_id: datos.tipologia_id, asunto: textoONull(datos.asunto) }
    const supabase = db()
    const { error } = datos.id
      ? await supabase.from('ticket_plantilla_items').update(fila).eq('id', datos.id)
      : await supabase.from('ticket_plantilla_items').insert({
          ...fila,
          plantilla_id: datos.plantilla_id,
          orden: await siguienteOrden('ticket_plantilla_items', { col: 'plantilla_id', val: datos.plantilla_id }),
        })
    if (error) return { ok: false, error: error.message }
    refrescar()
    return { ok: true }
  } catch (e) { return fallo(e, 'Error al guardar el ticket hijo') }
}

export async function moverItemPlantilla(id: string, direccion: 'arriba' | 'abajo'): Promise<Resultado> {
  if (!(await autorizado())) return { ok: false, error: NO_AUTORIZADO }
  try {
    const { data } = await db().from('ticket_plantilla_items').select('plantilla_id').eq('id', id).single()
    if (!data) return { ok: false, error: 'Elemento no encontrado' }
    const r = await moverEnGrupo('ticket_plantilla_items', id, direccion, { col: 'plantilla_id', val: data.plantilla_id })
    if (r.ok) refrescar()
    return r
  } catch (e) { return fallo(e, 'Error al reordenar') }
}

export async function eliminarItemPlantilla(id: string): Promise<Resultado> {
  if (!(await autorizado())) return { ok: false, error: NO_AUTORIZADO }
  try {
    const { error } = await db().from('ticket_plantilla_items').delete().eq('id', id)
    if (error) return { ok: false, error: error.message }
    refrescar()
    return { ok: true }
  } catch (e) { return fallo(e, 'Error al quitar el ticket hijo') }
}

// ── Parámetros generales ─────────────────────────────────────────────────────

export type ParametrosInput = {
  emailsCoordinador: string[]
  emailsDireccion: string[]
  diasCierreAutomatico: number
  horaResumenDiario: string
  sedes: string[]
  serviciosIGSI: ServiciosIGSI
  umbralCapacitacion: number
}

export async function guardarParametrosTickets(p: ParametrosInput): Promise<Resultado> {
  if (!(await autorizado())) return { ok: false, error: NO_AUTORIZADO }
  try {
    const limpiar = (xs: string[]) => [...new Set((xs ?? []).map(x => x.trim()).filter(Boolean))]
    const emailsCoordinador = limpiar(p.emailsCoordinador).map(x => x.toLowerCase())
    const emailsDireccion = limpiar(p.emailsDireccion).map(x => x.toLowerCase())
    const malos = [...emailsCoordinador, ...emailsDireccion].filter(x => !esCorreo(x))
    if (malos.length) return { ok: false, error: `Correo no válido: ${malos.join(', ')}` }

    const dias = Number(p.diasCierreAutomatico)
    if (!Number.isInteger(dias) || dias < 1 || dias > 60) {
      return { ok: false, error: 'Los días para cierre automático deben ser un entero entre 1 y 60' }
    }
    if (!esHora(p.horaResumenDiario)) return { ok: false, error: 'Hora del resumen diario no válida' }
    const umbral = Number(p.umbralCapacitacion)
    if (!Number.isInteger(umbral) || umbral < 1) return { ok: false, error: 'El umbral de capacitación debe ser un entero mayor que cero' }

    const servicios: ServiciosIGSI = {}
    for (const [servicio, modalidades] of Object.entries(p.serviciosIGSI ?? {})) {
      const s = servicio.trim()
      if (!s) continue
      if (servicios[s]) return { ok: false, error: `El servicio "${s}" está repetido` }
      const ms = limpiar(modalidades)
      if (!ms.length) return { ok: false, error: `El servicio "${s}" necesita al menos una modalidad` }
      servicios[s] = ms
    }

    const pares: [string, unknown][] = [
      [CONFIG_CLAVES.EMAILS_COORDINADOR, emailsCoordinador],
      [CONFIG_CLAVES.EMAILS_DIRECCION, emailsDireccion],
      [CONFIG_CLAVES.DIAS_CIERRE_AUTOMATICO, dias],
      [CONFIG_CLAVES.HORA_RESUMEN_DIARIO, p.horaResumenDiario],
      [CONFIG_CLAVES.SEDES, limpiar(p.sedes)],
      [CONFIG_CLAVES.IGSI_SERVICIOS, servicios],
      [CONFIG_CLAVES.UMBRAL_CAPACITACION, umbral],
    ]
    const ahora = new Date().toISOString()
    const { error } = await db()
      .from('ticket_config')
      .upsert(pares.map(([clave, valor]) => ({ clave, valor, updated_at: ahora })), { onConflict: 'clave' })
    if (error) return { ok: false, error: error.message }
    refrescar()
    revalidatePath('/admin/usuarios')
    return { ok: true }
  } catch (e) { return fallo(e, 'Error al guardar los parámetros') }
}
