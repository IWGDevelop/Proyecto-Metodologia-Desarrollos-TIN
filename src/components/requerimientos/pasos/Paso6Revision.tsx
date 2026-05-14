'use client'

import { useState } from 'react'
import type { UseFormReturn } from 'react-hook-form'
import type { WizardData } from '@/lib/schemas/requerimiento'
import { Checkbox } from '@/components/ui/checkbox'
import { ChevronDown, ChevronUp, CheckCircle2 } from 'lucide-react'
import { formatFecha, formatCOP, cn } from '@/lib/utils'
import { PRIORIDADES, PROCESOS_INTERNOS, TIPOS_SOLICITUD } from '@/lib/constants'
import { calcularActividad, calcValorAnual, calcTotalCualitativos } from '@/lib/schemas/requerimiento'

function SeccionColapsable({
  titulo, icono, children, defaultOpen = true,
}: { titulo: string; icono: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [abierta, setAbierta] = useState(defaultOpen)
  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => setAbierta(!abierta)}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-50"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <span className="text-base">{icono}</span> {titulo}
        </span>
        {abierta ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
      </button>
      {abierta && <div className="border-t border-slate-100 px-4 py-3">{children}</div>}
    </div>
  )
}

function Row({ label, valor }: { label: string; valor: React.ReactNode }) {
  if (!valor || valor === '' || valor === '—') return null
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 text-xs">
      <span className="shrink-0 text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-700">{valor}</span>
    </div>
  )
}

const PERIODICIDAD_LABELS: Record<string, string> = {
  UNICO: 'Único', MENSUAL: 'Mensual', ANUAL: 'Anual',
}

interface Props {
  form: UseFormReturn<WizardData>
  confirmado: boolean
  onConfirmadoChange: (v: boolean) => void
}

