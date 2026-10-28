import type { FilaTicketDashboard } from '@/actions/tickets/dashboard'

// Agregaciones del dashboard (funciones puras sobre las filas que devuelve obtenerDashboardTickets)

export const promedio = (xs: (number | null | undefined)[]): number | null => {
  const v = xs.filter((x): x is number => typeof x === 'number' && Number.isFinite(x))
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null
}

export const pct = (a: number, b: number): number | null => (b ? (100 * a) / b : null)

export const fmtH = (v: number | null | undefined) => (v == null ? '—' : `${v.toLocaleString('es-CO', { maximumFractionDigits: 1, minimumFractionDigits: 1 })} h`)
export const fmtPct = (v: number | null | undefined) => (v == null ? '—' : `${Math.round(v)}%`)

const resuelto = (t: FilaTicketDashboard) => t.estado === 'RESUELTO' || t.estado === 'CERRADO'

export interface Kpis {
  total: number
  abiertos: number
  respuestaProm: number | null
  solucionProm: number | null
  pctRespuesta: number | null
  respondidos: number
  pctSolucion: number | null
  resueltos: number
  vencidosAbiertos: number
  conRecordatorio: number
}

export function calcularKpis(periodo: FilaTicketDashboard[], abiertos: FilaTicketDashboard[]): Kpis {
  const resp = periodo.filter(t => t.t_primera_respuesta != null)
  const sol = periodo.filter(t => t.t_solucion != null)
  return {
    total: periodo.length,
    abiertos: abiertos.length,
    respuestaProm: promedio(resp.map(t => t.t_primera_respuesta)),
    solucionProm: promedio(sol.map(t => t.t_solucion)),
    pctRespuesta: pct(resp.filter(t => t.cumple_respuesta === true).length, resp.filter(t => t.cumple_respuesta != null).length),
    respondidos: resp.length,
    pctSolucion: pct(sol.filter(t => t.cumple_solucion === true).length, sol.filter(t => t.cumple_solucion != null).length),
    resueltos: sol.length,
    vencidosAbiertos: abiertos.filter(t => t.nivel?.clase === 'vencido').length,
    conRecordatorio: abiertos.filter(t => t.nivel && t.nivel.clase !== 'ok').length,
  }
}

export interface FilaResponsable {
  id: string
  nombre: string
  asignados: number
  abiertos: number
  cerrados: number
  respuestaProm: number | null
  solucionProm: number | null
  pctRespuesta: number | null
  pctSolucion: number | null
  conRecordatorio: number
  vencidos: number
}

export function porResponsable(periodo: FilaTicketDashboard[], abiertos: FilaTicketDashboard[]): FilaResponsable[] {
  const nombres = new Map<string, string>()
  for (const t of [...periodo, ...abiertos]) nombres.set(t.responsable_id ?? 'SIN', t.responsable)
  return [...nombres]
    .map(([id, nombre]) => {
      const clave = (t: FilaTicketDashboard) => (t.responsable_id ?? 'SIN') === id
      const x = periodo.filter(clave)
      const o = abiertos.filter(clave)
      const r = x.filter(t => t.t_primera_respuesta != null)
      const s = x.filter(t => t.t_solucion != null)
      return {
        id,
        nombre,
        asignados: x.length,
        abiertos: o.length,
        cerrados: x.filter(resuelto).length,
        respuestaProm: promedio(r.map(t => t.t_primera_respuesta)),
        solucionProm: promedio(s.map(t => t.t_solucion)),
        pctRespuesta: pct(r.filter(t => t.cumple_respuesta === true).length, r.filter(t => t.cumple_respuesta != null).length),
        pctSolucion: pct(s.filter(t => t.cumple_solucion === true).length, s.filter(t => t.cumple_solucion != null).length),
        conRecordatorio: o.filter(t => t.nivel && t.nivel.clase !== 'ok').length,
        vencidos: o.filter(t => t.nivel?.clase === 'vencido').length,
      }
    })
    .sort((a, b) => (a.id === 'SIN' ? 1 : b.id === 'SIN' ? -1 : a.nombre.localeCompare(b.nombre)))
}

export function conteo<T>(xs: T[], clave: (x: T) => string): { clave: string; n: number }[] {
  const m = new Map<string, number>()
  for (const x of xs) m.set(clave(x), (m.get(clave(x)) ?? 0) + 1)
  return [...m].map(([k, n]) => ({ clave: k, n })).sort((a, b) => b.n - a.n)
}

export function esperas(periodo: FilaTicketDashboard[]) {
  const tipos = [
    { tipo: 'Aprobación', campo: 't_espera_aprobacion' as const },
    { tipo: 'Usuario', campo: 't_espera_usuario' as const },
    { tipo: 'Proveedor', campo: 't_espera_proveedor' as const },
  ]
  return tipos.map(({ tipo, campo }) => {
    const con = periodo.filter(t => t[campo] > 0)
    return {
      tipo,
      horas: periodo.reduce((a, t) => a + t[campo], 0),
      tickets: con.length,
      promedio: promedio(con.map(t => t[campo])),
    }
  })
}

export function reaperturas(periodo: FilaTicketDashboard[]) {
  const reabiertos = periodo.filter(t => t.reaperturas > 0).length
  const cerrados = periodo.filter(t => t.estado === 'CERRADO').length
  return { reabiertos, cerrados, tasa: pct(reabiertos, cerrados) }
}

export function cumplimientoFecha(periodo: FilaTicketDashboard[]) {
  const medidos = periodo.filter(t => t.se_mide_contra !== 'SLA' && t.dias_vs_fecha_requerida != null)
  const aTiempo = medidos.filter(t => (t.dias_vs_fecha_requerida ?? 0) >= 0).length
  return {
    medidos: medidos.length,
    aTiempo,
    pct: pct(aTiempo, medidos.length),
    promedioDias: promedio(medidos.map(t => t.dias_vs_fecha_requerida)),
    sinFecha: periodo.filter(t => t.se_mide_contra !== 'SLA' && !t.fecha_requerida).length,
  }
}
