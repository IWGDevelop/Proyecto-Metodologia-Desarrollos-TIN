'use client'

import { useState } from 'react'
import type { UseFormReturn } from 'react-hook-form'
import type { WizardData } from '@/lib/schemas/requerimiento'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { ChevronDown, ChevronUp, CheckCircle2 } from 'lucide-react'
import { formatFecha, formatCOP, cn } from '@/lib/utils'
import { ESTADOS, PRIORIDADES, PROCESOS_INTERNOS, TIPOS_SOLICITUD, TIPOS_SOLUCION } from '@/lib/constants'
import { calcularActividad } from '@/lib/schemas/requerimiento'

interface SeccionProps {
  titulo: string
  icono: string
  children: React.ReactNode
  defaultOpen?: boolean
}

function SeccionColapsable({ titulo, icono, children, defaultOpen = true }: SeccionProps) {
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

function RowRevision({ label, valor }: { label: string; valor: React.ReactNode }) {
  if (!valor || valor === '' || valor === '—') return null
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 text-sm">
      <span className="shrink-0 text-xs text-slate-500">{label}</span>
      <span className="text-right text-xs font-medium text-slate-700">{valor}</span>
    </div>
  )
}

interface Props {
  form: UseFormReturn<WizardData>
  confirmado: boolean
  onConfirmadoChange: (v: boolean) => void
}

export function Paso6Revision({ form, confirmado, onConfirmadoChange }: Props) {
  const data = form.watch()

  const totalHorasMes = (data.actividades ?? []).reduce((sum, act) => {
    try { return sum + calcularActividad(act).horas_mes } catch { return sum }
  }, 0)
  const valorHora = (data.salario_promedio_cargo ?? 0) / (data.horas_laborales_mes ?? 192)
  const ahorroMensual = totalHorasMes * valorHora
  const ahorroAnual = ahorroMensual * 12

  const tipoLabel = TIPOS_SOLICITUD.find(t => t.value === data.tipo_solicitud)?.label ?? data.tipo_solicitud
  const procesoLabel = PROCESOS_INTERNOS.find(p => p.value === data.proceso_interno)?.label ?? data.proceso_interno
  const prioridadCfg = data.prioridad ? PRIORIDADES[data.prioridad] : null
  const beneficiosSeleccionados = (data.beneficios ?? []).filter(b => b.seleccionado)

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
          <RowRevision label="Fecha solicitud" valor={formatFecha(data.fecha_solicitud)} />
          <RowRevision label="Tipo de solicitud" valor={tipoLabel} />
        </div>
      </SeccionColapsable>

      {/* S2 — Solicitante */}
      <SeccionColapsable titulo="Información del solicitante" icono="👤">
        <div className="divide-y divide-slate-50">
          <RowRevision label="Empresa / Alcance" valor={data.alcance} />
          <RowRevision label="Sucursal" valor={data.sucursal} />
          <RowRevision label="Proceso interno" valor={procesoLabel} />
          <RowRevision label="Responsable" valor={data.responsable} />
          <RowRevision label="Partes interesadas" valor={data.partes_interesadas?.join(', ')} />
          <RowRevision label="Nombre del desarrollo" valor={data.nombre_desarrollo} />
          <RowRevision
            label="Prioridad"
            valor={prioridadCfg
              ? <span className={cn('rounded-full px-2 py-0.5 text-xs font-bold', prioridadCfg.bgColor, prioridadCfg.textColor)}>P{data.prioridad} {prioridadCfg.label}</span>
              : null}
          />
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
          ].map(({ label, valor }) => valor ? (
            <div key={label}>
              <p className="font-medium text-slate-500">{label}</p>
              <p className="mt-0.5 text-slate-700 line-clamp-3">{valor}</p>
            </div>
          ) : null)}
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
          <RowRevision label="Impacta" valor={data.impacta} />
          <RowRevision label="Tipos de cliente" valor={data.tipos_cliente?.join(', ')} />
          <RowRevision label="Ventajas" valor={data.ventajas_beneficios} />
        </div>
        {(data.procesos_cargos ?? []).length > 0 && (
          <div className="mt-2">
            <p className="text-xs font-medium text-slate-500">Procesos y cargos:</p>
            {data.procesos_cargos.map((p, i) => (
              <p key={i} className="text-xs text-slate-600">• {p.proceso} — {p.cargo} ({p.nivel_impacto})</p>
            ))}
          </div>
        )}
      </SeccionColapsable>

      {/* S5 — Impacto */}
      <SeccionColapsable titulo="Impacto en horas hombre" icono="💰">
        {(data.actividades ?? []).length > 0 && (
          <div className="mb-3 space-y-1">
            <p className="text-xs font-medium text-slate-500">Actividades ({data.actividades.length})</p>
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
        )}

        {/* Card de impacto destacada */}
        <div className="rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 p-4 text-white">
          <p className="mb-2 text-xs font-semibold text-emerald-200">Impacto económico estimado</p>
          <p className="text-2xl font-bold">{formatCOP(ahorroAnual)}</p>
          <p className="text-xs text-emerald-200">en ahorro anual proyectado</p>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
            <div>
              <p className="text-emerald-300">Horas / mes</p>
              <p className="font-semibold">{totalHorasMes.toFixed(1)} h</p>
            </div>
            <div>
              <p className="text-emerald-300">Ahorro mensual</p>
              <p className="font-semibold">{formatCOP(ahorroMensual)}</p>
            </div>
          </div>
        </div>

        {beneficiosSeleccionados.length > 0 && (
          <div className="mt-2">
            <p className="text-xs font-medium text-slate-500">Beneficios cualitativos:</p>
            {beneficiosSeleccionados.map((b, i) => (
              <p key={i} className="text-xs text-slate-600">✓ {b.tipo}</p>
            ))}
          </div>
        )}
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
