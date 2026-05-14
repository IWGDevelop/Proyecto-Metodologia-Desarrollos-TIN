import { TablaRequerimientosSkeleton } from '@/components/requerimientos/TablaRequerimientos'
import { Skeleton } from '@/components/ui/skeleton'

export default function RequerimientosLoading() {
  return (
    <div className="space-y-4 p-6">
      <Skeleton className="h-8 w-48" />
      <TablaRequerimientosSkeleton />
    </div>
  )
}
