'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { crearUsuario, actualizarPerfil } from '@/actions/usuarios'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { Plus, Pencil, Shield, User, RefreshCw, Star, Download } from 'lucide-react'
import { formatFecha } from '@/lib/utils'
import { useProcesos, opcionesProceso } from '@/context/ProcesosContext'
import { sincronizarPerfilesDesdeIGSI } from '@/actions/sync-igsi'
import type { Perfil } from '@/lib/supabase/types'

const createSchema = z.object({
  nombre_completo: z.string().min(2, 'Nombre requerido'),
  email: z.string().email('Email inválido'),
  cargo: z.string().optional(),
  proceso_interno: z.string().optional(),
  empresa: z.string().optional(),
  rol: z.string().min(1),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
  jefe_id: z.string().optional(),
  sede: z.string().optional(),
})
type CreateForm = z.infer<typeof createSchema>

const editSchema = z.object({
  nombre_completo: z.string().min(2, 'Nombre requerido'),
  cargo: z.string().optional(),
  proceso_interno: z.string().optional(),
  empresa: z.string().optional(),
  rol: z.string().min(1),
  activo: z.boolean(),
  jefe_id: z.string().optional(),
  sede: z.string().optional(),
})
type EditForm = z.infer<typeof editSchema>

function generarPassword() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#'
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

function AvatarLetra({ nombre }: { nombre: string }) {
  const initials = nombre.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
      {initials}
    </div>
  )
}

interface RolItem { nombre: string; descripcion: string | null }

const ROL_LABEL: Record<string, string> = {
  ADMIN_TIN:   'Admin TIN',
  PRESIDENCIA: 'Presidencia',
  USUARIO:     'Usuario',
}

function rolLabel(nombre: string) {
  return ROL_LABEL[nombre] ?? nombre.replace(/_/g, ' ')
}

const claseSelectNativo =
  'h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'

/** Jefe inmediato (aprueba los tickets que lo requieren): perfiles activos, sin el propio usuario */
function SelectJefe({ usuarios, excluirId, value, onChange }: {
  usuarios: Perfil[]; excluirId?: string; value: string; onChange: (v: string) => void
}) {
  const opciones = usuarios
    .filter(u => u.id !== excluirId && (u.activo || u.id === value))
    .sort((a, b) => a.nombre_completo.localeCompare(b.nombre_completo))
  return (
    <select value={value} onChange={e => onChange(e.target.value)} className={claseSelectNativo}>
      <option value="">Sin jefe asignado</option>
      {opciones.map(u => (
        <option key={u.id} value={u.id}>{u.nombre_completo}{!u.activo ? ' (inactivo)' : ''}</option>
      ))}
    </select>
  )
}

/** Sede: lista configurada en Tickets → Parámetros; texto libre si aún no hay sedes */
function CampoSede({ sedes, value, onChange }: { sedes: string[]; value: string; onChange: (v: string) => void }) {
  if (!sedes.length) {
    return <Input value={value} onChange={e => onChange(e.target.value)} placeholder="Ej. Bogotá" />
  }
  const opciones = value && !sedes.includes(value) ? [...sedes, value] : sedes
  return (
    <select value={value} onChange={e => onChange(e.target.value)} className={claseSelectNativo}>
      <option value="">Sin sede</option>
      {opciones.map(s => <option key={s} value={s}>{s}</option>)}
    </select>
  )
}

interface Props { usuarios: Perfil[]; roles: RolItem[]; sedes: string[] }

