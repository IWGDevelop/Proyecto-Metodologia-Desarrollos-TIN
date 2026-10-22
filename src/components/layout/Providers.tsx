'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { useState } from 'react'
import { AuthProvider } from '@/context/AuthContext'
import { ProcesosProvider } from '@/context/ProcesosContext'
import { EstadosProvider } from '@/context/EstadosContext'
import type { ProcesoInternoCfg } from '@/lib/procesos'
import type { EstadoCatalogo } from '@/lib/estados'

export function Providers({ children, procesos, estados }: {
  children: React.ReactNode
  procesos: ProcesoInternoCfg[]
  estados: EstadoCatalogo[]
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 2,
            refetchOnWindowFocus: false,
          },
        },
      })
  )

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClient}>
        <ProcesosProvider procesos={procesos}>
          <EstadosProvider estados={estados}>
            {children}
          </EstadosProvider>
        </ProcesosProvider>
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </AuthProvider>
  )
}
