import { notFound } from 'next/navigation'
import { getMiCasoUsoIA, getHistorialCasoUsoIA, getAnexosCasoUsoIA } from '@/actions/casos-uso-ia'
import { DetalleCasoUsoIA } from '@/components/casos-uso-ia/DetalleCasoUsoIA'

export const dynamic = 'force-dynamic'

interface Props { params: Promise<{ id: string }> }

export default async function MiCasoUsoIAPage({ params }: Props) {
  const { id } = await params
  const caso = await getMiCasoUsoIA(id)
  if (!caso) notFound()

  const [historial, anexos] = await Promise.all([
    getHistorialCasoUsoIA(id),
    getAnexosCasoUsoIA(id),
  ])

  return (
    <DetalleCasoUsoIA
      caso={caso}
      historial={historial}
      anexos={anexos}
      backHref="/casos-uso-ia"
      backLabel="Mis casos de uso IA"
    />
  )
}
