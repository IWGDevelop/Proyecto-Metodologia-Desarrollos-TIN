'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getPerfil } from '@/lib/supabase/auth'
import type {
  RegistroUsoIA, MetricaUsuarioIA,
  ActividadUsoIA, BeneficioCualitativoUsoIA,
} from '@/lib/supabase/types'

// ─── Input ────────────────────────────────────────────────────────────────────
export interface NuevoRegistroUsoIAInput {
  cedula: string
  fecha: string
  herramienta: string
  proceso: string
  descripcion: string
  actividades: ActividadUsoIA[]
  salario_mensual_cop?: number | null
  beneficios_cualitativos: BeneficioCualitativoUsoIA[]
}

function calcTotales(
  actividades: ActividadUsoIA[],
  salario_mensual_cop: number | null | undefined,
) {
  const horas_ahorradas_mes = actividades.reduce((sum, a) => sum + (a.horas_mes_ahorradas ?? 0), 0)
  const valor_hora = salario_mensual_cop ? salario_mensual_cop / 160 : null
  const ahorro_mensual_cop = valor_hora ? Math.round(horas_ahorradas_mes * valor_hora) : null
  const ahorro_anual_cop = ahorro_mensual_cop ? ahorro_mensual_cop * 12 : null
  return { horas_ahorradas_mes, valor_hora, ahorro_mensual_cop, ahorro_anual_cop }
}

// ─── Crear registro ───────────────────────────────────────────────────────────
export async function crearRegistroUsoIA(
  input: NuevoRegistroUsoIAInput
): Promise<{ ok: boolean; id?: string; error?: string }> {
  try {
    const perfil = await getPerfil()
    if (!perfil) return { ok: false, error: 'No autenticado' }

    const supabase = createAdminClient()
    const { horas_ahorradas_mes, valor_hora, ahorro_mensual_cop, ahorro_anual_cop } =
      calcTotales(input.actividades, input.salario_mensual_cop)

    const { data, error } = await (supabase as any)
      .from('registros_uso_ia')
      .insert({
        usuario_id:            perfil.id,
        cedula:                input.cedula || null,
        fecha:                 input.fecha,
        herramienta:           input.herramienta,
        proceso:               input.proceso,
        descripcion:           input.descripcion,
        actividades:           input.actividades,
        salario_mensual_cop:   input.salario_mensual_cop ?? null,
        horas_ahorradas_mes,
        valor_hora,
        ahorro_mensual_cop,
        ahorro_anual_cop,
        beneficios_cualitativos: input.beneficios_cualitativos,
      })
      .select('id')
      .single()

    if (error) return { ok: false, error: error.message }

    // Actualizar cédula en el perfil si no la tenía
    if (input.cedula && !perfil.cedula) {
      await (supabase as any)
        .from('perfiles')
        .update({ cedula: input.cedula })
        .eq('id', perfil.id)
    }

    return { ok: true, id: data.id }
  } catch (e: any) {
    return { ok: false, error: e?.message }
  }
}

// ─── Mis registros ────────────────────────────────────────────────────────────
export async function getMisRegistrosUsoIA(): Promise<RegistroUsoIA[]> {
  const perfil = await getPerfil()
  if (!perfil) return []

  const supabase = createAdminClient()
  const { data, error } = await (supabase as any)
    .from('registros_uso_ia')
    .select('*')
    .eq('usuario_id', perfil.id)
    .order('fecha', { ascending: false })

  if (error) return []
  return data ?? []
}

// ─── Mis métricas acumuladas ──────────────────────────────────────────────────
export async function getMisMétricasUsoIA(): Promise<{
  total_registros: number
  total_horas_mes: number
  total_ahorro_mensual: number
  total_ahorro_anual: number
  herramientas: string[]
}> {
  const registros = await getMisRegistrosUsoIA()
  return {
    total_registros:      registros.length,
    total_horas_mes:      registros.reduce((s, r) => s + (r.horas_ahorradas_mes ?? 0), 0),
    total_ahorro_mensual: registros.reduce((s, r) => s + (r.ahorro_mensual_cop ?? 0), 0),
    total_ahorro_anual:   registros.reduce((s, r) => s + (r.ahorro_anual_cop   ?? 0), 0),
    herramientas:         [...new Set(registros.map(r => r.herramienta))],
  }
}

