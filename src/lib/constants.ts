import type { Estado, Alcance, TipoSolucion, ProcesoInterno } from './supabase/types'

// ─── Sucursales ───────────────────────────────────────────────────────────────
export const SUCURSALES = [
  'Bogotá', 'Cali', 'Medellín', 'Buenaventura',
  'Cartagena', 'Mosquera', 'Pereira', 'Costa Norte',
] as const

// ─── SLA por prioridad (días hábiles) ────────────────────────────────────────
export const SLA_DIAS: Record<number, number> = {
  1: 5,
  2: 15,
  3: 30,
  4: 60,
}

export const HORAS_LABORALES_MES = 192

// ─── Paleta de colores para estados dinámicos ────────────────────────────────
export const COLOR_PALETTE: Record<string, { bg: string; text: string; border: string }> = {
  slate:  { bg: 'bg-slate-100',  text: 'text-slate-700',  border: 'border-slate-300'  },
  blue:   { bg: 'bg-blue-100',   text: 'text-blue-700',   border: 'border-blue-300'   },
  purple: { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-300' },
  violet: { bg: 'bg-violet-100', text: 'text-violet-700', border: 'border-violet-300' },
  indigo: { bg: 'bg-indigo-100', text: 'text-indigo-700', border: 'border-indigo-300' },
  amber:  { bg: 'bg-amber-100',  text: 'text-amber-700',  border: 'border-amber-300'  },
  orange: { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-300' },
  green:  { bg: 'bg-green-100',  text: 'text-green-700',  border: 'border-green-300'  },
  teal:   { bg: 'bg-teal-100',   text: 'text-teal-700',   border: 'border-teal-300'   },
  red:    { bg: 'bg-red-100',    text: 'text-red-700',    border: 'border-red-300'    },
  pink:   { bg: 'bg-pink-100',   text: 'text-pink-700',   border: 'border-pink-300'   },
  gray:   { bg: 'bg-gray-100',   text: 'text-gray-500',   border: 'border-gray-300'   },
  cyan:   { bg: 'bg-cyan-100',   text: 'text-cyan-700',   border: 'border-cyan-300'   },
}

// ─── Categorías de tareas técnicas ───────────────────────────────────────────
export const CATEGORIAS_TAREA = [
  { value: 'DESARROLLO',     label: 'Desarrollo',     bg: 'bg-blue-100',   text: 'text-blue-700'   },
  { value: 'TESTING',        label: 'Testing',        bg: 'bg-amber-100',  text: 'text-amber-700'  },
  { value: 'DOCUMENTAL',     label: 'Documental',     bg: 'bg-purple-100', text: 'text-purple-700' },
  { value: 'ADMINISTRATIVO', label: 'Administrativo', bg: 'bg-slate-100',  text: 'text-slate-600'  },
  { value: 'OTRO',           label: 'Otro',           bg: 'bg-gray-100',   text: 'text-gray-600'   },
] as const

// ─── Cargos del equipo TIN ────────────────────────────────────────────────────
export const CARGOS_TIN = [
  { value: 'AUXILIAR_TIN',             label: 'Auxiliar TIN'              },
  { value: 'ING_DESARROLLO',           label: 'Ing. de Desarrollo'        },
  { value: 'ANALISTA_TIN',             label: 'Analista TIN'              },
  { value: 'COORDINADOR_TIN',          label: 'Coordinador TIN'           },
  { value: 'DIRECTOR_CORPORATIVO_TIN', label: 'Director Corporativo TIN'  },
] as const

// ─── Estados (fallback estático para compatibilidad) ──────────────────────────
export const ESTADOS: Record<
  string,
  {
    label: string
    descripcion: string
    color: string
    bgColor: string
    textColor: string
    borderColor: string
    icon: string
  }
> = {
  SIN_GESTION: {
    label: 'Sin gestión',
    descripcion: 'El requerimiento aún no ha sido atendido',
    color: 'slate',
    bgColor: 'bg-slate-100',
    textColor: 'text-slate-700',
    borderColor: 'border-slate-300',
    icon: 'Clock',
  },
  ANALISIS: {
    label: 'En análisis',
    descripcion: 'El equipo TIN está analizando el requerimiento',
    color: 'blue',
    bgColor: 'bg-blue-100',
    textColor: 'text-blue-700',
    borderColor: 'border-blue-300',
    icon: 'Search',
  },
  EN_DEFINICION_USUARIO: {
    label: 'En definición de usuario',
    descripcion: 'Se está definiendo y validando con los usuarios',
    color: 'purple',
    bgColor: 'bg-purple-100',
    textColor: 'text-purple-700',
    borderColor: 'border-purple-300',
    icon: 'Users',
  },
  EN_DESARROLLO: {
    label: 'En desarrollo',
    descripcion: 'El desarrollo está en curso',
    color: 'indigo',
    bgColor: 'bg-indigo-100',
    textColor: 'text-indigo-700',
    borderColor: 'border-indigo-300',
    icon: 'Code2',
  },
  PRUEBAS_USUARIO: {
    label: 'Pruebas usuario',
    descripcion: 'El usuario está realizando pruebas de aceptación',
    color: 'amber',
    bgColor: 'bg-amber-100',
    textColor: 'text-amber-700',
    borderColor: 'border-amber-300',
    icon: 'TestTube',
  },
  STAND_BY: {
    label: 'Stand By',
    descripcion: 'El requerimiento está en espera',
    color: 'orange',
    bgColor: 'bg-orange-100',
    textColor: 'text-orange-700',
    borderColor: 'border-orange-300',
    icon: 'PauseCircle',
  },
  ENTREGADO: {
    label: 'Entregado',
    descripcion: 'El desarrollo fue entregado al usuario',
    color: 'green',
    bgColor: 'bg-green-100',
    textColor: 'text-green-700',
    borderColor: 'border-green-300',
    icon: 'CheckCircle',
  },
  CERRADO: {
    label: 'Cerrado',
    descripcion: 'El requerimiento fue cerrado formalmente',
    color: 'gray',
    bgColor: 'bg-gray-100',
    textColor: 'text-gray-500',
    borderColor: 'border-gray-300',
    icon: 'XCircle',
  },
}

// Fallback para estados dinámicos del Kanban que no están en ESTADOS
const ESTADO_FALLBACK = {
  label:       '',
  descripcion: '',
  color:       'slate',
  bgColor:     'bg-slate-100',
  textColor:   'text-slate-600',
  borderColor: 'border-slate-200',
  icon:        'Circle',
}

export function getEstadoCfg(estado: string) {
  const cfg = ESTADOS[estado]
  if (cfg) return cfg
  // Estado dinámico: mostrar el nombre legible como fallback
  return { ...ESTADO_FALLBACK, label: estado.replace(/_/g, ' ') }
}

// ─── Prioridades ─────────────────────────────────────────────────────────────
export const PRIORIDADES: Record<
  number,
  {
    label: string
    descripcion: string
    color: string
    bgColor: string
    textColor: string
    borderColor: string
    slaDias: number
  }
> = {
  1: {
    label: 'Crítica',
    descripcion: 'Impacto crítico en la operación. SLA: 5 días.',
    color: 'red',
    bgColor: 'bg-red-100',
    textColor: 'text-red-700',
    borderColor: 'border-red-300',
    slaDias: 5,
  },
  2: {
    label: 'Alta',
    descripcion: 'Alta prioridad. SLA: 15 días.',
    color: 'orange',
    bgColor: 'bg-orange-100',
    textColor: 'text-orange-700',
    borderColor: 'border-orange-300',
    slaDias: 15,
  },
  3: {
    label: 'Media',
    descripcion: 'Prioridad media. SLA: 30 días.',
    color: 'yellow',
    bgColor: 'bg-yellow-100',
    textColor: 'text-yellow-700',
    borderColor: 'border-yellow-300',
    slaDias: 30,
  },
  4: {
    label: 'Baja',
    descripcion: 'Baja prioridad. SLA: 60 días.',
    color: 'green',
    bgColor: 'bg-green-100',
    textColor: 'text-green-700',
    borderColor: 'border-green-300',
    slaDias: 60,
  },
}

// ─── Tipos de solución ────────────────────────────────────────────────────────
export const TIPOS_SOLUCION: Record<TipoSolucion, { label: string; descripcion: string }> = {
  DESARROLLO: {
    label: 'Desarrollo',
    descripcion: 'Desarrollo de software a medida',
  },
  MEJORA: {
    label: 'Mejora',
    descripcion: 'Mejora de funcionalidad existente',
  },
  INTEGRACION: {
    label: 'Integración',
    descripcion: 'Integración con otros sistemas o aplicativos',
  },
  SUPERSET: {
    label: 'Superset',
    descripcion: 'Informe o visualización en Apache Superset',
  },
  POR_DEFINIR: {
    label: 'Por definir',
    descripcion: 'La solución aún no ha sido determinada',
  },
}

// ─── Alcances ─────────────────────────────────────────────────────────────────
export const ALCANCES: Record<Alcance, { label: string; descripcion: string }> = {
  IWF: { label: 'IWF', descripcion: 'Unidad de negocio IWF' },
  ILT: { label: 'ILT', descripcion: 'Unidad de negocio ILT' },
  IWG: { label: 'IWG', descripcion: 'Unidad de negocio IWG' },
}

// ─── Procesos internos ────────────────────────────────────────────────────────
export const PROCESOS_INTERNOS: Array<{ value: ProcesoInterno; label: string }> = [
  { value: 'FINANCIERO',       label: 'Financiero' },
  { value: 'OPERACIONES',      label: 'Operaciones' },
  { value: 'COMERCIAL',        label: 'Comercial' },
  { value: 'CARGA',            label: 'Carga' },
  { value: 'SISTEMAS_GESTION', label: 'Sistemas de gestión' },
  { value: 'SERVICIO_CLIENTE', label: 'Servicio al cliente' },
  { value: 'COMPRAS',          label: 'Compras' },
  { value: 'SEGUROS',          label: 'Seguros' },
  { value: 'DATOS',            label: 'Datos' },
  { value: 'TI',               label: 'TI' },
  { value: 'GENERAL',          label: 'General' },
]

// ─── Tipos de cliente ─────────────────────────────────────────────────────────
export const TIPOS_CLIENTE: Array<{ value: string; label: string }> = [
  { value: 'IMPORTADOR',   label: 'Importador' },
  { value: 'EXPORTADOR',   label: 'Exportador' },
  { value: 'AGENTE_CARGA', label: 'Agente de carga' },
  { value: 'BROKER',       label: 'Broker' },
  { value: 'NAVIERA',      label: 'Naviera' },
  { value: 'TERMINAL',     label: 'Terminal portuaria' },
  { value: 'OTRO',         label: 'Otro' },
]

// ─── Tipos de solicitud ───────────────────────────────────────────────────────
export const TIPOS_SOLICITUD = [
  { value: 'NUEVO_DESARROLLO', label: 'Nuevo desarrollo' },
  { value: 'MEJORA',           label: 'Mejora' },
  { value: 'INTEGRACION',      label: 'Integración' },
  { value: 'INFORME',          label: 'Informe' },
] as const

// ─── Opciones de impacta ──────────────────────────────────────────────────────
export const OPCIONES_IMPACTA = [
  { value: 'FUNCIONARIOS', label: 'Solo funcionarios' },
  { value: 'CLIENTES',     label: 'Solo clientes' },
  { value: 'AMBOS',        label: 'Funcionarios y clientes' },
] as const

// ─── Tipos de operación de integración ───────────────────────────────────────
export const TIPOS_OPERACION_INTEGRACION = [
  { value: 'LECTURA',        label: 'Lectura' },
  { value: 'ESCRITURA',      label: 'Escritura' },
  { value: 'SINCRONIZACION', label: 'Sincronización bidireccional' },
  { value: 'WEBHOOK',        label: 'Webhook / Evento' },
  { value: 'API_REST',       label: 'API REST' },
  { value: 'ARCHIVO_PLANO',  label: 'Archivo plano (CSV/Excel)' },
] as const

// ─── Navegación ───────────────────────────────────────────────────────────────
export const NAV_ITEMS = [
  { href: '/dashboard',       label: 'Dashboard',        icon: 'LayoutDashboard' },
  { href: '/requerimientos',  label: 'Requerimientos',   icon: 'ClipboardList' },
  { href: '/kanban',          label: 'Kanban',           icon: 'Kanban' },
  { href: '/reportes',        label: 'Reportes',         icon: 'BarChart2' },
] as const
