import { Suspense } from 'react'
import { KPICards, KPICardsSkeleton } from '@/components/dashboard/KPICards'
import { ImpactoEconomico, ImpactoEconomicoSkeleton } from '@/components/dashboard/ImpactoEconomico'
import { GraficaEstados, GraficaEstadosSkeleton } from '@/components/dashboard/GraficaEstados'
import { GraficaProcesos, GraficaProcesosSkeleton } from '@/components/dashboard/GraficaProcesos'
import { TopImpacto, TopImpactoSkeleton } from '@/components/dashboard/TopImpacto'
import { AlertasCriticas, AlertasCriticasSkeleton } from '@/components/dashboard/AlertasCriticas'
import { ActividadReciente, ActividadRecienteSkeleton } from '@/components/dashboard/ActividadReciente'
import { HorasDesarrollo, HorasDesarrolloSkeleton } from '@/components/dashboard/HorasDesarrollo'

export const dynamic = 'force-dynamic'

export default function DashboardPage() {
  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Dashboard</h1>
        <p className="text-sm text-slate-500">
          Resumen ejecutivo ·{' '}
          {new Date().toLocaleDateString('es-CO', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
          })}
        </p>
      </div>

      <Suspense fallback={<KPICardsSkeleton />}>
        <KPICards />
      </Suspense>

      <Suspense fallback={<HorasDesarrolloSkeleton />}>
        <HorasDesarrollo />
      </Suspense>

      <Suspense fallback={<ImpactoEconomicoSkeleton />}>
        <ImpactoEconomico />
      </Suspense>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Suspense fallback={<GraficaEstadosSkeleton />}>
          <GraficaEstados />
        </Suspense>
        <Suspense fallback={<GraficaProcesosSkeleton />}>
          <GraficaProcesos />
        </Suspense>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Suspense fallback={<TopImpactoSkeleton />}>
          <TopImpacto />
        </Suspense>
        <Suspense fallback={<AlertasCriticasSkeleton />}>
          <AlertasCriticas />
        </Suspense>
      </div>

      <Suspense fallback={<ActividadRecienteSkeleton />}>
        <ActividadReciente />
      </Suspense>
    </div>
  )
}
