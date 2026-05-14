'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Loader2, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Link from 'next/link'

const schema = z.object({
  email: z.string().email('Correo electrónico inválido'),
})
type Form = z.infer<typeof schema>

export default function RecuperarPasswordPage() {
  const [sent, setSent] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Form>({ resolver: zodResolver(schema) })

  const onSubmit = async (data: Form) => {
    const supabase = createClient()
    const origin = window.location.origin
    await supabase.auth.resetPasswordForEmail(data.email, {
      redirectTo: `${origin}/auth/callback?next=/perfil`,
    })
    setSent(true)
  }

  return (
    <div className="w-full max-w-md">
      <div className="rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-200/60 overflow-hidden">
        <div className="border-b border-slate-100 px-8 py-8 text-center">
          <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
            <Mail size={28} className="text-slate-600" />
          </div>
          <h1 className="text-xl font-bold text-slate-800">Recuperar contraseña</h1>
          <p className="text-sm text-slate-500">IGSI — Gestión de Requerimientos</p>
        </div>

        <div className="px-8 py-7">
          {sent ? (
            <div className="space-y-4 text-center">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-700">
                Si ese correo existe en nuestro sistema, recibirás un enlace para
                restablecer tu contraseña.
              </div>
              <Link href="/login">
                <Button variant="outline" className="w-full gap-2">
                  <ArrowLeft size={14} /> Volver al inicio de sesión
                </Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <p className="text-sm text-slate-600">
                Ingresa tu correo y te enviaremos un enlace para restablecer tu
                contraseña.
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-sm font-medium text-slate-700">
                  Correo electrónico
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="tu.nombre@interworld.com.co"
                  {...register('email')}
                  className={errors.email ? 'border-red-400' : ''}
                />
                {errors.email && (
                  <p className="text-xs text-red-500">{errors.email.message}</p>
                )}
              </div>

              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={16} className="mr-2 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  'Enviar enlace de recuperación'
                )}
              </Button>

              <div className="text-center">
                <Link href="/login" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700">
                  <ArrowLeft size={13} /> Volver al inicio de sesión
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
