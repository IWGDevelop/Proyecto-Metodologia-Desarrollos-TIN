'use client'

import { useState } from 'react'
import { Settings2, Kanban, Clock, Mail } from 'lucide-react'
import { GestionEstadosKanban } from '@/components/admin/GestionEstadosKanban'
import { GestionSLA } from '@/components/admin/GestionSLA'
import { GestionNotificacionesEmail } from '@/components/admin/GestionNotificacionesEmail'
import { cn } from '@/lib/utils'

const TABS = [
  { id: 'sla',            label: 'SLA y Prioridades',   Icon: Clock  },
  { id: 'estados',        label: 'Estados Kanban',       Icon: Kanban },
  { id: 'notificaciones', label: 'Notificaciones Email', Icon: Mail   },
] as const

type TabId = typeof TABS[number]['id']

export default function ConfiguracionPage() {
  const [tab, setTab] = useState<TabId>('sla')

  return (
    <div className="p-6 max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Settings2 size={20} className="text-slate-500" />
        <div>
          <h1 className="text-xl font-bold text-slate-800">Configuración</h1>
          <p className="text-sm text-slate-500">Parámetros globales del sistema</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-1 w-fit gap-1">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all',
              tab === id
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            )}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* Contenido */}
      {tab === 'sla'            && <GestionSLA />}
      {tab === 'estados'        && <GestionEstadosKanban />}
      {tab === 'notificaciones' && <GestionNotificacionesEmail />}
    </div>
  )
}
