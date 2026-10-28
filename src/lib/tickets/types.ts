// Tipos del módulo Tickets — reflejan supabase/migration_tickets.sql

export type TipoGestion = 'INCIDENTE' | 'SOLICITUD' | 'PLANIFICADA'
export type SeMideContra = 'SLA' | 'FECHA' | 'FECHA_SIN_APROBACION'
export type PrioridadTicket = 'CRITICA' | 'ALTA' | 'MEDIA' | 'BAJA'
export type ImpactoTicket = 'SOLO_YO' | 'MI_AREA' | 'DETIENE_OPERACION'
export type CanalTicket = 'FORMULARIO' | 'CORREO'
export type EstadoTicket =
  | 'ABIERTO'
  | 'ASIGNADO'
  | 'EN_PROCESO'
  | 'ESPERA_APROBACION'
  | 'ESPERA_USUARIO'
  | 'ESPERA_PROVEEDOR'
  | 'RESUELTO'
  | 'CERRADO'
export type TipoDatoCampo = 'TEXTO' | 'TEXTO_LARGO' | 'NUMERO' | 'FECHA' | 'LISTA' | 'CASILLA' | 'USUARIO'
export type AmbitoCausa = 'IGSI' | 'GENERAL'
export type TipoDocumentoIGSI = 'SS' | 'DO' | 'REMESA' | 'MANIFIESTO' | 'OTRO'
export type AccionIGSI = 'CREAR' | 'MODIFICAR' | 'ANULAR' | 'LIQUIDAR' | 'IMPRIMIR' | 'REPORTAR' | 'CONSULTAR' | 'OTRA'
export type ImpactoOperacionIGSI = 'DETIENE' | 'RETRASA' | 'NO_AFECTA'
export type TipoEventoTicket =
  | 'CREACION'
  | 'ASIGNACION'
  | 'CAMBIO_ESTADO'
  | 'CAMBIO_PRIORIDAD'
  | 'CAMBIO_TIPOLOGIA'
  | 'COMENTARIO'
  | 'ADJUNTO'
  | 'RECORDATORIO'
  | 'APROBACION'
  | 'RECHAZO'
  | 'CLASIFICACION_CAUSA'
  | 'ENLACE_BUG'
  | 'REAPERTURA'
  | 'CIERRE'
  | 'PRIMERA_RESPUESTA'
export type ClasificacionBug = 'BUG' | 'DEUDA_TECNICA' | 'PARAMETRIZACION' | 'INFRAESTRUCTURA'
export type SeveridadBug = 'BLOQUEANTE' | 'ALTA' | 'MEDIA' | 'BAJA'
export type EstadoBug = 'REPORTADO' | 'CONFIRMADO' | 'PRIORIZADO' | 'EN_DESARROLLO' | 'EN_PRUEBAS' | 'DESPLEGADO'
export type DisparadorRecordatorio =
  | 'RESPUESTA'
  | 'SOLUCION'
  | 'ESPERA_USUARIO'
  | 'ESPERA_APROBACION'
  | 'FECHA_REQUERIDA'
  | 'RESUMEN_DIARIO'
export type DestinatarioRecordatorio =
  | 'RESPONSABLE'
  | 'COORDINADOR'
  | 'DIRECCION'
  | 'SOLICITANTE'
  | 'JEFE_SOLICITANTE'
  | 'APROBADOR'
export type CanalRecordatorio = 'APP' | 'CORREO' | 'AMBOS'
export type AccionRecordatorio = 'MARCAR_RESPUESTA_VENCIDA' | 'MARCAR_VENCIDO' | 'CIERRE_AUTOMATICO'

export interface TicketCategoria {
  id: string
  nombre: string
  descripcion: string | null
  orden: number
  activa: boolean
  created_at: string
}

export interface TicketTipologia {
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
  area_responsable: string | null
  responsable_defecto_id: string | null
  orden: number
  activa: boolean
  created_at: string
}

export interface TicketCampoTipologia {
  id: string
  tipologia_id: string
  clave: string
  etiqueta: string
  tipo_dato: TipoDatoCampo
  obligatorio: boolean
  orden: number
  opciones: string[] | null
  ayuda: string | null
  es_fecha_requerida: boolean
  activo: boolean
}

export interface TicketCausa {
  id: string
  ambito: AmbitoCausa
  tipo_causa: string
  subcausa: string
  orden: number
  activa: boolean
}

