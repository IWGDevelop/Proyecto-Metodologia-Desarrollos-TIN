'use client'

import { useState, useTransition } from 'react'
import { guardarImpactoReal } from '@/actions/impacto-real'
import { Plus, X, TrendingUp, AlertCircle, CheckCircle2, Save } from 'lucide-react'
import { toast } from 'sonner'
import { formatCOP, cn } from '@/lib/utils'
import type { Requerimiento, BeneficioCualitativoReal } from '@/lib/supabase/types'

const ESTADOS_FINALIZADOS = ['ENTREGADO', 'CERRADO']

interface Props {
  req: Requerimiento
  onSaved?: () => void
}

function num(v: number | null | undefined) { return v ?? 0 }

export function TabImpactoReal({ req, onSaved }: Props) {
  const esFinalizado = ESTADOS_FINALIZADOS.includes(req.estado as string)

  // Pre-fill con reales existentes, o con estimados si es la primera vez
  const [horasMes, setHorasMes] = useState(
    req.horas_ahorradas_mes_real ?? req.horas_ahorradas_mes ?? 0
  )
  const [valorHora, setValorHora] = useState(req.valor_hora_hombre ?? 0)
  const [beneficiosReal, setBeneficiosReal] = useState<BeneficioCualitativoReal[]>(
    req.beneficios_cualitativos_real?.length
      ? req.beneficios_cualitativos_real
      : (req.beneficios_cualitativos ?? []).map(b => ({ descripcion: b.descripcion, valor_anual_cop: 0 }))
  )
  const [isPending, startT] = useTransition()

  // Cálculos automáticos
  const horasLaboralesMes = req.horas_laborales_mes || 192
  const ahorroPct         = 1 // se ahorra el total de horas registradas (valores reales)
  const ahorroMensual     = Math.round(horasMes * (valorHora || (req.valor_hora_hombre ?? 0)))
  const ahorroAnual       = ahorroMensual * 12
  const totalCualitativos = beneficiosReal.reduce((s, b) => s + (b.valor_anual_cop || 0), 0)
  const totalReal         = ahorroAnual + totalCualitativos

  const yaRegistrado = req.horas_ahorradas_mes_real !== null || req.impacto_economico_total_anual_real !== null

  const agregarBeneficio = () =>
    setBeneficiosReal(prev => [...prev, { descripcion: '', valor_anual_cop: 0 }])

  const actualizarBeneficio = (i: number, campo: keyof BeneficioCualitativoReal, valor: string | number) =>
    setBeneficiosReal(prev => prev.map((b, j) => j === i ? { ...b, [campo]: valor } : b))

  const eliminarBeneficio = (i: number) =>
    setBeneficiosReal(prev => prev.filter((_, j) => j !== i))

  const handleGuardar = () => {
    startT(async () => {
      const res = await guardarImpactoReal(req.id, {
        horas_ahorradas_mes_real:            horasMes || null,
        ahorro_mensual_cop_real:             ahorroMensual || null,
        ahorro_anual_cop_real:               ahorroAnual || null,
        beneficios_cualitativos_real:        beneficiosReal.filter(b => b.descripcion.trim()),
        total_beneficios_cualitativos_anual_real: totalCualitativos || null,
        impacto_economico_total_anual_real:  totalReal || null,
      })
      if (res.ok) {
        toast.success('Impacto real guardado')
        onSaved?.()
      } else {
        toast.error(res.error ?? 'Error al guardar')
      }
    })
  }

  if (!esFinalizado) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-center">
        <AlertCircle size={28} className="mx-auto mb-2 text-slate-300" />
        <p className="text-sm font-medium text-slate-500">Impacto real no disponible</p>
        <p className="mt-1 text-xs text-slate-400">
          El impacto real se registra cuando el requerimiento pasa a estado
          <strong> Entregado</strong> o <strong>Cerrado</strong>.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp size={16} className="text-emerald-600" />
          <h3 className="text-sm font-bold text-slate-800">Impacto real registrado</h3>
          {yaRegistrado && (
            <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">
              <CheckCircle2 size={11} /> Registrado
            </span>
          )}
        </div>
        <p className="text-xs text-slate-400">
          Los valores estimados se muestran entre paréntesis como referencia
        </p>
      </div>

      {/* Comparativa estimado vs real — banner */}
      {yaRegistrado && (
        <div className="grid grid-cols-3 gap-3">
          {[
            {
              label: 'Horas / mes',
              estimado: `${num(req.horas_ahorradas_mes).toFixed(1)} h`,
              real: `${horasMes.toFixed(1)} h`,
              delta: horasMes - num(req.horas_ahorradas_mes),
              isHoras: true,
            },
            {
              label: 'Ahorro HH anual',
              estimado: formatCOP(req.ahorro_anual_cop),
              real: formatCOP(ahorroAnual),
              delta: ahorroAnual - num(req.ahorro_anual_cop),
            },
            {
              label: 'Impacto total anual',
              estimado: formatCOP(req.impacto_economico_total_anual),
              real: formatCOP(totalReal),
              delta: totalReal - num(req.impacto_economico_total_anual),
            },
          ].map(({ label, estimado, real, delta, isHoras }) => (
            <div key={label} className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-xs text-slate-400">{label}</p>
              <p className="mt-0.5 text-xs text-slate-400 line-through">{estimado} est.</p>
              <p className="text-base font-bold text-emerald-700">{real}</p>
              <p className={cn('text-xs font-medium', delta >= 0 ? 'text-emerald-600' : 'text-red-500')}>
                {delta >= 0 ? '▲' : '▼'} {isHoras ? `${Math.abs(delta).toFixed(1)} h` : formatCOP(Math.abs(delta))}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Formulario horas hombre real */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Horas hombre ahorradas — Real
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <label className="text-xs text-slate-500">
              Horas ahorradas/mes
              <span className="ml-1 text-slate-400">(est. {num(req.horas_ahorradas_mes).toFixed(1)} h)</span>
            </label>
            <input
              type="number" min={0} step={0.5}
              value={horasMes}
              onChange={e => setHorasMes(parseFloat(e.target.value) || 0)}
              className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-slate-500">Valor hora hombre (COP)</label>
            <input
              type="number" min={0} step={1000}
              value={valorHora}
              onChange={e => setValorHora(parseFloat(e.target.value) || 0)}
              className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-slate-500">Ahorro mensual COP</label>
            <div className="rounded-md border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-700">
              {formatCOP(ahorroMensual)}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
          <span className="text-xs text-slate-500">Ahorro HH anual real (× 12)</span>
          <span className="text-sm font-bold text-emerald-700">{formatCOP(ahorroAnual)}</span>
        </div>
      </div>

      {/* Beneficios cualitativos reales */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Beneficios cualitativos reales
          </p>
          <button
            onClick={agregarBeneficio}
            className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-800"
          >
            <Plus size={12} /> Agregar
          </button>
        </div>

        {beneficiosReal.length === 0 ? (
          <p className="text-xs italic text-slate-400">Sin beneficios cualitativos registrados</p>
        ) : (
          <div className="space-y-2">
            {beneficiosReal.map((b, i) => (
              <div key={i} className="grid grid-cols-[1fr_auto_auto] gap-2 items-start">
                <input
                  placeholder="Descripción del beneficio real..."
                  value={b.descripcion}
                  onChange={e => actualizarBeneficio(i, 'descripcion', e.target.value)}
                  className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm outline-none focus:border-emerald-400"
                />
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">$</span>
                  <input
                    type="number" min={0}
                    placeholder="Valor/año COP"
                    value={b.valor_anual_cop || ''}
                    onChange={e => actualizarBeneficio(i, 'valor_anual_cop', parseFloat(e.target.value) || 0)}
                    className="w-36 rounded-md border border-slate-200 bg-slate-50 pl-5 pr-2 py-1.5 text-sm outline-none focus:border-emerald-400"
                  />
                </div>
                <button onClick={() => eliminarBeneficio(i)} className="mt-1.5 text-slate-300 hover:text-red-400">
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        {totalCualitativos > 0 && (
          <div className="flex items-center justify-between rounded-lg bg-blue-50 px-3 py-2">
            <span className="text-xs text-slate-500">Total cualitativos anual real</span>
            <span className="text-sm font-bold text-blue-700">{formatCOP(totalCualitativos)}</span>
          </div>
        )}
      </div>

      {/* Total impacto real */}
      <div className="rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-800 p-4 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-emerald-200">Impacto económico total real (anual)</p>
            <p className="mt-1 text-2xl font-extrabold">{formatCOP(totalReal)}</p>
            <p className="text-xs text-emerald-300">
              HH {formatCOP(ahorroAnual)} + Cualitativos {formatCOP(totalCualitativos)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-emerald-300">Estimado era</p>
            <p className="text-base font-semibold text-emerald-200 line-through">
              {formatCOP(req.impacto_economico_total_anual ?? (num(req.ahorro_anual_cop) + num(req.total_beneficios_cualitativos_anual)))}
            </p>
          </div>
        </div>
      </div>

      {/* Botón guardar */}
      <div className="flex justify-end">
        <button
          onClick={handleGuardar}
          disabled={isPending}
          className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          <Save size={14} />
          {isPending ? 'Guardando...' : 'Guardar impacto real'}
        </button>
      </div>
    </div>
  )
}
