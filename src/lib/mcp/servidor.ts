import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import type { UsuarioMcp } from './tokens'
import { calcularReportePlaneacion, type CumplimientoEtapa, type EtapaReporte } from '@/lib/reporte-planeacion'
import { ETAPAS_PLANEACION } from '@/lib/etapas-planeacion'

const CUMPLIMIENTOS: [CumplimientoEtapa, ...CumplimientoEtapa[]] = [
  'A_TIEMPO', 'RETRASADA', 'EN_CURSO', 'VENCIDA', 'INICIO_ATRASADO', 'PENDIENTE', 'OMITIDA',
]

/** La etapa está vigente hoy si hoy cae dentro de su rango planeado (con una sola fecha, ese día) */
function etapaVigente(e: EtapaReporte, hoy: string): boolean {
  const inicio = e.planInicio ?? e.planFin
  const fin = e.planFin ?? e.planInicio
  return !!inicio && !!fin && inicio <= hoy && hoy <= fin
}

// Servidor MCP de gestión de requerimientos — Fase 1: solo lectura.
// Se crea uno por petición (modo sin estado), ya autenticado como `usuario`.

const ESTADOS_FINALES_POR_DEFECTO = ['ENTREGADO', 'CERRADO', 'DESISTIDO']
const LOTE = 1000 // máximo de filas que devuelve PostgREST por consulta

// Columnas resumidas para listados (el detalle completo sale en obtener_requerimiento)
const COLUMNAS_LISTADO = [
  'id', 'numero', 'identificacion', 'nombre_desarrollo', 'estado', 'motivo_stand_by',
  'prioridad', 'sub_prioridad', 'prioridad_proceso', 'alcance', 'proceso_interno',
  'tipo_solicitud', 'tipo_solucion', 'responsable', 'porcentaje_avance', 'es_borrador',
  'fecha_solicitud', 'fecha_envio_tin', 'fecha_inicio_desarrollo', 'fecha_estimada_entrega',
  'fecha_real_entrega', 'fecha_estimada_salida_vivo', 'fecha_salida_vivo', 'fecha_cierre',
  'dias_en_estado_actual', 'dias_respuesta_tin', 'dias_desarrollo', 'dias_pruebas', 'cumple_sla',
  'horas_estimadas_desarrollo', 'horas_ahorradas_mes', 'horas_ahorradas_mes_real',
  'impacto_economico_total_anual', 'impacto_economico_total_anual_real', 'updated_at',
].join(', ')

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type Fila = Record<string, any>

function hoyBogota(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
}

function json(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] }
}

function error(mensaje: string) {
  return { content: [{ type: 'text' as const, text: mensaje }], isError: true }
}

// Quita caracteres que rompen la sintaxis de filtros `or` de PostgREST
function limpiarTexto(texto: string): string {
  return texto.replace(/[,()*%\\]/g, ' ').trim()
}

async function estadosFinales(supabase: any): Promise<string[]> {
  const { data } = await supabase.from('estados_kanban').select('nombre').eq('es_final', true)
  const nombres = (data ?? []).map((e: { nombre: string }) => e.nombre)
  return nombres.length ? Array.from(new Set([...nombres, 'DESISTIDO'])) : ESTADOS_FINALES_POR_DEFECTO
}

const filtrosBase = {
  estados: z.array(z.string()).optional()
    .describe('Códigos de estado, ej. ["ANALISIS","EN_DESARROLLO"]. Ver listar_estados.'),
  alcance: z.enum(['IWF', 'ILT', 'IWG']).optional().describe('Empresa / alcance'),
  proceso_interno: z.string().optional().describe('Código del proceso interno, ej. OPERACIONES'),
  prioridad: z.number().int().min(1).max(4).optional().describe('Prioridad 1 (más alta) a 4'),
  tipo_solucion: z.string().optional().describe('DESARROLLO, MEJORA, INTEGRACION, SUPERSET, POR_DEFINIR'),
  responsable: z.string().optional().describe('Email o parte del nombre del responsable'),
  incluir_borradores: z.boolean().optional().describe('Incluir borradores no enviados (por defecto no)'),
  incluir_desistidos: z.boolean().optional().describe('Incluir DESISTIDO si no se filtra por estados (por defecto no)'),
}

