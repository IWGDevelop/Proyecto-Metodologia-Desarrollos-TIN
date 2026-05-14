'use client'

import { useState } from 'react'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { FiltrosReportes } from '@/components/reportes/FiltrosReportes'
import { ReporteImpactoEconomico } from '@/components/reportes/ReporteImpactoEconomico'
import { ReporteRespuestaTIN } from '@/components/reportes/ReporteRespuestaTIN'
import { ReporteDesarrollo } from '@/components/reportes/ReporteDesarrollo'
import { ReportePruebas } from '@/components/reportes/ReportePruebas'
import { ReporteStandBy } from '@/components/reportes/ReporteStandBy'
import { ReporteProductividad } from '@/components/reportes/ReporteProductividad'
import { useReportesData, FILTROS_INIT, type FiltrosReportes as TFiltros } from '@/hooks/useReportesData'
import { exportarReporteCompleto } from '@/lib/exportar'
import { ESTADOS, PRIORIDADES, SLA_DIAS } from '@/lib/constants'
import { formatFecha, formatCOP } from '@/lib/utils'
import type { MetricaRequerimiento, Estado } from '@/lib/supabase/types'

function exportarCompleto(datos: MetricaRequerimiento[]) {
  const conImpacto = datos.filter(r => r.ahorro_anual_cop && r.ahorro_anual_cop > 0)
  const conTIN     = datos.filter(r => r.fecha_envio_tin && r.fecha_inicio_desarrollo)
  const conDev     = datos.filter(r => r.fecha_inicio_desarrollo && r.fecha_estimada_entrega)
  const conPruebas = datos.filter(r => r.inicio_pruebas_usuario)
  const standBy    = datos.filter(r => r.estado === 'STAND_BY')

  exportarReporteCompleto([
    {
      nombre: '1. Impacto Economico',
      datos: conImpacto.sort((a, b) => (b.ahorro_anual_cop ?? 0) - (a.ahorro_anual_cop ?? 0)),
      columnas: [
        { titulo: 'Nombre',         ancho: 50, render: (r: MetricaRequerimiento) => r.nombre_desarrollo ?? r.identificacion },
        { titulo: 'Alcance',        ancho: 8,  render: (r: MetricaRequerimiento) => r.alcance },
        { titulo: 'Responsable',    ancho: 22, render: (r: MetricaRequerimiento) => r.responsable },
        { titulo: 'Horas/mes',      ancho: 12, render: (r: MetricaRequerimiento) => r.horas_ahorradas_mes?.toFixed(1) },
        { titulo: 'Ahorro mensual', ancho: 20, render: (r: MetricaRequerimiento) => r.ahorro_mensual_cop },
        { titulo: 'Ahorro anual',   ancho: 20, render: (r: MetricaRequerimiento) => r.ahorro_anual_cop },
      ],
    },
    {
      nombre: '2. Respuesta TIN',
      datos: conTIN,
      columnas: [
        { titulo: 'Nombre',         ancho: 50, render: (r: MetricaRequerimiento) => r.nombre_desarrollo ?? r.identificacion },
        { titulo: 'Prioridad',      ancho: 10, render: (r: MetricaRequerimiento) => r.prioridad ? `P${r.prioridad}` : '' },
        { titulo: 'Envío TIN',      ancho: 16, render: (r: MetricaRequerimiento) => formatFecha(r.fecha_envio_tin) },
        { titulo: 'Inicio Dev',     ancho: 16, render: (r: MetricaRequerimiento) => formatFecha(r.fecha_inicio_desarrollo) },
        { titulo: 'Días respuesta', ancho: 14, render: (r: MetricaRequerimiento) => r.dias_respuesta_tin },
        { titulo: 'Cumple SLA',     ancho: 12, render: (r: MetricaRequerimiento) => r.cumple_sla ? 'Sí' : 'No' },
      ],
    },
    {
      nombre: '3. Desarrollo',
      datos: conDev,
      columnas: [
        { titulo: 'Nombre',   ancho: 50, render: (r: MetricaRequerimiento) => r.nombre_desarrollo ?? r.identificacion },
        { titulo: 'Inicio',   ancho: 16, render: (r: MetricaRequerimiento) => formatFecha(r.fecha_inicio_desarrollo) },
        { titulo: 'Estimada', ancho: 16, render: (r: MetricaRequerimiento) => formatFecha(r.fecha_estimada_entrega) },
        { titulo: 'Real',     ancho: 16, render: (r: MetricaRequerimiento) => formatFecha(r.fecha_real_entrega) },
        { titulo: 'Estado',   ancho: 18, render: (r: MetricaRequerimiento) => ESTADOS[r.estado as Estado]?.label },
      ],
    },
    {
      nombre: '4. Pruebas',
      datos: conPruebas,
      columnas: [
        { titulo: 'Nombre',        ancho: 50, render: (r: MetricaRequerimiento) => r.nombre_desarrollo ?? r.identificacion },
        { titulo: 'Responsable',   ancho: 22, render: (r: MetricaRequerimiento) => r.responsable },
        { titulo: 'Inicio pruebas',ancho: 16, render: (r: MetricaRequerimiento) => formatFecha(r.inicio_pruebas_usuario) },
        { titulo: 'Fin pruebas',   ancho: 16, render: (r: MetricaRequerimiento) => formatFecha(r.fin_pruebas_usuario) },
        { titulo: 'Estado',        ancho: 18, render: (r: MetricaRequerimiento) => ESTADOS[r.estado as Estado]?.label },
      ],
    },
    {
      nombre: '5. Stand By',
      datos: standBy.sort((a, b) => (b.dias_en_estado_actual ?? 0) - (a.dias_en_estado_actual ?? 0)),
      columnas: [
        { titulo: 'Nombre',      ancho: 50, render: (r: MetricaRequerimiento) => r.nombre_desarrollo ?? r.identificacion },
        { titulo: 'Responsable', ancho: 22, render: (r: MetricaRequerimiento) => r.responsable },
        { titulo: 'Días',        ancho: 8,  render: (r: MetricaRequerimiento) => r.dias_en_estado_actual },
        { titulo: 'Motivo',      ancho: 50, render: (r: MetricaRequerimiento) => r.motivo_stand_by ?? 'Sin motivo' },
      ],
    },
  ])
}

