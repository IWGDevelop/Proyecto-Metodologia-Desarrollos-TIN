'use client'

import { useState } from 'react'
import {
  BellRing, CalendarDays, ClipboardList, Copy, FolderTree, ListChecks, SlidersHorizontal, Timer,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DatosConfigTickets } from '@/actions/tickets/configuracion'
import { TabCatalogo } from './TabCatalogo'
import { TabCampos } from './TabCampos'
import { TabCausas } from './TabCausas'
import { TabObjetivos } from './TabObjetivos'
import { TabCalendario } from './TabCalendario'
import { TabRecordatorios } from './TabRecordatorios'
import { TabPlantillas } from './TabPlantillas'
import { TabParametros } from './TabParametros'

const TABS = [
  { id: 'catalogo',     label: 'Catálogo',           Icon: FolderTree },
  { id: 'campos',       label: 'Campos',             Icon: ListChecks },
  { id: 'causas',       label: 'Causas de cierre',   Icon: ClipboardList },
  { id: 'objetivos',    label: 'Tiempos objetivo',   Icon: Timer },
  { id: 'calendario',   label: 'Calendario laboral', Icon: CalendarDays },
  { id: 'recordatorios', label: 'Recordatorios',     Icon: BellRing },
  { id: 'plantillas',   label: 'Ingreso y retiro',   Icon: Copy },
  { id: 'parametros',   label: 'Parámetros',         Icon: SlidersHorizontal },
] as const

type TabId = typeof TABS[number]['id']

export function ConfiguracionTickets({ datos }: { datos: DatosConfigTickets }) {
  const [tab, setTab] = useState<TabId>('catalogo')
  const [tipologiaCampos, setTipologiaCampos] = useState('')

  const objetivosPendientes = (() => {
    const { objetivos, hoy } = datos
    const prioridades = ['CRITICA', 'ALTA', 'MEDIA', 'BAJA']
    return prioridades.some(p => {
      const v = objetivos.filter(o => o.prioridad === p && o.vigente_desde <= hoy).sort((a, b) => b.vigente_desde.localeCompare(a.vigente_desde))[0]
      return !v || !v.aprobado
    })
  })()

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all',
              tab === id ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700',
            )}
          >
            <Icon size={14} />
            {label}
            {id === 'objetivos' && objetivosPendientes && (
              <span className="h-2 w-2 rounded-full bg-amber-500" title="Tiempos objetivo pendientes de aprobación" />
            )}
          </button>
        ))}
      </div>

      {tab === 'catalogo' && (
        <TabCatalogo datos={datos} onEditarCampos={id => { setTipologiaCampos(id); setTab('campos') }} />
      )}
      {tab === 'campos' && <TabCampos datos={datos} tipologiaId={tipologiaCampos} onCambiarTipologia={setTipologiaCampos} />}
      {tab === 'causas' && <TabCausas datos={datos} />}
      {tab === 'objetivos' && <TabObjetivos datos={datos} />}
      {tab === 'calendario' && <TabCalendario datos={datos} />}
      {tab === 'recordatorios' && <TabRecordatorios datos={datos} />}
      {tab === 'plantillas' && <TabPlantillas datos={datos} />}
      {tab === 'parametros' && <TabParametros datos={datos} />}
    </div>
  )
}
