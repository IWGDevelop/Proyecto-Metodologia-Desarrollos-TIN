'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Plus, Calendar, MapPin, Clock, DollarSign } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PublicarRequerimientoBtn } from '@/components/requerimientos/PublicarRequerimientoBtn'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ESTADOS, PRIORIDADES, getEstadoCfg } from '@/lib/constants'
import { formatFecha, formatCOP, cn } from '@/lib/utils'
import type { Requerimiento, Perfil, Estado } from '@/lib/supabase/types'

interface Props {
  requerimientos: Requerimiento[]
  perfil: Perfil
}

const FILTROS_ESTADO = [
  { value: 'TODOS', label: 'Todos' },
  { value: 'BORRADOR', label: 'Borradores' },
  { value: 'SIN_GESTION', label: 'Enviados' },
  { value: 'EN_PROCESO', label: 'En proceso' },
  { value: 'ENTREGADO', label: 'Entregados' },
]

type TipoRelacion = 'propietario' | 'participo' | 'proceso'

function CardRequerimiento({ req, tipo }: { req: Requerimiento; tipo: TipoRelacion }) {
  const estadoCfg    = getEstadoCfg(req.estado)
  const prioridadCfg = req.prioridad ? PRIORIDADES[req.prioridad] : null
  const impacto      = (req as any).impacto_economico_total_anual ?? req.ahorro_anual_cop

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
      {/* Header badges */}
      <div className="flex flex-wrap items-center gap-2">
        {req.alcance && (
          <Badge variant="outline" className={cn('text-xs', {
            'border-blue-300 text-blue-700': req.alcance === 'IWF',
            'border-green-300 text-green-700': req.alcance === 'ILT',
            'border-purple-300 text-purple-700': req.alcance === 'IWG',
          })}>
            {req.alcance}
          </Badge>
        )}
        {prioridadCfg && (
          <span className={cn('rounded-full px-2 py-0.5 text-xs font-bold', prioridadCfg.bgColor, prioridadCfg.textColor)}>
            P{req.prioridad}
          </span>
        )}
        <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold ml-auto', estadoCfg.bgColor, estadoCfg.textColor)}>
          {estadoCfg.label}
        </span>
        {tipo === 'participo' && (
          <Badge variant="secondary" className="text-xs">Parte interesada</Badge>
        )}
        {tipo === 'proceso' && (
          <Badge variant="outline" className="text-xs border-violet-300 bg-violet-50 text-violet-700">Mi proceso</Badge>
        )}
      </div>

      {/* Nombre */}
      <p className="font-semibold text-slate-800 leading-snug">{req.nombre_desarrollo ?? req.identificacion}</p>

      {/* Meta info */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
        {req.fecha_envio_solicitud && (
          <span className="flex items-center gap-1"><Calendar size={11} /> {formatFecha(req.fecha_envio_solicitud)}</span>
        )}
        {req.proceso_interno && (
          <span className="flex items-center gap-1"><MapPin size={11} /> {req.proceso_interno}</span>
        )}
      </div>

      {/* Progress */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">Progreso</span>
          <span className="font-semibold text-slate-700">{req.porcentaje_avance}%</span>
        </div>
        <Progress value={req.porcentaje_avance} className="h-1.5" />
      </div>

      {/* Impacto */}
      {impacto && impacto > 0 && (
        <div className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          <DollarSign size={12} />
          <span>Impacto proyectado: <strong>{formatCOP(impacto)}</strong> COP/año</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <Link href={`/mis-requerimientos/${req.id}`} className="flex-1">
          <Button size="sm" variant="outline" className="w-full text-xs">Ver detalle →</Button>
        </Link>
        {req.es_borrador && tipo === 'propietario' && (
          <>
            <Link href={`/mis-requerimientos/${req.id}`}>
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-xs">Editar borrador</Button>
            </Link>
            <PublicarRequerimientoBtn requerimientoId={req.id} />
          </>
        )}
      </div>
    </div>
  )
}

export function MisRequerimientosClient({ requerimientos, perfil }: Props) {
  const [filtroEstado, setFiltroEstado] = useState('TODOS')

  const mios = useMemo(() => requerimientos.filter(r =>
    r.responsable?.toLowerCase().includes(perfil.email.toLowerCase()) ||
    r.responsable?.toLowerCase().includes(perfil.nombre_completo.toLowerCase())
  ), [requerimientos, perfil])

  const participo = useMemo(() => requerimientos.filter(r =>
    !mios.includes(r) && (
      r.partes_interesadas?.some(p =>
        p.toLowerCase().includes(perfil.email.toLowerCase()) ||
        p.toLowerCase().includes(perfil.nombre_completo.toLowerCase())
      )
    )
  ), [requerimientos, mios, perfil])

  const miProceso = useMemo(() => {
    if (!perfil.proceso_interno) return []
    return requerimientos.filter(r =>
      !mios.includes(r) &&
      !participo.includes(r) &&
      r.proceso_interno === perfil.proceso_interno &&
      !r.es_borrador
    )
  }, [requerimientos, mios, participo, perfil])

  const filtrar = (list: Requerimiento[]) => {
    if (filtroEstado === 'TODOS') return list
    if (filtroEstado === 'BORRADOR') return list.filter(r => r.es_borrador)
    if (filtroEstado === 'EN_PROCESO') return list.filter(r =>
      ['ANALISIS', 'EN_DESARROLLO', 'PRUEBAS_USUARIO', 'STAND_BY'].includes(r.estado)
    )
    return list.filter(r => r.estado === filtroEstado && !r.es_borrador)
  }

  const totalImpacto = mios.reduce((s, r) =>
    s + ((r as any).impacto_economico_total_anual ?? r.ahorro_anual_cop ?? 0), 0
  )

  return (
    <div className="space-y-4">
      {/* Nueva solicitud */}
      <div className="flex justify-end">
        <Link href="/mis-requerimientos/nuevo">
          <Button className="bg-blue-600 hover:bg-blue-700 gap-1.5">
            <Plus size={15} /> Nueva solicitud
          </Button>
        </Link>
      </div>

      {/* Filtros pill */}
      <div className="flex flex-wrap gap-2">
        {FILTROS_ESTADO.map(f => (
          <button
            key={f.value}
            onClick={() => setFiltroEstado(f.value)}
            className={cn(
              'rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
              filtroEstado === f.value
                ? 'bg-blue-600 text-white'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <Tabs defaultValue="mias">
        <TabsList>
          <TabsTrigger value="mias">Mis solicitudes ({mios.length})</TabsTrigger>
          <TabsTrigger value="participo">Donde participo ({participo.length})</TabsTrigger>
          {perfil.proceso_interno && (
            <TabsTrigger value="proceso">Mi proceso ({miProceso.length})</TabsTrigger>
          )}
          <TabsTrigger value="resumen">Resumen</TabsTrigger>
        </TabsList>

        <TabsContent value="mias" className="mt-4">
          {filtrar(mios).length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-white py-12 text-center">
              <p className="text-sm text-slate-400">No tienes solicitudes en esta categoría</p>
              <Link href="/mis-requerimientos/nuevo">
                <Button size="sm" className="mt-3 bg-blue-600 hover:bg-blue-700">+ Nueva solicitud</Button>
              </Link>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filtrar(mios).map(r => (
                <CardRequerimiento key={r.id} req={r} tipo="propietario" />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="participo" className="mt-4">
          {filtrar(participo).length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-white py-12 text-center">
              <p className="text-sm text-slate-400">No participas en ningún requerimiento</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filtrar(participo).map(r => (
                <CardRequerimiento key={r.id} req={r} tipo="participo" />
              ))}
            </div>
          )}
        </TabsContent>

        {perfil.proceso_interno && (
          <TabsContent value="proceso" className="mt-4">
            <p className="mb-3 text-xs text-slate-500">
              Requerimientos del proceso <strong className="text-slate-700">{perfil.proceso_interno}</strong> en los que no estás listado directamente.
            </p>
            {filtrar(miProceso).length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-white py-12 text-center">
                <p className="text-sm text-slate-400">No hay requerimientos activos de tu proceso</p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {filtrar(miProceso).map(r => (
                  <CardRequerimiento key={r.id} req={r} tipo="proceso" />
                ))}
              </div>
            )}
          </TabsContent>
        )}

        <TabsContent value="resumen" className="mt-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: 'Total mis solicitudes',    valor: mios.length,   color: 'text-slate-700' },
              { label: 'En proceso',                valor: mios.filter(r => ['ANALISIS','EN_DESARROLLO','PRUEBAS_USUARIO','STAND_BY'].includes(r.estado)).length, color: 'text-blue-600' },
              { label: 'Entregadas',                valor: mios.filter(r => ['ENTREGADO','CERRADO'].includes(r.estado)).length, color: 'text-emerald-600' },
              { label: 'Ahorro total proyectado',   valor: formatCOP(totalImpacto), color: 'text-2xl font-extrabold text-emerald-700' },
            ].map(({ label, valor, color }) => (
              <div key={label} className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-xs text-slate-500">{label}</p>
                <p className={cn('mt-1 font-bold text-xl', color)}>{valor}</p>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
