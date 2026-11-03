import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const { pathname } = request.nextUrl

  // /api/mcp y /api/cron validan su propio token Bearer (token MCP y CRON_SECRET).
  // Vercel Cron no envía cookies de sesión: sin esta excepción se redirigían a /login y nunca se ejecutaban.
  const publicPaths = ['/login', '/auth/callback', '/login/recuperar', '/api/mcp', '/api/cron']
  const isPublic = publicPaths.some(p => pathname === p || pathname.startsWith(p + '/'))

  // Always allow public paths through — no auth check needed
  if (isPublic) return supabaseResponse

  let user = null

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
            supabaseResponse = NextResponse.next({ request })
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            )
          },
        },
      }
    )

    const { data } = await supabase.auth.getUser()
    user = data.user
  } catch {
    // Supabase unavailable — redirect to login to be safe
  }

  if (!user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
