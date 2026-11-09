import { bloquesComentario } from '@/lib/tickets/comentario-rico'
import { cn } from '@/lib/utils'

/** Muestra un comentario con sus imágenes intercaladas en el orden en que se escribió */
export function ContenidoComentario({ texto, className }: { texto: string; className?: string }) {
  const bloques = bloquesComentario(texto)
  return (
    <div className={cn('space-y-2 text-sm', className)}>
      {bloques.map((b, i) =>
        b.tipo === 'texto' ? (
          <p key={i} className="whitespace-pre-wrap break-words">{b.texto}</p>
        ) : (
          <a key={i} href={b.url} target="_blank" rel="noopener noreferrer" className="block w-fit" title={`Abrir ${b.nombre}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={b.url} alt={b.nombre} className="max-h-[480px] max-w-full rounded-lg border border-slate-200 bg-white" />
          </a>
        ),
      )}
    </div>
  )
}
