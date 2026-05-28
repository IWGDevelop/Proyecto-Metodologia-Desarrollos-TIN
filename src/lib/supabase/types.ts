// ─── Auth / Perfiles ─────────────────────────────────────────────────────────
export type RolUsuario = 'ADMIN_TIN' | 'USUARIO' | 'PRESIDENCIA'

export interface Perfil {
  id: string
  email: string
  nombre_completo: string
  cargo: string | null
  proceso_interno: string | null
  empresa: 'IWF' | 'ILT' | 'IWG' | null
  rol: RolUsuario
  activo: boolean
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export interface RegistroHorasTarea {
  id: string
  tarea_id: string
  fecha: string
  horas: number
  notas: string | null
  created_at: string
}

export type CategoriaTarea = 'DESARROLLO' | 'TESTING' | 'DOCUMENTAL' | 'ADMINISTRATIVO' | 'OTRO'
export type CargoTIN = 'AUXILIAR_TIN' | 'ING_DESARROLLO' | 'ANALISTA_TIN' | 'COORDINADOR_TIN' | 'DIRECTOR_CORPORATIVO_TIN'

export interface TareaTecnica {
  id: string
  requerimiento_id: string
  titulo: string
  descripcion: string | null
  responsable_id: string | null
  fecha_compromiso: string | null
  categoria: CategoriaTarea | null
  cargo_responsable: CargoTIN | null
  completada: boolean
  completada_por: string | null
  completada_at: string | null
  fecha_completada: string | null        // fecha elegida por el usuario (YYYY-MM-DD)
  motivo_incumplimiento: string | null   // obligatorio cuando completó después del compromiso
  orden: number
  created_by: string | null
  created_at: string
  updated_at: string
  perfil_completada?: Perfil
  registros_horas: RegistroHorasTarea[]
}

export interface RequerimientoDesarrollador {
  requerimiento_id: string
  perfil_id: string
  asignado_at: string
  perfil?: Perfil
}

export interface Notificacion {
  id: string
  usuario_id: string
  requerimiento_id: string | null
  mensaje: string
  leida: boolean
  created_at: string
}

// ─── Enums / Union types ─────────────────────────────────────────────────────
export type Estado =
  | 'SIN_GESTION'
  | 'ANALISIS'
  | 'EN_DEFINICION_USUARIO'
  | 'EN_DESARROLLO'
  | 'PRUEBAS_USUARIO'
  | 'STAND_BY'
  | 'ENTREGADO'
  | 'CERRADO'
  | (string & {})   // permite estados personalizados dinámicos

export interface EstadoKanban {
  id: string
  nombre: string
  label: string
  color_key: string
  icono: string
  orden: number
  activo: boolean
  es_final: boolean
  created_at: string
}

export type Alcance = 'IWF' | 'ILT' | 'IWG'
export type TipoSolicitud = 'NUEVO_DESARROLLO' | 'MEJORA' | 'INTEGRACION' | 'INFORME'
export type OrigenRequerimiento = 'LISTA_MEJORAS_PENDIENTES' | 'TIN_NOVA' | 'DESARROLLO_EXTERNO'
export type TipoSolucion = 'DESARROLLO' | 'MEJORA' | 'INTEGRACION' | 'SUPERSET' | 'POR_DEFINIR'
export type ProcesoInterno =
  | 'FINANCIERO' | 'OPERACIONES' | 'COMERCIAL' | 'CARGA'
  | 'SISTEMAS_GESTION' | 'SERVICIO_CLIENTE' | 'COMPRAS'
  | 'SEGUROS' | 'DATOS' | 'TI' | 'GENERAL'
export type Impacta = 'FUNCIONARIOS' | 'CLIENTES' | 'AMBOS'

// ─── Tipos JSONB embebidos ───────────────────────────────────────────────────
export interface ProcesoCargo {
  proceso: string
  cargo: string
  cantidad_usuarios: number
}

export interface ActividadImpacto {
  actividad: string
  cargo_ejecuta?: string | null
  salario_cargo?: number | null
  frecuencia?: string | null
  horas_mes: number
  porcentaje_automatizable: number
}

export interface BeneficioCualitativo {
  descripcion: string
}

export interface BeneficioCualitativoReal {
  descripcion: string
  valor_anual_cop: number
}

// ─── Tabla: requerimientos ───────────────────────────────────────────────────
export interface Requerimiento {
  id: string
  numero: string | null
  alcance: Alcance | null
  identificacion: string
  prioridad: number | null
  estado: Estado
  motivo_stand_by: string | null
  porcentaje_avance: number
  es_borrador: boolean
  fecha_envio_solicitud: string | null
  fecha_solicitud: string | null
  tipo_solicitud: TipoSolicitud | null
  origen_requerimiento: OrigenRequerimiento | null
  empresa: string | null
  sucursal: string | null
  proceso_igsi: string | null
  proceso_interno: ProcesoInterno | null
  responsable: string | null
  partes_interesadas: string[] | null
  nombre_desarrollo: string | null
  tipo_solucion: TipoSolucion | null
  viabilidad_tecnica: boolean | null
  descripcion_situacion_actual: string | null
  definicion_requerimiento: string | null
  objetivo: string | null
  criterios_validacion: string | null
  integra_otros_aplicativos: boolean
  detalle_integracion: string | null
  tipo_operacion_integracion: string[] | null
  definicion_usuarios: string | null
  impacta: Impacta | null
  tipos_cliente: string[] | null
  procesos_cargos: ProcesoCargo[]
  ventajas_beneficios: string | null
  actividades_impacto: ActividadImpacto[]
  salario_promedio_cargo: number | null
  horas_laborales_mes: number
  valor_hora_hombre: number | null
  horas_ahorradas_mes: number | null
  ahorro_mensual_cop: number | null
  ahorro_anual_cop: number | null
  beneficios_cualitativos: BeneficioCualitativo[]
  rama: 'TIN' | 'IA' | null
  fecha_envio_tin: string | null
  fecha_inicio_desarrollo: string | null
  fecha_estimada_entrega: string | null
  fecha_real_entrega: string | null
  inicio_pruebas_usuario: string | null
  fin_pruebas_usuario: string | null
  fecha_salida_vivo: string | null
  fecha_cierre: string | null
  horas_hombre_ahorradas: number | null
  // Campos de migración: cuantificación económica de beneficios cualitativos
  total_beneficios_cualitativos_anual: number | null
  impacto_economico_total_anual: number | null
  // Estimación de horas de desarrollo TIN
  horas_estimadas_desarrollo: number | null
  // Impacto REAL (registrado al finalizar el requerimiento)
  horas_ahorradas_mes_real: number | null
  ahorro_mensual_cop_real: number | null
  ahorro_anual_cop_real: number | null
  beneficios_cualitativos_real: BeneficioCualitativoReal[]
  total_beneficios_cualitativos_anual_real: number | null
  impacto_economico_total_anual_real: number | null
  created_at: string
  updated_at: string
}

// ─── Tabla: historial_estados ─────────────────────────────────────────────────
export interface HistorialEstado {
  id: string
  requerimiento_id: string
  estado_anterior: Estado | null
  estado_nuevo: Estado
  observacion: string | null
  usuario: string | null
  created_at: string
}

// ─── Tabla: comentarios ───────────────────────────────────────────────────────
export interface Comentario {
  id: string
  requerimiento_id: string
  comentario: string
  usuario: string
  created_at: string
}

// ─── Tabla: reuniones ────────────────────────────────────────────────────────
export interface AnexoTareaReunion {
  id: string
  tarea_reunion_id: string
  nombre_archivo: string
  url_storage: string
  tipo_archivo: string | null
  tamanio_bytes: number | null
  created_at: string
}

export interface TareaReunion {
  id: string
  reunion_id: string
  descripcion: string
  responsable_email: string | null
  fecha_inicio: string | null
  fecha_compromiso: string | null
  completada: boolean
  respuesta: string | null
  fecha_cumplimiento: string | null
  motivo_incumplimiento: string | null
  penalizacion_cop: number | null
  created_at: string
  anexos: AnexoTareaReunion[]
}

export interface Reunion {
  id: string
  requerimiento_id: string
  titulo: string
  fecha_reunion: string
  url_video: string | null
  notas: string | null
  created_by: string | null
  created_at: string
  tareas: TareaReunion[]
}

// ─── Tabla: anexos ────────────────────────────────────────────────────────────
export interface Anexo {
  id: string
  requerimiento_id: string
  nombre_archivo: string
  url_storage: string
  tipo_archivo: string | null
  tamanio_bytes: number | null
  created_at: string
}

// ─── Vistas ───────────────────────────────────────────────────────────────────
export interface MetricaRequerimiento extends Requerimiento {
  dias_respuesta_tin: number | null
  dias_en_estado_actual: number | null
  dias_desarrollo: number | null
  dias_pruebas: number | null
  cumple_sla: boolean | null
}

export interface ImpactoEconomico {
  alcance: Alcance | null
  tipo_solucion: TipoSolucion | null
  total_requerimientos: number
  total_horas_mes: number | null
  total_horas_anio: number | null
  total_ahorro_mensual_cop: number | null
  total_ahorro_anual_cop: number | null
  total_cualitativos_anual: number | null
  total_impacto_anual: number | null
  promedio_horas_mes: number | null
}

export interface TopImpacto {
  id: string
  numero: string | null
  identificacion: string
  alcance: Alcance | null
  responsable: string | null
  proceso_interno: ProcesoInterno | null
  prioridad: number | null
  estado: Estado
  horas_ahorradas_mes: number | null
  ahorro_mensual_cop: number | null
  ahorro_anual_cop: number | null
  total_beneficios_cualitativos_anual: number | null
  impacto_economico_total_anual: number | null
}

// ─── Database schema (compatible con supabase-js v2) ────────────────────────
export type Database = {
  public: {
    Tables: {
      requerimientos: {
        Row: Requerimiento
        Insert: {
          id?: string
          numero?: string | null
          alcance?: Alcance | null
          identificacion: string
          prioridad?: number | null
          estado?: Estado
          motivo_stand_by?: string | null
          porcentaje_avance?: number
          es_borrador?: boolean
          fecha_envio_solicitud?: string | null
          fecha_solicitud?: string | null
          tipo_solicitud?: TipoSolicitud | null
          empresa?: string | null
          sucursal?: string | null
          proceso_igsi?: string | null
          proceso_interno?: ProcesoInterno | null
          responsable?: string | null
          partes_interesadas?: string[] | null
          nombre_desarrollo?: string | null
          tipo_solucion?: TipoSolucion | null
          viabilidad_tecnica?: boolean | null
          descripcion_situacion_actual?: string | null
          definicion_requerimiento?: string | null
          objetivo?: string | null
          criterios_validacion?: string | null
          integra_otros_aplicativos?: boolean
          detalle_integracion?: string | null
          tipo_operacion_integracion?: string[] | null
          definicion_usuarios?: string | null
          impacta?: Impacta | null
          tipos_cliente?: string[] | null
          procesos_cargos?: ProcesoCargo[]
          ventajas_beneficios?: string | null
          actividades_impacto?: ActividadImpacto[]
          salario_promedio_cargo?: number | null
          horas_laborales_mes?: number
          valor_hora_hombre?: number | null
          horas_ahorradas_mes?: number | null
          ahorro_mensual_cop?: number | null
          ahorro_anual_cop?: number | null
          beneficios_cualitativos?: BeneficioCualitativo[]
          fecha_envio_tin?: string | null
          fecha_inicio_desarrollo?: string | null
          fecha_estimada_entrega?: string | null
          fecha_real_entrega?: string | null
          inicio_pruebas_usuario?: string | null
          fin_pruebas_usuario?: string | null
          fecha_salida_vivo?: string | null
          fecha_cierre?: string | null
          horas_hombre_ahorradas?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          numero?: string | null
          alcance?: Alcance | null
          identificacion?: string
          prioridad?: number | null
          estado?: Estado
          motivo_stand_by?: string | null
          porcentaje_avance?: number
          es_borrador?: boolean
          fecha_envio_solicitud?: string | null
          fecha_solicitud?: string | null
          tipo_solicitud?: TipoSolicitud | null
          empresa?: string | null
          sucursal?: string | null
          proceso_igsi?: string | null
          proceso_interno?: ProcesoInterno | null
          responsable?: string | null
          partes_interesadas?: string[] | null
          nombre_desarrollo?: string | null
          tipo_solucion?: TipoSolucion | null
          viabilidad_tecnica?: boolean | null
          descripcion_situacion_actual?: string | null
          definicion_requerimiento?: string | null
          objetivo?: string | null
          criterios_validacion?: string | null
          integra_otros_aplicativos?: boolean
          detalle_integracion?: string | null
          tipo_operacion_integracion?: string[] | null
          definicion_usuarios?: string | null
          impacta?: Impacta | null
          tipos_cliente?: string[] | null
          procesos_cargos?: ProcesoCargo[]
          ventajas_beneficios?: string | null
          actividades_impacto?: ActividadImpacto[]
          salario_promedio_cargo?: number | null
          horas_laborales_mes?: number
          valor_hora_hombre?: number | null
          horas_ahorradas_mes?: number | null
          ahorro_mensual_cop?: number | null
          ahorro_anual_cop?: number | null
          beneficios_cualitativos?: BeneficioCualitativo[]
          fecha_envio_tin?: string | null
          fecha_inicio_desarrollo?: string | null
          fecha_estimada_entrega?: string | null
          fecha_real_entrega?: string | null
          inicio_pruebas_usuario?: string | null
          fin_pruebas_usuario?: string | null
          fecha_salida_vivo?: string | null
          fecha_cierre?: string | null
          horas_hombre_ahorradas?: number | null
        }
        Relationships: []
      }
      historial_estados: {
        Row: HistorialEstado
        Insert: {
          id?: string
          requerimiento_id: string
          estado_anterior?: Estado | null
          estado_nuevo: Estado
          observacion?: string | null
          usuario?: string | null
          created_at?: string
        }
        Update: {
          estado_anterior?: Estado | null
          estado_nuevo?: Estado
          observacion?: string | null
          usuario?: string | null
        }
        Relationships: []
      }
      comentarios: {
        Row: Comentario
        Insert: {
          id?: string
          requerimiento_id: string
          comentario: string
          usuario: string
          created_at?: string
        }
        Update: {
          comentario?: string
          usuario?: string
        }
        Relationships: []
      }
      anexos: {
        Row: Anexo
        Insert: {
          id?: string
          requerimiento_id: string
          nombre_archivo: string
          url_storage: string
          tipo_archivo?: string | null
          tamanio_bytes?: number | null
          created_at?: string
        }
        Update: {
          nombre_archivo?: string
          url_storage?: string
          tipo_archivo?: string | null
          tamanio_bytes?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      v_metricas_requerimientos: {
        Row: MetricaRequerimiento
        Relationships: []
      }
      v_impacto_economico: {
        Row: ImpactoEconomico
        Relationships: []
      }
      v_top_impacto: {
        Row: TopImpacto
        Relationships: []
      }
    }
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
