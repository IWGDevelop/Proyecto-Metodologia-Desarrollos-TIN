'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Upload, CheckCircle2, AlertTriangle, ArrowRight,
  Download, Copy, RefreshCw, ExternalLink,
  FileJson, ClipboardList, Users, Layers,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { importarRequerimiento } from '@/actions/importar-requerimiento'
import type { ImportarPayload } from '@/actions/importar-requerimiento'

/* ── Plantilla de ejemplo ────────────────────────────────────────────────── */
const PLANTILLA: ImportarPayload = {
  requerimiento: {
    alcance:           'IWF',
    identificacion:    'Descripción breve del requerimiento',
    nombre_desarrollo: 'Nombre completo del desarrollo',
    tipo_solicitud:    'NUEVO_DESARROLLO',
    empresa:           'IWF',
    sucursal:          'Bogotá',
    proceso_interno:   'FINANCIERO',
    responsable:       'correo.responsable@empresa.com',
    partes_interesadas: ['correo.parte@empresa.com'],
    estado:            'EN_DESARROLLO',
    prioridad:         2,
    rama:              'TIN',
    horas_estimadas_desarrollo: 120,
    descripcion_situacion_actual: 'Describe el problema o situación actual...',
    definicion_requerimiento:    'Define qué se necesita desarrollar...',
    objetivo:                    'Objetivo principal del desarrollo...',
    criterios_validacion:        'Criterios de aceptación...',
    tipo_solucion:               'DESARROLLO',
    viabilidad_tecnica:          true,
    integra_otros_aplicativos:   false,
    impacta:                     'FUNCIONARIOS',
    fecha_solicitud:             '2026-01-15',
    fecha_envio_tin:             '2026-01-20',
    fecha_inicio_desarrollo:     '2026-02-01',
    fecha_estimada_entrega:      '2026-06-01',
    actividades_impacto: [
      { actividad: 'Proceso manual de ejemplo', horas_mes: 40, porcentaje_automatizable: 80 }
    ],
    procesos_cargos: [
      { proceso: 'Financiero', cargo: 'Auxiliar Contable', cantidad_usuarios: 3 }
    ],
    beneficios_cualitativos: [
      { descripcion: 'Reducción de errores' },
      { descripcion: 'Mejora en tiempos de respuesta' }
    ],
    horas_ahorradas_mes:    32,
    ahorro_mensual_cop:     1600000,
    ahorro_anual_cop:       19200000,
    total_beneficios_cualitativos_anual: 5000000,
    impacto_economico_total_anual:       24200000,
  },
  tareas: [
    {
      titulo:            'Análisis y diseño',
      descripcion:       'Detalle de la tarea (opcional)',
      categoria:         'DESARROLLO',
      cargo_responsable: 'ANALISTA_TIN',
      responsable_email: 'dev@tin.com',
      fecha_compromiso:  '2026-02-20',
    },
    {
      titulo:            'Desarrollo del módulo',
      categoria:         'DESARROLLO',
      cargo_responsable: 'ING_DESARROLLO',
      responsable_email: 'dev@tin.com',
      fecha_compromiso:  '2026-04-30',
    },
  ],
  desarrolladores: ['dev@tin.com'],
}

/* ── Valores válidos para referencia ─────────────────────────────────────── */
const REFERENCIA = {
  alcance:           ['IWF', 'ILT', 'IWG'],
  tipo_solicitud:    ['NUEVO_DESARROLLO', 'MEJORA', 'INTEGRACION', 'INFORME'],
  tipo_solucion:     ['DESARROLLO', 'MEJORA', 'INTEGRACION', 'SUPERSET', 'POR_DEFINIR'],
  estado:            ['SIN_GESTION', 'ANALISIS', 'EN_DEFINICION_USUARIO', 'EN_DESARROLLO', 'PRUEBAS_USUARIO', 'STAND_BY', 'ENTREGADO', 'CERRADO'],
  proceso_interno:   ['FINANCIERO', 'OPERACIONES', 'COMERCIAL', 'CARGA', 'SISTEMAS_GESTION', 'SERVICIO_CLIENTE', 'COMPRAS', 'SEGUROS', 'DATOS', 'TI', 'GENERAL'],
  impacta:           ['FUNCIONARIOS', 'CLIENTES', 'AMBOS'],
  rama:              ['TIN', 'IA'],
  categoria_tarea:   ['DESARROLLO', 'TESTING', 'DOCUMENTAL', 'ADMINISTRATIVO', 'OTRO'],
  cargo_responsable: ['AUXILIAR_TIN', 'ING_DESARROLLO', 'ANALISTA_TIN', 'COORDINADOR_TIN', 'DIRECTOR_CORPORATIVO_TIN'],
}

