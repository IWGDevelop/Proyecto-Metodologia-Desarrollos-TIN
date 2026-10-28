import type {
  AccionIGSI,
  ClasificacionBug,
  DestinatarioRecordatorio,
  DisparadorRecordatorio,
  EstadoBug,
  EstadoTicket,
  ImpactoOperacionIGSI,
  ImpactoTicket,
  PrioridadTicket,
  SeMideContra,
  SeveridadBug,
  TipoDatoCampo,
  TipoDocumentoIGSI,
  TipoEventoTicket,
  TipoGestion,
} from './types'

// ── Consecutivos ─────────────────────────────────────────────────────────────

export function codigoTicket(numero: number): string {
  return `TK-${String(numero).padStart(4, '0')}`
}

export function codigoBug(numero: number): string {
  return `B-${String(numero).padStart(3, '0')}`
}

// ── Estados ──────────────────────────────────────────────────────────────────

export const ESTADOS_TICKET: { value: EstadoTicket; label: string; color: string }[] = [
  { value: 'ABIERTO',           label: 'Abierto',                 color: 'bg-slate-100 text-slate-700' },
  { value: 'ASIGNADO',          label: 'Asignado',                color: 'bg-blue-100 text-blue-700' },
  { value: 'EN_PROCESO',        label: 'En proceso',              color: 'bg-indigo-100 text-indigo-700' },
  { value: 'ESPERA_APROBACION', label: 'En espera de aprobación', color: 'bg-amber-100 text-amber-800' },
  { value: 'ESPERA_USUARIO',    label: 'En espera de usuario',    color: 'bg-amber-100 text-amber-800' },
  { value: 'ESPERA_PROVEEDOR',  label: 'En espera de proveedor',  color: 'bg-amber-100 text-amber-800' },
  { value: 'RESUELTO',          label: 'Resuelto',                color: 'bg-emerald-100 text-emerald-700' },
  { value: 'CERRADO',           label: 'Cerrado',                 color: 'bg-gray-200 text-gray-700' },
]

export const LABEL_ESTADO_TICKET = Object.fromEntries(
  ESTADOS_TICKET.map(e => [e.value, e.label]),
) as Record<EstadoTicket, string>

/** Estados en los que el reloj no corre: el tiempo se descuenta del indicador */
export const ESTADOS_ESPERA: EstadoTicket[] = ['ESPERA_APROBACION', 'ESPERA_USUARIO', 'ESPERA_PROVEEDOR']

/** Estados en los que el ticket sigue abierto para TIN */
export const ESTADOS_ABIERTOS: EstadoTicket[] = [
  'ABIERTO', 'ASIGNADO', 'EN_PROCESO', 'ESPERA_APROBACION', 'ESPERA_USUARIO', 'ESPERA_PROVEEDOR',
]

/**
 * Transiciones permitidas. La UI y las Server Actions de flujo validan contra este mapa.
 * RESUELTO → EN_PROCESO es la reapertura; CERRADO → EN_PROCESO también (mantiene su reloj original).
 */
export const TRANSICIONES: Record<EstadoTicket, EstadoTicket[]> = {
  ABIERTO:           ['ASIGNADO', 'ESPERA_APROBACION'],
  ESPERA_APROBACION: ['ABIERTO', 'ASIGNADO', 'CERRADO'],
  ASIGNADO:          ['EN_PROCESO', 'ESPERA_USUARIO', 'ESPERA_PROVEEDOR', 'RESUELTO'],
  EN_PROCESO:        ['ESPERA_USUARIO', 'ESPERA_PROVEEDOR', 'ESPERA_APROBACION', 'RESUELTO'],
  ESPERA_USUARIO:    ['EN_PROCESO', 'RESUELTO', 'CERRADO'],
  ESPERA_PROVEEDOR:  ['EN_PROCESO', 'RESUELTO'],
  RESUELTO:          ['CERRADO', 'EN_PROCESO'],
  CERRADO:           ['EN_PROCESO'],
}

// ── Prioridad e impacto ──────────────────────────────────────────────────────

