import type { Metadata } from 'next'
import { METADATA_TIN_TICKETS } from '@/lib/metadata-apps'

// Favicon y título de TIN-TICKETS
export const metadata: Metadata = METADATA_TIN_TICKETS

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
