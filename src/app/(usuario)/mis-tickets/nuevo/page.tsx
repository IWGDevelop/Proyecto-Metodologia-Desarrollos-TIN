import { redirect } from 'next/navigation'
import { obtenerCatalogoFormulario } from '@/actions/tickets/crear'
import { NuevoTicketForm } from '@/components/tickets/funcionario/NuevoTicketForm'

export const dynamic = 'force-dynamic'

export default async function NuevoTicketPage() {
  const catalogo = await obtenerCatalogoFormulario()
  if (!catalogo) redirect('/login')

  return (
    <div className="mx-auto max-w-3xl p-6">
      {catalogo.categorias.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white py-12 text-center text-sm text-slate-500">
          El catálogo de tickets aún no está configurado. Comunícate con TIN.
        </div>
      ) : (
        <NuevoTicketForm catalogo={catalogo} />
      )}
    </div>
  )
}
