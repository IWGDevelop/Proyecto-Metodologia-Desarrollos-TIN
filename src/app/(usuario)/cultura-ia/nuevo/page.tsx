import { getPerfil } from '@/lib/supabase/auth'
import { FormRegistroUsoIA } from '@/components/cultura-ia/FormRegistroUsoIA'

export default async function NuevoRegistroUsoIAPage() {
  const perfil = await getPerfil()
  return <FormRegistroUsoIA perfil={perfil} />
}
