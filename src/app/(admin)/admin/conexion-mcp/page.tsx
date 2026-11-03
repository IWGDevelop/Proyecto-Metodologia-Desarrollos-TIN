import { redirect } from 'next/navigation'
import { Bot, Search, FileText, BarChart2, ListChecks } from 'lucide-react'
import { getPerfil } from '@/lib/supabase/auth'
import { TokensMcp } from '@/components/mcp/TokensMcp'

export const dynamic = 'force-dynamic'

const HERRAMIENTAS = [
  { nombre: 'listar_estados', Icon: ListChecks, texto: 'Catálogo de estados del Kanban.' },
  { nombre: 'buscar_requerimientos', Icon: Search, texto: 'Listados con filtros por texto, estado, proceso, alcance, prioridad o responsable.' },
  { nombre: 'obtener_requerimiento', Icon: FileText, texto: 'Detalle completo con historial de estados, comentarios y planeación.' },
  { nombre: 'metricas_requerimientos', Icon: BarChart2, texto: 'Conteos, atrasos, SLA, más estancados, horas e impacto estimado vs. real.' },
]

const EJEMPLOS = [
  '¿Qué requerimientos llevan más de 30 días en análisis?',
  'Dame las métricas de los requerimientos de OPERACIONES.',
  '¿Cuáles están atrasados frente a su fecha estimada de entrega?',
  'Compara el impacto estimado vs. el real de los requerimientos entregados.',
]

export default async function ConexionMcpPage() {
  const perfil = await getPerfil()
  if (perfil?.rol !== 'ADMIN_TIN') redirect('/admin/dashboard')

  return (
    <div className="max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-slate-800">
          <Bot size={22} /> Conexión MCP
        </h1>
        <p className="text-sm text-slate-500">
          Conecta Claude Code a TIN-FLOW para consultar y analizar requerimientos en lenguaje natural.
          Por ahora es solo lectura y no incluye tickets.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Cómo conectarte</h2>
        <ol className="list-decimal space-y-1.5 pl-5 text-sm text-slate-600">
          <li>Genera un token abajo y copia el comando que aparece.</li>
          <li>Pégalo en una terminal donde tengas Claude Code instalado y ejecútalo (una sola vez por equipo).</li>
          <li>Abre una sesión nueva de Claude Code y escribe <code className="rounded bg-slate-100 px-1">/mcp</code> para confirmar que <strong>tin-requerimientos</strong> aparece conectado.</li>
          <li>Haz tus preguntas sobre requerimientos.</li>
        </ol>
      </div>

      <TokensMcp />

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Herramientas disponibles</h2>
          <ul className="space-y-3">
            {HERRAMIENTAS.map(({ nombre, Icon, texto }) => (
              <li key={nombre} className="flex gap-3 text-xs">
                <Icon size={16} className="mt-0.5 shrink-0 text-blue-600" />
                <div>
                  <code className="font-semibold text-slate-700">{nombre}</code>
                  <p className="text-slate-500">{texto}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Ejemplos de preguntas</h2>
          <ul className="space-y-2">
            {EJEMPLOS.map(e => (
              <li key={e} className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">“{e}”</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
