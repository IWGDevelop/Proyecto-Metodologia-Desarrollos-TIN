'use server'

import { createAdminClient } from '@/lib/supabase/admin'

export type EventoTipo =
  | 'estado'
  | 'fecha'
  | 'comentario'
  | 'reunion'
  | 'tarea_reunion'
  | 'tarea_tecnica'
  | 'tarea_tecnica_completada'
  | 'anexo'
  | 'doc_tecnica'

export interface EventoHistorial {
  id: string
  tipo: EventoTipo
  fecha: string
  usuario: string | null
  titulo: string
  descripcion: string | null
  extra: Record<string, any>
}

const LABEL_FECHA: Record<string, string> = {
  fecha_estimada_entrega:          'Entrega estimada del desarrollo',
  fecha_real_entrega:              'Entrega real del desarrollo',
  fecha_estimada_feedback_pruebas: 'Pruebas de usuario estimadas',
  fecha_real_feedback_pruebas:     'Pruebas de usuario reales',
  fecha_estimada_ajustes_tecnicos: 'Ajustes técnicos estimados',
  fecha_real_ajustes_tecnicos:     'Ajustes técnicos reales',
  fecha_estimada_salida_vivo:      'Salida en vivo estimada',
  fecha_salida_vivo:               'Salida en vivo real',
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
    { data: anexos },
    { data: docTecnica },
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
          id, descripcion, responsable_email, completada,
          fecha_compromiso, fecha_cumplimiento, created_at
        )
      `)
      .eq('requerimiento_id', reqId),

    // Tareas técnicas con perfil del completador
    (supabase as any)
      .from('tareas_tecnicas')
      .select(`
        id, titulo, descripcion, completada, completada_at, created_by, created_at,
        perfil_completada:perfiles!completada_por (nombre_completo, email)
      `)
      .eq('requerimiento_id', reqId),

    (supabase as any)
      .from('anexos')
      .select('id, nombre_archivo, tipo_archivo, created_at')
      .eq('requerimiento_id', reqId),

    (supabase as any)
      .from('documentacion_tecnica')
      .select('id, nombre_archivo, tipo_documento, subido_por, created_at')
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
    const label = LABEL_FECHA[f.tipo_fecha] ?? f.tipo_fecha
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
      extra: { completada: t.completada },
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

  return eventos.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
}
