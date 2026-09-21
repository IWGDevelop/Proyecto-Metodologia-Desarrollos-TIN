'use client'

import { useState, useTransition } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  ShieldCheck, ShieldAlert, Clock, CheckCircle2, XCircle,
  Plus, X, AlertTriangle, FileCheck, Rocket, User, Mail,
  CalendarDays, ChevronDown, ChevronUp,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  getSolicitudesVistoBueno,
  crearSolicitudVistoBueno,
  firmarVistoBueno,
  cancelarSolicitudVistoBueno,
  getMisFirmasPendientesEnReq,
} from '@/actions/visto-bueno'
import type {
  SolicitudVistoBueno, FirmaVistoBueno, TipoVistoBueno,
} from '@/actions/visto-bueno'

interface Props {
  requerimientoId: string
  nombreDesarrollo: string
  isAdmin: boolean
  userEmail: string | null
  userName: string | null
}

/* ── Helpers ──────────────────────────────────────────────────────────────── */
const TIPO_CFG = {
  DOCUMENTACION: {
    label:       'Visto bueno de documentación',
    sublabel:    'Aprobación de que la documentación está completa y correcta',
    Icon:        FileCheck,
    color:       'text-violet-600',
    bg:          'bg-violet-50',
    border:      'border-violet-200',
    badge:       'bg-violet-100 text-violet-700',
    btnColor:    'bg-violet-600 hover:bg-violet-700',
    headerColor: 'text-violet-700',
  },
  SALIDA_VIVO: {
    label:       'Visto bueno de salida en vivo',
    sublabel:    'Conformidad con el desarrollo entregado — aprobación para salir en vivo',
    Icon:        Rocket,
    color:       'text-sky-600',
    bg:          'bg-sky-50',
    border:      'border-sky-200',
    badge:       'bg-sky-100 text-sky-700',
    btnColor:    'bg-sky-600 hover:bg-sky-700',
    headerColor: 'text-sky-700',
  },
} as const

const TEXTO_CONFIRMACION: Record<TipoVistoBueno, { titulo: string; cuerpo: string; advertencia: string }> = {
  DOCUMENTACION: {
    titulo: 'Confirmar visto bueno de documentación',
    cuerpo:
      'Al firmar confirmas que has revisado la documentación técnica del desarrollo — incluyendo especificaciones, arquitectura, bases de datos, manuales y cualquier otro documento adjunto — y que la consideras completa, correcta y alineada con los requisitos acordados. Esta firma constituye tu aprobación formal como parte interesada del proceso.',
    advertencia:
      'Esta firma es vinculante. Quedará registrada con tu nombre completo, correo electrónico y la fecha y hora exacta del registro. Se te enviará un correo de confirmación como constancia.',
  },
  SALIDA_VIVO: {
    titulo: 'Confirmar visto bueno de salida en vivo',
    cuerpo:
      'Al firmar confirmas que has recibido a conformidad el desarrollo, que el mismo cumple con los requisitos acordados y que otorgas tu aprobación formal para que el desarrollo salga en vivo o entre en operación. Esta firma representa tu aceptación definitiva del desarrollo entregado.',
    advertencia:
      'Esta firma es vinculante. Quedará registrada con tu nombre completo, correo electrónico y la fecha y hora exacta del registro. Se te enviará un correo de confirmación como constancia.',
  },
}

function formatDatetime(iso: string) {
  try { return format(parseISO(iso), "d 'de' MMMM yyyy, HH:mm", { locale: es }) }
  catch { return iso }
}

