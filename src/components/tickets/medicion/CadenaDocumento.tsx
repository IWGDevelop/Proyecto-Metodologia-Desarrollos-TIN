import { cn } from '@/lib/utils'
import type { TipoDocumentoIGSI } from '@/lib/tickets/types'

const CADENA: { value: TipoDocumentoIGSI; label: string }[] = [
  { value: 'SS', label: 'SS' },
  { value: 'DO', label: 'DO' },
  { value: 'REMESA', label: 'Remesa' },
  { value: 'MANIFIESTO', label: 'Manifiesto' },
]

/** Mini-cadena SS → DO → Remesa → Manifiesto con el documento afectado resaltado */
export function CadenaDocumento({ documento }: { documento: TipoDocumentoIGSI | null }) {
  if (!documento) return null
  if (documento === 'OTRO') {
    return <span className="inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">Otro documento</span>
  }
  const idx = CADENA.findIndex(c => c.value === documento)
  return (
    <div className="flex items-center gap-0.5" aria-label={`Documento afectado: ${CADENA[idx]?.label ?? documento}`}>
      {CADENA.map((c, i) => (
        <span
          key={c.value}
          className={cn(
            'rounded px-1.5 py-0.5 text-[10px] font-semibold',
            i === idx ? 'bg-blue-600 text-white' : i < idx ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-400',
          )}
        >
          {c.label}
        </span>
      ))}
    </div>
  )
}
