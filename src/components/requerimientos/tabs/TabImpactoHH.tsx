'use client'

import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Pencil, X, Loader2, Save, Clock, DollarSign, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { actualizarRequerimiento } from '@/actions/requerimientos'
import { Paso5ImpactoHH } from '../pasos/Paso5ImpactoHH'
import {
  defaultWizardValues, calcularActividad, calcValorAnual, calcTotalCualitativos,
  BENEFICIOS_CONFIG, type WizardData,
} from '@/lib/schemas/requerimiento'
import { formatCOP } from '@/lib/utils'

interface Props {
  req: any
  canEdit: boolean
}

function buildDefaultValues(req: any): WizardData {
  return {
    ...(defaultWizardValues() as WizardData),
    fecha_solicitud: req.fecha_solicitud ?? new Date().toISOString().split('T')[0],
    tipo_solicitud: req.tipo_solicitud as WizardData['tipo_solicitud'],
    alcance: req.alcance as WizardData['alcance'],
    sucursal: req.sucursal ?? '',
    proceso_interno: req.proceso_interno as WizardData['proceso_interno'],
    responsable: req.responsable ?? '',
    partes_interesadas: req.partes_interesadas ?? [],
    nombre_desarrollo: req.nombre_desarrollo ?? '',
    descripcion_situacion_actual: req.descripcion_situacion_actual ?? '',
    definicion_requerimiento: req.definicion_requerimiento ?? '',
    objetivo: req.objetivo ?? '',
    criterios_validacion: req.criterios_validacion ?? '',
    impacta: req.impacta as WizardData['impacta'],
    ventajas_beneficios: req.ventajas_beneficios ?? '',
    actividades: ((req.actividades_impacto as any[]) ?? []).map((act: any) => ({
      actividad: act.actividad ?? '',
      cargo_ejecuta: act.cargo_ejecuta ?? '',
      salario_cargo: act.salario_cargo ?? undefined,
      frecuencia: (act.frecuencia ?? 'DIARIA') as 'DIARIA' | 'SEMANAL' | 'QUINCENAL' | 'MENSUAL',
      tiempo_sin_mejora: act.tiempo_sin_mejora ?? 0,
      tiempo_sin_mejora_unidad: (act.tiempo_sin_mejora_unidad ?? 'MINUTOS') as 'MINUTOS' | 'HORAS',
      tiempo_con_mejora: act.tiempo_con_mejora ?? 0,
      tiempo_con_mejora_unidad: (act.tiempo_con_mejora_unidad ?? 'MINUTOS') as 'MINUTOS' | 'HORAS',
    })),
    salario_promedio_cargo: req.salario_promedio_cargo ?? undefined,
    horas_laborales_mes: req.horas_laborales_mes ?? 160,
    beneficios: (() => {
      const saved = (req.beneficios_cualitativos as any[]) ?? []
      return BENEFICIOS_CONFIG.map(cfg => {
        const guardado = saved.find((b: any) => b.id === cfg.id)
        if (guardado) {
          return {
            ...cfg,
            marcado: true,
            nombre_beneficio: guardado.nombre_beneficio ?? '',
            descripcion: guardado.descripcion ?? '',
            valor_cop: guardado.valor_cop ?? undefined,
            periodicidad: guardado.periodicidad as 'UNICO' | 'MENSUAL' | 'ANUAL' | undefined,
            valor_anual_calculado: guardado.valor_anual_calculado ?? 0,
            justificacion: guardado.justificacion ?? '',
          }
        }
        return {
          ...cfg, marcado: false,
          nombre_beneficio: '', descripcion: '',
          valor_cop: undefined, periodicidad: undefined,
          valor_anual_calculado: 0, justificacion: '',
        }
      })
    })(),
  }
}

