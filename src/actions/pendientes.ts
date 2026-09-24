'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getPerfil } from '@/lib/supabase/auth'

export interface FirmaPendienteVistoBueno {
  firma_id: string
  solicitud_id: string
  requerimiento_id: string
  requerimiento_nombre: string
  requerimiento_numero: string | null
  tipo: 'DOCUMENTACION' | 'SALIDA_VIVO'
  email_requerido: string
  nombre_requerido: string | null
  es_estrategia: boolean
  solicitado_por: string | null
  fecha_propuesta_salida: string | null
  created_at: string
}

export interface TareaPendienteReunion {
  id: string
  descripcion: string
  responsable_email: string | null
  nombre_responsable: string | null
  fecha_compromiso: string | null
  penalizacion_cop: number | null
  completada: boolean
  requerimiento_id: string
  requerimiento_nombre: string
  requerimiento_numero: string | null
  reunion_titulo: string
  fecha_reunion: string
  dias_restantes: number | null  // negativo = vencida
}

export interface CompromisoPendiente {
  requerimiento_id: string
  requerimiento_nombre: string
  requerimiento_numero: string | null
  estado: string
  proceso_interno: string | null
  tipo: 'entrega' | 'pruebas' | 'ajustes' | 'salida_vivo'
  label: string
  fecha_estimada: string
  fecha_real: string | null
  dias_restantes: number | null  // negativo = vencida
  vencida: boolean
}

function diasDesdeHoy(fecha: string): number {
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const f = new Date(fecha)
  f.setHours(0, 0, 0, 0)
  return Math.round((f.getTime() - hoy.getTime()) / 86400000)
}

export async function getTareasPendientesReunion(): Promise<TareaPendienteReunion[]> {
  const supabase = createAdminClient()
  const perfil = await getPerfil()
  const isAdmin = !perfil || perfil.rol === 'ADMIN_TIN'

  let queryBuilder = (supabase as any)
    .from('tareas_reunion')
    .select(`
      id, descripcion, responsable_email, fecha_compromiso,
      penalizacion_cop, completada,
      reunion:reuniones (
        id, titulo, fecha_reunion,
        requerimiento:requerimientos (
          id, nombre_desarrollo, identificacion, numero
        )
      )
    `)
    .eq('completada', false)
    .order('fecha_compromiso', { ascending: true, nullsFirst: false })

  // Usuarios no admin solo ven sus propias tareas asignadas
  if (!isAdmin && perfil) {
    queryBuilder = queryBuilder.eq('responsable_email', perfil.email)
  }

  const { data, error } = await queryBuilder
  if (error || !data) return []

  // Resolución de nombres: colectar emails únicos y buscar en perfiles
  const emails = [...new Set((data as any[]).map((t: any) => t.responsable_email).filter(Boolean))] as string[]
  const nombresMap: Record<string, string> = {}
  if (emails.length > 0) {
    const { data: perfs } = await (supabase as any)
      .from('perfiles')
      .select('email, nombre_completo')
      .in('email', emails)
    if (perfs) {
      for (const p of perfs as any[]) nombresMap[p.email] = p.nombre_completo
    }
  }

  return (data as any[])
    .filter((t: any) => t.reunion?.requerimiento)
    .map((t: any) => ({
      id: t.id,
      descripcion: t.descripcion,
      responsable_email: t.responsable_email,
      nombre_responsable: t.responsable_email ? (nombresMap[t.responsable_email] ?? null) : null,
      fecha_compromiso: t.fecha_compromiso,
      penalizacion_cop: t.penalizacion_cop,
      completada: t.completada,
      requerimiento_id: t.reunion.requerimiento.id,
      requerimiento_nombre: t.reunion.requerimiento.nombre_desarrollo ?? t.reunion.requerimiento.identificacion,
      requerimiento_numero: t.reunion.requerimiento.numero,
      reunion_titulo: t.reunion.titulo,
      fecha_reunion: t.reunion.fecha_reunion,
      dias_restantes: t.fecha_compromiso ? diasDesdeHoy(t.fecha_compromiso) : null,
    }))
}

const ESTADOS_EXCLUIDOS = ['ENTREGADO', 'CERRADO', 'DESISTIDO']

