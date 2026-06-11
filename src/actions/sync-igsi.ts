'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import type { ProcesoInterno } from '@/lib/supabase/types'

interface IgsiInfo {
  Email: string
  Empresa: string
  Unidad_negocio: string
  Proceso: string
  Cargo: string
}

// Mapeo flexible: el texto del API puede tener variaciones ortográficas
function mapProceso(proceso: string): ProcesoInterno {
  const p = proceso.trim().toLowerCase()
  if (
    p.includes('financiero') || p.includes('cartera') ||
    p.includes('facturación') || p.includes('facturacion') ||
    p.includes('anticipos') || p.includes('tesorería') ||
    p.includes('tesoreria') || p.includes('contabilidad') ||
    p.includes('nómina') || p.includes('nomina')
  ) return 'FINANCIERO'
  if (
    p.includes('operaciones') || p.includes('operación') || p.includes('operacion')
  ) return 'OPERACIONES'
  if (
    p.includes('comercial') || p.includes('ventas') || p.includes('mercadeo')
  ) return 'COMERCIAL'
  if (
    p.includes('carga') || p.includes('logística') || p.includes('logistica') ||
    p.includes('transporte') || p.includes('despacho')
  ) return 'CARGA'
  if (
    p.includes('sistemas de gestión') || p.includes('sistemas de gestion') ||
    p.includes('calidad') || p.includes('hseq') || p.includes('iso')
  ) return 'SISTEMAS_GESTION'
  if (
    p.includes('servicio') || p.includes('cliente') ||
    p.includes('call') || p.includes('atención') || p.includes('atencion')
  ) return 'SERVICIO_CLIENTE'
  if (
    p.includes('compras') || p.includes('abastecimiento') ||
    p.includes('proveedores') || p.includes('suministros')
  ) return 'COMPRAS'
  if (p.includes('seguros')) return 'SEGUROS'
  if (
    p.includes('datos') || p.includes('analítica') || p.includes('analitica') ||
    p.includes('inteligencia de negocio') || p === 'bi'
  ) return 'DATOS'
  if (
    p === 'ti' || p.includes('ti ') || p.includes('tecnología') ||
    p.includes('tecnologia') || p.includes('sistemas de información') ||
    p.includes('sistemas de informacion') || p.includes('infraestructura') ||
    p.includes('soporte') || p.includes('desarrollo de software')
  ) return 'TI'
  return 'GENERAL'
}

function mapEmpresa(empresa: string): 'IWF' | 'ILT' | 'IWG' | null {
  const e = empresa.trim().toUpperCase()
  if (e === 'IWF' || e === 'IWG' || e === 'ILT') return e as 'IWF' | 'IWG' | 'ILT'
  return null
}

async function fetchIgsiData(): Promise<IgsiInfo[]> {
  const res = await fetch(
    'https://www.igsiweb.com/Transverseservices/Api/FunctionaryInfo/GetInfoByEmail',
    { cache: 'no-store' }
  )
  if (!res.ok) throw new Error(`IGSI API respondió con error ${res.status}`)
  const data = await res.json()
  return Array.isArray(data) ? data : []
}

// Sincroniza TODOS los perfiles existentes contra el directorio IGSI
export async function sincronizarPerfilesDesdeIGSI(): Promise<{
  actualizados: number
  errores: number
  sinCoincidencia: number
}> {
  const igsiData = await fetchIgsiData()

  const mapa: Record<string, IgsiInfo> = {}
  igsiData.forEach(item => {
    mapa[item.Email.trim().toLowerCase()] = item
  })

  const supabase = createAdminClient()
  const { data: perfiles, error } = await (supabase as any)
    .from('perfiles')
    .select('id, email')

  if (error) throw new Error(error.message)

  let actualizados = 0
  let errores = 0
  let sinCoincidencia = 0

  for (const perfil of (perfiles ?? [])) {
    const igsi = mapa[(perfil.email ?? '').trim().toLowerCase()]
    if (!igsi) { sinCoincidencia++; continue }

    const proceso_interno = mapProceso(igsi.Proceso)
    const empresa         = mapEmpresa(igsi.Empresa)
    const cargo           = igsi.Cargo?.trim() || null

    const patch: Record<string, unknown> = { proceso_interno }
    if (empresa) patch.empresa = empresa
    if (cargo)   patch.cargo   = cargo

    const { error: updateError } = await (supabase as any)
      .from('perfiles')
      .update(patch)
      .eq('id', perfil.id)

    if (updateError) errores++
    else actualizados++
  }

  return { actualizados, errores, sinCoincidencia }
}

// Busca info IGSI para un solo correo (usado al crear usuario)
export async function buscarInfoIgsiPorEmail(email: string): Promise<{
  proceso_interno: ProcesoInterno | null
  empresa: 'IWF' | 'ILT' | 'IWG' | null
  cargo: string | null
}> {
  try {
    const igsiData = await fetchIgsiData()
    const igsi = igsiData.find(
      item => item.Email.trim().toLowerCase() === email.trim().toLowerCase()
    )
    if (!igsi) return { proceso_interno: null, empresa: null, cargo: null }
    return {
      proceso_interno: mapProceso(igsi.Proceso),
      empresa:         mapEmpresa(igsi.Empresa),
      cargo:           igsi.Cargo?.trim() || null,
    }
  } catch {
    return { proceso_interno: null, empresa: null, cargo: null }
  }
}
