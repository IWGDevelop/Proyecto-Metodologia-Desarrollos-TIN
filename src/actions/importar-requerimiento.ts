'use server'

import { createAdminClient } from '@/lib/supabase/admin'

/* ── Tipos del payload JSON ─────────────────────────────────────────────── */

export interface ImportarTarea {
  titulo: string
  descripcion?: string | null
  categoria?: 'DESARROLLO' | 'TESTING' | 'DOCUMENTAL' | 'ADMINISTRATIVO' | 'OTRO'
  cargo_responsable?: 'AUXILIAR_TIN' | 'ING_DESARROLLO' | 'ANALISTA_TIN' | 'COORDINADOR_TIN' | 'DIRECTOR_CORPORATIVO_TIN'
  responsable_email?: string | null
  fecha_compromiso?: string | null
}

export interface ImportarPayload {
  requerimiento: {
    /* ── Obligatorios ── */
    alcance: 'IWF' | 'ILT' | 'IWG'
    identificacion: string
    nombre_desarrollo: string

    /* ── Clasificación ── */
    tipo_solicitud?: 'NUEVO_DESARROLLO' | 'MEJORA' | 'INTEGRACION' | 'INFORME'
    tipo_solucion?: 'DESARROLLO' | 'MEJORA' | 'INTEGRACION' | 'SUPERSET' | 'POR_DEFINIR'
    estado?: string
    prioridad?: number | null
    es_borrador?: boolean
    rama?: 'TIN' | 'IA' | null

    /* ── Solicitante ── */
    empresa?: string | null
    sucursal?: string | null
    proceso_interno?: string | null
    responsable?: string | null          // email o nombre libre
    partes_interesadas?: string[] | null // emails

    /* ── Descripción técnica ── */
    descripcion_situacion_actual?: string | null
    definicion_requerimiento?: string | null
    objetivo?: string | null
    criterios_validacion?: string | null
    viabilidad_tecnica?: boolean | null
    definicion_usuarios?: string | null
    ventajas_beneficios?: string | null

    /* ── Integración ── */
    integra_otros_aplicativos?: boolean
    detalle_integracion?: string | null
    tipo_operacion_integracion?: string[] | null

    /* ── Impacto ── */
    impacta?: 'FUNCIONARIOS' | 'CLIENTES' | 'AMBOS' | null
    tipos_cliente?: string[] | null
    procesos_cargos?: { proceso: string; cargo: string; cantidad_usuarios: number }[]
    actividades_impacto?: { actividad: string; horas_mes: number; porcentaje_automatizable: number }[]
    beneficios_cualitativos?: { descripcion: string }[]

    /* ── Métricas estimadas ── */
    salario_promedio_cargo?: number | null
    horas_laborales_mes?: number
    valor_hora_hombre?: number | null
    horas_ahorradas_mes?: number | null
    ahorro_mensual_cop?: number | null
    ahorro_anual_cop?: number | null
    horas_estimadas_desarrollo?: number | null
    total_beneficios_cualitativos_anual?: number | null
    impacto_economico_total_anual?: number | null

    /* ── Métricas reales ── */
    horas_ahorradas_mes_real?: number | null
    ahorro_mensual_cop_real?: number | null
    ahorro_anual_cop_real?: number | null
    beneficios_cualitativos_real?: { descripcion: string; valor_anual_cop: number }[]
    total_beneficios_cualitativos_anual_real?: number | null
    impacto_economico_total_anual_real?: number | null

    /* ── Fechas ── */
    fecha_solicitud?: string | null
    fecha_envio_solicitud?: string | null
    fecha_envio_tin?: string | null
    fecha_inicio_desarrollo?: string | null
    fecha_estimada_entrega?: string | null
    fecha_real_entrega?: string | null
    inicio_pruebas_usuario?: string | null
    fin_pruebas_usuario?: string | null
    fecha_salida_vivo?: string | null
    fecha_cierre?: string | null

    /* ── Extras ── */
    porcentaje_avance?: number
    motivo_stand_by?: string | null
    numero?: string | null
    proceso_igsi?: string | null
  }

  tareas?: ImportarTarea[]
  desarrolladores?: string[]   // emails de los desarrolladores a asignar
}

export interface ImportarResult {
  ok: boolean
  requerimientoId?: string
  tareasCreadas?: number
  desarrolladoresAsignados?: number
  warnings?: string[]
  error?: string
}

export interface ImportarLoteResult {
  ok: boolean
  importados: { requerimientoId: string; nombre: string; tareasCreadas: number; desarrolladoresAsignados: number; warnings: string[] }[]
  totalImportados: number
  totalTareas: number
  totalDesarrolladores: number
  errores: { indice: number; nombre: string; error: string }[]
}

/* ── Validación básica ──────────────────────────────────────────────────── */