const TIPOS_FECHA: {
  tipo: CompromisoPendiente['tipo']
  label: string
  estimada: string
  real: string
}[] = [
  { tipo: 'entrega',     label: 'Entrega',          estimada: 'fecha_estimada_entrega',           real: 'fecha_real_entrega' },
  { tipo: 'pruebas',     label: 'Pruebas usuario',   estimada: 'fecha_estimada_feedback_pruebas',  real: 'fecha_real_feedback_pruebas' },
  { tipo: 'ajustes',     label: 'Ajustes técnicos',  estimada: 'fecha_estimada_ajustes_tecnicos',  real: 'fecha_real_ajustes_tecnicos' },
  { tipo: 'salida_vivo', label: 'Salida en vivo',    estimada: 'fecha_estimada_salida_vivo',       real: 'fecha_salida_vivo' },
]

export async function getCompromisosFechasPendientes(): Promise<CompromisoPendiente[]> {
  const supabase = createAdminClient()
  const perfil = await getPerfil()
  const isAdmin = !perfil || perfil.rol === 'ADMIN_TIN'

  const campos = [
    'id', 'nombre_desarrollo', 'identificacion', 'numero', 'estado', 'proceso_interno',
    'responsable', 'partes_interesadas',
    'fecha_estimada_entrega', 'fecha_real_entrega',
    'fecha_estimada_feedback_pruebas', 'fecha_real_feedback_pruebas',
    'fecha_estimada_ajustes_tecnicos', 'fecha_real_ajustes_tecnicos',
    'fecha_estimada_salida_vivo', 'fecha_salida_vivo',
  ].join(',')

  let reqQuery = (supabase as any)
    .from('requerimientos')
    .select(campos)
    .eq('es_borrador', false)
    .not('estado', 'in', `(${ESTADOS_EXCLUIDOS.join(',')})`)

  if (!isAdmin && perfil) {
    // Obtener IDs de requerimientos donde el usuario es desarrollador asignado
    const { data: asignaciones } = await (supabase as any)
      .from('requerimiento_desarrolladores')
      .select('requerimiento_id')
      .eq('perfil_id', perfil.id)

    const devIds: string[] = (asignaciones ?? []).map((a: any) => a.requerimiento_id)

    // Filtrar por asociación: desarrollador asignado, responsable, o partes interesadas
    const filtros: string[] = []
    if (devIds.length > 0) filtros.push(`id.in.(${devIds.join(',')})`)
    filtros.push(`responsable.ilike.*${perfil.email}*`)
    filtros.push(`responsable.ilike.*${perfil.nombre_completo}*`)
    filtros.push(`partes_interesadas.cs.{"${perfil.email}"}`)

    reqQuery = reqQuery.or(filtros.join(','))
  }

  const { data, error } = await reqQuery
  if (error || !data) return []

  const compromisos: CompromisoPendiente[] = []

  for (const req of data as any[]) {
    for (const tf of TIPOS_FECHA) {
      const fechaEstimada: string | null = req[tf.estimada]
      const fechaReal: string | null = req[tf.real]

      if (!fechaEstimada) continue
      if (fechaReal) continue  // ya cumplido

      const dias = diasDesdeHoy(fechaEstimada)
      compromisos.push({
        requerimiento_id: req.id,
        requerimiento_nombre: req.nombre_desarrollo ?? req.identificacion,
        requerimiento_numero: req.numero,
        estado: req.estado,
        proceso_interno: req.proceso_interno,
        tipo: tf.tipo,
        label: tf.label,
        fecha_estimada: fechaEstimada,
        fecha_real: fechaReal,
        dias_restantes: dias,
        vencida: dias < 0,
      })
    }
  }

  return compromisos.sort((a, b) => (a.dias_restantes ?? 999) - (b.dias_restantes ?? 999))
}

