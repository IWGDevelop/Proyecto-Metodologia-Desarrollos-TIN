'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { actualizarPerfil } from '@/actions/usuarios'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PROCESOS_INTERNOS } from '@/lib/constants'
import { formatFecha } from '@/lib/utils'
import { Loader2, User } from 'lucide-react'

const perfilSchema = z.object({
  nombre_completo: z.string().min(2, 'Nombre requerido'),
  cargo: z.string().optional(),
  proceso_interno: z.string().optional(),
  empresa: z.string().optional(),
})
type PerfilForm = z.infer<typeof perfilSchema>

const pwSchema = z.object({
  new_password: z.string().min(8, 'Mínimo 8 caracteres'),
  confirm_password: z.string(),
}).refine(d => d.new_password === d.confirm_password, {
  message: 'Las contraseñas no coinciden',
  path: ['confirm_password'],
})
type PwForm = z.infer<typeof pwSchema>

export default function PerfilPage() {
  const { perfil, refreshPerfil } = useAuth()
  const [savingPerfil, setSavingPerfil] = useState(false)
  const [savingPw, setSavingPw] = useState(false)

  const perfilForm = useForm<PerfilForm>({
    resolver: zodResolver(perfilSchema),
    values: {
      nombre_completo: perfil?.nombre_completo ?? '',
      cargo: perfil?.cargo ?? '',
      proceso_interno: perfil?.proceso_interno ?? '',
      empresa: perfil?.empresa ?? '',
    },
  })

  const pwForm = useForm<PwForm>({ resolver: zodResolver(pwSchema) })

  const onSavePerfil = async (data: PerfilForm) => {
    if (!perfil) return
    setSavingPerfil(true)
    try {
      await actualizarPerfil(perfil.id, data)
      await refreshPerfil()
      toast.success('Perfil actualizado')
    } catch {
      toast.error('Error al actualizar perfil')
    } finally {
      setSavingPerfil(false)
    }
  }

  const onSavePw = async (data: PwForm) => {
    setSavingPw(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({ password: data.new_password })
      if (error) throw error
      toast.success('Contraseña actualizada')
      pwForm.reset()
    } catch (e: any) {
      toast.error(e.message ?? 'Error al cambiar contraseña')
    } finally {
      setSavingPw(false)
    }
  }

  if (!perfil) return null

  const initials = perfil.nombre_completo.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()

  return (
    <div className="max-w-2xl space-y-6 p-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Mi perfil</h1>
        <p className="text-sm text-slate-500">Administra tu información personal</p>
      </div>

      {/* Avatar */}
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-xl font-bold text-blue-700">
          {initials}
        </div>
        <div>
          <p className="font-semibold text-slate-800">{perfil.nombre_completo}</p>
          <p className="text-sm text-slate-500">{perfil.email}</p>
          <span className={`mt-1 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            perfil.rol === 'ADMIN_TIN'
              ? 'bg-blue-100 text-blue-700'
              : 'bg-slate-100 text-slate-600'
          }`}>
            {perfil.rol === 'ADMIN_TIN' ? '🛡 Admin TIN' : '👤 Usuario'}
          </span>
        </div>
      </div>

      {/* Datos de perfil */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold text-slate-700">Información personal</h2>
        <form onSubmit={perfilForm.handleSubmit(onSavePerfil)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1">
              <Label>Nombre completo *</Label>
              <Input {...perfilForm.register('nombre_completo')} />
              {perfilForm.formState.errors.nombre_completo && (
                <p className="text-xs text-red-500">{perfilForm.formState.errors.nombre_completo.message}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label>Cargo</Label>
              <Input {...perfilForm.register('cargo')} />
            </div>
            <div className="space-y-1">
              <Label>Empresa</Label>
              <Select defaultValue={perfil.empresa ?? ''} onValueChange={(v: string | null) => perfilForm.setValue('empresa', v ?? undefined)}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {['IWF', 'ILT', 'IWG'].map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Proceso interno</Label>
              <Select defaultValue={perfil.proceso_interno ?? ''} onValueChange={(v: string | null) => perfilForm.setValue('proceso_interno', v ?? undefined)}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {PROCESOS_INTERNOS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="rounded-lg bg-slate-50 px-4 py-3 text-xs text-slate-500 grid grid-cols-2 gap-2">
            <span>Email: <strong className="text-slate-600">{perfil.email}</strong></span>
            <span>Rol: <strong className="text-slate-600">{perfil.rol}</strong></span>
            <span>Miembro desde: <strong className="text-slate-600">{formatFecha(perfil.created_at)}</strong></span>
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={savingPerfil} className="bg-blue-600 hover:bg-blue-700">
              {savingPerfil ? <><Loader2 size={14} className="mr-2 animate-spin" />Guardando...</> : 'Guardar cambios'}
            </Button>
          </div>
        </form>
      </div>

      {/* Cambio de contraseña */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold text-slate-700">Cambiar contraseña</h2>
        <form onSubmit={pwForm.handleSubmit(onSavePw)} className="space-y-4">
          <div className="space-y-1">
            <Label>Nueva contraseña</Label>
            <Input type="password" {...pwForm.register('new_password')} />
            {pwForm.formState.errors.new_password && (
              <p className="text-xs text-red-500">{pwForm.formState.errors.new_password.message}</p>
            )}
          </div>
          <div className="space-y-1">
            <Label>Confirmar contraseña</Label>
            <Input type="password" {...pwForm.register('confirm_password')} />
            {pwForm.formState.errors.confirm_password && (
              <p className="text-xs text-red-500">{pwForm.formState.errors.confirm_password.message}</p>
            )}
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={savingPw} variant="outline">
              {savingPw ? <><Loader2 size={14} className="mr-2 animate-spin" />Actualizando...</> : 'Cambiar contraseña'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
