import { z } from 'zod'
import { ADJUNTOS_ACEPTADOS } from '@/lib/tickets/constantes'
import type { CatalogoFormulario } from './tipos'

// Esquema del formulario "Nuevo ticket". Los campos específicos dependen de la tipología,
// así que su validación va en superRefine con el catálogo en el cierre.

/** Las claves de los campos dinámicos llevan prefijo para que react-hook-form no las trate como índices */
export const claveCampo = (id: string) => `c_${id}`

/** Cadena documental visible en el selector (sin "Otro") */
export const CADENA_VISUAL = ['SS', 'DO', 'REMESA', 'MANIFIESTO'] as const

const adjuntoSchema = z.object({
  nombre_archivo: z.string(),
  tipo_archivo: z.string(),
  tamano: z.number(),
  url: z.string(),
  ruta: z.string(),
  es_imagen: z.boolean(),
})

const igsiSchema = z.object({
  tipo_documento: z.string(),
  tipo_documento_otro: z.string(),
  numero_documento: z.string(),
  sin_numero: z.boolean(),
  relacionados: z.record(z.string(), z.string()),
  servicio: z.string(),
  modalidad: z.string(),
  accion: z.string(),
  que_paso: z.string(),
  que_esperaba: z.string(),
  mensaje_error: z.string(),
  validacion_previa: z.boolean(),
  impacto_operacion: z.string(),
})

export function crearEsquemaTicket(catalogo: CatalogoFormulario) {
  return z.object({
    categoriaId: z.string().min(1, 'Elige la categoría'),
    tipologiaId: z.string().min(1, 'Elige la tipología'),
    impacto: z.string(),
    asunto: z.string().max(300, 'Máximo 300 caracteres'),
    descripcion: z.string().max(20000, 'La descripción es demasiado larga'),
    valores: z.record(z.string(), z.string()),
    adjuntos: z.array(adjuntoSchema),
    igsi: igsiSchema,
  }).superRefine((v, ctx) => {
    const tip = catalogo.tipologias.find(t => t.id === v.tipologiaId)
    if (!tip) return
    const falta = (path: (string | number)[], message: string) => ctx.addIssue({ code: 'custom', path, message })

    if (tip.es_novedad_igsi) {
      const n = v.igsi
      if (!n.tipo_documento) falta(['igsi', 'tipo_documento'], 'Elige el documento afectado')
      if (n.tipo_documento === 'OTRO' && !n.tipo_documento_otro.trim()) falta(['igsi', 'tipo_documento_otro'], 'Indica cuál documento')
      if (!n.sin_numero && !n.numero_documento.trim()) falta(['igsi', 'numero_documento'], 'Escribe el número del documento')
      if (!n.servicio.trim()) falta(['igsi', 'servicio'], 'Elige el servicio')
      if (!n.modalidad.trim()) falta(['igsi', 'modalidad'], 'Elige la modalidad')
      if (!n.accion) falta(['igsi', 'accion'], 'Elige la acción')
      if (!n.que_paso.trim()) falta(['igsi', 'que_paso'], 'Describe qué pasó')
      if (!n.que_esperaba.trim()) falta(['igsi', 'que_esperaba'], 'Describe qué esperabas')
      if (!n.validacion_previa) falta(['igsi', 'validacion_previa'], 'Confirma que revisaste los datos antes de reportar')
      if (!n.impacto_operacion) falta(['igsi', 'impacto_operacion'], 'Indica el impacto en la operación')
      if (!v.adjuntos.some(a => a.es_imagen)) falta(['adjuntos'], 'Adjunta al menos una captura de pantalla')
    } else {
      if (!v.impacto) falta(['impacto'], 'Elige el impacto')
      if (!v.asunto.trim()) falta(['asunto'], 'Escribe el asunto')
      if (!v.descripcion.trim()) falta(['descripcion'], 'Describe la novedad o solicitud')
      if (tip.adjunto_obligatorio && !v.adjuntos.some(a => a.es_imagen)) {
        falta(['adjuntos'], 'Esta tipología exige al menos una imagen o captura')
      }
    }
    if (v.adjuntos.some(a => !ADJUNTOS_ACEPTADOS.includes(a.tipo_archivo))) falta(['adjuntos'], 'Hay un adjunto con tipo no admitido')

    for (const c of catalogo.campos.filter(c => c.tipologia_id === tip.id)) {
      const valor = (v.valores[claveCampo(c.id)] ?? '').trim()
      const path = ['valores', claveCampo(c.id)]
      if (c.tipo_dato === 'CASILLA') continue
      if (!valor) {
        if (c.obligatorio) falta(path, 'Campo obligatorio')
        continue
      }
      if (c.tipo_dato === 'NUMERO' && !Number.isFinite(Number(valor.replace(',', '.')))) falta(path, 'Debe ser un número')
      if (c.tipo_dato === 'FECHA' && !/^\d{4}-\d{2}-\d{2}$/.test(valor)) falta(path, 'Fecha inválida')
    }
  })
}

export type FormularioTicket = z.infer<ReturnType<typeof crearEsquemaTicket>>

export const IGSI_VACIO: FormularioTicket['igsi'] = {
  tipo_documento: '',
  tipo_documento_otro: '',
  numero_documento: '',
  sin_numero: false,
  relacionados: {},
  servicio: '',
  modalidad: '',
  accion: '',
  que_paso: '',
  que_esperaba: '',
  mensaje_error: '',
  validacion_previa: false,
  impacto_operacion: '',
}

export const SELECT_CLASS =
  'h-9 w-full rounded-lg border border-input bg-white px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 aria-invalid:border-destructive'
