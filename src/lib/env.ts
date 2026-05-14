// Validación de variables de entorno en tiempo de arranque.
// Si falta alguna, el servidor falla rápido con un mensaje claro.

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `Variable de entorno requerida no definida: ${name}\n` +
      `Copia .env.local.example como .env.local y completa los valores.`
    )
  }
  return value
}

// Públicas (disponibles en browser y server)
export const env = {
  supabaseUrl:     requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
  supabaseAnonKey: requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  appName:         process.env.NEXT_PUBLIC_APP_NAME ?? 'IGSI Dev',
} as const

// Solo server — lanza error si se intenta usar en el browser
export function getServerEnv() {
  if (typeof window !== 'undefined') {
    throw new Error('getServerEnv() solo puede llamarse en el servidor.')
  }
  return {
    supabaseServiceRoleKey: requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
  } as const
}
