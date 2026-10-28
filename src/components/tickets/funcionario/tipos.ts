// Tipos compartidos entre las Server Actions del funcionario y sus componentes (solo tipos).
import type {
  AccionIGSI,
  EstadoTicket,
  ImpactoOperacionIGSI,
  ImpactoTicket,
  PrioridadTicket,
  SeMideContra,
  ServiciosIGSI,
  TicketCampoTipologia,
  TipoDocumentoIGSI,
  TipoEventoTicket,
  TipoGestion,
} from '@/lib/tickets/types'
import type { AdjuntoNuevo } from '@/components/tickets/SubirAdjuntos'

export interface CategoriaFormulario {
  id: string
  nombre: string
  descripcion: string | null
}

export interface TipologiaFormulario {
  id: string
  categoria_id: string
  nombre: string
  descripcion_ayuda: string | null
  tipo_gestion: TipoGestion
  se_mide_contra: SeMideContra
  prioridad_defecto: PrioridadTicket | null
  requiere_aprobacion: boolean
  visibilidad_restringida: boolean
  adjunto_obligatorio: boolean
  es_novedad_igsi: boolean
}

export interface CatalogoFormulario {
  categorias: CategoriaFormulario[]
  tipologias: TipologiaFormulario[]
  campos: TicketCampoTipologia[]
  serviciosIGSI: ServiciosIGSI
  usuarios: { id: string; nombre_completo: string }[]
  solicitante: {
    id: string
    nombre: string
    area: string | null
    sede: string | null
    jefeNombre: string | null
  }
  puedePlantillas: boolean
}

export interface NovedadIGSIInput {
  tipo_documento: TipoDocumentoIGSI
  tipo_documento_otro?: string | null
  numero_documento?: string | null
  /** El documento no se pudo crear, por eso no tiene número */
  sin_numero?: boolean
  documentos_relacionados?: string | null
  servicio: string
  modalidad: string
  accion: AccionIGSI
  que_paso: string
  que_esperaba: string
  mensaje_error?: string | null
  validacion_previa: boolean
  impacto_operacion: ImpactoOperacionIGSI
}

export interface CrearTicketInput {
  tipologiaId: string
  impacto: ImpactoTicket
  asunto: string
  descripcion: string
  /** campo_id → valor (texto; CASILLA = 'true' | 'false'; USUARIO = id del perfil) */
  valores: Record<string, string>
  adjuntos: AdjuntoNuevo[]
  igsi?: NovedadIGSIInput | null
}

export interface ResultadoCrear {
  ok: boolean
  error?: string
  id?: string
  codigo?: string
  /** Códigos de tickets hijos creados (hallazgo de auditoría, plantilla) */
  hijos?: string[]
}

export interface PlantillaFormulario {
  id: string
  nombre: string
  descripcion: string | null
  items: { id: string; asunto: string | null; orden: number; tipologia: string; categoria: string; activa: boolean }[]
}

export interface DatosPlantillaFormulario {
  plantillas: PlantillaFormulario[]
  sedes: string[]
  areas: { value: string; label: string }[]
}

export interface CrearDesdePlantillaInput {
  plantillaId: string
  nombre: string
  cargo: string
  area: string
  sede: string
  /** YYYY-MM-DD: fecha de ingreso o de retiro */
  fecha: string
  observaciones?: string
}

export interface MiTicketFila {
  id: string
  codigo: string
  asunto: string
  categoria: string
  tipologia: string
  tipo_gestion: TipoGestion | null
  estado: EstadoTicket
  prioridad: PrioridadTicket
  responsable: string | null
  fecha_creacion: string
  fecha_requerida: string | null
  fecha_resuelto: string | null
  fecha_cierre: string | null
  updated_at: string
  es_hijo: boolean
}

export interface FiltrosMisTickets {
  /** Estado puntual, 'ABIERTOS' (no cerrados) o 'TODOS' */
  estado?: EstadoTicket | 'ABIERTOS' | 'TODOS'
  q?: string
}

export interface EventoVisible {
  id: number
  tipo_evento: TipoEventoTicket
  fecha: string
  usuario: string | null
  es_mio: boolean
  valor_anterior: string | null
  valor_nuevo: string | null
  comentario: string | null
}

export interface MiTicketDetalle {
  id: string
  codigo: string
  asunto: string
  descripcion: string
  estado: EstadoTicket
  prioridad: PrioridadTicket
  impacto: ImpactoTicket
  canal: string
  area: string | null
  sede: string | null
  categoria: string
  tipologia: string
  tipo_gestion: TipoGestion | null
  requiere_aprobacion: boolean
  responsable: string | null
  aprobador: string | null
  fecha_creacion: string
  fecha_requerida: string | null
  fecha_asignacion: string | null
  fecha_primera_respuesta: string | null
  fecha_resuelto: string | null
  fecha_cierre: string | null
  cierre_automatico: boolean
  reaperturas: number
  valores: { etiqueta: string; tipo_dato: string; valor: string }[]
  novedad: {
    tipo_documento: TipoDocumentoIGSI
    tipo_documento_otro: string | null
    numero_documento: string | null
    documentos_relacionados: string | null
    servicio: string
    modalidad: string
    accion: AccionIGSI
    que_paso: string
    que_esperaba: string
    mensaje_error: string | null
    validacion_previa: boolean
    impacto_operacion: ImpactoOperacionIGSI
  } | null
  adjuntos: { id: string; nombre_archivo: string; tipo_archivo: string | null; tamano: number | null; url: string; es_imagen: boolean; fecha: string; cargado_por: string | null }[]
  historial: EventoVisible[]
  cierre: { respuesta: string; fecha: string } | null
  /** Qué se le pidió al usuario (si está en espera de usuario) */
  solicitudPendiente: { fecha: string; textos: string[] } | null
  padre: { id: string; codigo: string; asunto: string } | null
  hijos: { id: string; codigo: string; asunto: string; estado: EstadoTicket }[]
}
