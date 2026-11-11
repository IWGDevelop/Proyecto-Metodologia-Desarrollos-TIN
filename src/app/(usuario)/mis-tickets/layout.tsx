import type { Metadata } from 'next'
import { METADATA_TIN_TICKETS } from '@/lib/metadata-apps'
import { AsistenteTickets } from '@/components/tickets/funcionario/AsistenteTickets'

export const metadata: Metadata = METADATA_TIN_TICKETS

// Todas las vistas del funcionario en TIN-TICKETS muestran el asistente de IA
export default function MisTicketsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <AsistenteTickets />
    </>
  )
}