export const PRIORIDADES_TICKET: { value: PrioridadTicket; label: string; color: string; regla: string }[] = [
  { value: 'CRITICA', label: 'Crítica', color: 'bg-red-100 text-red-700',       regla: 'Detiene la operación, o ticket de Auditoría con fecha de entrega vencida' },
  { value: 'ALTA',    label: 'Alta',    color: 'bg-orange-100 text-orange-700', regla: 'Afecta a un área completa' },
  { value: 'MEDIA',   label: 'Media',   color: 'bg-yellow-100 text-yellow-800', regla: 'Solo afecta al solicitante' },
  { value: 'BAJA',    label: 'Baja',    color: 'bg-slate-100 text-slate-700',   regla: 'Solicitudes planificadas (compras, capacitación, mantenimientos preventivos, visitas programadas)' },
]

export const LABEL_PRIORIDAD_TICKET = Object.fromEntries(
  PRIORIDADES_TICKET.map(p => [p.value, p.label]),
) as Record<PrioridadTicket, string>

export const IMPACTOS_TICKET: { value: ImpactoTicket; label: string }[] = [
  { value: 'SOLO_YO',           label: 'Solo me afecta a mí' },
  { value: 'MI_AREA',           label: 'Afecta a mi área' },
  { value: 'DETIENE_OPERACION', label: 'Detiene la operación' },
]

export const LABEL_IMPACTO_TICKET = Object.fromEntries(
  IMPACTOS_TICKET.map(i => [i.value, i.label]),
) as Record<ImpactoTicket, string>

/**
 * Prioridad calculada con la tipología y el impacto que marca el usuario.
 * - Detiene la operación → Crítica (también Auditoría con fecha de entrega vencida)
 * - Planificada → Baja
 * - Afecta al área → Alta
 * - Solo al solicitante → la prioridad por defecto de la tipología, o Media
 */
export function calcularPrioridad(params: {
  impacto: ImpactoTicket
  tipoGestion: TipoGestion
  prioridadDefecto?: PrioridadTicket | null
  esAuditoriaVencida?: boolean
}): PrioridadTicket {
  const { impacto, tipoGestion, prioridadDefecto, esAuditoriaVencida } = params
  if (impacto === 'DETIENE_OPERACION' || esAuditoriaVencida) return 'CRITICA'
  if (tipoGestion === 'PLANIFICADA') return 'BAJA'
  if (impacto === 'MI_AREA') return 'ALTA'
  return prioridadDefecto ?? 'MEDIA'
}

// ── Catálogo ─────────────────────────────────────────────────────────────────

export const TIPOS_GESTION: { value: TipoGestion; label: string; color: string }[] = [
  { value: 'INCIDENTE',   label: 'Incidente',   color: 'bg-red-50 text-red-700' },
  { value: 'SOLICITUD',   label: 'Solicitud',   color: 'bg-blue-50 text-blue-700' },
  { value: 'PLANIFICADA', label: 'Planificada', color: 'bg-emerald-50 text-emerald-700' },
]

export const MEDICIONES: { value: SeMideContra; label: string }[] = [
  { value: 'SLA',                  label: 'SLA de soporte' },
  { value: 'FECHA',                label: 'Fecha requerida o límite' },
  { value: 'FECHA_SIN_APROBACION', label: 'Fecha requerida, sin contar espera de aprobación' },
]

export const TIPOS_DATO_CAMPO: { value: TipoDatoCampo; label: string }[] = [
  { value: 'TEXTO',       label: 'Texto corto' },
  { value: 'TEXTO_LARGO', label: 'Texto largo' },
  { value: 'NUMERO',      label: 'Número' },
  { value: 'FECHA',       label: 'Fecha' },
  { value: 'LISTA',       label: 'Lista de opciones' },
  { value: 'CASILLA',     label: 'Casilla (sí/no)' },
  { value: 'USUARIO',     label: 'Funcionario de TIN-FLOW' },
]

/** Nombre de la categoría que recibe los tickets por correo y los "sin clasificar" */
export const CATEGORIA_OTROS = 'Otros'

