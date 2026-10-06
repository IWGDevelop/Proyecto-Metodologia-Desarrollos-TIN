'use client'

import { useEffect, useMemo, useState } from 'react'
import { Mail, Send } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { BuscadorMultiUsuario } from '@/components/requerimientos/pasos/Paso2Solicitante'
import { getPerfilesActivos } from '@/actions/perfiles'
import {
  enviarResumenTareasPendientes, type EnviarResumenInput, type TareaConsolidadaReq,
} from '@/actions/pendientes-requerimiento'
import { urgenciaTarea } from '@/lib/urgencia-tareas'
import type { Perfil } from '@/lib/supabase/types'
import { cn } from '@/lib/utils'

interface Props {
  requerimientoId: string
  tareas: TareaConsolidadaReq[]
}

export function EnviarPendientesDialog({ requerimientoId, tareas }: Props) {
  const [open, setOpen] = useState(false)
  const [alcance, setAlcance] = useState<EnviarResumenInput['alcance']>('TODAS')
  const [responsables, setResponsables] = useState(true)
  const [listaGlobal, setListaGlobal] = useState(false)
  const [adicionales, setAdicionales] = useState<string[]>([])
  const [mensaje, setMensaje] = useState('')
  const [usuarios, setUsuarios] = useState<Perfil[]>([])
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    if (open && usuarios.length === 0) getPerfilesActivos().then(setUsuarios)
  }, [open, usuarios.length])

  const pendientes = useMemo(
    () => tareas.filter(t => !t.completada).map(t => ({ ...t, urgencia: urgenciaTarea(t.fecha_compromiso) })),
    [tareas],
  )
  const conteo = {
    VENCIDA:   pendientes.filter(t => t.urgencia === 'VENCIDA').length,
    PROXIMA:   pendientes.filter(t => t.urgencia === 'PROXIMA').length,
    AL_DIA:    pendientes.filter(t => t.urgencia === 'AL_DIA').length,
    SIN_FECHA: pendientes.filter(t => t.urgencia === 'SIN_FECHA').length,
  }
  const incluidas = alcance === 'TODAS'
    ? pendientes
    : pendientes.filter(t => t.urgencia === 'VENCIDA' || t.urgencia === 'PROXIMA')
  const emailsResponsables = [...new Set(incluidas.map(t => t.responsable_email).filter(Boolean))] as string[]

  async function enviar() {
    setEnviando(true)
    const res = await enviarResumenTareasPendientes(requerimientoId, {
      alcance, responsables, listaGlobal, adicionales, mensaje,
    })
    setEnviando(false)
    if (!res.ok) { toast.error(res.error ?? 'No se pudo enviar el correo'); return }
    toast.success(`Resumen de ${res.tareas} tarea${res.tareas === 1 ? '' : 's'} enviado a ${res.enviadoA?.length} destinatario${res.enviadoA?.length === 1 ? '' : 's'}`)
    setOpen(false)
    setMensaje('')
  }

  const sinDestinatarios = !(responsables && emailsResponsables.length > 0) && !listaGlobal && adicionales.length === 0

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="gap-1.5"
        onClick={() => setOpen(true)}
        disabled={pendientes.length === 0}
        title={pendientes.length === 0 ? 'No hay tareas pendientes' : 'Enviar resumen por correo'}
      >
        <Mail size={14} /> Enviar por correo
      </Button>

      <Dialog open={open} onOpenChange={o => !o && setOpen(false)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Enviar tareas pendientes por correo</DialogTitle>
            <DialogDescription>
              Se envía un resumen con las tareas agrupadas por urgencia: vencidas, próximas a vencer (3 días o menos), al día y sin fecha.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Vista previa de urgencia */}
            <div className="grid grid-cols-4 gap-2 text-center">
              {[
                { k: 'VENCIDA',   label: 'Vencidas',  cls: 'border-red-200 bg-red-50 text-red-700' },
                { k: 'PROXIMA',   label: 'Próximas',  cls: 'border-amber-200 bg-amber-50 text-amber-700' },
                { k: 'AL_DIA',    label: 'Al día',    cls: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
                { k: 'SIN_FECHA', label: 'Sin fecha', cls: 'border-slate-200 bg-slate-50 text-slate-600' },
              ].map(c => (
                <div key={c.k} className={cn('rounded-lg border px-2 py-2', c.cls)}>
                  <p className="text-lg font-bold">{conteo[c.k as keyof typeof conteo]}</p>
                  <p className="text-[11px]">{c.label}</p>
                </div>
              ))}
            </div>

            {/* Qué incluir */}
            <div className="space-y-1.5">
              <Label>Tareas a incluir</Label>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { v: 'TODAS', t: 'Todas las pendientes', n: pendientes.length },
                  { v: 'URGENTES', t: 'Solo vencidas y próximas', n: conteo.VENCIDA + conteo.PROXIMA },
                ] as const).map(o => (
                  <button
                    key={o.v}
                    type="button"
                    onClick={() => setAlcance(o.v)}
                    className={cn(
                      'rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                      alcance === o.v ? 'border-blue-500 bg-blue-50 text-blue-800 ring-1 ring-blue-500' : 'border-slate-200 hover:border-blue-300',
                    )}
                  >
                    <span className="font-medium">{o.t}</span>
                    <span className="block text-xs text-slate-500">{o.n} tarea{o.n === 1 ? '' : 's'}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Destinatarios */}
            <div className="space-y-2">
              <Label>Destinatarios</Label>
              <label className="flex items-start gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={responsables} onChange={e => setResponsables(e.target.checked)} className="mt-0.5 accent-blue-600" />
                <span>
                  Responsables de las tareas
                  <span className="block text-xs text-slate-400">
                    {emailsResponsables.length > 0
                      ? emailsResponsables.map(e => usuarios.find(u => u.email === e)?.nombre_completo ?? e).join(', ')
                      : 'Ninguna tarea incluida tiene responsable'}
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={listaGlobal} onChange={e => setListaGlobal(e.target.checked)} className="mt-0.5 accent-blue-600" />
                <span>
                  Lista de notificaciones TIN
                  <span className="block text-xs text-slate-400">Configuración → Notificaciones Email</span>
                </span>
              </label>
              <div className="space-y-1">
                <p className="text-xs text-slate-500">Otros destinatarios</p>
                <BuscadorMultiUsuario
                  usuarios={usuarios}
                  values={adicionales}
                  onChange={setAdicionales}
                  placeholder="Buscar y agregar usuarios..."
                />
              </div>
            </div>

            {/* Mensaje */}
            <div className="space-y-1.5">
              <Label>Mensaje <span className="text-xs font-normal text-slate-400">(opcional)</span></Label>
              <Textarea
                value={mensaje}
                onChange={e => setMensaje(e.target.value)}
                rows={3}
                placeholder="Ej: Por favor registren el cumplimiento antes del comité del viernes."
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button
              type="button"
              onClick={enviar}
              disabled={enviando || incluidas.length === 0 || sinDestinatarios}
              className="gap-1.5"
            >
              <Send size={14} /> {enviando ? 'Enviando...' : `Enviar ${incluidas.length} tarea${incluidas.length === 1 ? '' : 's'}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
