'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { FormProvider, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { AlertTriangle, ArrowLeft, Info, Loader2, Lock, ShieldCheck, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { SubirAdjuntos, type AdjuntoNuevo } from '@/components/tickets/SubirAdjuntos'
import { crearTicket } from '@/actions/tickets/crear'
import {
  CADENA_IGSI,
  IMPACTOS_OPERACION_IGSI,
  IMPACTOS_TICKET,
  MEDICIONES,
  PRIORIDADES_TICKET,
  calcularPrioridad,
} from '@/lib/tickets/constantes'
import type { AccionIGSI, ImpactoOperacionIGSI, ImpactoTicket, TipoDocumentoIGSI } from '@/lib/tickets/types'
import { cn } from '@/lib/utils'
import { CampoDinamico } from './CampoDinamico'
import { FormNovedadIGSI } from './FormNovedadIGSI'
import { PrioridadChip, TipoGestionChip } from './Chips'
import {
  CADENA_VISUAL,
  IGSI_VACIO,
  SELECT_CLASS,
  claveCampo,
  crearEsquemaTicket,
  type FormularioTicket,
} from './formulario-ticket'
import type { CatalogoFormulario } from './tipos'

function hoy() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
}

const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

export function NuevoTicketForm({ catalogo }: { catalogo: CatalogoFormulario }) {
  const router = useRouter()
  const [carpeta] = useState(() => `nuevos/${catalogo.solicitante.id}/${Date.now()}`)
  const esquema = useMemo(() => crearEsquemaTicket(catalogo), [catalogo])

  const form = useForm<FormularioTicket>({
    resolver: zodResolver(esquema),
    defaultValues: {
      categoriaId: '',
      tipologiaId: '',
      impacto: '',
      asunto: '',
      descripcion: '',
      valores: {},
      adjuntos: [],
      igsi: IGSI_VACIO,
    },
  })
  const { register, control, setValue, handleSubmit, formState: { errors, isSubmitting } } = form

  const categoriaId = useWatch({ control, name: 'categoriaId' })
  const tipologiaId = useWatch({ control, name: 'tipologiaId' })
  const impacto = useWatch({ control, name: 'impacto' })
  const impactoIgsi = useWatch({ control, name: 'igsi.impacto_operacion' })
  const valores = useWatch({ control, name: 'valores' })
  const adjuntos = useWatch({ control, name: 'adjuntos' }) as AdjuntoNuevo[]

  const categoria = catalogo.categorias.find(c => c.id === categoriaId) ?? null
  const tipologiasCat = catalogo.tipologias.filter(t => t.categoria_id === categoriaId)
  const tipologia = catalogo.tipologias.find(t => t.id === tipologiaId) ?? null
  const campos = tipologia ? catalogo.campos.filter(c => c.tipologia_id === tipologia.id) : []

  // Prioridad calculada en vivo (la definitiva la calcula el servidor con la misma regla)
  const impactoEfectivo: ImpactoTicket | null = tipologia?.es_novedad_igsi
    ? (IMPACTOS_OPERACION_IGSI.find(i => i.value === impactoIgsi)?.impacto ?? null)
    : ((impacto || null) as ImpactoTicket | null)
  const campoFecha = campos.find(c => c.es_fecha_requerida && c.tipo_dato === 'FECHA')
  const fechaRequerida = campoFecha ? (valores?.[claveCampo(campoFecha.id)] ?? '') : ''
  const esAuditoriaVencida = !!categoria && normalizar(categoria.nombre) === 'auditoria' && !!fechaRequerida && fechaRequerida < hoy()
  const prioridad = tipologia && impactoEfectivo
    ? calcularPrioridad({
      impacto: impactoEfectivo,
      tipoGestion: tipologia.tipo_gestion,
      prioridadDefecto: tipologia.prioridad_defecto,
      esAuditoriaVencida,
    })
    : null
  const reglaPrioridad = PRIORIDADES_TICKET.find(p => p.value === prioridad)?.regla

  const cambiarCategoria = (id: string) => {
    setValue('categoriaId', id, { shouldValidate: true })
    setValue('tipologiaId', '')
    setValue('valores', {})
    setValue('igsi', IGSI_VACIO)
  }
  const cambiarTipologia = (id: string) => {
    setValue('tipologiaId', id, { shouldValidate: true })
    setValue('valores', {})
    setValue('igsi', IGSI_VACIO)
  }

  const onSubmit = async (v: FormularioTicket) => {
    if (!tipologia) return
    const valoresServidor: Record<string, string> = {}
    for (const c of campos) {
      const val = v.valores[claveCampo(c.id)]
      if (val != null && val !== '') valoresServidor[c.id] = val
    }
    let igsi = null
    if (tipologia.es_novedad_igsi) {
      const n = v.igsi
      const idx = CADENA_VISUAL.indexOf(n.tipo_documento as (typeof CADENA_VISUAL)[number])
      const relacionados = (idx > 0 ? CADENA_VISUAL.slice(0, idx) : [])
        .map(d => [CADENA_IGSI.find(c => c.value === d)?.label ?? d, (n.relacionados[d] ?? '').trim()] as const)
        .filter(([, num]) => num)
        .map(([l, num]) => `${l}: ${num}`)
        .join(' · ')
      igsi = {
        tipo_documento: n.tipo_documento as TipoDocumentoIGSI,
        tipo_documento_otro: n.tipo_documento_otro || null,
        numero_documento: n.sin_numero ? null : n.numero_documento.trim(),
        sin_numero: n.sin_numero,
        documentos_relacionados: relacionados || null,
        servicio: n.servicio.trim(),
        modalidad: n.modalidad.trim(),
        accion: n.accion as AccionIGSI,
        que_paso: n.que_paso.trim(),
        que_esperaba: n.que_esperaba.trim(),
        mensaje_error: n.mensaje_error.trim() || null,
        validacion_previa: n.validacion_previa,
        impacto_operacion: n.impacto_operacion as ImpactoOperacionIGSI,
      }
    }

    const res = await crearTicket({
      tipologiaId: tipologia.id,
      impacto: (impactoEfectivo ?? 'SOLO_YO') as ImpactoTicket,
      asunto: v.asunto,
      descripcion: v.descripcion,
      valores: valoresServidor,
      adjuntos: v.adjuntos,
      igsi,
    })
    if (!res.ok || !res.id) {
      toast.error(res.error ?? 'No se pudo crear el ticket')
      return
    }
    toast.success(`Ticket ${res.codigo} creado`, {
      description: res.hijos?.length ? `También se creó: ${res.hijos.join(', ')}` : undefined,
    })
    router.push(`/mis-tickets/${res.id}`)
  }

  const errAdj = (errors.adjuntos as { message?: string } | undefined)?.message

  return (
    <FormProvider {...form}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
        <Link href="/mis-tickets" className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600">
          <ArrowLeft size={13} /> Volver a mis tickets
        </Link>

        <div>
          <h1 className="text-xl font-bold text-slate-800">Nuevo ticket</h1>
          <p className="mt-1 text-sm text-slate-500">
            Clasifica tu solicitud y completa la información que se pide. {catalogo.solicitante.area && (
              <>Área: <strong>{catalogo.solicitante.area}</strong></>
            )}{catalogo.solicitante.sede && <> · Sede: <strong>{catalogo.solicitante.sede}</strong></>}
          </p>
        </div>

        {/* 1. Clasificación */}
        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">1. ¿Qué necesitas?</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="categoria" className="text-sm font-medium text-slate-700">Categoría<span className="ml-0.5 text-red-500">*</span></Label>
              <select
                id="categoria"
                className={SELECT_CLASS}
                value={categoriaId}
                onChange={e => cambiarCategoria(e.target.value)}
                aria-invalid={!!errors.categoriaId}
              >
                <option value="">Selecciona la categoría…</option>
                {catalogo.categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
              {categoria?.descripcion && <p className="text-xs text-slate-400">{categoria.descripcion}</p>}
              {errors.categoriaId && <p className="text-xs text-red-600">{errors.categoriaId.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tipologia" className="text-sm font-medium text-slate-700">Tipología<span className="ml-0.5 text-red-500">*</span></Label>
              <select
                id="tipologia"
                className={SELECT_CLASS}
                value={tipologiaId}
                disabled={!categoriaId}
                onChange={e => cambiarTipologia(e.target.value)}
                aria-invalid={!!errors.tipologiaId}
              >
                <option value="">{categoriaId ? 'Selecciona la tipología…' : 'Primero elige la categoría'}</option>
                {tipologiasCat.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
              </select>
              {errors.tipologiaId && <p className="text-xs text-red-600">{errors.tipologiaId.message}</p>}
            </div>
          </div>

          {tipologia && (
            <div className="space-y-2 rounded-lg bg-slate-50 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <TipoGestionChip tipo={tipologia.tipo_gestion} />
                <span className="text-[11px] text-slate-500">
                  Se mide contra: {MEDICIONES.find(m => m.value === tipologia.se_mide_contra)?.label}
                </span>
                {tipologia.adjunto_obligatorio && (
                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">Imagen obligatoria</span>
                )}
                {tipologia.visibilidad_restringida && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-700">
                    <Lock size={10} /> Restringida
                  </span>
                )}
              </div>
              {tipologia.descripcion_ayuda && (
                <p className="flex gap-1.5 text-xs text-slate-600">
                  <Info size={13} className="mt-0.5 shrink-0 text-blue-500" />
                  <span><strong>Información que se pide:</strong> {tipologia.descripcion_ayuda}</span>
                </p>
              )}
            </div>
          )}

          {tipologia?.requiere_aprobacion && (
            catalogo.solicitante.jefeNombre ? (
              <div className="flex gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">
                <ShieldCheck size={15} className="shrink-0" />
                <span>
                  Esta solicitud requiere aprobación de tu jefe inmediato (<strong>{catalogo.solicitante.jefeNombre}</strong>).
                  Quedará <strong>En espera de aprobación</strong> hasta que la apruebe; ese tiempo no cuenta para la atención de TIN.
                </span>
              </div>
            ) : (
              <div className="flex gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
                <AlertTriangle size={15} className="shrink-0" />
                <span>
                  Esta solicitud requiere aprobación del jefe inmediato, pero <strong>no tienes un jefe configurado</strong> en
                  TIN-FLOW. El ticket quedará <strong>En espera de aprobación</strong> y lo aprobará un coordinador TIN.
                  Pide a TIN que registre tu jefe inmediato para la próxima vez.
                </span>
              </div>
            )
          )}
        </section>

        {tipologia && (
          <>
            {/* 2. Detalle */}
            <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">2. Detalle</p>

              {tipologia.es_novedad_igsi ? (
                <FormNovedadIGSI servicios={catalogo.serviciosIGSI} />
              ) : (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-slate-700">Impacto<span className="ml-0.5 text-red-500">*</span></Label>
                    <div className="flex flex-wrap gap-2">
                      {IMPACTOS_TICKET.map(i => (
                        <label
                          key={i.value}
                          className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50"
                        >
                          <input type="radio" value={i.value} className="accent-blue-600" {...register('impacto')} />
                          {i.label}
                        </label>
                      ))}
                    </div>
                    {errors.impacto && <p className="text-xs text-red-600">{errors.impacto.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="asunto" className="text-sm font-medium text-slate-700">Asunto<span className="ml-0.5 text-red-500">*</span></Label>
                    <Input id="asunto" maxLength={300} placeholder="Resumen corto de la novedad o solicitud" aria-invalid={!!errors.asunto} {...register('asunto')} />
                    {errors.asunto && <p className="text-xs text-red-600">{errors.asunto.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="descripcion" className="text-sm font-medium text-slate-700">Descripción<span className="ml-0.5 text-red-500">*</span></Label>
                    <Textarea id="descripcion" rows={5} placeholder="Detalle de la novedad o solicitud" aria-invalid={!!errors.descripcion} {...register('descripcion')} />
                    {errors.descripcion && <p className="text-xs text-red-600">{errors.descripcion.message}</p>}
                  </div>
                </>
              )}

              {campos.length > 0 && (
                <div className="space-y-4 border-t border-slate-100 pt-4">
                  <p className="text-sm font-semibold text-slate-700">Datos específicos de “{tipologia.nombre}”</p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {campos.map(c => (
                      <div key={c.id} className={cn(c.tipo_dato === 'TEXTO_LARGO' && 'sm:col-span-2')}>
                        <CampoDinamico campo={c} usuarios={catalogo.usuarios} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

            {/* 3. Adjuntos */}
            <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                3. {tipologia.es_novedad_igsi ? 'Capturas de pantalla' : 'Imágenes y adjuntos'}
                {(tipologia.adjunto_obligatorio || tipologia.es_novedad_igsi) && <span className="ml-0.5 text-red-500">*</span>}
              </p>
              <SubirAdjuntos
                carpeta={carpeta}
                value={adjuntos}
                onChange={v => setValue('adjuntos', v, { shouldValidate: form.formState.isSubmitted })}
                requerirImagen={tipologia.adjunto_obligatorio || tipologia.es_novedad_igsi}
                disabled={isSubmitting}
              />
              {errAdj && <p className="text-xs text-red-600">{errAdj}</p>}
            </section>

            {/* Prioridad y envío */}
            <section className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Prioridad calculada</p>
                {prioridad ? (
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <PrioridadChip prioridad={prioridad} />
                    <span className="text-xs text-slate-500">{esAuditoriaVencida ? 'Auditoría con fecha de entrega vencida' : reglaPrioridad}</span>
                  </div>
                ) : (
                  <p className="mt-1 text-xs text-slate-400">Indica el impacto para ver la prioridad</p>
                )}
              </div>
              <Button type="submit" disabled={isSubmitting} className="gap-1.5 bg-blue-600 hover:bg-blue-700">
                {isSubmitting ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                Crear ticket
              </Button>
            </section>
          </>
        )}
      </form>
    </FormProvider>
  )
}
