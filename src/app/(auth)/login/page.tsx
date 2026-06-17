'use client'

import { useState, Suspense } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { InterflowLogoIcon } from '@/components/layout/InterflowLogo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Link from 'next/link'

const loginSchema = z.object({
  email: z.string().email('Correo electrónico inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
})
type LoginForm = z.infer<typeof loginSchema>

const ERROR_MESSAGES: Record<string, string> = {
  domain_not_allowed: 'Solo se permiten cuentas @iwglogistics.com. Usa tu correo corporativo.',
  auth_callback_failed: 'Error al autenticar con Google. Intenta de nuevo.',
}

function LoginPageContent() {
  const searchParams = useSearchParams()
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(
    ERROR_MESSAGES[searchParams.get('error') ?? ''] ?? null
  )
  const [googleLoading, setGoogleLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) })

  const onSubmit = async (data: LoginForm) => {
    setError(null)
    try {
      const supabase = createClient()

      const { error: authError } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      })

      if (authError) {
        setError('Correo o contraseña incorrectos. Verifica tus datos.')
        return
      }

      // Hard navigation so the browser sends fresh cookies to the server
      window.location.href = '/'
    } catch {
      setError('Error de conexión. Intenta de nuevo.')
    }
  }

  const handleGoogleLogin = async () => {
    setGoogleLoading(true)
    setError(null)
    try {
      const supabase = createClient()
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })
    } catch {
      setError('Error al iniciar sesión con Google. Intenta de nuevo.')
      setGoogleLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md">
      <div className="rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-200/60 overflow-hidden">
        {/* Header */}
        <div className="border-b border-slate-100 px-8 py-8 text-center">
          <div className="mb-5 flex justify-center">
            <InterflowLogoIcon px={64} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">
            INTER<span className="text-blue-600">FLOW</span>
          </h1>
          <p className="mt-1 text-sm text-slate-500">Gestión de Proyectos · Interworld Group</p>
        </div>

        {/* Form */}
        <div className="px-8 py-7">
          <p className="mb-6 text-sm text-slate-600">
            Ingresa con tu correo corporativo
          </p>

          {/* Google OAuth */}
          <Button
            type="button"
            variant="outline"
            className="w-full gap-2.5 border-slate-200 text-slate-700 hover:bg-slate-50"
            onClick={handleGoogleLogin}
            disabled={googleLoading}
          >
            {googleLoading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            )}
            Continuar con Google
          </Button>

          <div className="relative my-4 flex items-center gap-3">
            <div className="flex-1 border-t border-slate-200" />
            <span className="text-xs text-slate-400">o ingresa con tu correo</span>
            <div className="flex-1 border-t border-slate-200" />
          </div>

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

export default function LoginPage() {
  return (
    <Suspense>
      <LoginPageContent />
    </Suspense>
  )
}
