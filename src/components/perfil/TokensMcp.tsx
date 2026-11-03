'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Bot, Check, Copy, KeyRound, Loader2 } from 'lucide-react'
import { generarTokenMcp, listarMisTokensMcp, revocarTokenMcp, type TokenMcp } from '@/actions/mcp-tokens'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatFecha, formatFechaRelativa } from '@/lib/utils'

function estadoToken(t: TokenMcp): { texto: string; clase: string } {
  if (t.revocado_en) return { texto: 'Revocado', clase: 'bg-slate-100 text-slate-500' }
  if (new Date(t.expira_en).getTime() <= Date.now()) return { texto: 'Vencido', clase: 'bg-amber-100 text-amber-700' }
  return { texto: 'Activo', clase: 'bg-emerald-100 text-emerald-700' }
}

function BotonCopiar({ texto }: { texto: string }) {
  const [copiado, setCopiado] = useState(false)
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={async () => {
        await navigator.clipboard.writeText(texto)
        setCopiado(true)
        setTimeout(() => setCopiado(false), 1500)
      }}
    >
      {copiado ? <Check size={14} /> : <Copy size={14} />}
    </Button>
  )
}

export function TokensMcp() {
  const [tokens, setTokens] = useState<TokenMcp[] | null>(null)
  const [nombre, setNombre] = useState('')
  const [generando, setGenerando] = useState(false)
  const [revocando, setRevocando] = useState<string | null>(null)
  const [nuevo, setNuevo] = useState<string | null>(null)

  const cargar = () =>
    listarMisTokensMcp()
      .then(setTokens)
      .catch(() => { setTokens([]); toast.error('No se pudieron cargar los tokens') })

  useEffect(() => { cargar() }, [])

  const onGenerar = async () => {
    setGenerando(true)
    try {
      const { token } = await generarTokenMcp(nombre)
      setNuevo(token)
      setNombre('')
      await cargar()
    } catch (e: any) {
      toast.error(e.message ?? 'Error al generar el token')
    } finally {
      setGenerando(false)
    }
  }

  const onRevocar = async (id: string) => {
    setRevocando(id)
    try {
      await revocarTokenMcp(id)
      toast.success('Token revocado')
      await cargar()
    } catch (e: any) {
      toast.error(e.message ?? 'Error al revocar el token')
    } finally {
      setRevocando(null)
    }
  }

  const url = typeof window !== 'undefined' ? `${window.location.origin}/api/mcp` : '/api/mcp'
  const comando = nuevo
    ? `claude mcp add --transport http --scope user tin-requerimientos ${url} --header "Authorization: Bearer ${nuevo}"`
    : ''

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-slate-700">
        <Bot size={16} /> Conexión con Claude Code (MCP)
      </h2>
      <p className="mb-4 text-xs text-slate-500">
        Genera un token personal para consultar y analizar requerimientos desde Claude Code.
        Vence a los 90 días. Trátalo como una contraseña: da acceso a todos los requerimientos con tu usuario.
      </p>

      <div className="flex items-end gap-2">
        <div className="flex-1 space-y-1">
          <Label>Nombre del token</Label>
          <Input
            placeholder="Ej. Portátil oficina"
            value={nombre}
            maxLength={80}
            onChange={e => setNombre(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && nombre.trim()) onGenerar() }}
          />
        </div>
        <Button onClick={onGenerar} disabled={generando || !nombre.trim()} className="bg-blue-600 hover:bg-blue-700">
          {generando ? <Loader2 size={14} className="mr-2 animate-spin" /> : <KeyRound size={14} className="mr-2" />}
          Generar token
        </Button>
      </div>

      <div className="mt-4 divide-y divide-slate-100 rounded-lg border border-slate-100">
        {tokens === null && (
          <p className="px-4 py-3 text-xs text-slate-400"><Loader2 size={12} className="mr-1 inline animate-spin" />Cargando…</p>
        )}
        {tokens?.length === 0 && <p className="px-4 py-3 text-xs text-slate-400">Aún no tienes tokens.</p>}
        {tokens?.map(t => {
          const est = estadoToken(t)
          return (
            <div key={t.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-xs">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-slate-700">{t.nombre}</p>
                <p className="text-slate-400">
                  <code>{t.prefijo}…</code> · creado {formatFecha(t.created_at)} · vence {formatFecha(t.expira_en)} ·
                  último uso {t.ultimo_uso ? formatFechaRelativa(t.ultimo_uso) : 'nunca'}
                </p>
              </div>
              <span className={`rounded-full px-2 py-0.5 font-semibold ${est.clase}`}>{est.texto}</span>
              {est.texto === 'Activo' && (
                <Button variant="outline" size="sm" disabled={revocando === t.id} onClick={() => onRevocar(t.id)}>
                  {revocando === t.id ? <Loader2 size={12} className="animate-spin" /> : 'Revocar'}
                </Button>
              )}
            </div>
          )
        })}
      </div>

      <Dialog open={!!nuevo} onOpenChange={o => !o && setNuevo(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Token generado</DialogTitle>
            <DialogDescription>
              Cópialo ahora: por seguridad no se volverá a mostrar.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-xs">
            <div className="space-y-1">
              <Label>Token</Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 break-all rounded bg-slate-50 px-3 py-2 text-slate-700">{nuevo}</code>
                <BotonCopiar texto={nuevo ?? ''} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Comando para conectar Claude Code (ejecútalo en una terminal)</Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 break-all rounded bg-slate-900 px-3 py-2 text-slate-100">{comando}</code>
                <BotonCopiar texto={comando} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setNuevo(null)}>Listo, ya lo copié</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