export async function getFirmasPendientesVistoBueno(): Promise<FirmaPendienteVistoBueno[]> {
  const supabase = createAdminClient()
  const perfil = await getPerfil()
  const isAdmin = !perfil || perfil.rol === 'ADMIN_TIN'

  let query = (supabase as any)
    .from('firmas_visto_bueno')
    .select(`
      id,
      solicitud_id,
      requerimiento_id,
      email_requerido,
      nombre_requerido,
      es_estrategia,
      created_at,
      solicitud:solicitudes_visto_bueno!inner (
        tipo,
        estado,
        solicitado_por,
        fecha_propuesta_salida
      ),
      requerimiento:requerimientos!inner (
        nombre_desarrollo,
        identificacion,
        numero
      )
    `)
    .eq('firmado', false)
    .eq('solicitud.estado', 'PENDIENTE')
    .order('created_at', { ascending: true })

  if (!isAdmin && perfil) {
    query = query.eq('email_requerido', perfil.email)
  }

  const { data, error } = await query
  if (error || !data) return []

  return (data as any[]).map(f => ({
    firma_id:               f.id,
    solicitud_id:           f.solicitud_id,
    requerimiento_id:       f.requerimiento_id,
    requerimiento_nombre:   f.requerimiento?.nombre_desarrollo ?? f.requerimiento?.identificacion ?? '',
    requerimiento_numero:   f.requerimiento?.numero ?? null,
    tipo:                   f.solicitud?.tipo ?? 'DOCUMENTACION',
    email_requerido:        f.email_requerido,
    nombre_requerido:       f.nombre_requerido ?? null,
    es_estrategia:          f.es_estrategia ?? false,
    solicitado_por:         f.solicitud?.solicitado_por ?? null,
    fecha_propuesta_salida: f.solicitud?.fecha_propuesta_salida ?? null,
    created_at:             f.created_at,
  }))
}

export async function getContadorPendientes(): Promise<number> {
  const supabase = createAdminClient()
  const perfil = await getPerfil()
  const isAdmin = !perfil || perfil.rol === 'ADMIN_TIN'

  // ── Tareas de reunión pendientes ──────────────────────────────────────────
  let tareasQuery = (supabase as any)
    .from('tareas_reunion')
    .select('id', { count: 'exact', head: true })
    .eq('completada', false)

  if (!isAdmin && perfil) {
    tareasQuery = tareasQuery.eq('responsable_email', perfil.email)
  }

  const { count: tareasCount } = await tareasQuery

  // ── Compromisos de fechas pendientes ──────────────────────────────────────
  const campos = [
    'id', 'responsable', 'partes_interesadas', 'proceso_interno',
    'fecha_estimada_entrega', 'fecha_real_entrega',
    'fecha_estimada_feedback_pruebas', 'fecha_real_feedback_pruebas',
    'fecha_estimada_ajustes_tecnicos', 'fecha_real_ajustes_tecnicos',
    'fecha_estimada_salida_vivo', 'fecha_salida_vivo',
  ].join(',')

  let reqQuery = (supabase as any)
    .from('requerimientos')
    .select(campos)
    .eq('es_borrador', false)
    .not('estado', 'in', `(${ESTADOS_EXCLUIDOS.join(',')})`)

  if (!isAdmin && perfil) {
    const { data: asignaciones } = await (supabase as any)
      .from('requerimiento_desarrolladores')
      .select('requerimiento_id')
      .eq('perfil_id', perfil.id)

    const devIds: string[] = (asignaciones ?? []).map((a: any) => a.requerimiento_id)

    const filtros: string[] = []
    if (devIds.length > 0) filtros.push(`id.in.(${devIds.join(',')})`)
    filtros.push(`responsable.ilike.*${perfil.email}*`)
    filtros.push(`responsable.ilike.*${perfil.nombre_completo}*`)
    filtros.push(`partes_interesadas.cs.{"${perfil.email}"}`)

    reqQuery = reqQuery.or(filtros.join(','))
  }

  const { data: reqs } = await reqQuery
  let fechasCount = 0
  for (const req of reqs ?? []) {
    for (const tf of TIPOS_FECHA) {
      if (req[tf.estimada] && !req[tf.real]) fechasCount++
    }
  }

  // ── Firmas de visto bueno pendientes ─────────────────────────────────────
  let firmasQuery = (supabase as any)
    .from('firmas_visto_bueno')
    .select('id', { count: 'exact', head: true })
    .eq('firmado', false)

  if (!isAdmin && perfil) {
    firmasQuery = firmasQuery.eq('email_requerido', perfil.email)
  }

  const { count: firmasCount } = await firmasQuery

  return (tareasCount ?? 0) + fechasCount + (firmasCount ?? 0)
}
