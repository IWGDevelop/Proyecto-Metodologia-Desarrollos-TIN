import Link from 'next/link'
import { ArrowLeft, FileJson } from 'lucide-react'
import { ImportadorRequerimiento } from '@/components/requerimientos/ImportadorRequerimiento'

export default function ImportarRequerimientoPage() {
  return (
    <div className="space-y-6 p-6">
      <div>
        <Link
          href="/admin/requerimientos"
          className="mb-3 inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600"
        >
          <ArrowLeft size={13} /> Volver al listado
        </Link>
        <div className="flex items-center gap-2">
          <FileJson size={20} className="text-blue-600" />
          <div>
            <h1 className="text-xl font-bold text-slate-800">Importar requerimiento desde JSON</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Pega o escribe el JSON con la estructura del requerimiento y sus tareas técnicas
            </p>
          </div>
        </div>
      </div>

      <ImportadorRequerimiento />
    </div>
  )
}
