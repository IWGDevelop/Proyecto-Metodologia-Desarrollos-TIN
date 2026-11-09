import { redirect } from 'next/navigation'
import { obtenerCatalogoFormulario } from '@/actions/tickets/crear'
import { NuevoTicketForm } from '@/components/tickets/funcionario/NuevoTicketForm'

export const dynamic = 'force-dynamic'

export default async function NuevoTicketPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const [catalogo, sp] = await Promise.all([obtenerCatalogoFormulario(), searchParams])
  if (!catalogo) redirect('/login')
  // ?requerimiento=<id>: viene del botón "Abrir ticket relacionado" del requerimiento
  const requerimiento = Array.isArray(sp.requerimiento) ? sp.requerimiento[0] : sp.requerimiento

  return (
    <div className="p-6">
      {catalogo.categorias.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white py-12 text-center text-sm text-slate-500">
          El catálogo de tickets aún no está configurado. Comunícate con TIN.
        </div>
      ) : (
        <NuevoTicketForm catalogo={catalogo} requerimientoInicial={requerimiento ?? null} />
      )}
    </div>
  )
}