/** Tipos de archivo admitidos como adjunto */
export const ADJUNTOS_ACEPTADOS = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
export const ADJUNTO_TAMANO_MAX = 10 * 1024 * 1024

// ── Novedades IGSI ───────────────────────────────────────────────────────────

/** Cadena documental de IGSI, en orden */
export const CADENA_IGSI: { value: TipoDocumentoIGSI; label: string }[] = [
  { value: 'SS',         label: 'SS' },
  { value: 'DO',         label: 'DO' },
  { value: 'REMESA',     label: 'Remesa' },
  { value: 'MANIFIESTO', label: 'Manifiesto' },
  { value: 'OTRO',       label: 'Otro' },
]

export const ACCIONES_IGSI: { value: AccionIGSI; label: string }[] = [
  { value: 'CREAR',     label: 'Crear' },
  { value: 'MODIFICAR', label: 'Modificar' },
  { value: 'ANULAR',    label: 'Anular' },
  { value: 'LIQUIDAR',  label: 'Liquidar' },
  { value: 'IMPRIMIR',  label: 'Imprimir' },
  { value: 'REPORTAR',  label: 'Reportar' },
  { value: 'CONSULTAR', label: 'Consultar' },
  { value: 'OTRA',      label: 'Otra' },
]

export const IMPACTOS_OPERACION_IGSI: { value: ImpactoOperacionIGSI; label: string; impacto: ImpactoTicket }[] = [
  { value: 'DETIENE',   label: 'Detiene la operación',  impacto: 'DETIENE_OPERACION' },
  { value: 'RETRASA',   label: 'Retrasa la operación',  impacto: 'MI_AREA' },
  { value: 'NO_AFECTA', label: 'No afecta por ahora',   impacto: 'SOLO_YO' },
]

// ── Bugs ─────────────────────────────────────────────────────────────────────

export const CLASIFICACIONES_BUG: { value: ClasificacionBug; label: string; descripcion: string }[] = [
  { value: 'BUG',             label: 'Bug',                              descripcion: 'El sistema hace algo distinto a lo diseñado. Se corrige con desarrollo y pasa por pruebas antes de publicarse.' },
  { value: 'DEUDA_TECNICA',   label: 'Deuda técnica',                    descripcion: 'Funciona, pero con una solución provisional, lentitud o código frágil que genera novedades repetidas. Se planifica su corrección.' },
  { value: 'PARAMETRIZACION', label: 'Parametrización o datos maestros', descripcion: 'Tarifas, rutas, clientes o reglas mal configuradas. Se corrige configurando, sin desarrollo.' },
  { value: 'INFRAESTRUCTURA', label: 'Infraestructura o integración',    descripcion: 'Servidor, red o servicio externo que no responde. Se atiende con el proveedor o con infraestructura.' },
]

export const SEVERIDADES_BUG: { value: SeveridadBug; label: string; descripcion: string }[] = [
  { value: 'BLOQUEANTE', label: 'Bloqueante', descripcion: 'Impide crear o despachar SS, DO, remesa o manifiesto y no hay alternativa.' },
  { value: 'ALTA',       label: 'Alta',       descripcion: 'Afecta la operación, pero hay un paso manual que la resuelve.' },
  { value: 'MEDIA',      label: 'Media',      descripcion: 'Molesta o retrasa sin detener.' },
  { value: 'BAJA',       label: 'Baja',       descripcion: 'Detalle visual o de impresión.' },
]

export const ESTADOS_BUG: { value: EstadoBug; label: string }[] = [
  { value: 'REPORTADO',     label: 'Reportado' },
  { value: 'CONFIRMADO',    label: 'Confirmado' },
  { value: 'PRIORIZADO',    label: 'Priorizado' },
  { value: 'EN_DESARROLLO', label: 'En desarrollo' },
  { value: 'EN_PRUEBAS',    label: 'En pruebas' },
  { value: 'DESPLEGADO',    label: 'Desplegado' },
]

// ── Historial y recordatorios ────────────────────────────────────────────────

