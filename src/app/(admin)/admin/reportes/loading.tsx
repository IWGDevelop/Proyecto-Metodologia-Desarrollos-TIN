import { Skeleton } from '@/components/ui/skeleton'

export default function ReportesLoading() {
  return (
    <div className="space-y-6 p-5">
      <Skeleton className="h-8 w-32" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </div>
  )
}
