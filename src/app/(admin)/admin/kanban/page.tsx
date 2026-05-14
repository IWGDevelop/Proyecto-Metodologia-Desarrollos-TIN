import { KanbanBoard } from '@/components/kanban/KanbanBoard'

export default function AdminKanbanPage() {
  return (
    <div className="flex h-[calc(100vh-64px)] flex-col gap-4 overflow-hidden p-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Kanban</h1>
        <p className="text-sm text-slate-500">
          Gestión visual de requerimientos por estado · Arrastra para cambiar estado
        </p>
      </div>
      <div className="flex-1 overflow-hidden">
        <KanbanBoard isAdmin />
      </div>
    </div>
  )
}