// ─── Todos los registros (admin) ──────────────────────────────────────────────
export async function getAllRegistrosUsoIA(params?: {
  search?: string
  herramienta?: string
  mes?: string // YYYY-MM
}): Promise<RegistroUsoIA[]> {
  const supabase = createAdminClient()
  let query = (supabase as any)
    .from('registros_uso_ia')
    .select(`*, usuario:usuario_id(id, nombre_completo, cedula, cargo, proceso_interno, empresa)`)
    .order('fecha', { ascending: false })

  if (params?.herramienta) query = query.eq('herramienta', params.herramienta)
  if (params?.mes) {
    query = query
      .gte('fecha', `${params.mes}-01`)
      .lt('fecha', `${params.mes}-31`)
  }
  if (params?.search?.trim()) {
    const q = params.search.trim()
    query = query.or(`proceso.ilike.%${q}%,descripcion.ilike.%${q}%,herramienta.ilike.%${q}%`)
  }

  const { data, error } = await query
  if (error) return []
  return data ?? []
}

// ─── Métricas agregadas por funcionario (admin) ───────────────────────────────
export async function getMetricasUsoIAPorUsuario(): Promise<MetricaUsuarioIA[]> {
  const supabase = createAdminClient()
  const { data, error } = await (supabase as any)
    .from('registros_uso_ia')
    .select(`
      usuario_id, cedula, horas_ahorradas_mes, ahorro_mensual_cop, ahorro_anual_cop,
      herramienta, fecha,
      usuario:usuario_id(nombre_completo, cedula, cargo, proceso_interno, empresa)
    `)
    .order('fecha', { ascending: false })

  if (error) return []

  const rows: any[] = data ?? []
  const map = new Map<string, MetricaUsuarioIA>()

  for (const r of rows) {
    const uid = r.usuario_id
    if (!map.has(uid)) {
      map.set(uid, {
        usuario_id:              uid,
        cedula:                  r.usuario?.cedula ?? r.cedula ?? null,
        nombre:                  r.usuario?.nombre_completo ?? 'Sin nombre',
        cargo:                   r.usuario?.cargo ?? null,
        proceso_interno:         r.usuario?.proceso_interno ?? null,
        empresa:                 r.usuario?.empresa ?? null,
        total_registros:         0,
        total_horas_ahorradas_mes: 0,
        total_ahorro_mensual_cop:  0,
        total_ahorro_anual_cop:    0,
        herramientas:            [],
        ultimo_registro:         r.fecha,
      })
    }
    const m = map.get(uid)!
    m.total_registros++
    m.total_horas_ahorradas_mes  += r.horas_ahorradas_mes  ?? 0
    m.total_ahorro_mensual_cop   += r.ahorro_mensual_cop   ?? 0
    m.total_ahorro_anual_cop     += r.ahorro_anual_cop     ?? 0
    if (r.herramienta && !m.herramientas.includes(r.herramienta)) {
      m.herramientas.push(r.herramienta)
    }
    if (r.fecha > m.ultimo_registro) m.ultimo_registro = r.fecha
  }

  return [...map.values()].sort((a, b) => b.total_horas_ahorradas_mes - a.total_horas_ahorradas_mes)
}

// ─── Overview total (admin) ───────────────────────────────────────────────────
export async function getOverviewMetricasIA(): Promise<{
  total_usuarios: number
  total_registros: number
  total_horas_mes: number
  total_ahorro_mensual: number
  total_ahorro_anual: number
  herramientas_top: { herramienta: string; count: number }[]
}> {
  const supabase = createAdminClient()
  const { data, error } = await (supabase as any)
    .from('registros_uso_ia')
    .select('usuario_id, horas_ahorradas_mes, ahorro_mensual_cop, ahorro_anual_cop, herramienta')

  if (error) return {
    total_usuarios: 0, total_registros: 0, total_horas_mes: 0,
    total_ahorro_mensual: 0, total_ahorro_anual: 0, herramientas_top: [],
  }

  const rows: any[] = data ?? []
  const usuarios = new Set(rows.map((r: any) => r.usuario_id))
  const toolCount = new Map<string, number>()
  let horas = 0, mensual = 0, anual = 0

  for (const r of rows) {
    horas   += r.horas_ahorradas_mes  ?? 0
    mensual += r.ahorro_mensual_cop   ?? 0
    anual   += r.ahorro_anual_cop     ?? 0
    if (r.herramienta) toolCount.set(r.herramienta, (toolCount.get(r.herramienta) ?? 0) + 1)
  }

  const herramientas_top = [...toolCount.entries()]
    .map(([herramienta, count]) => ({ herramienta, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  return {
    total_usuarios:   usuarios.size,
    total_registros:  rows.length,
    total_horas_mes:  Math.round(horas * 10) / 10,
    total_ahorro_mensual: Math.round(mensual),
    total_ahorro_anual:   Math.round(anual),
    herramientas_top,
  }
}
