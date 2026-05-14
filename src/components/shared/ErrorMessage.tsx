import { AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  title?: string
  message: string
  className?: string
}

export function ErrorMessage({ title = 'Error', message, className }: Props) {
  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4',
        className
      )}
    >
      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
      <div>
        <p className="text-sm font-semibold text-red-700">{title}</p>
        <p className="text-sm text-red-600">{message}</p>
      </div>
    </div>
  )
}
