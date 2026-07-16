'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { publicarRequerimiento } from '@/actions/requerimientos'

interface Props {
  requerimientoId: string
  size?: 'sm' | 'default'
}

export function PublicarRequerimientoBtn({ requerimientoId, size = 'sm' }: Props) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const handlePublicar = () => {
    startTransition(async () => {
      try {
        await publicarRequerimiento(requerimientoId)
        toast.success('Requerimiento publicado correctamente')
        router.refresh()
      } catch {
        toast.error('Error al publicar el requerimiento')
      }
    })
  }

  return (
    <Button
      size={size}
      onClick={handlePublicar}
      disabled={isPending}
      className="bg-emerald-600 hover:bg-emerald-700 text-white"
    >
      <Send size={14} />
      {isPending ? 'Publicando...' : 'Publicar requerimiento'}
    </Button>
  )
}
