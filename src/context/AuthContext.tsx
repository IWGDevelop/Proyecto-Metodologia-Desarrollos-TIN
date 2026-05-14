'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import type { Perfil } from '@/lib/supabase/types'

interface AuthContextType {
  user: User | null
  perfil: Perfil | null
  isAdmin: boolean
  isLoading: boolean
  signOut: () => Promise<void>
  refreshPerfil: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  perfil: null,
  isAdmin: false,
  isLoading: true,
  signOut: async () => {},
  refreshPerfil: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetchPerfil = useCallback(async (userId: string) => {
    const supabase = createClient()
    const { data } = await (supabase as any)
      .from('perfiles')
      .select('*')
      .eq('id', userId)
      .single()
    setPerfil(data as Perfil | null)
  }, [])

  const refreshPerfil = useCallback(async () => {
    if (user) await fetchPerfil(user.id)
  }, [user, fetchPerfil])

  useEffect(() => {
    const supabase = createClient()

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchPerfil(session.user.id).finally(() => setIsLoading(false))
      } else {
        setIsLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null)
        if (session?.user) {
          await fetchPerfil(session.user.id)
        } else {
          setPerfil(null)
        }
        setIsLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [fetchPerfil])

  const signOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    setUser(null)
    setPerfil(null)
    window.location.href = '/login'
  }

  return (
    <AuthContext.Provider value={{
      user,
      perfil,
      isAdmin: perfil?.rol === 'ADMIN_TIN',
      isLoading,
      signOut,
      refreshPerfil,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuthContext() {
  return useContext(AuthContext)
}
