import type { Metadata } from 'next'

// Favicon y título de cada solución. El layout raíz usa TIN-FLOW y los layouts de las rutas
// de tickets (mis-tickets y admin/tickets*) lo reemplazan por TIN-TICKETS.

export const METADATA_TIN_FLOW: Metadata = {
  title: 'TIN-FLOW — Interworld Group',
  icons: {
    icon: [
      { url: '/icons/tin-flow.svg', type: 'image/svg+xml' },
      { url: '/icons/tin-flow.ico', sizes: '48x48' },
    ],
    apple: '/icons/tin-flow-apple.png',
  },
}

export const METADATA_TIN_TICKETS: Metadata = {
  title: 'TIN-TICKETS — Interworld Group',
  icons: {
    icon: [
      { url: '/icons/tin-tickets.svg', type: 'image/svg+xml' },
      { url: '/icons/tin-tickets.ico', sizes: '48x48' },
    ],
    apple: '/icons/tin-tickets-apple.png',
  },
}
