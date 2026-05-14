import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { RequerimientoWizard } from '@/components/requerimientos/RequerimientoWizard'

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditarRequerimientoPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const { data: requerimiento, error } = await supabase
    .from('requerimientos')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !requerimiento) notFound()

  return <RequerimientoWizard requerimiento={requerimiento as any} />
}