/* ── Diálogo de firma ────────────────────────────────────────────────────── */
function DialogFirmar({
  open,
  onClose,
  firma,
  solicitud,
  requerimientoId,
  userName,
  userEmail,
  onFirmado,
}: {
  open: boolean
  onClose: () => void
  firma: FirmaVistoBueno
  solicitud: SolicitudVistoBueno
  requerimientoId: string
  userName: string | null
  userEmail: string | null
  onFirmado: () => void
}) {
  const [aceptado, setAceptado]     = useState(false)
  const [isPending, startTransition] = useTransition()
  const cfg  = TIPO_CFG[solicitud.tipo]
  const text = TEXTO_CONFIRMACION[solicitud.tipo]

  const handleFirmar = () => {
    if (!aceptado) return
    startTransition(async () => {
      const res = await firmarVistoBueno(firma.id, requerimientoId)
      if (res.ok) {
        toast.success('Visto bueno registrado — recibirás un correo de confirmación')
        onFirmado()
        onClose()
      } else {
        toast.error(res.error ?? 'Error al registrar la firma')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className={cn('flex items-center gap-2', cfg.headerColor)}>
            <ShieldCheck size={18} />
            {text.titulo}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Texto de lo que se está firmando */}
          <div className={cn('rounded-xl border p-4', cfg.bg, cfg.border)}>
            <p className="text-sm text-slate-700 leading-relaxed">{text.cuerpo}</p>
          </div>

          {/* Identidad del firmante */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-slate-400">
              Tu firma quedará registrada como
            </p>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-sm text-slate-700">
                <User size={14} className="text-slate-400" />
                <span className="font-semibold">{userName ?? 'Usuario desconocido'}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Mail size={14} className="text-slate-400" />
                {userEmail ?? '—'}
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <CalendarDays size={14} className="text-slate-400" />
                {formatDatetime(new Date().toISOString())}
              </div>
            </div>
          </div>

          {/* Advertencia legal */}
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-500" />
            <p className="text-xs text-amber-800 leading-relaxed">{text.advertencia}</p>
          </div>

          {/* Checkbox de confirmación */}
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 hover:bg-slate-50 transition-colors">
            <input
              type="checkbox"
              checked={aceptado}
              onChange={e => setAceptado(e.target.checked)}
              className="mt-0.5 h-4 w-4 cursor-pointer rounded border-slate-300 text-violet-600 accent-violet-600"
            />
            <span className="text-sm font-medium text-slate-700">
              He leído y entiendo lo anterior. Confirmo que deseo registrar mi visto bueno formal. Esta acción no puede deshacerse.
            </span>
          </label>

          {/* Botones */}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={onClose} disabled={isPending}>
              Cancelar
            </Button>
            <Button
              onClick={handleFirmar}
              disabled={!aceptado || isPending}
              className={cn(cfg.btnColor, 'gap-2 font-semibold')}
            >
              <ShieldCheck size={15} />
              {isPending ? 'Registrando firma...' : 'Confirmar visto bueno'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/* ── Fila de firmante ────────────────────────────────────────────────────── */
function FilaFirmante({
  firma, solicitud, requerimientoId, userEmail, userName, onRefresh,
}: {
  firma: FirmaVistoBueno
  solicitud: SolicitudVistoBueno
  requerimientoId: string
  userEmail: string | null
  userName: string | null
  onRefresh: () => void
}) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const esMiFirma = userEmail && firma.email_requerido.toLowerCase() === userEmail.toLowerCase()
  const puedeFirmar = esMiFirma && !firma.firmado && solicitud.estado === 'PENDIENTE'

  return (
    <>
      <div className={cn(
        'flex items-center justify-between gap-3 rounded-lg border p-3 transition-all',
        firma.firmado
          ? 'border-green-200 bg-green-50'
          : puedeFirmar
          ? 'border-amber-200 bg-amber-50 ring-1 ring-amber-200'
          : 'border-slate-100 bg-white',
      )}>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            {firma.es_estrategia && (
              <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-blue-700">
                Dir. Estrategia
              </span>
            )}
            <span className="text-sm font-medium text-slate-700 truncate">
              {firma.nombre_requerido ?? firma.email_requerido}
            </span>
            {firma.nombre_requerido && (
              <span className="text-xs text-slate-400">{firma.email_requerido}</span>
            )}
          </div>
          {firma.firmado && (
            <div className="mt-1 text-xs text-green-600">
              Firmado por <strong>{firma.firmado_por_nombre ?? firma.firmado_por_email}</strong>
              {firma.firmado_at && ` · ${formatDatetime(firma.firmado_at)}`}
            </div>
          )}
        </div>

        <div className="shrink-0">
          {firma.firmado ? (
            <div className="flex items-center gap-1 text-xs font-semibold text-green-600">
              <CheckCircle2 size={15} />
              Firmado
            </div>
          ) : puedeFirmar ? (
            <Button
              size="sm"
              onClick={() => setDialogOpen(true)}
              className="bg-amber-500 hover:bg-amber-600 text-white gap-1.5 text-xs"
            >
              <ShieldCheck size={13} />
              Firmar ahora
            </Button>
          ) : (
            <div className="flex items-center gap-1 text-xs text-slate-400">
              <Clock size={13} />
              Pendiente
            </div>
          )}
        </div>
      </div>

      {dialogOpen && (
        <DialogFirmar
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          firma={firma}
          solicitud={solicitud}
          requerimientoId={requerimientoId}
          userName={userName}
          userEmail={userEmail}
          onFirmado={onRefresh}
        />
      )}
    </>
  )
}

/* ── Tarjeta de solicitud ────────────────────────────────────────────────── */
function TarjetaSolicitud({
  solicitud, requerimientoId, isAdmin, userEmail, userName, onRefresh,
}: {
  solicitud: SolicitudVistoBueno
  requerimientoId: string
  isAdmin: boolean
  userEmail: string | null
  userName: string | null
  onRefresh: () => void
}) {
  const [abierta, setAbierta]        = useState(true)
  const [isPending, startTransition] = useTransition()
  const cfg = TIPO_CFG[solicitud.tipo]
  const Icon = cfg.Icon

  const firmadas  = solicitud.firmas.filter(f => f.firmado).length
  const total     = solicitud.firmas.length
  const progreso  = total > 0 ? Math.round((firmadas / total) * 100) : 0

  const estadoCfg = {
    PENDIENTE:  { label: 'Pendiente',  cls: 'bg-amber-100 text-amber-700', Icon: Clock },
    COMPLETADO: { label: 'Completado', cls: 'bg-green-100 text-green-700', Icon: CheckCircle2 },
    CANCELADO:  { label: 'Cancelado',  cls: 'bg-slate-100 text-slate-500', Icon: XCircle },
  }[solicitud.estado]

  const handleCancelar = () => {
    if (!confirm('¿Cancelar esta solicitud de visto bueno? Esta acción no se puede deshacer.')) return
    startTransition(async () => {
      const res = await cancelarSolicitudVistoBueno(solicitud.id, requerimientoId)
      if (res.ok) { toast.success('Solicitud cancelada'); onRefresh() }
      else toast.error(res.error ?? 'Error al cancelar')
    })
  }

  return (
    <div className={cn('rounded-xl border overflow-hidden', cfg.border)}>
      {/* Header */}
      <div className={cn('flex items-center justify-between gap-3 p-4', cfg.bg)}>
        <div className="flex items-center gap-3 min-w-0">
          <Icon size={18} className={cfg.color} />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-slate-700">{cfg.label}</span>
              <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold flex items-center gap-1', estadoCfg.cls)}>
                <estadoCfg.Icon size={10} /> {estadoCfg.label}
              </span>
            </div>
            <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
              <span>Solicitado por {solicitud.solicitado_por ?? 'Administrador'}</span>
              <span>·</span>
              <span>{formatDatetime(solicitud.created_at)}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isAdmin && solicitud.estado === 'PENDIENTE' && (
            <button
              onClick={handleCancelar}
              disabled={isPending}
              className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
              title="Cancelar solicitud"
            >
              <X size={14} />
            </button>
          )}
          <button
            onClick={() => setAbierta(v => !v)}
            className="rounded p-1.5 text-slate-400 hover:bg-white/60 transition-colors"
          >
            {abierta ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {abierta && (
        <div className="p-4 space-y-3 bg-white">
          {/* Mensaje opcional */}
          {solicitud.mensaje && (
            <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-1">Mensaje</p>
              <p className="text-sm text-slate-600 italic">"{solicitud.mensaje}"</p>
            </div>
          )}

          {/* Progreso */}
          <div>
            <div className="mb-1.5 flex items-center justify-between text-xs text-slate-500">
              <span>{firmadas} de {total} firmas</span>
              <span className="font-semibold">{progreso}%</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-500',
                  progreso === 100 ? 'bg-green-500' : 'bg-violet-500'
                )}
                style={{ width: `${progreso}%` }}
              />
            </div>
          </div>

          {/* Lista de firmantes */}
          <div className="space-y-1.5">
            {solicitud.firmas.map(firma => (
              <FilaFirmante
                key={firma.id}
                firma={firma}
                solicitud={solicitud}
                requerimientoId={requerimientoId}
                userEmail={userEmail}
                userName={userName}
                onRefresh={onRefresh}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Modal nueva solicitud ───────────────────────────────────────────────── */
function ModalNuevaSolicitud({
  open, onClose, requerimientoId, onCreado,
}: {
  open: boolean
  onClose: () => void
  requerimientoId: string
  onCreado: () => void
}) {
  const [tipo, setTipo]     = useState<TipoVistoBueno>('DOCUMENTACION')
  const [mensaje, setMensaje] = useState('')
  const [isPending, startT] = useTransition()

  const cfg = TIPO_CFG[tipo]
  const Icon = cfg.Icon

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    startT(async () => {
      const res = await crearSolicitudVistoBueno(requerimientoId, tipo, mensaje.trim() || null)
      if (res.ok) {
        toast.success('Solicitud enviada — los firmantes recibirán un correo')
        setMensaje(''); onCreado(); onClose()
      } else {
        toast.error(res.error ?? 'Error al crear solicitud')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-700">
            <ShieldAlert size={18} className="text-violet-600" />
            Solicitar visto bueno
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 pt-1">
          {/* Tipo */}
          <div className="grid grid-cols-2 gap-3">
            {(['DOCUMENTACION', 'SALIDA_VIVO'] as const).map(t => {
              const c = TIPO_CFG[t]
              const Ic = c.Icon
              const sel = tipo === t
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTipo(t)}
                  className={cn(
                    'flex flex-col items-start gap-2 rounded-xl border-2 p-4 text-left transition-all',
                    sel ? `${c.border} ${c.bg}` : 'border-slate-200 bg-white hover:border-slate-300'
                  )}
                >
                  <Ic size={18} className={sel ? c.color : 'text-slate-400'} />
                  <div>
                    <p className={cn('text-xs font-semibold', sel ? c.color : 'text-slate-500')}>
                      {c.label}
                    </p>
                    <p className="text-[10px] text-slate-400 leading-tight mt-0.5">{c.sublabel}</p>
                  </div>
                </button>
              )
            })}
          </div>

          {/* Info sobre firmantes */}
          <div className={cn('rounded-xl border p-4 text-xs space-y-1.5', cfg.bg, cfg.border)}>
            <p className="font-semibold text-slate-600 flex items-center gap-1">
              <User size={12} /> Firmantes requeridos:
            </p>
            <ul className="space-y-1 text-slate-500 ml-4 list-disc">
              <li>Todas las <strong>partes interesadas</strong> vinculadas al requerimiento</li>
              <li>El <strong>responsable</strong> del requerimiento</li>
              <li className="font-semibold text-blue-600">
                Dirección de Estrategia (dc.estrategia@iwglogistics.com) — verificará que todas las partes estén involucradas
              </li>
            </ul>
          </div>

          {/* Mensaje opcional */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-600">
              Mensaje para los firmantes <span className="text-slate-400">(opcional)</span>
            </label>
            <Textarea
              rows={3}
              placeholder="Instrucciones adicionales o contexto para quienes deben firmar..."
              value={mensaje}
              onChange={e => setMensaje(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending} className={cn(cfg.btnColor, 'gap-2')}>
              <ShieldAlert size={14} />
              {isPending ? 'Enviando...' : 'Solicitar vistos buenos'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/* ── Tab principal ───────────────────────────────────────────────────────── */
export function TabVistoBueno({
  requerimientoId, nombreDesarrollo, isAdmin, userEmail, userName,
}: Props) {
  const [modalOpen, setModalOpen]   = useState(false)
  const qc = useQueryClient()

  const refresh = () => qc.invalidateQueries({ queryKey: ['visto-bueno', requerimientoId] })

  const { data: solicitudes = [], isLoading } = useQuery<SolicitudVistoBueno[]>({
    queryKey: ['visto-bueno', requerimientoId],
    queryFn:  () => getSolicitudesVistoBueno(requerimientoId),
    refetchOnWindowFocus: true,
  })

  // Firmas pendientes para el usuario actual
  const { data: misFirmasPendientes = [] } = useQuery<FirmaVistoBueno[]>({
    queryKey: ['mis-firmas-pendientes', requerimientoId, userEmail],
    queryFn:  () => userEmail ? getMisFirmasPendientesEnReq(requerimientoId, userEmail) : Promise.resolve([]),
    enabled: !!userEmail,
    refetchOnWindowFocus: true,
  })

  return (
    <div className="mt-4 space-y-4">
      {/* Banner de firmas pendientes para el usuario actual */}
      {misFirmasPendientes.length > 0 && (
        <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <ShieldAlert size={20} className="shrink-0 text-amber-500 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-800">
                Tienes {misFirmasPendientes.length === 1 ? 'un visto bueno pendiente' : `${misFirmasPendientes.length} vistos buenos pendientes`} en este desarrollo
              </p>
              <p className="text-xs text-amber-700 mt-1">
                Busca tu nombre en las solicitudes a continuación y usa el botón <strong>"Firmar ahora"</strong> para registrar tu aprobación.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Cabecera */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-700">Vistos buenos</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Aprobaciones formales requeridas sobre documentación o salida en vivo
          </p>
        </div>
        {isAdmin && (
          <Button
            size="sm"
            onClick={() => setModalOpen(true)}
            className="bg-violet-600 hover:bg-violet-700 gap-1.5"
          >
            <Plus size={14} /> Solicitar visto bueno
          </Button>
        )}
      </div>

      {/* Lista de solicitudes */}
      {isLoading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-400">
          Cargando...
        </div>
      ) : solicitudes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white p-10 text-center">
          <ShieldCheck size={32} className="mx-auto mb-3 text-slate-300" />
          <p className="text-sm font-medium text-slate-400">No hay solicitudes de visto bueno</p>
          {isAdmin && (
            <p className="text-xs text-slate-400 mt-1">
              Usa "Solicitar visto bueno" para pedir aprobaciones de documentación o salida en vivo
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {solicitudes.map(sol => (
            <TarjetaSolicitud
              key={sol.id}
              solicitud={sol}
              requerimientoId={requerimientoId}
              isAdmin={isAdmin}
              userEmail={userEmail}
              userName={userName}
              onRefresh={refresh}
            />
          ))}
        </div>
      )}

      <ModalNuevaSolicitud
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        requerimientoId={requerimientoId}
        onCreado={refresh}
      />
    </div>
  )
}