type Filtros = {
  texto?: string
  estados?: string[]
  alcance?: string
  proceso_interno?: string
  prioridad?: number
  tipo_solucion?: string
  responsable?: string
  incluir_borradores?: boolean
  incluir_desistidos?: boolean
}

function aplicarFiltros(query: any, f: Filtros): any {
  if (f.texto?.trim()) {
    const q = limpiarTexto(f.texto)
    if (q) {
      query = query.or(
        `numero.ilike.%${q}%,identificacion.ilike.%${q}%,nombre_desarrollo.ilike.%${q}%,descripcion_situacion_actual.ilike.%${q}%,definicion_requerimiento.ilike.%${q}%`
      )
    }
  }
  if (f.estados?.length) query = query.in('estado', f.estados)
  else if (!f.incluir_desistidos) query = query.neq('estado', 'DESISTIDO')
  if (!f.incluir_borradores) query = query.eq('es_borrador', false)
  if (f.alcance) query = query.eq('alcance', f.alcance)
  if (f.proceso_interno) query = query.eq('proceso_interno', f.proceso_interno)
  if (f.prioridad) query = query.eq('prioridad', f.prioridad)
  if (f.tipo_solucion) query = query.eq('tipo_solucion', f.tipo_solucion)
  if (f.responsable?.trim()) {
    const r = limpiarTexto(f.responsable)
    if (r) query = query.ilike('responsable', `%${r}%`)
  }
  return query
}

/** Trae todas las filas que cumplen los filtros, paginando de a LOTE */
async function traerTodas(supabase: any, columnas: string, f: Filtros): Promise<Fila[]> {
  const filas: Fila[] = []
  for (let desde = 0; ; desde += LOTE) {
    const { data, error: err } = await aplicarFiltros(
      supabase.from('v_metricas_requerimientos').select(columnas), f
    ).order('id').range(desde, desde + LOTE - 1)
    if (err) throw new Error(err.message)
    filas.push(...(data ?? []))
    if (!data || data.length < LOTE) return filas
  }
}

function contarPor(filas: Fila[], campo: string): Record<string, number> {
  const out: Record<string, number> = {}
  for (const f of filas) {
    const k = f[campo] == null ? 'SIN_DATO' : String(f[campo])
    out[k] = (out[k] ?? 0) + 1
  }
  return Object.fromEntries(Object.entries(out).sort((a, b) => b[1] - a[1]))
}

function suma(filas: Fila[], campo: string): number {
  return Math.round(filas.reduce((s, f) => s + (Number(f[campo]) || 0), 0) * 100) / 100
}

function promedio(valores: number[]): number | null {
  if (!valores.length) return null
  return Math.round((valores.reduce((s, v) => s + v, 0) / valores.length) * 10) / 10
}

