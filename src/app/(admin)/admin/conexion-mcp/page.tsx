import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { Bot, Search, FileText, BarChart2, ListChecks, Globe, Terminal, CalendarRange } from 'lucide-react'
import { getPerfil } from '@/lib/supabase/auth'
import { origenPublico, urlRecurso } from '@/lib/mcp/oauth'
import { TokensMcp } from '@/components/mcp/TokensMcp'
import { ConexionesMcp } from '@/components/mcp/ConexionesMcp'

export const dynamic = 'force-dynamic'

const HERRAMIENTAS = [
  { nombre: 'listar_estados', Icon: ListChecks, texto: 'Catálogo de estados del Kanban.' },
  { nombre: 'buscar_requerimientos', Icon: Search, texto: 'Listados con filtros por texto, estado, proceso, alcance, prioridad o responsable.' },
  { nombre: 'obtener_requerimiento', Icon: FileText, texto: 'Detalle completo con historial de estados, comentarios y planeación.' },
  { nombre: 'metricas_requerimientos', Icon: BarChart2, texto: 'Conteos, atrasos, SLA, más estancados, horas e impacto estimado vs. real.' },
  { nombre: 'planeacion_requerimientos', Icon: CalendarRange, texto: 'Planeación por etapas: plan vs. real, etapas vigentes hoy, cumplimiento y desviaciones.' },
]

const EJEMPLOS = [
  '¿Qué requerimientos llevan más de 30 días en análisis?',
  'Dame las métricas de los requerimientos de OPERACIONES.',
  '¿Cuáles están atrasados frente a su fecha estimada de entrega?',
  'Compara el impacto estimado vs. el real de los requerimientos entregados.',
  '¿Qué requerimientos tienen etapas planeadas activas hoy?',
  '¿Cuáles van atrasados frente a su planeación y por cuántos días?',
]

function Codigo({ children }: { children: React.ReactNode }) {
  return <code className="break-all rounded bg-slate-100 px-1.5 py-0.5 text-[12px] text-slate-700">{children}</code>
}

export default async function ConexionMcpPage() {
  const perfil = await getPerfil()
  if (perfil?.rol !== 'ADMIN_TIN') redirect('/admin/dashboard')

  const urlMcp = urlRecurso(origenPublico(await headers()))

  return (
    <div className="max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-slate-800">
          <Bot size={22} /> Conexión MCP
        </h1>
        <p className="text-sm text-slate-500">
          Conecta Claude a TIN-FLOW para consultar y analizar requerimientos en lenguaje natural.
          Por ahora es solo lectura y no incluye tickets. Disponible solo para usuarios ADMIN_TIN.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Globe size={16} /> Claude web, Desktop y móvil
        </h2>
        <ol className="list-decimal space-y-1.5 pl-5 text-sm text-slate-600">
          <li>
            Un Owner de la organización en Claude lo agrega una sola vez: <strong>Organization settings → Connectors → Add → Custom</strong>.
            En una cuenta personal: <strong>Customize → Connectors → Add custom connector</strong>.
          </li>
          <li>Nombre: <Codigo>TIN-FLOW Requerimientos</Codigo> · URL: <Codigo>{urlMcp}</Codigo> · sin credenciales ni headers.</li>
          <li>Cada persona va a <strong>Customize → Connectors</strong>, busca el conector y presiona <strong>Connect</strong>.</li>
          <li>Se abre TIN-FLOW: inicia sesión y presiona <strong>Permitir acceso</strong>.</li>
          <li>En un chat, actívalo desde <strong>+ → Connectors</strong> y haz tus preguntas.</li>
        </ol>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Terminal size={16} /> Claude Code
        </h2>
        <p className="mb-2 text-sm text-slate-600">Con inicio de sesión (recomendado):</p>
        <ol className="mb-3 list-decimal space-y-1.5 pl-5 text-sm text-slate-600">
          <li>Ejecuta <Codigo>{`claude mcp add --transport http --scope user tin-requerimientos ${urlMcp}`}</Codigo></li>
          <li>En una sesión de Claude Code escribe <Codigo>/mcp</Codigo>, elige <strong>tin-requerimientos</strong> → <strong>Authenticate</strong> y permite el acceso en TIN-FLOW.</li>
        </ol>
        <p className="text-xs text-slate-500">
          Alternativa sin navegador: genera un token abajo y usa el comando que aparece (incluye el header de autorización).
        </p>
      </div>

      <ConexionesMcp />
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