export interface Ticket {
  id: string
  numero: number
  solicitante_id: string
  area: string | null
  sede: string | null
  categoria_id: string
  tipologia_id: string
  impacto: ImpactoTicket
  prioridad: PrioridadTicket
  estado: EstadoTicket
  responsable_id: string | null
  aprobador_id: string | null
  ticket_padre_id: string | null
  plantilla_id: string | null
  canal: CanalTicket
  asunto: string
  descripcion: string
  fecha_requerida: string | null
  respuesta_vencida: boolean
  solucion_vencida: boolean
  fecha_creacion: string
  fecha_asignacion: string | null
  fecha_primera_respuesta: string | null
  fecha_resuelto: string | null
  fecha_cierre: string | null
  cierre_automatico: boolean
  reaperturas: number
  updated_at: string
}

export interface TicketValorCampo {
  id: string
  ticket_id: string
  campo_id: string
  valor: string | null
}

export interface TicketNovedadIGSI {
  ticket_id: string
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
}

export interface TicketCierre {
  id: string
  ticket_id: string
  causa_id: string
  respuesta: string
  requiere_capacitacion: boolean
  requiere_ajuste: boolean
  cerrado_por: string | null
  fecha: string
}

export interface TicketAdjunto {
  id: string
  ticket_id: string
  nombre_archivo: string
  tipo_archivo: string | null
  tamano: number | null
  url: string
  ruta: string | null
  es_imagen: boolean
  cargado_por: string | null
  fecha: string
}

export interface TicketHistorial {
  id: number
  ticket_id: string
  tipo_evento: TipoEventoTicket
  campo: string | null
  valor_anterior: string | null
  valor_nuevo: string | null
  usuario_id: string | null
  fecha: string
  comentario: string | null
  visible_usuario: boolean
  metadata: Record<string, unknown> | null
}

export interface TicketTiempos {
  ticket_id: string
  t_asignacion: number | null
  t_primera_respuesta: number | null
  t_solucion: number | null
  t_espera_aprobacion: number
  t_espera_usuario: number
  t_espera_proveedor: number
  t_confirmacion: number | null
  t_total: number | null
  t_consumido: number | null
  reaperturas: number
  cumple_respuesta: boolean | null
  cumple_solucion: boolean | null
  dias_vs_fecha_requerida: number | null
  calculado_en: string
}

export interface TicketObjetivoTiempo {
  id: string
  prioridad: PrioridadTicket
  horas_respuesta: number
  horas_solucion: number
  vigente_desde: string
  aprobado: boolean
  created_at: string
}

export interface TicketCalendarioDia {
  fecha: string
  es_habil: boolean
  hora_inicio: string | null
  hora_fin: string | null
  descripcion: string | null
}

export interface TicketReglaRecordatorio {
  id: string
  codigo: string
  nombre: string
  disparador: DisparadorRecordatorio
  porcentaje: number | null
  dias_habiles: number | null
  destinatarios: DestinatarioRecordatorio[]
  canal: CanalRecordatorio
  plantilla: string | null
  accion: AccionRecordatorio | null
  orden: number
  activa: boolean
}

export interface TicketRecordatorio {
  id: string
  ticket_id: string | null
  regla_id: string
  nivel: number
  destinatarios: string[]
  clave_unica: string
  fecha_envio: string
}

export interface TicketNotificacion {
  id: string
  usuario_id: string
  ticket_id: string | null
  mensaje: string
  leida: boolean
  created_at: string
}

export interface TicketBug {
  id: string
  numero: number
  titulo: string
  descripcion: string | null
  clasificacion: ClasificacionBug
  severidad: SeveridadBug
  tipo_documento: TipoDocumentoIGSI | null
  modulo: string | null
  estado: EstadoBug
  solucion_provisional: string | null
  responsable_id: string | null
  requerimiento_id: string | null
  fecha_detectado: string
  fecha_desplegado: string | null
  version: string | null
  created_by: string | null
  updated_at: string
}

export interface TicketPlantilla {
  id: string
  nombre: string
  descripcion: string | null
  activa: boolean
}

export interface TicketPlantillaItem {
  id: string
  plantilla_id: string
  tipologia_id: string
  asunto: string | null
  orden: number
}

/** Horario laboral general (ticket_config.horario_laboral) */
export interface HorarioLaboral {
  /** Días hábiles de la semana: 0 = domingo … 6 = sábado */
  dias: number[]
  /** "HH:MM" */
  inicio: string
  fin: string
  /** Pausa de almuerzo opcional, "HH:MM" */
  almuerzo_inicio?: string | null
  almuerzo_fin?: string | null
}

/** Servicios de IGSI y sus modalidades (ticket_config.igsi_servicios) */
export type ServiciosIGSI = Record<string, string[]>
