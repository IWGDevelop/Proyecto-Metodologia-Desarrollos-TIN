'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { labelTipoFechaPlaneacion } from '@/lib/etapas-planeacion'

export type EventoTipo =
  | 'estado'
  | 'fecha'
  | 'comentario'
  | 'reunion'
  | 'tarea_reunion'
  | 'tarea_tecnica'
  | 'tarea_tecnica_completada'
  | 'tarea_solicitud'
  | 'tarea_solicitud_completada'
  | 'anexo'
  | 'doc_tecnica'
  | 'penalizacion'

export interface EventoHistorial {
  id: string
  tipo: EventoTipo
  fecha: string
  usuario: string | null
  titulo: string
  descripcion: string | null
  extra: Record<string, any>
}

const LABEL_PENALIZACION: Record<string, string> = {
  DOCUMENTACION_DESTIEMPO: 'Documentación a destiempo',
  MALA_DEFINICION:         'Mala definición',
  FALTA_RESPUESTA:         'Falta de respuesta',
  INFORMACION_INCORRECTA:  'Información incorrecta',
  CAMBIO_ALCANCE:          'Cambio de alcance',
  RETRASO_ENTREGA:         'Retraso en entrega',
  OTRO:                    'Otro',
}

const LABEL_FECHA: Record<string, string> = {
  fecha_estimada_definicion_usuario: 'Definición de usuario estimada',
  fecha_real_definicion_usuario:     'Definición de usuario real',
  fecha_estimada_entrega:          'Entrega estimada del desarrollo',
  fecha_real_entrega:              'Entrega real del desarrollo',
  fecha_estimada_fin_testing:      'Fin de pruebas Testing estimado',
  fecha_real_fin_testing:          'Fin de pruebas Testing real',
  fecha_estimada_feedback_pruebas: 'Pruebas de usuario estimadas',
  fecha_real_feedback_pruebas:     'Pruebas de usuario reales',
  fecha_estimada_ajustes_tecnicos: 'Ajustes técnicos estimados',
  fecha_real_ajustes_tecnicos:     'Ajustes técnicos reales',
  fecha_estimada_salida_vivo:      'Salida en vivo estimada',
  fecha_salida_vivo:               'Salida en vivo real',
}

/* ── Cumplimiento de tareas ──────────────────────────────────────────────── */

/** A_TIEMPO / TARDE (cumplida después del compromiso) / VENCIDA (sin cumplir y pasada) / EN_CURSO / SIN_COMPROMISO */
export type EstadoCumplimiento = 'A_TIEMPO' | 'TARDE' | 'VENCIDA' | 'EN_CURSO' | 'SIN_COMPROMISO'

export interface CumplimientoTarea {
  fecha_inicio: string | null
  fecha_compromiso: string | null
  fecha_cumplimiento: string | null
  /** Días desde el inicio hasta el cumplimiento (o hasta hoy si sigue abierta) */
  dias_cumplimiento: number | null
  /** Días después del compromiso (solo si > 0) */
  dias_retraso: number
  estado: EstadoCumplimiento
  /** true si la tarea no se cumplió a tiempo (vencida o cumplida tarde) */
  incumplida: boolean
}

export interface SoporteTarea {
  nombre_archivo: string
  url_storage: string
}

/** Fecha (YYYY-MM-DD) en Colombia de un timestamp o fecha */
function fechaColombia(valor: string | null | undefined): string | null {
  if (!valor) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) return valor
  const d = new Date(valor)
  if (isNaN(d.getTime())) return null
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(d)
}

function diasEntre(desde: string, hasta: string): number {
  const [y1, m1, d1] = desde.split('-').map(Number)
  const [y2, m2, d2] = hasta.split('-').map(Number)
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000)
}

