export type TipoPermiso = 'puede_ver' | 'puede_editar' | 'puede_crear'

export interface RecursoSistema {
  id: string
  label: string
  permisos: TipoPermiso[]
}

export interface CategoriaRecursos {
  id: string
  label: string
  icono: string
  recursos: RecursoSistema[]
}

export const CATEGORIAS_RECURSOS: CategoriaRecursos[] = [
  {
    id: 'menus',
    label: 'Menús del sistema',
    icono: 'menu',
    recursos: [
      { id: 'menu:dashboard',             label: 'Dashboard',                permisos: ['puede_ver'] },
      { id: 'menu:requerimientos',        label: 'Requerimientos',           permisos: ['puede_ver'] },
      { id: 'menu:kanban',               label: 'Kanban',                   permisos: ['puede_ver'] },
      { id: 'menu:reportes',             label: 'Reportes',                 permisos: ['puede_ver'] },
      { id: 'menu:reporte-presidencial',    label: 'Reporte Presidencial',     permisos: ['puede_ver'] },
      { id: 'menu:reporte-desarrolladores', label: 'Reporte Desarrolladores',  permisos: ['puede_ver'] },
      { id: 'menu:reporte-prioridades',    label: 'Reporte Prioridades',      permisos: ['puede_ver'] },
      { id: 'menu:usuarios',               label: 'Usuarios',                 permisos: ['puede_ver'] },
      { id: 'menu:configuracion',        label: 'Configuración',            permisos: ['puede_ver'] },
      { id: 'menu:roles',               label: 'Roles y Permisos',         permisos: ['puede_ver'] },
    ],
  },
  {
    id: 'requerimientos',
    label: 'Requerimientos — acciones',
    icono: 'req',
    recursos: [
      { id: 'req:general',    label: 'Acceso a requerimientos', permisos: ['puede_ver', 'puede_crear', 'puede_editar'] },
      { id: 'req:estado',     label: 'Cambiar estado',          permisos: ['puede_editar'] },
      { id: 'req:prioridad',  label: 'Asignar prioridad',       permisos: ['puede_editar'] },
    ],
  },
  {
    id: 'req_tabs',
    label: 'Requerimientos — pestañas',
    icono: 'tabs',
    recursos: [
      { id: 'req:informacion',    label: 'Información',    permisos: ['puede_ver', 'puede_editar'] },
      { id: 'req:desarrollo',     label: 'Desarrollo',     permisos: ['puede_ver', 'puede_editar'] },
      { id: 'req:impacto-hh',    label: 'Impacto HH',     permisos: ['puede_ver', 'puede_editar'] },
      { id: 'req:historial',      label: 'Historial',      permisos: ['puede_ver'] },
      { id: 'req:impacto-real',  label: 'Impacto Real',   permisos: ['puede_ver', 'puede_editar'] },
      { id: 'req:reuniones',      label: 'Reuniones',      permisos: ['puede_ver', 'puede_editar', 'puede_crear'] },
      { id: 'req:penalizaciones', label: 'Penalizaciones', permisos: ['puede_ver', 'puede_editar'] },
      { id: 'req:comentarios',    label: 'Comentarios',    permisos: ['puede_ver', 'puede_crear'] },
      { id: 'req:anexos',         label: 'Anexos',         permisos: ['puede_ver', 'puede_crear'] },
    ],
  },
]

export const TODOS_RECURSOS: RecursoSistema[] = CATEGORIAS_RECURSOS.flatMap(c => c.recursos)

export const LABELS_PERMISO: Record<TipoPermiso, string> = {
  puede_ver:    'Ver',
  puede_editar: 'Editar',
  puede_crear:  'Crear',
}
