import { Suspense } from 'react'
import Link from 'next/link'
import { Plus, FileJson } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FiltrosRequerimientos } from '@/components/requerimientos/FiltrosRequerimientos'
import { TablaRequerimientos, TablaRequerimientosSkeleton } from '@/components/requerimientos/TablaRequerimientos'
import { ExportarExcel } from '@/components/requerimientos/ExportarExcel'
import { createAdminClient } from '@/lib/supabase/admin'
import { getPerfil } from '@/lib/supabase/auth'
import { getLotesConStats } from '@/actions/lotes'
import type { FiltrosRequerimientos as FiltrosType, SortConfig } from '@/hooks/useRequerimientos'
import type { PerfilFiltro } from '@/actions/requerimientos-admin'

interface PageProps {
  searchParams: Promise<{
    q?: string; estado?: string; alcance?: string; prioridad?: string
    proceso?: string; tipo?: string; borrador?: string; page?: string
    sort?: string; dir?: string
  }>
}

async function getTotales(filtros: FiltrosType, perfilFiltro: PerfilFiltro | null) {
  const supabase = createAdminClient()
  const { count: total } = await (supabase as any)
    .from('requerimientos').select('*', { count: 'exact', head: true })

  let query = (supabase as any).from('requerimientos').select('*', { count: 'exact', head: true })
  if (filtros.search?.trim()) {
    const q = filtros.search.trim()
    query = query.or(`identificacion.ilike.%${q}%,nombre_desarrollo.ilike.%${q}%,descripcion_situacion_actual.ilike.%${q}%`)
  }
  if (filtros.estados?.length)   query = query.in('estado', filtros.estados)
  if (filtros.alcance)           query = query.eq('alcance', filtros.alcance)
  if (filtros.prioridad)         query = query.eq('prioridad', parseInt(filtros.prioridad))
  if (filtros.proceso_interno)   query = query.eq('proceso_interno', filtros.proceso_interno)
  if (filtros.tipo_solucion)     query = query.eq('tipo_solucion', filtros.tipo_solucion)
  if (filtros.es_borrador !== undefined) query = query.eq('es_borrador', filtros.es_borrador)

  if (perfilFiltro) {
    const orParts: string[] = [
      `responsable.ilike.%${perfilFiltro.email}%`,
      `partes_interesadas.cs.{${perfilFiltro.email}}`,
    ]
    if (perfilFiltro.proceso_interno) {
      orParts.push(`proceso_interno.eq.${perfilFiltro.proceso_interno}`)
    }
    query = query.or(orParts.join(','))
  }

  const { count: totalFiltrado } = await query
  return { total: total ?? 0, totalFiltrado: totalFiltrado ?? 0 }
}

export default async function AdminRequerimientosPage({ searchParams }: PageProps) {
  const params = await searchParams
  const perfil = await getPerfil()

  const isAdmin = perfil?.rol === 'ADMIN_TIN' || perfil?.rol === 'PRESIDENCIA'
  const perfilFiltro: PerfilFiltro | null = !isAdmin && perfil
    ? { email: perfil.email, proceso_interno: perfil.proceso_interno }
    : null

  const filtros: FiltrosType = {
    search:          params.q,
    estados:         params.estado ? params.estado.split(',').filter(Boolean) : undefined,
    alcance:         params.alcance,
    prioridad:       params.prioridad,
    proceso_interno: params.proceso,
    tipo_solucion:   params.tipo,
    es_borrador:     params.borrador === 'true' ? true : undefined,
  }
  const sort: SortConfig = {
    column:    params.sort ?? 'impacto_economico_total_anual',
    direction: (params.dir === 'asc' ? 'asc' : 'desc') as 'asc' | 'desc',
  }
  const page = Math.max(1, parseInt(params.page ?? '1'))
  const [{ total, totalFiltrado }, lotes] = await Promise.all([
    getTotales(filtros, perfilFiltro),
    getLotesConStats(),
  ])

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Requerimientos</h1>
          <p className="text-sm text-slate-500">Gestión de requerimientos de desarrollo</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportarExcel filtros={filtros} sort={sort} isAdmin={isAdmin} perfilFiltro={perfilFiltro} />
          <Link href="/admin/requerimientos/importar">
            <Button size="sm" variant="outline" className="gap-1.5">
              <FileJson size={14} /> Importar JSON
            </Button>
          </Link>
          <Link href="/admin/requerimientos/nuevo">
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
              <Plus size={15} className="mr-1" /> Nuevo
            </Button>
          </Link>
        </div>
      </div>

      <Suspense>
        <FiltrosRequerimientos total={total} totalFiltrado={totalFiltrado} />
      </Suspense>

      <Suspense fallback={<TablaRequerimientosSkeleton />}>
        <TablaRequerimientos
          filtros={filtros}
          page={page}
          sort={sort}
          basePath="/admin/requerimientos"
          isAdmin
          perfilFiltro={perfilFiltro}
          lotes={lotes}
        />
      </Suspense>
    </div>
  )
}