export function GestionUsuariosClient({ usuarios: initial, roles, sedes }: Props) {
  const router = useRouter()
  const procesos = useProcesos()
  const [showCreate, setShowCreate] = useState(false)
  const [editUser, setEditUser] = useState<Perfil | null>(null)
  const [sincronizando, setSincronizando] = useState(false)

  const onSincronizarIGSI = async () => {
    setSincronizando(true)
    try {
      const result = await sincronizarPerfilesDesdeIGSI()
      toast.success(`${result.actualizados} perfiles sincronizados desde IGSI`, {
        description: result.sinCoincidencia > 0
          ? `${result.sinCoincidencia} usuarios sin coincidencia en el directorio`
          : undefined,
      })
      if (result.errores > 0) toast.warning(`${result.errores} perfiles no pudieron actualizarse`)
      router.refresh()
    } catch (e: any) {
      toast.error(e?.message ?? 'Error al conectar con IGSI')
    } finally {
      setSincronizando(false)
    }
  }

  const createForm = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: { rol: 'USUARIO' },
  })

  const editForm = useForm<EditForm>({ resolver: zodResolver(editSchema) })

  const nombrePorId = new Map(initial.map(u => [u.id, u.nombre_completo]))

  const onCrear = async (data: CreateForm) => {
    const result = await crearUsuario({ ...data, jefe_id: data.jefe_id || null, sede: data.sede || null })
    if (!result.ok) {
      toast.error(result.error ?? 'Error al crear usuario')
      return
    }
    toast.success('Usuario creado exitosamente')
    setShowCreate(false)
    createForm.reset()
    window.location.href = '/admin/usuarios'
  }

  const onEditar = async (data: EditForm) => {
    if (!editUser) return
    const result = await actualizarPerfil(editUser.id, {
      ...data,
      empresa: data.empresa || null,
      proceso_interno: data.proceso_interno || null,
      cargo: data.cargo || null,
      jefe_id: data.jefe_id || null,
      sede: data.sede || null,
    })
    if (!result.ok) {
      toast.error(result.error ?? 'Error al actualizar usuario')
      return
    }
    toast.success('Usuario actualizado')
    setEditUser(null)
    window.location.href = '/admin/usuarios'
  }

  const openEdit = (u: Perfil) => {
    editForm.reset({
      nombre_completo: u.nombre_completo,
      cargo: u.cargo ?? '',
      proceso_interno: u.proceso_interno ?? '',
      empresa: u.empresa ?? '',
      rol: u.rol,
      activo: u.activo,
      jefe_id: u.jefe_id ?? '',
      sede: u.sede ?? '',
    })
    setEditUser(u)
  }

  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-slate-500">{initial.length} usuarios registrados</p>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={onSincronizarIGSI}
            disabled={sincronizando}
            className="gap-1.5 text-slate-600"
          >
            <Download size={14} className={sincronizando ? 'animate-bounce' : ''} />
            {sincronizando ? 'Sincronizando...' : 'Sincronizar desde IGSI'}
          </Button>
          <Button size="sm" onClick={() => setShowCreate(true)} className="bg-blue-600 hover:bg-blue-700 gap-1.5">
            <Plus size={14} /> Crear usuario
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                {['Usuario', 'Email', 'Cargo', 'Proceso', 'Empresa', 'Jefe · Sede', 'Rol', 'Estado', 'Registro', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {initial.map(u => (
                <tr key={u.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <AvatarLetra nombre={u.nombre_completo} />
                      <span className="font-medium text-slate-700">{u.nombre_completo}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{u.email}</td>
                  <td className="px-4 py-3 text-slate-500">{u.cargo ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-500">{u.proceso_interno ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-500">{u.empresa ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    <p>{u.jefe_id ? (nombrePorId.get(u.jefe_id) ?? '—') : '—'}</p>
                    <p className="text-slate-400">{u.sede ?? '—'}</p>
                  </td>
                  <td className="px-4 py-3">
                    {u.rol === 'ADMIN_TIN' ? (
                      <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 gap-1">
                        <Shield size={10} /> Admin TIN
                      </Badge>
                    ) : u.rol === 'PRESIDENCIA' ? (
                      <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 gap-1">
                        <Star size={10} /> Presidencia
                      </Badge>
                    ) : u.rol === 'USUARIO' ? (
                      <Badge variant="secondary" className="gap-1">
                        <User size={10} /> Usuario
                      </Badge>
                    ) : (
                      <Badge className="bg-violet-100 text-violet-700 hover:bg-violet-100 gap-1">
                        <Shield size={10} /> {rolLabel(u.rol)}
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                      u.activo ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
                    }`}>
                      {u.activo ? '✓ Activo' : '✗ Inactivo'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{formatFecha(u.created_at)}</td>
                  <td className="px-4 py-3">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(u)} className="h-7 px-2">
                      <Pencil size={13} />
                    </Button>
                  </td>
                </tr>
              ))}
              {initial.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-sm text-slate-400">
                    Sin usuarios registrados
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Crear */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Crear usuario</DialogTitle>
          </DialogHeader>
          <form onSubmit={createForm.handleSubmit(onCrear)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1">
                <Label>Nombre completo *</Label>
                <Input {...createForm.register('nombre_completo')} />
                {createForm.formState.errors.nombre_completo && (
                  <p className="text-xs text-red-500">{createForm.formState.errors.nombre_completo.message}</p>
                )}
              </div>
              <div className="col-span-2 space-y-1">
                <Label>Correo electrónico *</Label>
                <Input type="email" {...createForm.register('email')} />
                {createForm.formState.errors.email && (
                  <p className="text-xs text-red-500">{createForm.formState.errors.email.message}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label>Cargo</Label>
                <Input {...createForm.register('cargo')} />
              </div>
              <div className="space-y-1">
                <Label>Empresa</Label>
                <Select onValueChange={(v: string | null) => createForm.setValue('empresa', v ?? undefined)}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    {['IWF', 'ILT', 'IWG'].map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Proceso interno</Label>
                <Select onValueChange={(v: string | null) => createForm.setValue('proceso_interno', v ?? undefined)}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    {procesos.activos.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Rol</Label>
                <Select defaultValue="USUARIO" onValueChange={(v: string | null) => createForm.setValue('rol', v ?? 'USUARIO')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {roles.map(r => (
                      <SelectItem key={r.nombre} value={r.nombre}>{rolLabel(r.nombre)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Jefe inmediato</Label>
                <SelectJefe
                  usuarios={initial}
                  value={createForm.watch('jefe_id') ?? ''}
                  onChange={v => createForm.setValue('jefe_id', v)}
                />
              </div>
              <div className="space-y-1">
                <Label>Sede</Label>
                <CampoSede sedes={sedes} value={createForm.watch('sede') ?? ''} onChange={v => createForm.setValue('sede', v)} />
              </div>
              <div className="col-span-2 space-y-1">
                <Label>Contraseña temporal *</Label>
                <div className="flex gap-2">
                  <Input type="text" {...createForm.register('password')} />
                  <Button type="button" variant="outline" size="sm"
                    onClick={() => createForm.setValue('password', generarPassword())}
                    className="shrink-0 gap-1 text-xs">
                    <RefreshCw size={12} /> Generar
                  </Button>
                </div>
                {createForm.formState.errors.password && (
                  <p className="text-xs text-red-500">{createForm.formState.errors.password.message}</p>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
              <Button type="submit" disabled={createForm.formState.isSubmitting} className="bg-blue-600 hover:bg-blue-700">
                {createForm.formState.isSubmitting ? 'Creando...' : 'Crear usuario'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Editar */}
      <Dialog open={!!editUser} onOpenChange={o => !o && setEditUser(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar usuario</DialogTitle>
          </DialogHeader>
          {editUser && (
            <form onSubmit={editForm.handleSubmit(onEditar)} className="space-y-4">
              <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">
                <strong>Email:</strong> {editUser.email}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1">
                  <Label>Nombre completo *</Label>
                  <Input {...editForm.register('nombre_completo')} />
                </div>
                <div className="space-y-1">
                  <Label>Cargo</Label>
                  <Input {...editForm.register('cargo')} />
                </div>
                <div className="space-y-1">
                  <Label>Empresa</Label>
                  <Select defaultValue={editUser.empresa ?? ''} onValueChange={(v: string | null) => editForm.setValue('empresa', v ?? undefined)}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                    <SelectContent>
                      {['IWF', 'ILT', 'IWG'].map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Proceso</Label>
                  <Select defaultValue={editUser.proceso_interno ?? ''} onValueChange={(v: string | null) => editForm.setValue('proceso_interno', v ?? undefined)}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                    <SelectContent>
                      {opcionesProceso(procesos, editUser.proceso_interno).map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Rol</Label>
                  <Select defaultValue={editUser.rol} onValueChange={(v: string | null) => editForm.setValue('rol', v ?? 'USUARIO')}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {roles.map(r => (
                        <SelectItem key={r.nombre} value={r.nombre}>{rolLabel(r.nombre)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Jefe inmediato</Label>
                  <SelectJefe
                    usuarios={initial}
                    excluirId={editUser.id}
                    value={editForm.watch('jefe_id') ?? ''}
                    onChange={v => editForm.setValue('jefe_id', v)}
                  />
                  <p className="text-[11px] text-slate-400">Aprueba los tickets que requieren aprobación.</p>
                </div>
                <div className="space-y-1">
                  <Label>Sede</Label>
                  <CampoSede sedes={sedes} value={editForm.watch('sede') ?? ''} onChange={v => editForm.setValue('sede', v)} />
                </div>
                <div className="col-span-2 flex items-center gap-3">
                  <Switch
                    id="activo"
                    defaultChecked={editUser.activo}
                    onCheckedChange={v => editForm.setValue('activo', v)}
                  />
                  <Label htmlFor="activo" className="cursor-pointer">
                    {editForm.watch('activo') ? 'Cuenta activa' : 'Cuenta inactiva — el usuario no podrá ingresar'}
                  </Label>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setEditUser(null)}>Cancelar</Button>
                <Button type="submit" disabled={editForm.formState.isSubmitting} className="bg-blue-600 hover:bg-blue-700">
                  {editForm.formState.isSubmitting ? 'Guardando...' : 'Guardar cambios'}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
