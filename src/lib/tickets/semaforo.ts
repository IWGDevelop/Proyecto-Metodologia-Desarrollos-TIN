// Semáforo y nivel de recordatorio de un ticket abierto (función pura, cliente o servidor).
// Equivale a level() de la especificación, pero con los umbrales de las reglas
// activas de ticket_reglas_recordatorio (disparadores RESPUESTA y SOLUCION).

export type ClaseSemaforo = 'ok' | 'alerta' | 'vencido'

export interface ReglaUmbral {
  disparador: string
  porcentaje: number | null
  nombre: string
}

export interface NivelRecordatorio {
  /** Fracción del tiempo objetivo consumida (1 = 100 %) */
  u: number
  /** Medida que se está vigilando */
  medida: 'RESPUESTA' | 'SOLUCION'
  etiqueta: string
  clase: ClaseSemaforo
  /** Posición (1..n) de la regla alcanzada; 0 = ninguna */
  nivel: number
}

export function nivelRecordatorio(
  t: { respondido: boolean; horasRespuesta: number; horasConsumidas: number },
  objetivo: { horas_respuesta: number; horas_solucion: number } | null,
  reglas: ReglaUmbral[],
): NivelRecordatorio | null {
  if (!objetivo) return null
  const medida: 'RESPUESTA' | 'SOLUCION' = t.respondido ? 'SOLUCION' : 'RESPUESTA'
  const meta = medida === 'RESPUESTA' ? Number(objetivo.horas_respuesta) : Number(objetivo.horas_solucion)
  if (!(meta > 0)) return null
  const horas = medida === 'RESPUESTA' ? t.horasRespuesta : t.horasConsumidas
  const u = horas / meta

  const umbrales = reglas
    .filter(r => r.disparador === medida && r.porcentaje != null)
    .sort((a, b) => Number(a.porcentaje) - Number(b.porcentaje))
  let nivel = 0
  let etiqueta = 'Sin recordatorio'
  umbrales.forEach((r, i) => {
    if (u * 100 >= Number(r.porcentaje)) {
      nivel = i + 1
      etiqueta = r.nombre
    }
  })
  const minimo = umbrales.length ? Number(umbrales[0].porcentaje) / 100 : medida === 'RESPUESTA' ? 0.5 : 0.8
  const clase: ClaseSemaforo = u >= 1 ? 'vencido' : u >= minimo ? 'alerta' : 'ok'
  if (u >= 1 && nivel === 0) etiqueta = medida === 'RESPUESTA' ? 'Respuesta vencida' : 'Solución vencida'
  return { u, medida, etiqueta, clase, nivel }
}