export default function AdminReportesPage() {
  const [filtros, setFiltros] = useState<TFiltros>(FILTROS_INIT)
  const { datos, isLoading } = useReportesData(filtros, true)

  const handleExportarCompleto = () => {
    if (!datos.length) { toast.error('Sin datos en el período seleccionado'); return }
    try {
      exportarCompleto(datos)
      toast.success(`Reporte completo exportado (${datos.length} requerimientos)`)
    } catch {
      toast.error('Error al exportar el reporte completo')
    }
  }

  return (
    <div className="space-y-6 p-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Reportes</h1>
          <p className="text-sm text-slate-500">Métricas e indicadores de gestión de desarrollo TIN</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleExportarCompleto} disabled={isLoading} className="gap-1.5 text-xs">
          <Download size={13} /> 📥 Exportar reporte completo
        </Button>
      </div>

      <FiltrosReportes filtros={filtros} onChange={setFiltros} total={datos.length} />

      <div className="space-y-10">
        <section><ReporteImpactoEconomico datos={datos} isLoading={isLoading} /></section>
        <div className="border-t border-slate-200" />
        <section><ReporteRespuestaTIN datos={datos} isLoading={isLoading} /></section>
        <div className="border-t border-slate-200" />
        <section><ReporteDesarrollo datos={datos} isLoading={isLoading} /></section>
        <div className="border-t border-slate-200" />
        <section><ReportePruebas datos={datos} isLoading={isLoading} /></section>
        <div className="border-t border-slate-200" />
        <section><ReporteStandBy datos={datos} isLoading={isLoading} /></section>
        <div className="border-t border-slate-200" />
        <section><ReporteProductividad datos={datos} isLoading={isLoading} /></section>
      </div>
    </div>
  )
}
