import { Skeleton } from '@/components/ui/skeleton'

export default function KanbanLoading() {
  return (
    <div className="flex h-[calc(100vh-64px)] gap-4 overflow-hidden p-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex w-72 shrink-0 flex-col gap-3">
          <Skeleton className="h-8 w-full rounded-lg" />
          {Array.from({ length: 3 }).map((_, j) => (
            <Skeleton key={j} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      ))}
    </div>
  )
}