export function TabImpactoHH({ req, canEdit }: Props) {
  const router = useRouter()
  const [editMode, setEditMode] = useState(false)
  const [isPending, startTransition] = useTransition()

  const actividades = (req.actividades_impacto ?? []) as any[]
  const beneficios  = (req.beneficios_cualitativos ?? []) as any[]

  const form = useForm<WizardData>({ defaultValues: buildDefaultValues(req) as WizardData })

  const handleEdit = () => {
    form.reset(buildDefaultValues(req))
    setEditMode(true)
  }

  const handleSave = () => {
    startTransition(async () => {
      try {
        const data = form.getValues()
        const actividadesLocal = data.actividades ?? []
        const salarioGlobal    = data.salario_promedio_cargo ?? 0
        const horasLab         = data.horas_laborales_mes ?? 160

        const actividades_impacto = actividadesLocal.map(act => {
          let horas_mes = 0
          try { horas_mes = calcularActividad(act).horas_mes } catch {}
          return {
            actividad: act.actividad,
            cargo_ejecuta: act.cargo_ejecuta,
            salario_cargo: act.salario_cargo ?? null,
            frecuencia: act.frecuencia,
            tiempo_sin_mejora: act.tiempo_sin_mejora,
            tiempo_sin_mejora_unidad: act.tiempo_sin_mejora_unidad,
            tiempo_con_mejora: act.tiempo_con_mejora,
            tiempo_con_mejora_unidad: act.tiempo_con_mejora_unidad,
            horas_mes,
            porcentaje_automatizable: 100,
          }
        })

        const totalHorasMes = actividades_impacto.reduce((s, a) => s + (a.horas_mes ?? 0), 0)

        const ahorroMensual = actividadesLocal.reduce((sum, act) => {
          let horas_mes = 0
          try { horas_mes = calcularActividad(act).horas_mes } catch {}
          const sal     = (act.salario_cargo && act.salario_cargo > 0) ? act.salario_cargo : salarioGlobal
          const valHora = sal && horasLab ? sal / horasLab : 0
          return sum + horas_mes * valHora
        }, 0)
        const ahorroAnual = ahorroMensual * 12

        const beneficios_cualitativos = (data.beneficios ?? [])
          .filter(b => b.marcado)
          .map(b => ({
            id: b.id,
            nombre: b.id === 'otro' ? (b.nombre_beneficio || 'Otro') : b.nombre,
            icono: b.icono,
            marcado: true,
            descripcion: b.descripcion ?? '',
            valor_cop: b.valor_cop ?? 0,
            periodicidad: b.periodicidad ?? 'UNICO',
            valor_anual_calculado: b.valor_cop && b.periodicidad
              ? calcValorAnual(b.valor_cop, b.periodicidad) : 0,
            justificacion: b.justificacion ?? '',
          }))

        const totalAnualCualitativos = calcTotalCualitativos(data.beneficios ?? [])

        await actualizarRequerimiento(req.id, {
          actividades_impacto,
          salario_promedio_cargo: data.salario_promedio_cargo,
          horas_laborales_mes: horasLab,
          valor_hora_hombre: salarioGlobal && horasLab ? salarioGlobal / horasLab : undefined,
          horas_ahorradas_mes: totalHorasMes,
          ahorro_mensual_cop: ahorroMensual,
          ahorro_anual_cop: ahorroAnual,
          beneficios_cualitativos,
          total_beneficios_cualitativos_anual: totalAnualCualitativos,
          impacto_economico_total_anual: ahorroAnual + totalAnualCualitativos,
        })

        toast.success('Impacto HH actualizado')
        setEditMode(false)
        router.refresh()
      } catch {
        toast.error('Error al guardar los cambios')
      }
    })
  }

  if (editMode) {
    return (
      <div className="mt-4 space-y-4">
        <div className="flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
          <p className="text-sm font-medium text-blue-800">Editando impacto HH</p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setEditMode(false)} disabled={isPending}>
              <X size={13} className="mr-1.5" /> Cancelar
            </Button>
            <Button type="button" size="sm" onClick={handleSave} disabled={isPending} className="bg-blue-600 hover:bg-blue-700">
              {isPending ? <Loader2 size={13} className="mr-1.5 animate-spin" /> : <Save size={13} className="mr-1.5" />}
              Guardar
            </Button>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <Paso5ImpactoHH form={form} />
        </div>

        <div className="flex justify-end gap-2 pb-4">
          <Button type="button" variant="outline" onClick={() => setEditMode(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSave} disabled={isPending} className="bg-blue-600 hover:bg-blue-700">
            {isPending ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : <Save size={14} className="mr-1.5" />}
            Guardar cambios
          </Button>
        </div>
      </div>
    )
  }

  // ─── Read mode ───────────────────────────────────────────────────────────────
  return (
    <div className="mt-4 space-y-4">
      {canEdit && (
        <div className="flex justify-end">
          <Button type="button" variant="outline" size="sm" onClick={handleEdit} className="gap-1.5">
            <Pencil size={13} /> Editar impacto HH
          </Button>
        </div>
      )}

      {actividades.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <p className="border-b border-slate-100 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Actividades impactadas
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  {['Actividad', 'Cargo que ejecuta', 'Salario cargo', 'Frecuencia', 'Horas/mes'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-slate-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {actividades.map((act: any, i: number) => (
                  <tr key={i}>
                    <td className="px-4 py-2.5 text-slate-700">{act.actividad}</td>
                    <td className="px-4 py-2.5 text-slate-600 text-xs">{act.cargo_ejecuta ?? '—'}</td>
                    <td className="px-4 py-2.5 text-xs">
                      {act.salario_cargo
                        ? <span className="font-medium text-blue-600">{formatCOP(act.salario_cargo)}</span>
                        : <span className="text-slate-400">Global</span>}
                    </td>
                    <td className="px-4 py-2.5 text-slate-500 text-xs">{act.frecuencia ?? '—'}</td>
                    <td className="px-4 py-2.5 font-semibold text-emerald-600">{(act.horas_mes ?? 0).toFixed(2)} h</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {(req.horas_ahorradas_mes ?? 0) > 0 && (
        <div className="rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-800 p-5 text-white">
          <p className="mb-3 text-sm font-semibold text-emerald-200">Impacto en horas hombre</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              { icon: Clock,      label: 'Horas ahorradas / mes', valor: `${req.horas_ahorradas_mes?.toFixed(1) ?? 0} h` },
              { icon: DollarSign, label: 'Ahorro mensual',        valor: formatCOP(req.ahorro_mensual_cop) },
              { icon: TrendingUp, label: 'Ahorro anual HH',       valor: formatCOP(req.ahorro_anual_cop) },
            ].map(({ icon: Icon, label, valor }) => (
              <div key={label} className="rounded-lg bg-white/10 p-3">
                <Icon size={14} className="mb-1 text-emerald-300" />
                <p className="text-xs text-emerald-300">{label}</p>
                <p className="text-lg font-bold">{valor}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {beneficios.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <p className="border-b border-slate-100 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Beneficios cualitativos
          </p>
          <div className="divide-y divide-slate-50">
            {beneficios.map((b: any, i: number) => (
              <div key={i} className="flex items-start justify-between gap-4 px-4 py-3">
                <div className="flex items-start gap-2 min-w-0">
                  {b.icono && <span className="mt-0.5 text-base shrink-0">{b.icono}</span>}
                  <div className="min-w-0">
                    {b.nombre && <p className="text-xs font-semibold text-slate-700">{b.nombre}</p>}
                    {b.descripcion && <p className="text-xs text-slate-500 mt-0.5">{b.descripcion}</p>}
                    {b.justificacion && (
                      <p className="mt-1 text-xs text-slate-400 italic">"{b.justificacion}"</p>
                    )}
                  </div>
                </div>
                {(b.valor_anual_calculado ?? 0) > 0 && (
                  <div className="shrink-0 text-right">
                    <p className="text-[10px] text-slate-400">
                      {b.periodicidad === 'MENSUAL' ? 'mensual ×12' : b.periodicidad === 'UNICO' ? 'único' : 'anual'}
                    </p>
                    <p className="text-sm font-bold text-blue-600">{formatCOP(b.valor_anual_calculado)}</p>
                    <p className="text-[10px] text-slate-400">/ año</p>
                  </div>
                )}
              </div>
            ))}
          </div>
          {(req.total_beneficios_cualitativos_anual ?? 0) > 0 && (
            <div className="flex items-center justify-between border-t border-slate-200 bg-blue-50 px-4 py-3">
              <span className="text-sm font-semibold text-slate-700">Total cualitativos / año</span>
              <span className="text-lg font-extrabold text-blue-700">{formatCOP(req.total_beneficios_cualitativos_anual)}</span>
            </div>
          )}
        </div>
      )}

      {((req.ahorro_anual_cop ?? 0) > 0 || (req.total_beneficios_cualitativos_anual ?? 0) > 0) && (
        <div className="rounded-xl border-2 border-emerald-300 bg-emerald-50 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-emerald-700">
            Resumen impacto total proyectado
          </p>
          <div className="space-y-1.5 text-sm">
            {(req.ahorro_anual_cop ?? 0) > 0 && (
              <div className="flex justify-between text-slate-600">
                <span>Ahorro en horas hombre (anual)</span>
                <span className="font-semibold text-emerald-700">{formatCOP(req.ahorro_anual_cop)}</span>
              </div>
            )}
            {(req.total_beneficios_cualitativos_anual ?? 0) > 0 && (
              <div className="flex justify-between text-slate-600">
                <span>Beneficios cualitativos (anual)</span>
                <span className="font-semibold text-blue-600">{formatCOP(req.total_beneficios_cualitativos_anual)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-emerald-200 pt-2">
              <span className="font-bold text-slate-800">Impacto económico total / año</span>
              <span className="text-xl font-extrabold text-emerald-700">
                {formatCOP((req.ahorro_anual_cop ?? 0) + (req.total_beneficios_cualitativos_anual ?? 0))}
              </span>
            </div>
          </div>
        </div>
      )}

      {actividades.length === 0 && beneficios.length === 0 && (req.horas_ahorradas_mes ?? 0) === 0 && (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center">
          <p className="text-sm text-slate-400">No hay datos de impacto HH registrados</p>
          {canEdit && (
            <Button type="button" variant="outline" size="sm" onClick={handleEdit} className="mt-3 gap-1.5">
              <Pencil size={13} /> Agregar datos de impacto
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