export function crearServidorMcp(usuario: UsuarioMcp): McpServer {
  const server = new McpServer(
    { name: 'tin-requerimientos', version: '1.0.0' },
    {
      instructions:
        'Gestión de requerimientos de desarrollo del área TIN (Interworld). ' +
        `Conectado como ${usuario.nombre} (${usuario.email}, ${usuario.rol}). ` +
        'Fase 1: herramientas de solo lectura. Usa listar_estados para conocer los códigos de estado, ' +
        'buscar_requerimientos para listados filtrados, obtener_requerimiento para el detalle completo ' +
        'metricas_requerimientos para análisis agregados y planeacion_requerimientos para la planeación ' +
        'por etapas (plan vs. real, vigentes hoy, atrasos). Los montos están en COP.',
    }
  )

  const soloLectura = { readOnlyHint: true, destructiveHint: false, openWorldHint: false }

  // ── listar_estados ────────────────────────────────────────────────────────
  server.registerTool(
    'listar_estados',
    {
      title: 'Listar estados',
      description: 'Catálogo de estados del Kanban de requerimientos (código, nombre visible, orden, si es final y si está activo).',
      annotations: soloLectura,
    },
    async () => {
      const supabase = createAdminClient() as any
      const { data, error: err } = await supabase
        .from('estados_kanban')
        .select('nombre, label, orden, activo, es_final')
        .order('orden')
      if (err) return error(`Error consultando estados: ${err.message}`)
      return json(data ?? [])
    }
  )

  // ── buscar_requerimientos ─────────────────────────────────────────────────
  server.registerTool(
    'buscar_requerimientos',
    {
      title: 'Buscar requerimientos',
      description:
        'Lista requerimientos con filtros (texto, estado, alcance, proceso, prioridad, tipo de solución, responsable). ' +
        'Devuelve columnas resumidas, incluidos días en el estado actual, fechas, avance, horas e impacto. ' +
        'Por defecto excluye borradores y desistidos.',
      inputSchema: {
        texto: z.string().optional().describe('Busca en número, identificación, nombre y descripción'),
        ...filtrosBase,
        ordenar_por: z.enum([
          'prioridad', 'dias_en_estado_actual', 'fecha_solicitud', 'fecha_estimada_entrega',
          'impacto_economico_total_anual', 'horas_estimadas_desarrollo', 'updated_at',
        ]).optional().describe('Columna de orden (por defecto prioridad)'),
        descendente: z.boolean().optional().describe('Orden descendente (por defecto ascendente)'),
        limite: z.number().int().min(1).max(200).optional().describe('Máximo de filas (por defecto 50, máx. 200)'),
      },
      annotations: soloLectura,
    },
    async (args) => {
      const supabase = createAdminClient() as any
      const columna = args.ordenar_por ?? 'prioridad'
      const { data, count, error: err } = await aplicarFiltros(
        supabase.from('v_metricas_requerimientos').select(COLUMNAS_LISTADO, { count: 'exact' }), args
      )
        .order(columna, { ascending: !args.descendente, nullsFirst: false })
        .limit(args.limite ?? 50)
      if (err) return error(`Error consultando requerimientos: ${err.message}`)
      return json({ total_coincidencias: count ?? 0, devueltos: data?.length ?? 0, requerimientos: data ?? [] })
    }
  )

  // ── obtener_requerimiento ─────────────────────────────────────────────────
  server.registerTool(
    'obtener_requerimiento',
    {
      title: 'Obtener requerimiento',
      description:
        'Detalle completo de un requerimiento por su id (UUID) o su número: todos los campos, ' +
        'historial de cambios de estado, comentarios y planeación de etapas.',
      inputSchema: {
        identificador: z.string().min(1).describe('UUID del requerimiento o su número (campo "numero")'),
      },
      annotations: soloLectura,
    },
    async ({ identificador }) => {
      const supabase = createAdminClient() as any
      const valor = identificador.trim()
      const { data: reqs, error: err } = await supabase
        .from('v_metricas_requerimientos')
        .select('*')
        .eq(UUID_RE.test(valor) ? 'id' : 'numero', valor)
        .limit(2)
      if (err) return error(`Error consultando el requerimiento: ${err.message}`)
      if (!reqs?.length) return error(`No se encontró ningún requerimiento con id o número "${valor}".`)
      if (reqs.length > 1) {
        return error(`Hay más de un requerimiento con el número "${valor}". Usa el UUID: ${reqs.map((r: Fila) => r.id).join(', ')}`)
      }

      const req = reqs[0]
      const [historial, comentarios, planeacion] = await Promise.all([
        supabase.from('historial_estados')
          .select('estado_anterior, estado_nuevo, observacion, usuario, created_at')
          .eq('requerimiento_id', req.id).order('created_at'),
        supabase.from('comentarios')
          .select('comentario, usuario, created_at')
          .eq('requerimiento_id', req.id).order('created_at'),
        supabase.from('planeacion_etapas')
          .select('estado, fecha_inicio, fecha_fin, updated_by, updated_at')
          .eq('requerimiento_id', req.id).order('fecha_inicio', { nullsFirst: false }),
      ])

      return json({
        requerimiento: req,
        historial_estados: historial.data ?? [],
        comentarios: comentarios.data ?? [],
        planeacion_etapas: planeacion.data ?? [],
      })
    }
  )

  // ── metricas_requerimientos ───────────────────────────────────────────────
  server.registerTool(
    'metricas_requerimientos',
    {
      title: 'Métricas de requerimientos',
      description:
        'Indicadores agregados sobre los requerimientos que cumplen los filtros: conteos por estado, proceso, ' +
        'alcance y prioridad; días promedio en el estado actual; requerimientos atrasados (fecha estimada de ' +
        'entrega vencida y sin entregar); cumplimiento de SLA; horas de desarrollo estimadas; horas hombre ' +
        'ahorradas e impacto económico anual estimado vs. real; y los más estancados.',
      inputSchema: filtrosBase,
      annotations: soloLectura,
    },
    async (args) => {
      const supabase = createAdminClient() as any
      let filas: Fila[]
      let finales: string[]
      try {
        ;[filas, finales] = await Promise.all([
          traerTodas(supabase, COLUMNAS_LISTADO, args),
          estadosFinales(supabase),
        ])
      } catch (e) {
        return error(`Error calculando métricas: ${(e as Error).message}`)
      }

      const hoy = hoyBogota()
      const abiertos = filas.filter(f => !finales.includes(f.estado))
      const atrasados = abiertos
        .filter(f => f.fecha_estimada_entrega && f.fecha_estimada_entrega < hoy && !f.fecha_real_entrega)
        .map(f => ({
          id: f.id, numero: f.numero, nombre: f.nombre_desarrollo ?? f.identificacion, estado: f.estado,
          responsable: f.responsable, fecha_estimada_entrega: f.fecha_estimada_entrega,
          dias_atraso: Math.round((Date.parse(hoy) - Date.parse(f.fecha_estimada_entrega)) / 86_400_000),
        }))
        .sort((a, b) => b.dias_atraso - a.dias_atraso)

      const diasPorEstado: Record<string, number | null> = {}
      for (const estado of Object.keys(contarPor(abiertos, 'estado'))) {
        diasPorEstado[estado] = promedio(
          abiertos.filter(f => f.estado === estado && f.dias_en_estado_actual != null).map(f => Number(f.dias_en_estado_actual))
        )
      }

      const conSla = filas.filter(f => f.cumple_sla != null)
      const estancados = [...abiertos]
        .filter(f => f.dias_en_estado_actual != null)
        .sort((a, b) => Number(b.dias_en_estado_actual) - Number(a.dias_en_estado_actual))
        .slice(0, 10)
        .map(f => ({
          id: f.id, numero: f.numero, nombre: f.nombre_desarrollo ?? f.identificacion, estado: f.estado,
          dias_en_estado_actual: f.dias_en_estado_actual, responsable: f.responsable, prioridad: f.prioridad,
        }))

      const conReal = filas.filter(f => f.impacto_economico_total_anual_real != null || f.horas_ahorradas_mes_real != null)

      return json({
        fecha_corte: hoy,
        estados_finales: finales,
        total: filas.length,
        abiertos: abiertos.length,
        por_estado: contarPor(filas, 'estado'),
        por_proceso: contarPor(filas, 'proceso_interno'),
        por_alcance: contarPor(filas, 'alcance'),
        por_prioridad: contarPor(filas, 'prioridad'),
        por_tipo_solucion: contarPor(filas, 'tipo_solucion'),
        dias_promedio_en_estado_actual: diasPorEstado,
        sla: {
          evaluados: conSla.length,
          cumplen: conSla.filter(f => f.cumple_sla === true).length,
          no_cumplen: conSla.filter(f => f.cumple_sla === false).length,
        },
        atrasados: { cantidad: atrasados.length, detalle: atrasados.slice(0, 25) },
        mas_estancados: estancados,
        horas_desarrollo_estimadas: { total: suma(filas, 'horas_estimadas_desarrollo'), abiertos: suma(abiertos, 'horas_estimadas_desarrollo') },
        impacto_estimado: {
          horas_hombre_ahorradas_mes: suma(filas, 'horas_ahorradas_mes'),
          impacto_economico_total_anual_cop: suma(filas, 'impacto_economico_total_anual'),
        },
        impacto_real: {
          requerimientos_con_impacto_real: conReal.length,
          horas_hombre_ahorradas_mes: suma(conReal, 'horas_ahorradas_mes_real'),
          impacto_economico_total_anual_cop: suma(conReal, 'impacto_economico_total_anual_real'),
          estimado_de_esos_mismos_cop: suma(conReal, 'impacto_economico_total_anual'),
        },
      })
    }
  )

  // ── planeacion_requerimientos ─────────────────────────────────────────────
  server.registerTool(
    'planeacion_requerimientos',
    {
      title: 'Planeación de requerimientos',
      description:
        'Planeación por etapas (plan vs. ejecución), con la misma lógica del Reporte de Planeación de TIN-FLOW. ' +
        'Por defecto devuelve los requerimientos que tienen fechas de planeación registradas. ' +
        'Con solo_vigentes_hoy=true, solo los que tienen al menos una etapa cuyo rango planeado incluye hoy. ' +
        'Por etapa entrega fechas planeadas y reales, desviación en días (positivo = retraso), duración y ' +
        'cumplimiento: A_TIEMPO, RETRASADA, EN_CURSO, VENCIDA (en ejecución con el fin planeado vencido), ' +
        'INICIO_ATRASADO (no ha iniciado y ya pasó el inicio planeado), PENDIENTE, OMITIDA. ' +
        `Etapas planeables: ${ETAPAS_PLANEACION.map(e => `${e.estado} (${e.label})`).join(', ')}.`,
      inputSchema: {
        solo_vigentes_hoy: z.boolean().optional()
          .describe('Solo requerimientos con alguna etapa cuyo rango planeado incluye la fecha de hoy'),
        etapa: z.string().optional().describe('Código de la etapa, ej. EN_DESARROLLO'),
        cumplimiento: z.array(z.enum(CUMPLIMIENTOS)).optional()
          .describe('Solo etapas con estos cumplimientos, ej. ["VENCIDA","INICIO_ATRASADO"]'),
        estados: z.array(z.string()).optional().describe('Estado actual del requerimiento'),
        proceso_interno: z.string().optional().describe('Código del proceso interno, ej. OPERACIONES'),
        desarrollador: z.string().optional().describe('Nombre o parte del nombre de un desarrollador asignado'),
        texto: z.string().optional().describe('Busca en el nombre o número del requerimiento'),
      },
      annotations: soloLectura,
    },
    async (args) => {
      let filas
      try {
        filas = await calcularReportePlaneacion(createAdminClient())
      } catch (e) {
        return error(`Error calculando la planeación: ${(e as Error).message}`)
      }

      const hoy = hoyBogota()
      const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
      const filtroEtapa = !!(args.etapa || args.cumplimiento?.length || args.solo_vigentes_hoy)

      const etapaPasa = (e: EtapaReporte) =>
        e.cumplimiento !== 'SIN_PLAN' &&
        (!args.etapa || e.estado === args.etapa) &&
        (!args.cumplimiento?.length || args.cumplimiento.includes(e.cumplimiento)) &&
        (!args.solo_vigentes_hoy || etapaVigente(e, hoy))

      const resultado = filas
        .filter(r => r.tienePlan) // solo con planeación propia (el reporte agrega padres/hijos como contexto)
        .filter(r => !args.estados?.length || args.estados.includes(r.estado))
        .filter(r => !args.proceso_interno || r.proceso_interno === args.proceso_interno)
        .filter(r => !args.desarrollador || r.desarrolladores.some(d => norm(d.nombre).includes(norm(args.desarrollador!))))
        .filter(r => !args.texto || norm(`${r.numero ?? ''} ${r.nombre}`).includes(norm(args.texto)))
        .map(r => ({ r, etapas: r.etapas.filter(etapaPasa) }))
        .filter(({ etapas }) => etapas.length > 0)
        .map(({ r, etapas }) => ({
          id: r.id,
          numero: r.numero,
          prioridad: r.etiqueta,
          nombre: r.nombre,
          estado_actual: r.estado,
          proceso_interno: r.proceso_interno,
          desarrolladores: r.desarrolladores.map(d => d.nombre),
          etapas: etapas.map(e => ({
            etapa: e.estado,
            nombre: e.label,
            plan_inicio: e.planInicio,
            plan_fin: e.planFin,
            real_inicio: e.realInicio,
            real_fin: e.realFin,
            en_curso: e.enCurso,
            vigente_hoy: etapaVigente(e, hoy),
            cumplimiento: e.cumplimiento,
            desviacion_inicio_dias: e.desvInicio,
            desviacion_fin_dias: e.desvFin,
            duracion_plan_dias: e.duracionPlan,
            duracion_real_dias: e.duracionReal,
            veces_en_etapa: e.veces,
          })),
        }))

      const etapasDevueltas = resultado.flatMap(r => r.etapas)
      return json({
        fecha_corte: hoy,
        filtro_por_etapa: filtroEtapa,
        requerimientos: resultado.length,
        etapas: etapasDevueltas.length,
        etapas_por_cumplimiento: contarPor(etapasDevueltas, 'cumplimiento'),
        etapas_vigentes_hoy: etapasDevueltas.filter(e => e.vigente_hoy).length,
        detalle: resultado,
      })
    }
  )

  return server
}
