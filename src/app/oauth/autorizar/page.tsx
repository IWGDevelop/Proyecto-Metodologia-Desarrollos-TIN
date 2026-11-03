import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { AlertTriangle, Bot, CheckCircle2, ShieldAlert } from 'lucide-react'
import { getPerfil } from '@/lib/supabase/auth'
import { esLoopback, origenPublico } from '@/lib/mcp/oauth'
import { validarSolicitud } from '@/lib/mcp/autorizacion'
import { aprobarAutorizacionMcp, denegarAutorizacionMcp } from '@/actions/mcp-oauth'
import { InterflowLogoIcon } from '@/components/layout/InterflowLogo'
import { Button } from '@/components/ui/button'

// Authorization endpoint OAuth del MCP: pantalla de consentimiento.
// Es pública en middleware.ts para conservar la query al mandar a /login (?next=…).

export const dynamic = 'force-dynamic'

function Marco({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex min-h-screen items-center justify-center bg-slate-50 px-4"
      style={{ backgroundImage: 'radial-gradient(circle, #cbd5e1 1px, transparent 1px)', backgroundSize: '24px 24px' }}
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-200/60">
        <div className="flex flex-col items-center border-b border-slate-100 px-8 py-6">
          <InterflowLogoIcon px={48} />
          <p className="mt-3 text-lg font-bold tracking-tight text-slate-800">TIN-<span className="text-blue-600">FLOW</span></p>
        </div>
        <div className="px-8 py-6">{children}</div>
      </div>
    </div>
  )
}

function Error({ titulo, mensaje }: { titulo: string; mensaje: string }) {
  return (
    <Marco>
      <div className="flex flex-col items-center gap-3 text-center">
        <ShieldAlert className="text-red-500" size={32} />
        <h1 className="text-base font-semibold text-slate-800">{titulo}</h1>
        <p className="text-sm text-slate-500">{mensaje}</p>
      </div>
    </Marco>
  )
}

export default async function AutorizarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const consulta = new URLSearchParams()
  for (const [k, v] of Object.entries(sp)) {
    const valor = Array.isArray(v) ? v[0] : v
    if (valor != null) consulta.set(k, valor)
  }

  const origen = origenPublico(await headers())
  const solicitud = await validarSolicitud(consulta, origen)
  if (solicitud.tipo === 'error_pantalla') {
    return <Error titulo="Solicitud de conexión inválida" mensaje={solicitud.mensaje} />
  }
  if (solicitud.tipo === 'error_redirect') redirect(solicitud.url)

  const perfil = await getPerfil()
  if (!perfil) redirect(`/login?next=${encodeURIComponent(`/oauth/autorizar?${consulta.toString()}`)}`)
  if (perfil.rol !== 'ADMIN_TIN' || perfil.activo === false) {
    return (
      <Error
        titulo="No tienes acceso"
        mensaje={`La conexión MCP de TIN-FLOW está disponible solo para usuarios ADMIN_TIN. Sesión actual: ${perfil.email}.`}
      />
    )
  }

  const { cliente, redirectUri } = solicitud
  const hostRetorno = new URL(redirectUri).host
  const soloLoopback = cliente.redirect_uris.length > 0 && cliente.redirect_uris.every(esLoopback)

  return (
    <Marco>
      <div className="space-y-5">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-blue-50 p-2 text-blue-600"><Bot size={22} /></div>
          <div>
            <h1 className="text-base font-semibold text-slate-800">
              <span className="text-blue-700">{cliente.nombre}</span> quiere acceder a TIN-FLOW
            </h1>
            {cliente.descripcion !== cliente.nombre && (
              <p className="text-xs text-slate-500">Se identifica como “{cliente.descripcion}”</p>
            )}
          </div>
        </div>

        <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">
          <p className="mb-2 font-medium text-slate-700">Podrá, en tu nombre:</p>
          <ul className="space-y-1.5">
            <li className="flex gap-2"><CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600" />Consultar requerimientos, su historial, comentarios y planeación</li>
            <li className="flex gap-2"><CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600" />Calcular métricas e indicadores de requerimientos</li>
          </ul>
          <p className="mt-2 text-xs text-slate-400">Solo lectura. No incluye tickets ni puede modificar información.</p>
        </div>

        <div className="space-y-1 text-xs text-slate-500">
          <p>Sesión: <strong className="text-slate-700">{perfil.email}</strong></p>
          <p>Volverá a: <strong className="text-slate-700">{hostRetorno}</strong></p>
        </div>

        {soloLoopback && (
          <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <AlertTriangle size={16} className="shrink-0" />
            Esta aplicación se ejecuta en tu computador (por ejemplo, Claude Code). Autorízala solo si tú iniciaste la conexión.
          </div>
        )}

        <form className="flex gap-2 pt-1">
          <input type="hidden" name="consulta" value={consulta.toString()} />
          <Button formAction={denegarAutorizacionMcp} type="submit" variant="outline" className="flex-1">
            Cancelar
          </Button>
          <Button formAction={aprobarAutorizacionMcp} type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700">
            Permitir acceso
          </Button>
        </form>
        <p className="text-center text-[11px] text-slate-400">
          Puedes revocar esta conexión cuando quieras en TIN-FLOW → Conexión MCP.
        </p>
      </div>
    </Marco>
  )
}
