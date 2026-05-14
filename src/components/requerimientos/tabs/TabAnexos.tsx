'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Skeleton } from '@/components/ui/skeleton'
import { FileText, Image, File, Download } from 'lucide-react'
import type { Anexo } from '@/lib/supabase/types'

interface Props { requerimientoId: string }

function formatBytes(bytes: number | null) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function IconoTipo({ tipo }: { tipo: string | null }) {
  if (tipo?.startsWith('image/')) return <Image size={16} className="text-blue-500" />
  if (tipo?.includes('pdf')) return <FileText size={16} className="text-red-500" />
  return <File size={16} className="text-slate-400" />
}

export function TabAnexos({ requerimientoId }: Props) {
  const { data: anexos, isLoading } = useQuery<Anexo[]>({
    queryKey: ['anexos', requerimientoId],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('anexos').select('*')
        .eq('requerimiento_id', requerimientoId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as Anexo[]
    },
  })

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      {isLoading ? (
        <div className="space-y-2">{Array.from({length:3}).map((_,i)=><Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : !anexos?.length ? (
        <p className="py-8 text-center text-sm text-slate-400">Sin archivos adjuntos</p>
      ) : (
        <ul className="divide-y divide-slate-50">
          {anexos.map(a => (
            <li key={a.id} className="flex items-center gap-3 py-3">
              <IconoTipo tipo={a.tipo_archivo} />
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium text-slate-700">{a.nombre_archivo}</p>
                <p className="text-xs text-slate-400">{formatBytes(a.tamanio_bytes)}</p>
              </div>
              <a
                href={a.url_storage}
                target="_blank"
                rel="noopener noreferrer"
                download={a.nombre_archivo}
                className="text-slate-400 hover:text-blue-500"
              >
                <Download size={16} />
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
