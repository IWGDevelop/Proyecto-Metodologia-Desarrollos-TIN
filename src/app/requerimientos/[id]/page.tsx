interface Props {
  params: Promise<{ id: string }>
}

export default async function RequerimientoDetailPage({ params }: Props) {
  const { id } = await params
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-slate-800">Detalle del Requerimiento</h1>
      <p className="mt-1 text-slate-500">ID: {id}</p>
    </div>
  )
}
