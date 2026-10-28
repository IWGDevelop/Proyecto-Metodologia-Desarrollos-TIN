'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { ArrowLeft, CornerDownRight, Loader2, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { crearTicketsDesdePlantilla } from '@/actions/tickets/crear'
import { cn } from '@/lib/utils'
import { SELECT_CLASS } from './formulario-ticket'
import type { DatosPlantillaFormulario } from './tipos'

const esquema = z.object({
  plantillaId: z.string().min(1, 'Elige la plantilla'),
  nombre: z.string().trim().min(1, 'Escribe el nombre del funcionario'),
  cargo: z.string().trim().min(1, 'Escribe el cargo'),
  area: z.string(),
  sede: z.string(),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Indica la fecha'),
  observaciones: z.string().max(5000),
})
type Datos = z.infer<typeof esquema>

function Req() {
  return <span className="ml-0.5 text-red-500">*</span>
}

export function PlantillaIngresoForm({ datos }: { datos: DatosPlantillaFormulario }) {
  const router = useRouter()
  const { register, control, handleSubmit, formState: { errors, isSubmitting } } = useForm<Datos>({
    resolver: zodResolver(esquema),
    defaultValues: {
      plantillaId: datos.plantillas.length === 1 ? datos.plantillas[0].id : '',
      nombre: '', cargo: '', area: '', sede: '', fecha: '', observaciones: '',
    },
  })
  const plantillaId = useWatch({ control, name: 'plantillaId' })
  const plantilla = datos.plantillas.find(p => p.id === plantillaId) ?? null
  const esRetiro = !!plantilla && plantilla.nombre.toLowerCase().includes('retiro')

  const onSubmit = async (v: Datos) => {
    const r = await crearTicketsDesdePlantilla(v)
    if (!r.ok || !r.id) {
      toast.error(r.error ?? 'No se pudieron crear los tickets')
      return
    }
    toast.success(`Ticket ${r.codigo} creado con ${r.hijos?.length ?? 0} tickets hijos`, {
      description: r.hijos?.join(', '),
    })
    if (r.error) toast.warning(r.error)
    router.push(`/mis-tickets/${r.id}`)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
      <Link href="/mis-tickets" className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600">
        <ArrowLeft size={13} /> Volver a mis tickets
      </Link>
      <div>
        <h1 className="text-xl font-bold text-slate-800">Plantilla de ingreso o retiro de personal</h1>
        <p className="mt-1 text-sm text-slate-500">
          Crea un ticket padre y un ticket por cada tarea de la plantilla. Los datos específicos que falten los completa TIN al atender cada ticket.
        </p>
      </div>

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-slate-700">Plantilla<Req /></Label>
          <div className="grid gap-2 sm:grid-cols-2">
            {datos.plantillas.map(p => (
              <label
                key={p.id}
                className="flex cursor-pointer flex-col gap-1 rounded-lg border border-slate-200 p-3 has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50"
              >
                <span className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <input type="radio" value={p.id} className="accent-blue-600" {...register('plantillaId')} />
                  {p.nombre}
                </span>
                {p.descripcion && <span className="text-xs text-slate-500">{p.descripcion}</span>}
                <span className="text-xs text-slate-400">{p.items.filter(i => i.activa).length} tickets hijos</span>
              </label>
            ))}
          </div>
          {errors.plantillaId && <p className="text-xs text-red-600">{errors.plantillaId.message}</p>}
        </div>

        {plantilla && (
          <ul className="space-y-1 rounded-lg bg-slate-50 p-3">
            {plantilla.items.map(i => (
              <li key={i.id} className={cn('flex items-start gap-1.5 text-xs', i.activa ? 'text-slate-700' : 'text-slate-400 line-through')}>
                <CornerDownRight size={12} className="mt-0.5 shrink-0 text-slate-400" />
                <span><strong>{i.asunto || i.tipologia}</strong> <span className="text-slate-500">· {i.categoria} / {i.tipologia}</span>{!i.activa && ' (tipología inactiva, no se crea)'}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Funcionario que {esRetiro ? 'se retira' : 'ingresa'}
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="pl-nombre" className="text-sm font-medium text-slate-700">Nombre completo<Req /></Label>
            <Input id="pl-nombre" aria-invalid={!!errors.nombre} {...register('nombre')} />
            {errors.nombre && <p className="text-xs text-red-600">{errors.nombre.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pl-cargo" className="text-sm font-medium text-slate-700">Cargo<Req /></Label>
            <Input id="pl-cargo" aria-invalid={!!errors.cargo} {...register('cargo')} />
            {errors.cargo && <p className="text-xs text-red-600">{errors.cargo.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pl-area" className="text-sm font-medium text-slate-700">Área</Label>
            {datos.areas.length > 0 ? (
              <select id="pl-area" className={SELECT_CLASS} {...register('area')}>
                <option value="">Selecciona…</option>
                {datos.areas.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
            ) : (
              <Input id="pl-area" {...register('area')} />
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pl-sede" className="text-sm font-medium text-slate-700">Sede</Label>
            {datos.sedes.length > 0 ? (
              <select id="pl-sede" className={SELECT_CLASS} {...register('sede')}>
                <option value="">Selecciona…</option>
                {datos.sedes.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            ) : (
              <Input id="pl-sede" {...register('sede')} />
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pl-fecha" className="text-sm font-medium text-slate-700">
              Fecha de {esRetiro ? 'retiro' : 'ingreso'}<Req />
            </Label>
            <Input id="pl-fecha" type="date" aria-invalid={!!errors.fecha} {...register('fecha')} />
            {errors.fecha && <p className="text-xs text-red-600">{errors.fecha.message}</p>}
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="pl-obs" className="text-sm font-medium text-slate-700">Observaciones</Label>
            <Textarea id="pl-obs" rows={3} placeholder="Perfil de referencia, software requerido, a quién se delegan las cuentas…" {...register('observaciones')} />
          </div>
        </div>
      </section>

      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting} className="gap-1.5 bg-blue-600 hover:bg-blue-700">
          {isSubmitting ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
          Crear tickets
        </Button>
      </div>
    </form>
  )
}
