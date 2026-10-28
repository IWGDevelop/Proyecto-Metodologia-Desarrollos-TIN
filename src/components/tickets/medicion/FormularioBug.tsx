'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { CADENA_IGSI, CLASIFICACIONES_BUG, SEVERIDADES_BUG } from '@/lib/tickets/constantes'
import { editarBug, registrarBug, type BugTablero, type DatosBug } from '@/actions/tickets/bugs'
import type { ClasificacionBug, SeveridadBug, TipoDocumentoIGSI } from '@/lib/tickets/types'
import { SELECT_CLASE } from './estilos'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** null = nuevo bug */
  bug: BugTablero | null
  responsables: { id: string; nombre: string }[]
  onGuardado: () => void
}

function inicial(bug: BugTablero | null): DatosBug {
  return {
    titulo: bug?.titulo ?? '',
    descripcion: bug?.descripcion ?? '',
    clasificacion: bug?.clasificacion ?? 'BUG',
    severidad: bug?.severidad ?? 'MEDIA',
    tipo_documento: bug?.tipo_documento ?? null,
    modulo: bug?.modulo ?? '',
    solucion_provisional: bug?.solucion_provisional ?? '',
    responsable_id: bug?.responsable_id ?? null,
    version: bug?.version ?? '',
  }
}

export function FormularioBug({ open, onOpenChange, bug, responsables, onGuardado }: Props) {
  // El padre monta el formulario con key distinta por bug: el estado inicial basta
  const [d, setD] = useState<DatosBug>(() => inicial(bug))
  const [pendiente, startTransition] = useTransition()
  const set = <K extends keyof DatosBug>(k: K, v: DatosBug[K]) => setD(prev => ({ ...prev, [k]: v }))

  const guardar = () => {
    if (!d.titulo.trim()) { toast.error('Escribe el título del bug'); return }
    startTransition(async () => {
      const r = bug ? await editarBug(bug.id, d) : await registrarBug(d)
      if (!r.ok) { toast.error(r.error ?? 'No se pudo guardar'); return }
      toast.success(bug ? 'Bug actualizado' : `Bug ${'codigo' in r && r.codigo ? r.codigo : ''} creado`)
      onGuardado()
      onOpenChange(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{bug ? `Editar ${bug.codigo}` : 'Nuevo bug o deuda técnica'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="bug-titulo">Título</Label>
            <Input id="bug-titulo" value={d.titulo} onChange={e => set('titulo', e.target.value)} placeholder="Qué hace mal el sistema" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="bug-desc">Descripción</Label>
            <Textarea id="bug-desc" rows={3} value={d.descripcion ?? ''} onChange={e => set('descripcion', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="bug-clas">Clasificación</Label>
              <select id="bug-clas" className={`${SELECT_CLASE} w-full`} value={d.clasificacion} onChange={e => set('clasificacion', e.target.value as ClasificacionBug)}>
                {CLASIFICACIONES_BUG.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="bug-sev">Severidad</Label>
              <select id="bug-sev" className={`${SELECT_CLASE} w-full`} value={d.severidad} onChange={e => set('severidad', e.target.value as SeveridadBug)}>
                {SEVERIDADES_BUG.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>
          <p className="text-xs text-slate-500">
            {SEVERIDADES_BUG.find(s => s.value === d.severidad)?.descripcion}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="bug-doc">Documento afectado</Label>
              <select id="bug-doc" className={`${SELECT_CLASE} w-full`} value={d.tipo_documento ?? ''} onChange={e => set('tipo_documento', (e.target.value || null) as TipoDocumentoIGSI | null)}>
                <option value="">Ninguno</option>
                {CADENA_IGSI.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="bug-mod">Módulo</Label>
              <Input id="bug-mod" value={d.modulo ?? ''} onChange={e => set('modulo', e.target.value)} placeholder="Ej. Remesas" />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="bug-prov">Solución provisional</Label>
            <Input id="bug-prov" value={d.solucion_provisional ?? ''} onChange={e => set('solucion_provisional', e.target.value)} placeholder="Ej. Anular las remesas una por una" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="bug-resp">Responsable</Label>
              <select id="bug-resp" className={`${SELECT_CLASE} w-full`} value={d.responsable_id ?? ''} onChange={e => set('responsable_id', e.target.value || null)}>
                <option value="">Sin responsable</option>
                {responsables.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="bug-ver">Versión</Label>
              <Input id="bug-ver" value={d.version ?? ''} onChange={e => set('version', e.target.value)} placeholder="Versión que lo corrige" />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pendiente}>Cancelar</Button>
          <Button onClick={guardar} disabled={pendiente}>{pendiente ? 'Guardando…' : 'Guardar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
