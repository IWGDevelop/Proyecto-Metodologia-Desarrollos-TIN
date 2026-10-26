'use server'

import { exigirAccesoAdmin } from '@/lib/supabase/guards'
import { createAdminClient } from '@/lib/supabase/admin'
import { getPerfil } from '@/lib/supabase/auth'
import { revalidatePath } from 'next/cache'
import { PROCESOS_POR_DEFECTO, codigoDesdeNombre, type ProcesoInternoCfg } from '@/lib/procesos'

type Resultado = { ok: boolean; error?: string }

/** Catálogo completo (activos e inactivos) ordenado; si la tabla aún no existe, usa el catálogo por defecto */
export async function getProcesosInternos(): Promise<ProcesoInternoCfg[]> {
  try {
    const supabase = createAdminClient()
    const { data, error } = await (supabase as any)
      .from('procesos_internos')
      .select('valor, label, activo, orden')
      .order('orden', { ascending: true })
      .order('label', { ascending: true })
    if (error || !data?.length) return PROCESOS_POR_DEFECTO
    return data.map((p: any) => ({ value: p.valor, label: p.label, activo: p.activo, orden: p.orden }))
  } catch {
    return PROCESOS_POR_DEFECTO
  }
}

async function soloAdmin(): Promise<string | null> {
  const perfil = await getPerfil()
  return perfil?.rol === 'ADMIN_TIN' ? null : 'Solo un administrador puede modificar los procesos'
}

function refrescar() {
  // El catálogo se carga en el layout raíz: se invalidan todas las páginas
  revalidatePath('/', 'layout')
}

export async function crearProcesoInterno(nombre: string): Promise<Resultado & { valor?: string }> {
  await exigirAccesoAdmin()
  try {
    const noAdmin = await soloAdmin()
    if (noAdmin) return { ok: false, error: noAdmin }

    const label = nombre.trim()
    const valor = codigoDesdeNombre(label)
    if (!label || !valor) return { ok: false, error: 'Escribe el nombre del proceso' }

    const supabase = createAdminClient()
    const { data: existentes } = await (supabase as any).from('procesos_internos').select('valor, label, orden')
    if ((existentes ?? []).some((p: any) => p.valor === valor || p.label.toLowerCase() === label.toLowerCase())) {
      return { ok: false, error: `Ya existe un proceso llamado "${label}"` }
    }
    const orden = Math.max(0, ...(existentes ?? []).map((p: any) => p.orden)) + 10

    const { error } = await (supabase as any).from('procesos_internos').insert({ valor, label, activo: true, orden })
    if (error) return { ok: false, error: error.message }
    refrescar()
    return { ok: true, valor }
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'Error al crear el proceso' }
  }
}

export async function actualizarProcesoInterno(
  valor: string,
  cambios: { label?: string; activo?: boolean },
): Promise<Resultado> {
  await exigirAccesoAdmin()
  try {
    const noAdmin = await soloAdmin()
    if (noAdmin) return { ok: false, error: noAdmin }

    const datos: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (cambios.label !== undefined) {
      const label = cambios.label.trim()
      if (!label) return { ok: false, error: 'El nombre no puede quedar vacío' }
      datos.label = label
    }
    if (cambios.activo !== undefined) datos.activo = cambios.activo

    const supabase = createAdminClient()
    const { error } = await (supabase as any).from('procesos_internos').update(datos).eq('valor', valor)
    if (error) return { ok: false, error: error.message }
    refrescar()
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'Error al actualizar el proceso' }
  }
}

/** Intercambia el orden con el proceso vecino */
export async function moverProcesoInterno(valor: string, direccion: 'arriba' | 'abajo'): Promise<Resultado> {
  await exigirAccesoAdmin()
  try {
    const noAdmin = await soloAdmin()
    if (noAdmin) return { ok: false, error: noAdmin }

    const lista = await getProcesosInternos()
    const i = lista.findIndex(p => p.value === valor)
    const j = direccion === 'arriba' ? i - 1 : i + 1
    if (i < 0 || j < 0 || j >= lista.length) return { ok: true }

    // Se renumera todo de 10 en 10 para que el intercambio sea estable aunque haya órdenes repetidos
    const nuevo = [...lista]
    ;[nuevo[i], nuevo[j]] = [nuevo[j], nuevo[i]]
    const supabase = createAdminClient()
    for (const [k, p] of nuevo.entries()) {
      const orden = (k + 1) * 10
      if (p.orden === orden) continue
      const { error } = await (supabase as any).from('procesos_internos').update({ orden }).eq('valor', p.value)
      if (error) return { ok: false, error: error.message }
    }
    refrescar()
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'Error al reordenar' }
  }
}

/** Cantidad de requerimientos y usuarios que usan cada proceso (para advertir antes de desactivar) */
export async function getUsoProcesos(): Promise<Record<string, { requerimientos: number; usuarios: number }>> {
  await exigirAccesoAdmin()
  const supabase = createAdminClient()
  const [{ data: reqs }, { data: perfiles }] = await Promise.all([
    (supabase as any).from('requerimientos').select('proceso_interno'),
    (supabase as any).from('perfiles').select('proceso_interno'),
  ])
  const uso: Record<string, { requerimientos: number; usuarios: number }> = {}
  for (const r of reqs ?? []) if (r.proceso_interno) (uso[r.proceso_interno] ??= { requerimientos: 0, usuarios: 0 }).requerimientos++
  for (const p of perfiles ?? []) if (p.proceso_interno) (uso[p.proceso_interno] ??= { requerimientos: 0, usuarios: 0 }).usuarios++
  return uso
}
