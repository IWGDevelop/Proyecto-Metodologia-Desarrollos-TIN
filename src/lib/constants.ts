import type { Estado, Alcance, TipoSolucion, ProcesoInterno } from './supabase/types'

// ─── SLA por prioridad (días hábiles) ────────────────────────────────────────
export const SLA_DIAS: Record<number, number> = {
  1: 5,
  2: 15,
  3: 30,
  4: 60,
}

export const HORAS_LABORALES_MES = 192

// ─── Estados ─────────────────────────────────────────────────────────────────
export const ESTADOS: Record<
  Estado,
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
