import * as XLSX from 'xlsx'

export interface ColumnaExcel {
  titulo: string
  ancho?: number
  render: (row: any, index: number) => string | number | null | undefined
}

export interface HojaExcel {
  nombre: string
  datos: any[]
  columnas: ColumnaExcel[]
}

function buildWorksheet(datos: any[], columnas: ColumnaExcel[]): XLSX.WorkSheet {
  if (datos.length === 0) {
    const ws: XLSX.WorkSheet = {}
    ws['A1'] = { v: 'Sin datos en este período', t: 's' }
    ws['!ref'] = 'A1'
    return ws
  }

  const filas = datos.map((d, i) => {
    const fila: Record<string, any> = {}
    columnas.forEach(c => { fila[c.titulo] = c.render(d, i) ?? '' })
    return fila
  })

  const ws = XLSX.utils.json_to_sheet(filas)

  // Ancho de columnas
  ws['!cols'] = columnas.map(c => ({ wch: c.ancho ?? 18 }))

  return ws
}

export function exportarReporte(
  nombre: string,
  datos: any[],
  columnas: ColumnaExcel[]
): void {
  const wb = XLSX.utils.book_new()
  const ws = buildWorksheet(datos, columnas)
  XLSX.utils.book_append_sheet(wb, ws, nombre.slice(0, 31)) // max 31 chars
  const fecha = new Date().toISOString().split('T')[0]
  XLSX.writeFile(wb, `${nombre.replace(/\s+/g, '_')}_${fecha}.xlsx`)
}

export function exportarReporteCompleto(hojas: HojaExcel[]): void {
  const wb = XLSX.utils.book_new()

  hojas.forEach(hoja => {
    const ws = buildWorksheet(hoja.datos, hoja.columnas)
    XLSX.utils.book_append_sheet(wb, ws, hoja.nombre.slice(0, 31))
  })

  const fecha = new Date().toISOString().split('T')[0]
  XLSX.writeFile(wb, `Reporte_Completo_TIN_${fecha}.xlsx`)
}
