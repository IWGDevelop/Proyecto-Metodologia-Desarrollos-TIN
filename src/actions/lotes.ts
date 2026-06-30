'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export interface Lote {
  id: string
  numero: number
  nombre: string
  descripcion: string | null
  cerrado: boolean
  activo: boolean
  fecha_cierre: string | null
  created_at: string
}

export interface LoteConStats extends Lote {
  total: number
}

export async function getLotesConStats(): Promise<LoteConStats[]> {
  try {
    const supabase = createAdminClient()
    const [{ data: lotes }, { data: reqs }] = await Promise.all([
      (supabase as any).from('lotes').select('*').order('numero', { ascending: false }),
      (supabase as any).from('requerimientos').select('lote_id'),
    ])

    const countMap: Record<string, number> = {}
    for (const r of (reqs ?? [])) {
      if (r.lote_id) countMap[r.lote_id] = (countMap[r.lote_id] ?? 0) + 1
    }

    return (lotes ?? []).map((l: Lote) => ({ ...l, total: countMap[l.id] ?? 0 }))
  } catch {
    return []
  }
}

export async function getConfigBloqueo(): Promise<boolean> {
  try {
    const supabase = createAdminClient()
    const { data } = await (supabase as any)
      .from('configuracion_global')
      .select('valor')
      .eq('clave', 'bloquear_nuevos_requerimientos')
      .single()
    return data?.valor === 'true'
  } catch {
    return false
  }
}

export async function setConfigBloqueo(valor: boolean) {
  const supabase = createAdminClient()
  await (supabase as any)
    .from('configuracion_global')
    .upsert({
      clave: 'bloquear_nuevos_requerimientos',
      valor: String(valor),
      updated_at: new Date().toISOString(),
    })
  revalidatePath('/admin/lotes')
  revalidatePath('/admin/requerimientos/nuevo')
}

export async function crearLote(nombre: string, descripcion?: string) {
  const supabase = createAdminClient()

  const { data: existing } = await (supabase as any)
    .from('lotes').select('numero').order('numero', { ascending: false }).limit(1)
  const nextNumero = (existing?.[0]?.numero ?? 0) + 1

  // Desactivar lote activo anterior
  await (supabase as any).from('lotes').update({ activo: false }).eq('activo', true)

  const { error } = await (supabase as any).from('lotes').insert({
    numero: nextNumero,
    nombre,
    descripcion: descripcion?.trim() || null,
    cerrado: false,
    activo: true,
  })

  if (error) throw new Error(`Error al crear lote: ${error.message}`)
  revalidatePath('/admin/lotes')
  revalidatePath('/admin/requerimientos')
}

export async function cerrarLote(id: string) {
  const supabase = createAdminClient()
  const { error } = await (supabase as any).from('lotes').update({
    cerrado: true,
    activo: false,
    fecha_cierre: new Date().toISOString(),
  }).eq('id', id)

  if (error) throw new Error(`Error al cerrar lote: ${error.message}`)
  revalidatePath('/admin/lotes')
  revalidatePath('/admin/requerimientos')
}

export async function getLoteActivo(): Promise<Lote | null> {
  try {
    const supabase = createAdminClient()
    const { data } = await (supabase as any)
      .from('lotes').select('*').eq('activo', true).single()
    return data as Lote | null
  } catch {
    return null
  }
}