function validar(payload: ImportarPayload): string[] {
  const errores: string[] = []
  const r = payload.requerimiento

  if (!r) { errores.push('Falta el campo "requerimiento"'); return errores }
  if (!r.alcance || !['IWF','ILT','IWG'].includes(r.alcance))
    errores.push('requerimiento.alcance debe ser "IWF", "ILT" o "IWG"')
  if (!r.identificacion?.trim())
    errores.push('requerimiento.identificacion es obligatorio')
  if (!r.nombre_desarrollo?.trim())
    errores.push('requerimiento.nombre_desarrollo es obligatorio')
  if (r.prioridad != null && ![1,2,3,4].includes(r.prioridad))
    errores.push('requerimiento.prioridad debe ser 1, 2, 3 o 4')
  if (r.horas_estimadas_desarrollo != null && r.horas_estimadas_desarrollo < 0)
    errores.push('requerimiento.horas_estimadas_desarrollo no puede ser negativo')

  if (payload.tareas) {
    payload.tareas.forEach((t, i) => {
      if (!t.titulo?.trim()) errores.push(`tareas[${i}].titulo es obligatorio`)
    })
  }

  return errores
}

/* ── Acción principal ───────────────────────────────────────────────────── */

export async function importarRequerimiento(payload: ImportarPayload): Promise<ImportarResult> {
  try {
    const errores = validar(payload)
    if (errores.length > 0) return { ok: false, error: errores.join(' | ') }

    const supabase   = createAdminClient()
    const warnings: string[] = []
    const r = payload.requerimiento

    /* 1 ── Resolver emails de tareas y desarrolladores a IDs de perfil */
    const emailsAResolver = [
      ...(payload.tareas ?? []).map(t => t.responsable_email).filter(Boolean),
      ...(payload.desarrolladores ?? []),
    ] as string[]

    const perfilPorEmail = new Map<string, string>()  // email → perfil.id
    if (emailsAResolver.length > 0) {
      const { data: perfs } = await (supabase as any)
        .from('perfiles')
        .select('id, email')
        .in('email', [...new Set(emailsAResolver)])
      ;(perfs ?? []).forEach((p: any) => perfilPorEmail.set(p.email, p.id))

      emailsAResolver.forEach(email => {
        if (!perfilPorEmail.has(email))
          warnings.push(`Email "${email}" no encontrado en perfiles — se omitió`)
      })
    }

    /* 2 ── Crear el requerimiento */
    const payload_req: Record<string, unknown> = {
      identificacion:             r.identificacion.trim(),
      nombre_desarrollo:          r.nombre_desarrollo.trim(),
      alcance:                    r.alcance,
      tipo_solicitud:             r.tipo_solicitud              ?? null,
      tipo_solucion:              r.tipo_solucion               ?? null,
      estado:                     r.estado                      ?? 'SIN_GESTION',
      prioridad:                  r.prioridad                   ?? null,
      es_borrador:                r.es_borrador                 ?? false,
      rama:                       r.rama                        ?? null,
      empresa:                    r.empresa                     ?? null,
      sucursal:                   r.sucursal                    ?? null,
      proceso_interno:            r.proceso_interno             ?? null,
      responsable:                r.responsable                 ?? null,
      partes_interesadas:         r.partes_interesadas          ?? [],
      descripcion_situacion_actual: r.descripcion_situacion_actual ?? null,
      definicion_requerimiento:   r.definicion_requerimiento    ?? null,
      objetivo:                   r.objetivo                    ?? null,
      criterios_validacion:       r.criterios_validacion        ?? null,
      viabilidad_tecnica:         r.viabilidad_tecnica          ?? null,
      definicion_usuarios:        r.definicion_usuarios         ?? null,
      ventajas_beneficios:        r.ventajas_beneficios         ?? null,
      integra_otros_aplicativos:  r.integra_otros_aplicativos   ?? false,
      detalle_integracion:        r.detalle_integracion         ?? null,
      tipo_operacion_integracion: r.tipo_operacion_integracion  ?? null,
      impacta:                    r.impacta                     ?? null,
      tipos_cliente:              r.tipos_cliente               ?? null,
      procesos_cargos:            r.procesos_cargos             ?? [],
      actividades_impacto:        r.actividades_impacto         ?? [],
      beneficios_cualitativos:    r.beneficios_cualitativos     ?? [],
      salario_promedio_cargo:     r.salario_promedio_cargo      ?? null,
      horas_laborales_mes:        r.horas_laborales_mes         ?? 160,
      valor_hora_hombre:          r.valor_hora_hombre           ?? null,
      horas_ahorradas_mes:        r.horas_ahorradas_mes         ?? null,
      ahorro_mensual_cop:         r.ahorro_mensual_cop          ?? null,
      ahorro_anual_cop:           r.ahorro_anual_cop            ?? null,
      horas_estimadas_desarrollo: r.horas_estimadas_desarrollo  ?? null,
      total_beneficios_cualitativos_anual: r.total_beneficios_cualitativos_anual ?? null,
      impacto_economico_total_anual:       r.impacto_economico_total_anual       ?? null,
      horas_ahorradas_mes_real:            r.horas_ahorradas_mes_real            ?? null,
      ahorro_mensual_cop_real:             r.ahorro_mensual_cop_real             ?? null,
      ahorro_anual_cop_real:               r.ahorro_anual_cop_real               ?? null,
      beneficios_cualitativos_real:        r.beneficios_cualitativos_real        ?? [],
      total_beneficios_cualitativos_anual_real: r.total_beneficios_cualitativos_anual_real ?? null,
      impacto_economico_total_anual_real:       r.impacto_economico_total_anual_real       ?? null,
      fecha_solicitud:            r.fecha_solicitud             ?? null,
      fecha_envio_solicitud:      r.fecha_envio_solicitud       ?? null,
      fecha_envio_tin:            r.fecha_envio_tin             ?? null,
      fecha_inicio_desarrollo:    r.fecha_inicio_desarrollo     ?? null,
      fecha_estimada_entrega:     r.fecha_estimada_entrega      ?? null,
      fecha_real_entrega:         r.fecha_real_entrega          ?? null,
      inicio_pruebas_usuario:     r.inicio_pruebas_usuario      ?? null,
      fin_pruebas_usuario:        r.fin_pruebas_usuario         ?? null,
      fecha_salida_vivo:          r.fecha_salida_vivo           ?? null,
      fecha_cierre:               r.fecha_cierre                ?? null,
      porcentaje_avance:          r.porcentaje_avance           ?? 0,
      motivo_stand_by:            r.motivo_stand_by             ?? null,
      numero:                     r.numero                      ?? null,
      proceso_igsi:               r.proceso_igsi                ?? null,
      horas_hombre_ahorradas:     null,
    }

    const { data: reqData, error: reqErr } = await (supabase as any)
      .from('requerimientos')
      .insert(payload_req)
      .select('id')
      .single()

    if (reqErr) return { ok: false, error: `Error al crear requerimiento: ${reqErr.message}` }
    const requerimientoId: string = reqData.id

    /* 3 ── Crear tareas técnicas */
    let tareasCreadas = 0
    const tareas = payload.tareas ?? []
    for (let i = 0; i < tareas.length; i++) {
      const t = tareas[i]
      const responsableId = t.responsable_email ? (perfilPorEmail.get(t.responsable_email) ?? null) : null
      const { error: tErr } = await (supabase as any)
        .from('tareas_tecnicas')
        .insert({
          requerimiento_id:  requerimientoId,
          titulo:            t.titulo.trim(),
          descripcion:       t.descripcion?.trim() || null,
          categoria:         t.categoria            || null,
          cargo_responsable: t.cargo_responsable    || null,
          responsable_id:    responsableId,
          fecha_compromiso:  t.fecha_compromiso     || null,
          orden:             i,
        })
      if (tErr) warnings.push(`Tarea "${t.titulo}": ${tErr.message}`)
      else tareasCreadas++
    }

    /* 4 ── Asignar desarrolladores */
    let desarrolladoresAsignados = 0
    for (const email of (payload.desarrolladores ?? [])) {
      const perfilId = perfilPorEmail.get(email)
      if (!perfilId) continue
      const { error: dErr } = await (supabase as any)
        .from('requerimiento_desarrolladores')
        .insert({ requerimiento_id: requerimientoId, perfil_id: perfilId })
      if (dErr) warnings.push(`Desarrollador "${email}": ${dErr.message}`)
      else desarrolladoresAsignados++
    }

    return { ok: true, requerimientoId, tareasCreadas, desarrolladoresAsignados, warnings }
  } catch (e: any) {
    return { ok: false, error: e.message ?? 'Error inesperado' }
  }
}

/* ── Importación en lote ─────────────────────────────────────────────────── */

export async function importarLote(payloads: ImportarPayload[]): Promise<ImportarLoteResult> {
  const importados: ImportarLoteResult['importados'] = []
  const errores:    ImportarLoteResult['errores']    = []

  for (let i = 0; i < payloads.length; i++) {
    const p = payloads[i]
    const nombre = p.requerimiento?.nombre_desarrollo ?? `Requerimiento #${i + 1}`
    const res = await importarRequerimiento(p)
    if (res.ok && res.requerimientoId) {
      importados.push({
        requerimientoId:         res.requerimientoId,
        nombre,
        tareasCreadas:           res.tareasCreadas ?? 0,
        desarrolladoresAsignados: res.desarrolladoresAsignados ?? 0,
        warnings:                res.warnings ?? [],
      })
    } else {
      errores.push({ indice: i, nombre, error: res.error ?? 'Error desconocido' })
    }
  }

  return {
    ok:                   importados.length > 0,
    importados,
    totalImportados:      importados.length,
    totalTareas:          importados.reduce((s, r) => s + r.tareasCreadas, 0),
    totalDesarrolladores: importados.reduce((s, r) => s + r.desarrolladoresAsignados, 0),
    errores,
  }
}