function calcularCumplimiento(params: {
  inicio: string | null | undefined
  compromiso: string | null | undefined
  cumplimiento: string | null | undefined
  completada: boolean
}): CumplimientoTarea {
  const hoy = fechaColombia(new Date().toISOString())!
  const inicio = fechaColombia(params.inicio)
  const compromiso = fechaColombia(params.compromiso)
  const cumplimiento = params.completada ? fechaColombia(params.cumplimiento) : null
  const fin = cumplimiento ?? (params.completada ? null : hoy)

  const dias_cumplimiento = inicio && fin ? Math.max(0, diasEntre(inicio, fin)) : null
  const referencia = cumplimiento ?? (params.completada ? null : hoy)
  const retraso = compromiso && referencia ? diasEntre(compromiso, referencia) : 0
  const dias_retraso = Math.max(0, retraso)

  let estado: EstadoCumplimiento
  if (!compromiso) estado = 'SIN_COMPROMISO'
  else if (params.completada) estado = dias_retraso > 0 ? 'TARDE' : 'A_TIEMPO'
  else estado = dias_retraso > 0 ? 'VENCIDA' : 'EN_CURSO'

  return {
    fecha_inicio: inicio,
    fecha_compromiso: compromiso,
    fecha_cumplimiento: cumplimiento,
    dias_cumplimiento,
    dias_retraso,
    estado,
    incumplida: estado === 'TARDE' || estado === 'VENCIDA',
  }
}

function fmt(d: string | null): string {
  if (!d) return '—'
  try {
    return new Date(d + 'T12:00:00').toLocaleDateString('es-CO', {
      day: '2-digit', month: 'short', year: 'numeric',
    })
  } catch { return d }
}

