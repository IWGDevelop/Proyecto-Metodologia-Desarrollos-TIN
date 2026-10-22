import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/layout/Providers'
import { Toaster } from '@/components/ui/sonner'
import { getProcesosInternos } from '@/actions/procesos-internos'
import { getCatalogoEstados } from '@/actions/estados-kanban'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'TIN-FLOW — Interworld Group',
  description: 'Plataforma de gestión de proyectos y desarrollos tecnológicos de Interworld Group',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Catálogo de procesos internos (Configuración → Procesos), disponible en toda la aplicación
  // y nombres de los estados (Configuración → Estados)
  const [procesos, estados] = await Promise.all([getProcesosInternos(), getCatalogoEstados()])
  return (
    <html lang="es">
      <body className={`${inter.className} bg-slate-50 antialiased`}>
        <Providers procesos={procesos} estados={estados}>
          {children}
          <Toaster richColors position="top-right" />
        </Providers>
      </body>
    </html>
  )
}