export const LABEL_EVENTO_TICKET: Record<TipoEventoTicket, string> = {
  CREACION:            'Creación',
  ASIGNACION:          'Asignación',
  CAMBIO_ESTADO:       'Cambio de estado',
  CAMBIO_PRIORIDAD:    'Cambio de prioridad',
  CAMBIO_TIPOLOGIA:    'Cambio de tipología',
  COMENTARIO:          'Comentario',
  ADJUNTO:             'Adjunto',
  RECORDATORIO:        'Recordatorio enviado',
  APROBACION:          'Aprobación',
  RECHAZO:             'Rechazo',
  CLASIFICACION_CAUSA: 'Clasificación de causa',
  ENLACE_BUG:          'Enlace a bug',
  REAPERTURA:          'Reapertura',
  CIERRE:              'Cierre',
  PRIMERA_RESPUESTA:   'Primera respuesta',
}

export const DISPARADORES_RECORDATORIO: { value: DisparadorRecordatorio; label: string }[] = [
  { value: 'RESPUESTA',         label: '% del tiempo de respuesta sin responder' },
  { value: 'SOLUCION',          label: '% del tiempo de solución' },
  { value: 'ESPERA_USUARIO',    label: 'Días hábiles en espera de usuario' },
  { value: 'ESPERA_APROBACION', label: 'Días hábiles en espera de aprobación' },
  { value: 'FECHA_REQUERIDA',   label: 'Días hábiles antes de la fecha requerida' },
  { value: 'RESUMEN_DIARIO',    label: 'Resumen diario' },
]

export const DESTINATARIOS_RECORDATORIO: { value: DestinatarioRecordatorio; label: string }[] = [
  { value: 'RESPONSABLE',      label: 'Responsable' },
  { value: 'COORDINADOR',      label: 'Coordinador TIN' },
  { value: 'DIRECCION',        label: 'Dirección de TI' },
  { value: 'SOLICITANTE',      label: 'Solicitante' },
  { value: 'JEFE_SOLICITANTE', label: 'Jefe inmediato del solicitante' },
  { value: 'APROBADOR',        label: 'Aprobador' },
]

// ── Parámetros generales (ticket_config) ─────────────────────────────────────

export const CONFIG_CLAVES = {
  /** HorarioLaboral */
  HORARIO_LABORAL: 'horario_laboral',
  /** number: días hábiles en Resuelto o en espera de usuario antes del cierre automático */
  DIAS_CIERRE_AUTOMATICO: 'dias_cierre_automatico',
  /** string[]: correos del Coordinador TIN */
  EMAILS_COORDINADOR: 'emails_coordinador',
  /** string[]: correos de la Dirección de TI */
  EMAILS_DIRECCION: 'emails_direccion',
  /** "HH:MM": hora del resumen diario */
  HORA_RESUMEN_DIARIO: 'hora_resumen_diario',
  /** ServiciosIGSI */
  IGSI_SERVICIOS: 'igsi_servicios',
  /** string[]: sedes disponibles */
  SEDES: 'sedes',
  /** number: novedades conceptuales del mismo funcionario en 30 días que sugieren capacitación */
  UMBRAL_CAPACITACION: 'umbral_capacitacion',
} as const

/** Zona horaria de los cálculos de horas hábiles */
export const ZONA_HORARIA = 'America/Bogota'

// ── Permisos (recursos de roles_personalizados / permisos_rol) ───────────────

export const RECURSOS_TICKETS = {
  /** Bandeja de tickets de TIN */
  MENU_BANDEJA: 'menu:tickets',
  MENU_DASHBOARD: 'menu:tickets-dashboard',
  MENU_BUGS: 'menu:tickets-bugs',
  MENU_CONFIG: 'menu:tickets-config',
  /** Puede ser responsable de tickets y atender los suyos */
  ATENDER: 'tickets:atender',
  /** Ve todos los tickets, asigna y reasigna (Coordinador TIN) */
  COORDINAR: 'tickets:coordinar',
  /** Ve las tipologías de visibilidad restringida (Auditoría) */
  RESTRINGIDAS: 'tickets:restringidas',
} as const
