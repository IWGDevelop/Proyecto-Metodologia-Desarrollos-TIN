'use client'

import { useState, useEffect, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Pencil, X, Loader2, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { actualizarRequerimiento } from '@/actions/requerimientos'
import { getPerfilesActivos } from '@/actions/perfiles'
import { Paso1Encabezado } from '../pasos/Paso1Encabezado'
import { Paso2Solicitante } from '../pasos/Paso2Solicitante'
import { Paso3Descripcion } from '../pasos/Paso3Descripcion'
import { Paso4Alcance } from '../pasos/Paso4Alcance'
import { defaultWizardValues, type WizardData } from '@/lib/schemas/requerimiento'
import { TIPOS_SOLICITUD, PROCESOS_INTERNOS, ORIGENES_REQUERIMIENTO } from '@/lib/constants'
import { formatFecha } from '@/lib/utils'
import type { Perfil } from '@/lib/supabase/types'

interface Props {
  req: any
  canEdit: boolean
  isAdmin: boolean
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
    integra_otros_aplicativos: req.integra_otros_aplicativos ?? false,
    detalle_integracion: req.detalle_integracion ?? '',
    tipo_operacion_integracion: req.tipo_operacion_integracion ?? [],
    definicion_usuarios: req.definicion_usuarios ?? '',
    impacta: req.impacta as WizardData['impacta'],
    tipos_cliente: req.tipos_cliente ?? [],
    procesos_cargos: (req.procesos_cargos as any[]) ?? [],
    ventajas_beneficios: req.ventajas_beneficios ?? '',
  }
}

export function TabInformacion({ req, canEdit, isAdmin }: Props) {
  const router = useRouter()
  const [editMode, setEditMode] = useState(false)
  const [usuarios, setUsuarios] = useState<Perfil[]>([])
  const [isPending, startTransition] = useTransition()

  const tipoLabel    = TIPOS_SOLICITUD.find(t => t.value === req.tipo_solicitud)?.label
  const origenLabel  = ORIGENES_REQUERIMIENTO.find(o => o.value === req.origen_requerimiento)?.label
  const procesoLabel = PROCESOS_INTERNOS.find(p => p.value === req.proceso_interno)?.label

  const form = useForm<WizardData>({ defaultValues: buildDefaultValues(req) as WizardData })

  useEffect(() => {
    getPerfilesActivos().then(setUsuarios).catch(() => {})
  }, [])

  const handleEdit = () => {
    form.reset(buildDefaultValues(req))
    setEditMode(true)
  }

  const handleSave = () => {
    startTransition(async () => {
      try {
        const data = form.getValues()
        await actualizarRequerimiento(req.id, {
          identificacion: data.nombre_desarrollo,
          fecha_solicitud: data.fecha_solicitud,
          tipo_solicitud: data.tipo_solicitud,
          alcance: data.alcance,
          sucursal: data.sucursal,
          proceso_interno: data.proceso_interno,
          responsable: data.responsable,
          partes_interesadas: data.partes_interesadas ?? [],
          nombre_desarrollo: data.nombre_desarrollo,
          descripcion_situacion_actual: data.descripcion_situacion_actual,
          definicion_requerimiento: data.definicion_requerimiento,
          objetivo: data.objetivo,
          criterios_validacion: data.criterios_validacion,
          integra_otros_aplicativos: data.integra_otros_aplicativos ?? false,
          detalle_integracion: data.detalle_integracion,
          tipo_operacion_integracion: data.tipo_operacion_integracion ?? [],
          definicion_usuarios: data.definicion_usuarios,
          impacta: data.impacta,
          tipos_cliente: data.tipos_cliente ?? [],
          procesos_cargos: (data.procesos_cargos ?? []).map(p => ({
            proceso: p.proceso,
            cargo: p.cargo,
            cantidad_usuarios: 0,
          })),
          ventajas_beneficios: data.ventajas_beneficios,
        })
        toast.success('Información actualizada')
        setEditMode(false)
        router.refresh()
      } catch {
        toast.error('Error al guardar los cambios')
      }
    })
  }

  if (editMode) {
    return (
      <div className="mt-4 space-y-6">
        <div className="flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
          <p className="text-sm font-medium text-blue-800">Editando información del requerimiento</p>
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

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-slate-400">Encabezado</p>
          <Paso1Encabezado form={form} />
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-slate-400">Solicitante</p>
          <Paso2Solicitante form={form} usuarios={usuarios} isAdmin={isAdmin} />
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-slate-400">Descripción</p>
          <Paso3Descripcion form={form} anexos={[]} onAnexosChange={() => {}} carpetaTemporal={req.id} />
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-slate-400">Alcance</p>
          <Paso4Alcance form={form} />
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

  return (
    <div className="mt-4 space-y-4">
      {canEdit && (
        <div className="flex justify-end">
          <Button type="button" variant="outline" size="sm" onClick={handleEdit} className="gap-1.5">
            <Pencil size={13} /> Editar información
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Encabezado</p>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-slate-500">Fecha solicitud</dt><dd>{formatFecha(req.fecha_solicitud)}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Tipo</dt><dd>{tipoLabel}</dd></div>
            {origenLabel && <div className="flex justify-between"><dt className="text-slate-500">Origen</dt><dd className="font-medium text-violet-700">{origenLabel}</dd></div>}
            <div className="flex justify-between"><dt className="text-slate-500">Empresa</dt><dd>{req.empresa ?? req.alcance}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Sucursal</dt><dd>{req.sucursal}</dd></div>
          </dl>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Solicitante</p>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-slate-500">Responsable</dt><dd className="font-medium">{req.responsable}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Proceso</dt><dd>{procesoLabel}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Avance</dt><dd className="font-medium">{req.porcentaje_avance}%</dd></div>
            {req.fecha_envio_tin && <div className="flex justify-between"><dt className="text-slate-500">Fecha TIN</dt><dd>{formatFecha(req.fecha_envio_tin)}</dd></div>}
          </dl>
          {req.partes_interesadas && req.partes_interesadas.length > 0 && (
            <div className="mt-3 border-t border-slate-100 pt-3">
              <p className="mb-2 text-xs text-slate-500">Partes interesadas</p>
              <div className="flex flex-wrap gap-1.5">
                {req.partes_interesadas.map((p: string, i: number) => (
                  <span key={i} className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 border border-blue-200">
                    {p}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {[
        { label: 'Situación actual', valor: req.descripcion_situacion_actual },
        { label: 'Definición del requerimiento', valor: req.definicion_requerimiento },
        { label: 'Objetivo', valor: req.objetivo },
        { label: 'Criterios de validación', valor: req.criterios_validacion },
        { label: 'Definición de usuarios', valor: req.definicion_usuarios },
        { label: 'Ventajas y beneficios', valor: req.ventajas_beneficios },
      ].filter(f => f.valor).map(({ label, valor }) => (
        <div key={label} className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
          <p className="whitespace-pre-wrap text-sm text-slate-700">{valor}</p>
        </div>
      ))}
    </div>
  )
}
