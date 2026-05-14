import { redirect } from 'next/navigation'
interface Props { params: Promise<{ id: string }> }
export default async function RequerimientoIdRedirect({ params }: Props) {
  const { id } = await params
  redirect(`/admin/requerimientos/${id}`)
}
