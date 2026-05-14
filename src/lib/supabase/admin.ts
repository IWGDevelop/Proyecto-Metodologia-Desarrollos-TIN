import { createClient } from '@supabase/supabase-js'

// Cliente con service_role — bypasea RLS.
// SOLO usar en Server Actions o Route Handlers. Nunca en componentes client.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error('Faltan variables de entorno de Supabase (admin)')
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
