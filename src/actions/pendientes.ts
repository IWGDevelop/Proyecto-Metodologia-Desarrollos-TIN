'use server'

import { createAdminClient } from '@/lib/supabase/admin'

export interface TareaPendienteReunion {
  id: string
  descripcion: string
  responsable_email: string | null
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

  const { data, error } = await (supabase as any)
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

  if (error || !data) return []

  return (data as any[])
    .filter((t: any) => t.reunion?.requerimiento)
    .map((t: any) => ({
      id: t.id,
      descripcion: t.descripcion,
      responsable_email: t.responsable_email,
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

  const { data, error } = await (supabase as any)
    .from('requerimientos')
    .select([
      'id', 'nombre_desarrollo', 'identificacion', 'numero', 'estado', 'proceso_interno',
      'fecha_estimada_entrega', 'fecha_real_entrega',
      'fecha_estimada_feedback_pruebas', 'fecha_real_feedback_pruebas',
      'fecha_estimada_ajustes_tecnicos', 'fecha_real_ajustes_tecnicos',
      'fecha_estimada_salida_vivo', 'fecha_salida_vivo',
    ].join(','))
    .eq('es_borrador', false)
    .not('estado', 'in', `(${ESTADOS_EXCLUIDOS.join(',')})`)

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
