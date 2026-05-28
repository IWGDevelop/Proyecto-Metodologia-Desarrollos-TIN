'use client'

import { useState } from 'react'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'
import { fetchTodosParaExportar } from '@/hooks/useRequerimientos'
import { fetchTodosAdminParaExportar } from '@/actions/requerimientos-admin'
import { formatFecha } from '@/lib/utils'
import { ESTADOS, PRIORIDADES, TIPOS_SOLUCION, ALCANCES, TIPOS_SOLICITUD, PROCESOS_INTERNOS } from '@/lib/constants'
import type { FiltrosRequerimientos, SortConfig } from '@/hooks/useRequerimientos'
import type { Estado, TipoSolucion, Alcance } from '@/lib/supabase/types'

interface Props {
  filtros: FiltrosRequerimientos
  sort: SortConfig
  isAdmin?: boolean
}

export function ExportarExcel({ filtros, sort, isAdmin = false }: Props) {
  const [loading, setLoading] = useState(false)

  const handleExport = async () => {
    setLoading(true)
    try {
      const data = isAdmin
        ? await fetchTodosAdminParaExportar(filtros, sort)
        : await fetchTodosParaExportar(filtros, sort)

      const rows = data.map((r, i) => ({
        '#':                   i + 1,
        Número:                r.numero ?? '',
        Nombre:                r.nombre_desarrollo ?? r.identificacion,
        Identificación:        r.identificacion,
        Alcance:               r.alcance ? ALCANCES[r.alcance as Alcance]?.label ?? r.alcance : '',
        'Tipo solicitud':      r.tipo_solicitud ? (TIPOS_SOLICITUD.find(t => t.value === r.tipo_solicitud)?.label ?? r.tipo_solicitud) : '',
        'Tipo solución':       r.tipo_solucion ? TIPOS_SOLUCION[r.tipo_solucion as TipoSolucion]?.label ?? r.tipo_solucion : '',
        Proceso:               r.proceso_interno ? (PROCESOS_INTERNOS.find(p => p.value === r.proceso_interno)?.label ?? r.proceso_interno) : '',
        Responsable:           r.responsable ?? '',
        Prioridad:             r.prioridad ? `P${r.prioridad} - ${PRIORIDADES[r.prioridad]?.label ?? ''}` : '',
        Estado:                r.estado ? ESTADOS[r.estado as Estado]?.label ?? r.estado : '',
        'Días en estado':      r.dias_en_estado_actual ?? '',
        '% Avance':            r.porcentaje_avance ?? 0,
        'Horas est. desarrollo': (r as any).horas_estimadas_desarrollo ?? '',
        'Horas ahorradas/mes': r.horas_ahorradas_mes ?? '',
        'Ahorro mensual COP':  r.ahorro_mensual_cop ?? '',
        'Ahorro anual COP':    r.ahorro_anual_cop ?? '',
        'Impacto total anual': (r as any).impacto_economico_total_anual ?? '',
        'Fecha solicitud':     formatFecha(r.fecha_solicitud),
        'Fecha envío TIN':     formatFecha(r.fecha_envio_tin),
        'Fecha inicio dev.':   formatFecha(r.fecha_inicio_desarrollo),
        'Fecha estimada':      formatFecha(r.fecha_estimada_entrega),
        'Fecha entrega real':  formatFecha(r.fecha_real_entrega),
      }))

      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.json_to_sheet(rows)

      ws['!cols'] = [
        { wch: 4 }, { wch: 10 }, { wch: 50 }, { wch: 30 }, { wch: 8 },
        { wch: 18 }, { wch: 14 }, { wch: 20 }, { wch: 22 }, { wch: 14 },
        { wch: 20 }, { wch: 14 }, { wch: 10 }, { wch: 20 }, { wch: 20 },
        { wch: 22 }, { wch: 22 }, { wch: 22 }, { wch: 16 }, { wch: 16 },
        { wch: 16 }, { wch: 16 }, { wch: 16 },
      ]

      XLSX.utils.book_append_sheet(wb, ws, 'Requerimientos')
      const fecha = new Date().toISOString().split('T')[0]
      XLSX.writeFile(wb, `requerimientos_${fecha}.xlsx`)

      toast.success(`${data.length} requerimientos exportados`)
    } catch {
      toast.error('Error al exportar el archivo')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      disabled={loading}
      className="gap-1.5 text-xs"
    >
      <Download size={13} />
      {loading ? 'Exportando...' : 'Exportar Excel'}
    </Button>
  )
}
