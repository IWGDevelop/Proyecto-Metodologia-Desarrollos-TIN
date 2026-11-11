import { AsistenteTickets } from '@/components/tickets/funcionario/AsistenteTickets'

// Todas las vistas del funcionario en TIN-TICKETS muestran el asistente de IA
export default function MisTicketsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <AsistenteTickets />
    </>
  )
}