export function Paso6Revision({ form, confirmado, onConfirmadoChange }: Props) {
  const data = form.watch()

  // Cálculos HH
  const totalHorasMes = (data.actividades ?? []).reduce((sum, act) => {
    try { return sum + calcularActividad(act).horas_mes } catch { return sum }
  }, 0)
  const valorHora   = (data.salario_promedio_cargo ?? 0) / (data.horas_laborales_mes ?? 192)
  const ahorroMensualHH = totalHorasMes * valorHora
  const ahorroAnualHH   = ahorroMensualHH * 12

  // Cálculos cualitativos
  const beneficiosMarcados = (data.beneficios ?? []).filter(b => b.marcado)
  const totalAnualCualitativos = calcTotalCualitativos(data.beneficios ?? [])
  const impactoTotal = ahorroAnualHH + totalAnualCualitativos

  const tipoLabel    = TIPOS_SOLICITUD.find(t => t.value === data.tipo_solicitud)?.label ?? data.tipo_solicitud
  const procesoLabel = PROCESOS_INTERNOS.find(p => p.value === data.proceso_interno)?.label
  const prioridadCfg = data.prioridad ? PRIORIDADES[data.prioridad] : null

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4">
        <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-blue-500" />
        <p className="text-sm text-blue-700">
          Revisa toda la información antes de enviar. Puedes volver a cualquier paso para hacer cambios.
        </p>
      </div>

      {/* S1 — Encabezado */}
      <SeccionColapsable titulo="Encabezado de solicitud" icono="📋">
        <div className="divide-y divide-slate-50">
          <Row label="Fecha solicitud" valor={formatFecha(data.fecha_solicitud)} />
          <Row label="Tipo de solicitud" valor={tipoLabel} />
        </div>
      </SeccionColapsable>

      {/* S2 — Solicitante */}
      <SeccionColapsable titulo="Información del solicitante" icono="👤">
        <div className="divide-y divide-slate-50">
          <Row label="Empresa / Alcance" valor={data.alcance} />
          <Row label="Sucursal" valor={data.sucursal} />
          <Row label="Proceso interno" valor={procesoLabel} />
          <Row label="Responsable" valor={data.responsable} />
          <Row label="Partes interesadas" valor={data.partes_interesadas?.join(', ')} />
          <Row label="Nombre del desarrollo" valor={data.nombre_desarrollo} />
          <Row label="Prioridad" valor={
            prioridadCfg
              ? <span className={cn('rounded-full px-2 py-0.5 text-xs font-bold', prioridadCfg.bgColor, prioridadCfg.textColor)}>
                  P{data.prioridad} {prioridadCfg.label}
                </span>
              : null
          } />
        </div>
      </SeccionColapsable>

      {/* S3 — Descripción */}
      <SeccionColapsable titulo="Descripción de la solicitud" icono="📄" defaultOpen={false}>
        <div className="space-y-2 text-xs">
          {[
            { label: 'Situación actual', valor: data.descripcion_situacion_actual },
            { label: 'Definición del requerimiento', valor: data.definicion_requerimiento },
            { label: 'Objetivo', valor: data.objetivo },
            { label: 'Criterios de validación', valor: data.criterios_validacion },
          ].filter(f => f.valor).map(({ label, valor }) => (
            <div key={label}>
              <p className="font-medium text-slate-500">{label}</p>
              <p className="mt-0.5 text-slate-700 line-clamp-3">{valor}</p>
            </div>
          ))}
          {data.integra_otros_aplicativos && (
            <div>
              <p className="font-medium text-slate-500">Integración con</p>
              <p className="text-slate-700">{data.detalle_integracion}</p>
              <p className="text-slate-500">{data.tipo_operacion_integracion?.join(', ')}</p>
            </div>
          )}
        </div>
      </SeccionColapsable>

      {/* S4 — Alcance */}
      <SeccionColapsable titulo="Alcance del desarrollo" icono="🎯" defaultOpen={false}>
        <div className="divide-y divide-slate-50">
          <Row label="Impacta" valor={data.impacta} />
          <Row label="Tipos de cliente" valor={data.tipos_cliente?.join(', ')} />
          <Row label="Ventajas" valor={data.ventajas_beneficios} />
        </div>
        {(data.procesos_cargos ?? []).length > 0 && (
          <div className="mt-2 space-y-0.5">
            <p className="text-xs font-medium text-slate-500">Procesos y cargos:</p>
            {data.procesos_cargos.map((p, i) => (
              <p key={i} className="text-xs text-slate-600">• {p.proceso} — {p.cargo} ({p.nivel_impacto})</p>
            ))}
          </div>
        )}
      </SeccionColapsable>

      {/* S5 — Impacto */}
      <SeccionColapsable titulo="Impacto económico" icono="💰">
        {/* Tabla de actividades */}
        {(data.actividades ?? []).length > 0 && (
          <div className="mb-4">
            <p className="mb-1.5 text-xs font-medium text-slate-500">
              Actividades HH ({data.actividades.length})
            </p>
            <div className="space-y-1">
              {data.actividades.map((act, i) => {
                let hrs = 0
                try { hrs = calcularActividad(act).horas_mes } catch {}
                return (
                  <div key={i} className="flex items-center justify-between text-xs text-slate-600">
                    <span className="line-clamp-1 flex-1">{act.actividad || `Actividad ${i + 1}`}</span>
                    <span className="ml-2 font-medium text-emerald-600">{hrs.toFixed(2)} h/mes</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Tabla de beneficios cualitativos */}
        {beneficiosMarcados.length > 0 && (
          <div className="mb-4">
            <p className="mb-1.5 text-xs font-medium text-slate-500">
              Beneficios cualitativos cuantificados ({beneficiosMarcados.length})
            </p>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-xs">
                <thead className="bg-slate-50">
                  <tr>
                    {['Beneficio', 'Valor estimado', 'Periodicidad', 'Valor anual', 'Justificación'].map(h => (
                      <th key={h} className="px-2 py-2 text-left font-medium text-slate-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {beneficiosMarcados.map((b, i) => {
                    const nombre = b.id === 'otro' ? (b.nombre_beneficio || 'Otro') : b.nombre
                    const anual  = b.valor_cop && b.periodicidad
                      ? calcValorAnual(b.valor_cop, b.periodicidad) : 0
                    return (
                      <tr key={i}>
                        <td className="px-2 py-2 font-medium text-slate-700">
                          {b.icono} {nombre}
                        </td>
                        <td className="px-2 py-2 text-slate-600">
                          {b.valor_cop ? formatCOP(b.valor_cop) : '—'}
                        </td>
                        <td className="px-2 py-2 text-slate-500">
                          {b.periodicidad ? PERIODICIDAD_LABELS[b.periodicidad] : '—'}
                        </td>
                        <td className="px-2 py-2 font-bold text-emerald-600">
                          {anual > 0 ? formatCOP(anual) : '—'}
                        </td>
                        <td className="px-2 py-2 max-w-[180px]">
                          <p className="line-clamp-2 text-slate-500">{b.justificacion ?? '—'}</p>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Resumen económico final */}
        <div className="rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-800 p-4 text-white">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-emerald-200">Resumen económico total</p>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-emerald-200">
              <span>Ahorro en horas hombre (anual)</span>
              <span className="font-semibold text-white">{formatCOP(ahorroAnualHH)}</span>
            </div>
            {totalAnualCualitativos > 0 && (
              <div className="flex justify-between text-emerald-200">
                <span>Beneficios cualitativos (anual)</span>
                <span className="font-semibold text-white">{formatCOP(totalAnualCualitativos)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-emerald-400/50 pt-2">
              <span className="font-bold text-emerald-100">IMPACTO ECONÓMICO TOTAL ANUAL</span>
              <span className="text-xl font-extrabold text-white">{formatCOP(impactoTotal)}</span>
            </div>
          </div>
        </div>
      </SeccionColapsable>

      {/* Confirmación */}
      <div className="rounded-xl border-2 border-blue-200 bg-blue-50 p-4">
        <label className="flex cursor-pointer items-start gap-3">
          <Checkbox
            checked={confirmado}
            onCheckedChange={v => onConfirmadoChange(!!v)}
            className="mt-0.5"
          />
          <span className="text-sm font-medium text-slate-700">
            Confirmo que la información es correcta y completa, y que estoy autorizado para realizar esta solicitud.
          </span>
        </label>
      </div>
    </div>
  )
}
