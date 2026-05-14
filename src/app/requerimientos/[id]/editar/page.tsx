import { redirect } from 'next/navigation'
interface Props { params: Promise<{ id: string }> }
export default async function EditarRedirect({ params }: Props) {
  const { id } = await params
  redirect(`/admin/requerimientos/${id}/editar`)
}
