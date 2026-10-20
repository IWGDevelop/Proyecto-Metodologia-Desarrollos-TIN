'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { useState } from 'react'
import { AuthProvider } from '@/context/AuthContext'
import { ProcesosProvider } from '@/context/ProcesosContext'
import type { ProcesoInternoCfg } from '@/lib/procesos'

export function Providers({ children, procesos }: { children: React.ReactNode; procesos: ProcesoInternoCfg[] }) {
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
          {children}
        </ProcesosProvider>
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </AuthProvider>
  )
}