/* ── Preview card ────────────────────────────────────────────────────────── */
function PreviewCard({ payload }: { payload: ImportarPayload }) {
  const r = payload.requerimiento
  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <CheckCircle2 size={16} className="text-emerald-500" />
        <p className="text-sm font-semibold text-emerald-700">JSON válido — vista previa</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-emerald-100 bg-white p-3 space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 flex items-center gap-1.5">
            <Layers size={11} /> Requerimiento
          </p>
          <p className="text-sm font-bold text-slate-800 leading-tight">{r.nombre_desarrollo}</p>
          <p className="text-xs text-slate-500">{r.identificacion}</p>
          <div className="flex flex-wrap gap-1.5 mt-1">
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">{r.alcance}</span>
            {r.estado && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{r.estado}</span>}
            {r.prioridad && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">P{r.prioridad}</span>}
            {r.rama && <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs text-indigo-600">{r.rama}</span>}
          </div>
        </div>
        <div className="space-y-2">
          <div className="rounded-lg border border-slate-100 bg-white px-3 py-2 flex items-center gap-2">
            <ClipboardList size={13} className="text-blue-500 shrink-0" />
            <div>
              <p className="text-xs text-slate-400">Tareas técnicas</p>
              <p className="text-sm font-bold text-slate-700">{payload.tareas?.length ?? 0}</p>
            </div>
          </div>
          <div className="rounded-lg border border-slate-100 bg-white px-3 py-2 flex items-center gap-2">
            <Users size={13} className="text-purple-500 shrink-0" />
            <div>
              <p className="text-xs text-slate-400">Desarrolladores a asignar</p>
              <p className="text-sm font-bold text-slate-700">{payload.desarrolladores?.length ?? 0}</p>
            </div>
          </div>
        </div>
      </div>
      {r.horas_estimadas_desarrollo && (
        <p className="text-xs text-slate-500">Horas estimadas: <strong>{r.horas_estimadas_desarrollo} h</strong></p>
      )}
      {r.impacto_economico_total_anual && (
        <p className="text-xs text-slate-500">Impacto económico total: <strong>
          {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(r.impacto_economico_total_anual)}
        </strong></p>
      )}
    </div>
  )
}

/* ── Resultado ───────────────────────────────────────────────────────────── */
function ResultadoCard({
  requerimientoId, tareasCreadas, desarrolladoresAsignados, warnings,
}: {
  requerimientoId: string
  tareasCreadas: number
  desarrolladoresAsignados: number
  warnings: string[]
}) {
  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 space-y-3">
      <div className="flex items-center gap-2">
        <CheckCircle2 size={20} className="text-emerald-500" />
        <p className="text-base font-bold text-emerald-700">¡Requerimiento importado correctamente!</p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Requerimiento', valor: '1', color: 'text-emerald-600' },
          { label: 'Tareas creadas', valor: String(tareasCreadas), color: 'text-blue-600' },
          { label: 'Desarrolladores', valor: String(desarrolladoresAsignados), color: 'text-purple-600' },
        ].map(({ label, valor, color }) => (
          <div key={label} className="rounded-lg bg-white border border-emerald-100 px-3 py-2 text-center">
            <p className={cn('text-2xl font-bold', color)}>{valor}</p>
            <p className="text-xs text-slate-400">{label}</p>
          </div>
        ))}
      </div>
      {warnings.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-1">
          <p className="text-xs font-semibold text-amber-700 flex items-center gap-1.5">
            <AlertTriangle size={12} /> Advertencias ({warnings.length})
          </p>
          {warnings.map((w, i) => <p key={i} className="text-xs text-amber-600">• {w}</p>)}
        </div>
      )}
      <a
        href={`/admin/requerimientos/${requerimientoId}`}
        className="flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700"
      >
        <ExternalLink size={14} /> Abrir requerimiento
      </a>
    </div>
  )
}

