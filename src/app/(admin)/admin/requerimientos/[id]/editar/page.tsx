import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { RequerimientoWizard } from '@/components/requerimientos/RequerimientoWizard'

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditarRequerimientoAdminPage({ params }: Props) {
  const { id } = await params
  const supabase = createAdminClient()
  const { data: requerimiento, error } = await (supabase as any)
    .from('requerimientos').select('*').eq('id', id).single()

  if (error || !requerimiento) notFound()

  return (
    <RequerimientoWizard
      requerimiento={requerimiento as any}
      redirectBasePath="/admin/requerimientos"
      isAdmin
    />
  )
}