export async function getHistorialCompleto(reqId: string): Promise<EventoHistorial[]> {
  const supabase = createAdminClient()

  const [
    { data: estados },
    { data: fechas },
    { data: comentarios },
    { data: reuniones },
    { data: tareasTecnicas },
    { data: tareasSolicitud },
    { data: anexos },
    { data: docTecnica },
    { data: penalizaciones },
  ] = await Promise.all([
    (supabase as any)
      .from('historial_estados')
      .select('id, estado_anterior, estado_nuevo, observacion, usuario, created_at')
      .eq('requerimiento_id', reqId),

    (supabase as any)
      .from('historial_fechas')
      .select('id, tipo_fecha, fecha_anterior, fecha_nueva, usuario, created_at')
      .eq('requerimiento_id', reqId),

    (supabase as any)
      .from('comentarios')
      .select('id, comentario, usuario, created_at')
      .eq('requerimiento_id', reqId),

    // Reuniones con sus tareas anidadas
    (supabase as any)
      .from('reuniones')
      .select(`
        id, titulo, fecha_reunion, created_by, created_at,
        tareas_reunion (
          id, descripcion, responsable_email, completada, respuesta, fecha_inicio,
          fecha_compromiso, fecha_cumplimiento, created_at,
          anexos_tarea_reunion ( nombre_archivo, url_storage )
        )
      `)
      .eq('requerimiento_id', reqId),

    // Tareas técnicas con perfil del completador
    (supabase as any)
      .from('tareas_tecnicas')
      .select(`
        id, titulo, descripcion, completada, completada_at, fecha_compromiso, fecha_completada, created_by, created_at,
        perfil_completada:perfiles!completada_por (nombre_completo, email)
      `)
      .eq('requerimiento_id', reqId),

    (supabase as any)
      .from('tareas_solicitud')
      .select('*')
      .eq('requerimiento_id', reqId),

    (supabase as any)
      .from('anexos')
      .select('id, nombre_archivo, tipo_archivo, created_at')
      .eq('requerimiento_id', reqId),

    (supabase as any)
      .from('documentacion_tecnica')
      .select('id, nombre_archivo, tipo_documento, subido_por, created_at')
      .eq('requerimiento_id', reqId),

    (supabase as any)
      .from('penalizaciones_requerimiento')
      .select('id, tipo, descripcion, responsables, monto_cop, created_by, created_at')
      .eq('requerimiento_id', reqId),
  ])

  const eventos: EventoHistorial[] = []

  for (const e of estados ?? []) {
    eventos.push({
      id: `estado-${e.id}`,
      tipo: 'estado',
      fecha: e.created_at,
      usuario: e.usuario ?? null,
      titulo: `${e.estado_anterior ?? 'Inicial'} → ${e.estado_nuevo}`,
      descripcion: e.observacion ?? null,
      extra: { estado_anterior: e.estado_anterior, estado_nuevo: e.estado_nuevo },
    })
  }

  for (const f of fechas ?? []) {
    const label = LABEL_FECHA[f.tipo_fecha] ?? labelTipoFechaPlaneacion(f.tipo_fecha) ?? f.tipo_fecha
    eventos.push({
      id: `fecha-${f.id}`,
      tipo: 'fecha',
      fecha: f.created_at,
      usuario: f.usuario ?? null,
      titulo: label,
      descripcion: `${fmt(f.fecha_anterior)} → ${fmt(f.fecha_nueva)}`,
      extra: { tipo_fecha: f.tipo_fecha, fecha_anterior: f.fecha_anterior, fecha_nueva: f.fecha_nueva },
    })
  }

  for (const c of comentarios ?? []) {
    eventos.push({
      id: `comentario-${c.id}`,
      tipo: 'comentario',
      fecha: c.created_at,
      usuario: c.usuario ?? null,
      titulo: c.comentario,
      descripcion: null,
      extra: {},
    })
  }

  for (const r of reuniones ?? []) {
    eventos.push({
      id: `reunion-${r.id}`,
      tipo: 'reunion',
      fecha: r.created_at,
      usuario: r.created_by ?? null,
      titulo: r.titulo,
      descripcion: `Reunión · ${fmt(r.fecha_reunion)}`,
      extra: { fecha_reunion: r.fecha_reunion },
    })

    for (const t of r.tareas_reunion ?? []) {
      eventos.push({
        id: `tarea-reunion-${t.id}`,
        tipo: 'tarea_reunion',
        fecha: t.created_at,
        usuario: t.responsable_email ?? null,
        titulo: t.descripcion,
        descripcion: [
          `Reunión: ${r.titulo}`,
          t.fecha_compromiso ? `Compromiso: ${fmt(t.fecha_compromiso)}` : null,
          t.completada ? `Completada${t.fecha_cumplimiento ? ' el ' + fmt(t.fecha_cumplimiento) : ''}` : null,
        ].filter(Boolean).join(' · '),
        extra: {
          reunion_titulo: r.titulo,
          completada: t.completada,
          fecha_compromiso: t.fecha_compromiso,
          responsable_email: t.responsable_email,
          respuesta: t.respuesta ?? null,
          soportes: (t.anexos_tarea_reunion ?? []) as SoporteTarea[],
          cumplimiento: calcularCumplimiento({
            inicio: t.fecha_inicio ?? r.fecha_reunion ?? t.created_at,
            compromiso: t.fecha_compromiso,
            cumplimiento: t.fecha_cumplimiento,
            completada: !!t.completada,
          }),
        },
      })
    }
  }

  for (const t of tareasTecnicas ?? []) {
    eventos.push({
      id: `tarea-tecnica-${t.id}`,
      tipo: 'tarea_tecnica',
      fecha: t.created_at,
      usuario: t.created_by ?? null,
      titulo: t.titulo,
      descripcion: t.descripcion ?? null,
      extra: {
        completada: t.completada,
        cumplimiento: calcularCumplimiento({
          inicio: t.created_at,
          compromiso: t.fecha_compromiso,
          cumplimiento: t.fecha_completada ?? t.completada_at,
          completada: !!t.completada,
        }),
      },
    })

    if (t.completada && t.completada_at) {
      const nombreCompletado =
        t.perfil_completada?.nombre_completo ??
        t.perfil_completada?.email ??
        null

      eventos.push({
        id: `tarea-tecnica-completada-${t.id}`,
        tipo: 'tarea_tecnica_completada',
        fecha: t.completada_at,
        usuario: nombreCompletado,
        titulo: t.titulo,
        descripcion: null,
        extra: {},
      })
    }
  }

  // Soportes de tareas de comentarios (consulta aparte: si la tabla aún no existe, no rompe el historial)
  const soportesSolicitud = new Map<string, SoporteTarea[]>()
  const idsSolicitud = (tareasSolicitud ?? []).map((t: { id: string }) => t.id)
  if (idsSolicitud.length > 0) {
    const { data: anexosSol } = await (supabase as any)
      .from('anexos_tarea_solicitud')
      .select('tarea_solicitud_id, nombre_archivo, url_storage')
      .in('tarea_solicitud_id', idsSolicitud)
    for (const a of anexosSol ?? []) {
      const lista = soportesSolicitud.get(a.tarea_solicitud_id) ?? []
      lista.push({ nombre_archivo: a.nombre_archivo, url_storage: a.url_storage })
      soportesSolicitud.set(a.tarea_solicitud_id, lista)
    }
  }

  for (const t of tareasSolicitud ?? []) {
    eventos.push({
      id: `tarea-solicitud-${t.id}`,
      tipo: 'tarea_solicitud',
      fecha: t.created_at,
      usuario: t.created_by ?? null,
      titulo: t.descripcion,
      descripcion: [
        t.responsable_email ? `Responsable: ${t.responsable_email}` : null,
        t.fecha_compromiso ? `Compromiso: ${fmt(t.fecha_compromiso)}` : null,
      ].filter(Boolean).join(' · ') || null,
      extra: {
        completada: t.completada,
        responsable_email: t.responsable_email,
        fecha_compromiso: t.fecha_compromiso,
        penalizacion_cop: t.penalizacion_cop,
        respuesta: t.respuesta ?? null,
        soportes: soportesSolicitud.get(t.id) ?? [],
        cumplimiento: calcularCumplimiento({
          inicio: t.created_at,
          compromiso: t.fecha_compromiso,
          cumplimiento: t.fecha_cumplimiento,
          completada: !!t.completada,
        }),
      },
    })

    if (t.completada && t.fecha_cumplimiento) {
      eventos.push({
        id: `tarea-solicitud-completada-${t.id}`,
        tipo: 'tarea_solicitud_completada',
        fecha: t.fecha_cumplimiento + 'T12:00:00',
        usuario: null,
        titulo: t.descripcion,
        descripcion: null,
        extra: {},
      })
    }
  }

  for (const a of anexos ?? []) {
    eventos.push({
      id: `anexo-${a.id}`,
      tipo: 'anexo',
      fecha: a.created_at,
      usuario: null,
      titulo: a.nombre_archivo,
      descripcion: a.tipo_archivo ?? null,
      extra: { tipo_archivo: a.tipo_archivo },
    })
  }

  for (const d of docTecnica ?? []) {
    eventos.push({
      id: `doc-${d.id}`,
      tipo: 'doc_tecnica',
      fecha: d.created_at,
      usuario: d.subido_por ?? null,
      titulo: d.nombre_archivo,
      descripcion: d.tipo_documento ?? null,
      extra: { tipo_documento: d.tipo_documento },
    })
  }

  for (const p of penalizaciones ?? []) {
    const tipoLabel = LABEL_PENALIZACION[p.tipo] ?? p.tipo
    const partes: string[] = []
    if (p.descripcion) partes.push(p.descripcion)
    if (p.responsables?.length) partes.push(`Responsables: ${(p.responsables as string[]).join(', ')}`)
    eventos.push({
      id: `penalizacion-${p.id}`,
      tipo: 'penalizacion',
      fecha: p.created_at,
      usuario: p.created_by ?? null,
      titulo: tipoLabel,
      descripcion: partes.length ? partes.join(' · ') : null,
      extra: { tipo_penalizacion: p.tipo, monto_cop: p.monto_cop, responsables: p.responsables ?? [] },
    })
  }

  return eventos.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
}
