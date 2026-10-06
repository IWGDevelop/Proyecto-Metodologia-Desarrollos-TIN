import { notFound } from 'next/navigation'
import { getCasoUsoIA, getHistorialCasoUsoIA, getAnexosCasoUsoIA } from '@/actions/casos-uso-ia'
import { DetalleCasoUsoIA } from '@/components/casos-uso-ia/DetalleCasoUsoIA'
import { CambiarEstadoCasoIA } from '@/components/casos-uso-ia/CambiarEstadoCasoIA'
import { getPerfil } from '@/lib/supabase/auth'

export const dynamic = 'force-dynamic'

interface Props { params: Promise<{ id: string }> }

export default async function DetalleCasoUsoIAPage({ params }: Props) {
  const { id } = await params
  const [caso, historial, anexos, perfil] = await Promise.all([
    getCasoUsoIA(id),
    getHistorialCasoUsoIA(id),
    getAnexosCasoUsoIA(id),
    getPerfil(),
  ])

  if (!caso) notFound()

  const isAdmin = perfil?.rol === 'ADMIN_TIN' || perfil?.rol === 'PRESIDENCIA' || perfil?.rol === 'DIRECCION_ESTRATEGIA'

  return (
    <DetalleCasoUsoIA
      caso={caso}
      historial={historial}
      anexos={anexos}
      backHref="/admin/casos-uso-ia"
      backLabel="Casos de Uso IA"
      acciones={isAdmin ? <CambiarEstadoCasoIA casoId={caso.id} estadoActual={caso.estado} /> : null}
    />
  )
}
