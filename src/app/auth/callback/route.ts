import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { registrarSesion } from '@/actions/sesiones'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const cookieStore = await cookies()

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch {
              // Ignore in Server Components
            }
          },
        },
      }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        // Restrict to corporate domains
        const DOMINIOS_PERMITIDOS = ['@iwglogistics.com', '@iwltransport.com']
        const dominioPermitido = DOMINIOS_PERMITIDOS.some(d => user.email?.endsWith(d))
        if (!dominioPermitido) {
          await supabase.auth.signOut()
          return NextResponse.redirect(`${origin}/login?error=domain_not_allowed`)
        }

        // Registrar inicio de sesión
        const { data: perfil } = await (supabase as any)
          .from('perfiles').select('nombre_completo').eq('id', user.id).single()
        await registrarSesion({
          user_id:    user.id,
          email:      user.email!,
          nombre:     perfil?.nombre_completo ?? null,
          metodo:     'google',
          ip:         request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? null,
          user_agent: request.headers.get('user-agent') ?? null,
        })

        return NextResponse.redirect(`${origin}${next}`)
      }
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
