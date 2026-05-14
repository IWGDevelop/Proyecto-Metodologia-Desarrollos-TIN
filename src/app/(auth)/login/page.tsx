'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { Eye, EyeOff, Loader2, LayoutDashboard } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Link from 'next/link'

const loginSchema = z.object({
  email: z.string().email('Correo electrónico inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
})
type LoginForm = z.infer<typeof loginSchema>

export default function LoginPage() {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) })

  const onSubmit = async (data: LoginForm) => {
    setError(null)
    const supabase = createClient()

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    })

    if (authError) {
      setError('Correo o contraseña incorrectos. Verifica tus datos.')
      return
    }

    const { data: perfilData } = await (supabase as any)
      .from('perfiles')
      .select('rol, activo')
      .eq('email', data.email)
      .single()

    if (perfilData && !perfilData.activo) {
      await supabase.auth.signOut()
      setError('Tu cuenta está desactivada. Contacta al administrador.')
      return
    }

    if (perfilData?.rol === 'ADMIN_TIN') {
      router.push('/admin/dashboard')
    } else {
      router.push('/mis-requerimientos')
    }
    router.refresh()
  }

  return (
    <div className="w-full max-w-md">
      <div className="rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-200/60 overflow-hidden">
        {/* Header */}
        <div className="border-b border-slate-100 px-8 py-8 text-center">
          <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600">
            <LayoutDashboard size={28} className="text-white" />
          </div>
          <h1 className="text-xl font-bold text-slate-800">IGSI</h1>
          <p className="text-sm text-slate-500">Gestión de Requerimientos</p>
        </div>

        {/* Form */}
        <div className="px-8 py-7">
          <p className="mb-6 text-sm text-slate-600">
            Ingresa con tu correo corporativo
          </p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-medium text-slate-700">
                Correo electrónico
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="tu.nombre@interworld.com.co"
                autoComplete="email"
                {...register('email')}
                className={errors.email ? 'border-red-400' : ''}
              />
              {errors.email && (
                <p className="text-xs text-red-500">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-medium text-slate-700">
                Contraseña
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  {...register('password')}
                  className={errors.password ? 'border-red-400 pr-10' : 'pr-10'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-red-500">{errors.password.message}</p>
              )}
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="mr-2 animate-spin" />
                  Ingresando...
                </>
              ) : (
                'Ingresar al sistema →'
              )}
            </Button>
          </form>

          <div className="mt-4 text-center">
            <Link
              href="/login/recuperar"
              className="text-sm text-blue-600 hover:text-blue-700 hover:underline"
            >
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 bg-slate-50 px-8 py-4 text-center">
          <p className="text-xs text-slate-500">
            ¿No tienes cuenta?{' '}
            <span className="font-medium text-slate-600">
              Solicita acceso a tu administrador TIN
            </span>
          </p>
        </div>
      </div>
    </div>
  )
}