/* ── Componente principal ────────────────────────────────────────────────── */
export function ImportadorRequerimiento() {
  const router = useRouter()
  const [jsonText, setJsonText]       = useState('')
  const [parsed, setParsed]           = useState<ImportarPayload | null>(null)
  const [parseError, setParseError]   = useState<string | null>(null)
  const [resultado, setResultado]     = useState<{
    requerimientoId: string; tareasCreadas: number
    desarrolladoresAsignados: number; warnings: string[]
  } | null>(null)
  const [isPending, startT] = useTransition()

  const handleParsear = () => {
    setParseError(null)
    setParsed(null)
    setResultado(null)
    try {
      const obj = JSON.parse(jsonText)
      if (!obj.requerimiento) throw new Error('El JSON debe tener un campo "requerimiento"')
      if (!obj.requerimiento.alcance) throw new Error('requerimiento.alcance es obligatorio (IWF | ILT | IWG)')
      if (!obj.requerimiento.nombre_desarrollo) throw new Error('requerimiento.nombre_desarrollo es obligatorio')
      if (!obj.requerimiento.identificacion) throw new Error('requerimiento.identificacion es obligatorio')
      setParsed(obj as ImportarPayload)
      toast.success('JSON válido — revisa la vista previa')
    } catch (e: any) {
      setParseError(e.message)
      toast.error('Error en el JSON')
    }
  }

  const handleImportar = () => {
    if (!parsed) return
    startT(async () => {
      const res = await importarRequerimiento(parsed)
      if (res.ok && res.requerimientoId) {
        setResultado({
          requerimientoId: res.requerimientoId,
          tareasCreadas: res.tareasCreadas ?? 0,
          desarrolladoresAsignados: res.desarrolladoresAsignados ?? 0,
          warnings: res.warnings ?? [],
        })
        toast.success('Importado correctamente')
      } else {
        toast.error(res.error ?? 'Error al importar')
      }
    })
  }

  const handleDescargarPlantilla = () => {
    const blob = new Blob([JSON.stringify(PLANTILLA, null, 2)], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = 'plantilla_requerimiento.json'; a.click()
    URL.revokeObjectURL(url)
  }

  const handleCopiarPlantilla = () => {
    navigator.clipboard.writeText(JSON.stringify(PLANTILLA, null, 2))
    setJsonText(JSON.stringify(PLANTILLA, null, 2))
    toast.success('Plantilla copiada al editor')
  }

  const handleReset = () => {
    setJsonText(''); setParsed(null); setParseError(null); setResultado(null)
  }

  if (resultado) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <ResultadoCard {...resultado} />
        <button onClick={handleReset}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700">
          <RefreshCw size={13} /> Importar otro requerimiento
        </button>
      </div>
    )
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      {/* ── Panel izquierdo: editor JSON ─────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-700">JSON del requerimiento</p>
          <div className="flex gap-2">
            <button onClick={handleCopiarPlantilla}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600">
              <Copy size={12} /> Cargar plantilla
            </button>
            <button onClick={handleDescargarPlantilla}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 hover:border-slate-300">
              <Download size={12} /> Descargar plantilla
            </button>
          </div>
        </div>

        <textarea
          value={jsonText}
          onChange={e => { setJsonText(e.target.value); setParsed(null); setParseError(null); setResultado(null) }}
          placeholder={'{\n  "requerimiento": {\n    "alcance": "IWF",\n    "identificacion": "...",\n    "nombre_desarrollo": "..."\n  }\n}'}
          rows={22}
          spellCheck={false}
          className={cn(
            'w-full rounded-xl border bg-slate-900 px-4 py-3 font-mono text-sm text-slate-100 outline-none transition resize-none',
            'focus:ring-2',
            parseError
              ? 'border-red-400 focus:border-red-400 focus:ring-red-200'
              : parsed
                ? 'border-emerald-400 focus:border-emerald-400 focus:ring-emerald-200'
                : 'border-slate-700 focus:border-blue-400 focus:ring-blue-200'
          )}
        />

        {parseError && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-600">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            {parseError}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={handleParsear}
            disabled={!jsonText.trim() || isPending}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:border-blue-300 hover:bg-blue-50 disabled:opacity-40"
          >
            <FileJson size={15} /> Parsear y validar
          </button>
          {parsed && (
            <button
              onClick={handleImportar}
              disabled={isPending}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isPending ? (
                <><div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> Importando...</>
              ) : (
                <><Upload size={15} /> Importar requerimiento <ArrowRight size={14} /></>
              )}
            </button>
          )}
        </div>

        {parsed && <PreviewCard payload={parsed} />}
      </div>

      {/* ── Panel derecho: referencia ─────────────────────────────────── */}
      <div className="space-y-4">
        <p className="text-sm font-semibold text-slate-700">Valores válidos</p>
        <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100 text-xs overflow-hidden">
          {Object.entries(REFERENCIA).map(([campo, valores]) => (
            <div key={campo} className="px-3 py-2.5">
              <p className="font-semibold text-slate-500 mb-1.5 font-mono">{campo}</p>
              <div className="flex flex-wrap gap-1">
                {valores.map(v => (
                  <span key={v} className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600 font-mono text-[10px]">
                    {v}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3 space-y-2 text-xs text-slate-600">
          <p className="font-semibold text-slate-700">Notas</p>
          <ul className="space-y-1 list-disc list-inside text-slate-500">
            <li><code className="font-mono">responsable</code> — email o texto libre</li>
            <li><code className="font-mono">partes_interesadas</code> — array de emails</li>
            <li><code className="font-mono">desarrolladores</code> — emails registrados en el sistema</li>
            <li><code className="font-mono">responsable_email</code> en tareas — debe existir en perfiles</li>
            <li>Fechas en formato <code className="font-mono">YYYY-MM-DD</code></li>
            <li>Montos en COP (enteros)</li>
            <li>Emails no encontrados generan advertencias pero no bloquean la importación</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
