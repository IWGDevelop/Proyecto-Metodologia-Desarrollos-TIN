-- ═════════════════════════════════════════════════════════════════════════════
-- Módulo Tickets TIN-FLOW — esquema base
-- Catálogo parametrizable, tickets, historial inmodificable, tiempos,
-- recordatorios, bugs de IGSI y plantillas de ingreso/retiro.
-- Los datos iniciales (catálogo, causas, reglas, festivos…) están en
-- migration_tickets_seed.sql, que se ejecuta después de este archivo.
--
-- Todo el acceso a datos pasa por Server Actions con createAdminClient()
-- y las validaciones de src/lib/supabase/guards.ts; por eso las tablas de
-- tickets tienen RLS activo sin políticas para `authenticated` (solo
-- service_role), salvo el catálogo, que es de lectura para autenticados.
-- ═════════════════════════════════════════════════════════════════════════════

-- ── Perfiles: datos del solicitante que el ticket necesita ───────────────────
ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS jefe_id uuid REFERENCES perfiles(id) ON DELETE SET NULL;
ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS sede text;

-- ── Catálogo ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ticket_categorias (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      text NOT NULL UNIQUE,
  descripcion text,
  orden       int  NOT NULL DEFAULT 0,
  activa      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ticket_tipologias (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria_id            uuid NOT NULL REFERENCES ticket_categorias(id) ON DELETE RESTRICT,
  nombre                  text NOT NULL,
  -- Texto de ayuda: qué información se le pide al funcionario
  descripcion_ayuda       text,
  tipo_gestion            text NOT NULL CHECK (tipo_gestion IN ('INCIDENTE','SOLICITUD','PLANIFICADA')),
  se_mide_contra          text NOT NULL CHECK (se_mide_contra IN ('SLA','FECHA','FECHA_SIN_APROBACION')),
  prioridad_defecto       text CHECK (prioridad_defecto IN ('CRITICA','ALTA','MEDIA','BAJA')),
  requiere_aprobacion     boolean NOT NULL DEFAULT false,
  visibilidad_restringida boolean NOT NULL DEFAULT false,
  adjunto_obligatorio     boolean NOT NULL DEFAULT false,
  -- Usa el formulario propio de Novedades IGSI (ticket_novedades_igsi)
  es_novedad_igsi         boolean NOT NULL DEFAULT false,
  area_responsable        text,
  -- Regla automática de asignación: si tiene valor, el ticket nace Asignado a este responsable
  responsable_defecto_id  uuid REFERENCES perfiles(id) ON DELETE SET NULL,
  orden                   int  NOT NULL DEFAULT 0,
  activa                  boolean NOT NULL DEFAULT true,
  created_at              timestamptz NOT NULL DEFAULT now(),
  UNIQUE (categoria_id, nombre)
);
CREATE INDEX IF NOT EXISTS idx_ticket_tipologias_categoria ON ticket_tipologias(categoria_id);

-- Campos específicos que el formulario muestra según la tipología
CREATE TABLE IF NOT EXISTS ticket_campos_tipologia (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipologia_id uuid NOT NULL REFERENCES ticket_tipologias(id) ON DELETE CASCADE,
  -- Clave estable (snake_case) para exportes e informes
  clave        text NOT NULL,
  etiqueta     text NOT NULL,
  tipo_dato    text NOT NULL CHECK (tipo_dato IN ('TEXTO','TEXTO_LARGO','NUMERO','FECHA','LISTA','CASILLA','USUARIO')),
  obligatorio  boolean NOT NULL DEFAULT false,
  orden        int  NOT NULL DEFAULT 0,
  -- Para LISTA: arreglo JSON de strings
  opciones     jsonb,
  ayuda        text,
  -- Si es true, el valor de este campo se copia a tickets.fecha_requerida
  es_fecha_requerida boolean NOT NULL DEFAULT false,
  activo       boolean NOT NULL DEFAULT true,
  UNIQUE (tipologia_id, clave)
);
CREATE INDEX IF NOT EXISTS idx_ticket_campos_tipologia ON ticket_campos_tipologia(tipologia_id);

-- Causas de cierre. ambito IGSI = técnica/conceptual de novedades IGSI; GENERAL = resto de tickets
CREATE TABLE IF NOT EXISTS ticket_causas (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ambito     text NOT NULL CHECK (ambito IN ('IGSI','GENERAL')),
  tipo_causa text NOT NULL,
  subcausa   text NOT NULL,
  orden      int  NOT NULL DEFAULT 0,
  activa     boolean NOT NULL DEFAULT true,
  UNIQUE (ambito, tipo_causa, subcausa)
);

-- ── Tickets ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tickets (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Consecutivo visible: TK-0001 (ver codigoTicket() en src/lib/tickets/constantes.ts)
  numero                  bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
  solicitante_id          uuid NOT NULL REFERENCES perfiles(id),
  -- Copia del perfil al crear (proceso_interno y sede), para indicadores por área
  area                    text,
  sede                    text,
  categoria_id            uuid NOT NULL REFERENCES ticket_categorias(id),
  tipologia_id            uuid NOT NULL REFERENCES ticket_tipologias(id),
  impacto                 text NOT NULL CHECK (impacto IN ('SOLO_YO','MI_AREA','DETIENE_OPERACION')),
  prioridad               text NOT NULL CHECK (prioridad IN ('CRITICA','ALTA','MEDIA','BAJA')),
  estado                  text NOT NULL DEFAULT 'ABIERTO' CHECK (estado IN (
                            'ABIERTO','ASIGNADO','EN_PROCESO','ESPERA_APROBACION',
                            'ESPERA_USUARIO','ESPERA_PROVEEDOR','RESUELTO','CERRADO')),
  responsable_id          uuid REFERENCES perfiles(id) ON DELETE SET NULL,
  -- Jefe que aprueba (copia de perfiles.jefe_id al crear, si la tipología requiere aprobación)
  aprobador_id            uuid REFERENCES perfiles(id) ON DELETE SET NULL,
  ticket_padre_id         uuid REFERENCES tickets(id) ON DELETE SET NULL,
  plantilla_id            uuid,
  canal                   text NOT NULL DEFAULT 'FORMULARIO' CHECK (canal IN ('FORMULARIO','CORREO')),
  asunto                  text NOT NULL,
  descripcion             text NOT NULL,
  fecha_requerida         date,
  -- Marcas del motor de recordatorios
  respuesta_vencida       boolean NOT NULL DEFAULT false,
  solucion_vencida        boolean NOT NULL DEFAULT false,
  -- Fechas de hitos (también derivables del historial; se guardan para consultas rápidas)
  fecha_creacion          timestamptz NOT NULL DEFAULT now(),
  fecha_asignacion        timestamptz,
  fecha_primera_respuesta timestamptz,
  fecha_resuelto          timestamptz,
  fecha_cierre            timestamptz,
  cierre_automatico       boolean NOT NULL DEFAULT false,
  reaperturas             int NOT NULL DEFAULT 0,
  updated_at              timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tickets_solicitante ON tickets(solicitante_id);
CREATE INDEX IF NOT EXISTS idx_tickets_responsable ON tickets(responsable_id);
CREATE INDEX IF NOT EXISTS idx_tickets_estado      ON tickets(estado);
CREATE INDEX IF NOT EXISTS idx_tickets_tipologia   ON tickets(tipologia_id);
CREATE INDEX IF NOT EXISTS idx_tickets_padre       ON tickets(ticket_padre_id);
CREATE INDEX IF NOT EXISTS idx_tickets_aprobador   ON tickets(aprobador_id);

CREATE TABLE IF NOT EXISTS ticket_valores_campo (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  campo_id  uuid NOT NULL REFERENCES ticket_campos_tipologia(id),
  valor     text,
  UNIQUE (ticket_id, campo_id)
);

-- Detalle de la novedad IGSI (1 a 1 con tickets)
CREATE TABLE IF NOT EXISTS ticket_novedades_igsi (
  ticket_id               uuid PRIMARY KEY REFERENCES tickets(id) ON DELETE CASCADE,
  tipo_documento          text NOT NULL CHECK (tipo_documento IN ('SS','DO','REMESA','MANIFIESTO','OTRO')),
  tipo_documento_otro     text,
  numero_documento        text,
  documentos_relacionados text,
  servicio                text NOT NULL,
  modalidad               text NOT NULL,
  accion                  text NOT NULL CHECK (accion IN ('CREAR','MODIFICAR','ANULAR','LIQUIDAR','IMPRIMIR','REPORTAR','CONSULTAR','OTRA')),
  que_paso                text NOT NULL,
  que_esperaba            text NOT NULL,
  mensaje_error           text,
  validacion_previa       boolean NOT NULL DEFAULT false,
  impacto_operacion       text NOT NULL CHECK (impacto_operacion IN ('DETIENE','RETRASA','NO_AFECTA'))
);

-- Solución / cierre que registra TIN al pasar a Resuelto
CREATE TABLE IF NOT EXISTS ticket_cierres (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id             uuid NOT NULL UNIQUE REFERENCES tickets(id) ON DELETE CASCADE,
  causa_id              uuid NOT NULL REFERENCES ticket_causas(id),
  respuesta             text NOT NULL,
  requiere_capacitacion boolean NOT NULL DEFAULT false,
  requiere_ajuste       boolean NOT NULL DEFAULT false,
  cerrado_por           uuid REFERENCES perfiles(id),
  fecha                 timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ticket_adjuntos (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id      uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  nombre_archivo text NOT NULL,
  tipo_archivo   text,
  tamano         bigint,
  -- URL pública de descarga (Firebase Storage) y ruta interna del objeto
  url            text NOT NULL,
  ruta           text,
  es_imagen      boolean NOT NULL DEFAULT false,
  cargado_por    uuid REFERENCES perfiles(id),
  fecha          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ticket_adjuntos_ticket ON ticket_adjuntos(ticket_id);

-- ── Historial inmodificable ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ticket_historial (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ticket_id       uuid NOT NULL REFERENCES tickets(id) ON DELETE RESTRICT,
  tipo_evento     text NOT NULL CHECK (tipo_evento IN (
                    'CREACION','ASIGNACION','CAMBIO_ESTADO','CAMBIO_PRIORIDAD','CAMBIO_TIPOLOGIA',
                    'COMENTARIO','ADJUNTO','RECORDATORIO','APROBACION','RECHAZO',
                    'CLASIFICACION_CAUSA','ENLACE_BUG','REAPERTURA','CIERRE','PRIMERA_RESPUESTA')),
  campo           text,
  valor_anterior  text,
  valor_nuevo     text,
  -- null = sistema (regla automática, cron)
  usuario_id      uuid REFERENCES perfiles(id),
  fecha           timestamptz NOT NULL DEFAULT now(),
  comentario      text,
  visible_usuario boolean NOT NULL DEFAULT false,
  metadata        jsonb
);
CREATE INDEX IF NOT EXISTS idx_ticket_historial_ticket ON ticket_historial(ticket_id, fecha);

CREATE OR REPLACE FUNCTION ticket_historial_inmodificable() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'El historial de tickets no se puede modificar ni borrar';
END;
$$;

DROP TRIGGER IF EXISTS trg_ticket_historial_inmodificable ON ticket_historial;
CREATE TRIGGER trg_ticket_historial_inmodificable
  BEFORE UPDATE OR DELETE ON ticket_historial
  FOR EACH ROW EXECUTE FUNCTION ticket_historial_inmodificable();

-- ── Tiempos ──────────────────────────────────────────────────────────────────
-- Calculados desde el historial, en horas hábiles (ver src/lib/tickets/tiempos.ts)
CREATE TABLE IF NOT EXISTS ticket_tiempos (
  ticket_id             uuid PRIMARY KEY REFERENCES tickets(id) ON DELETE CASCADE,
  t_asignacion          numeric,
  t_primera_respuesta   numeric,
  t_solucion            numeric,
  t_espera_aprobacion   numeric NOT NULL DEFAULT 0,
  t_espera_usuario      numeric NOT NULL DEFAULT 0,
  t_espera_proveedor    numeric NOT NULL DEFAULT 0,
  t_confirmacion        numeric,
  t_total               numeric,
  -- Horas hábiles consumidas (sin esperas) a la fecha del cálculo, para abiertos
  t_consumido           numeric,
  reaperturas           int NOT NULL DEFAULT 0,
  cumple_respuesta      boolean,
  cumple_solucion       boolean,
  -- Tipologías medidas por fecha: días hábiles antes (+) o después (-) de la fecha requerida
  dias_vs_fecha_requerida int,
  calculado_en          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ticket_objetivos_tiempo (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prioridad      text NOT NULL CHECK (prioridad IN ('CRITICA','ALTA','MEDIA','BAJA')),
  horas_respuesta numeric NOT NULL CHECK (horas_respuesta > 0),
  horas_solucion  numeric NOT NULL CHECK (horas_solucion > 0),
  vigente_desde  date NOT NULL DEFAULT current_date,
  -- false mientras la Dirección de TI no los apruebe (valores de ejemplo)
  aprobado       boolean NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (prioridad, vigente_desde)
);

-- Excepciones al horario laboral (festivos, jornadas especiales).
-- El horario general está en ticket_config.horario_laboral.
CREATE TABLE IF NOT EXISTS ticket_calendario (
  fecha       date PRIMARY KEY,
  es_habil    boolean NOT NULL DEFAULT false,
  hora_inicio time,
  hora_fin    time,
  descripcion text
);

-- Parámetros generales (clave/valor). Ver claves en src/lib/tickets/constantes.ts (CONFIG_CLAVES)
CREATE TABLE IF NOT EXISTS ticket_config (
  clave       text PRIMARY KEY,
  valor       jsonb NOT NULL,
  descripcion text,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ── Recordatorios ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ticket_reglas_recordatorio (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo        text NOT NULL UNIQUE,
  nombre        text NOT NULL,
  disparador    text NOT NULL CHECK (disparador IN (
                  'RESPUESTA','SOLUCION','ESPERA_USUARIO','ESPERA_APROBACION','FECHA_REQUERIDA','RESUMEN_DIARIO')),
  -- RESPUESTA/SOLUCION: % del tiempo objetivo consumido
  porcentaje    numeric,
  -- ESPERA_*: días hábiles en el estado; FECHA_REQUERIDA: días hábiles antes de la fecha
  dias_habiles  numeric,
  -- Roles destinatarios: RESPONSABLE, COORDINADOR, DIRECCION, SOLICITANTE, JEFE_SOLICITANTE, APROBADOR
  destinatarios text[] NOT NULL DEFAULT '{}',
  canal         text NOT NULL CHECK (canal IN ('APP','CORREO','AMBOS')),
  plantilla     text,
  -- Efecto adicional al disparar: MARCAR_RESPUESTA_VENCIDA, MARCAR_VENCIDO, CIERRE_AUTOMATICO
  accion        text CHECK (accion IN ('MARCAR_RESPUESTA_VENCIDA','MARCAR_VENCIDO','CIERRE_AUTOMATICO')),
  orden         int NOT NULL DEFAULT 0,
  activa        boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS ticket_recordatorios (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id     uuid REFERENCES tickets(id) ON DELETE CASCADE,
  regla_id      uuid NOT NULL REFERENCES ticket_reglas_recordatorio(id) ON DELETE CASCADE,
  nivel         int NOT NULL DEFAULT 1,
  destinatarios text[] NOT NULL DEFAULT '{}',
  -- Clave para no repetir un recordatorio: ticket + regla + "ciclo" (ej. número de entrada al estado de espera)
  clave_unica   text NOT NULL UNIQUE,
  fecha_envio   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ticket_recordatorios_ticket ON ticket_recordatorios(ticket_id);

-- Avisos dentro de TIN-FLOW (canal APP)
CREATE TABLE IF NOT EXISTS ticket_notificaciones (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  ticket_id  uuid REFERENCES tickets(id) ON DELETE CASCADE,
  mensaje    text NOT NULL,
  leida      boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ticket_notificaciones_usuario ON ticket_notificaciones(usuario_id, leida);

-- ── Bugs y deuda técnica de IGSI ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ticket_bugs (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Consecutivo visible: B-001 (ver codigoBug())
  numero               bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
  titulo               text NOT NULL,
  descripcion          text,
  clasificacion        text NOT NULL CHECK (clasificacion IN ('BUG','DEUDA_TECNICA','PARAMETRIZACION','INFRAESTRUCTURA')),
  severidad            text NOT NULL CHECK (severidad IN ('BLOQUEANTE','ALTA','MEDIA','BAJA')),
  tipo_documento       text CHECK (tipo_documento IN ('SS','DO','REMESA','MANIFIESTO','OTRO')),
  modulo               text,
  estado               text NOT NULL DEFAULT 'REPORTADO' CHECK (estado IN (
                         'REPORTADO','CONFIRMADO','PRIORIZADO','EN_DESARROLLO','EN_PRUEBAS','DESPLEGADO')),
  solucion_provisional text,
  responsable_id       uuid REFERENCES perfiles(id) ON DELETE SET NULL,
  -- Enlace opcional al requerimiento de desarrollo de TIN-FLOW que lo corrige
  requerimiento_id     uuid REFERENCES requerimientos(id) ON DELETE SET NULL,
  fecha_detectado      timestamptz NOT NULL DEFAULT now(),
  fecha_desplegado     timestamptz,
  version              text,
  created_by           uuid REFERENCES perfiles(id),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ticket_bug_tickets (
  ticket_id    uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  bug_id       uuid NOT NULL REFERENCES ticket_bugs(id) ON DELETE CASCADE,
  fecha_enlace timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ticket_id, bug_id)
);

-- ── Plantillas de ingreso y retiro ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ticket_plantillas (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      text NOT NULL UNIQUE,
  descripcion text,
  activa      boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS ticket_plantilla_items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plantilla_id uuid NOT NULL REFERENCES ticket_plantillas(id) ON DELETE CASCADE,
  tipologia_id uuid NOT NULL REFERENCES ticket_tipologias(id),
  -- Asunto del ticket hijo, ej. "Crear usuario y permisos en IGSI"
  asunto       text,
  orden        int NOT NULL DEFAULT 0
);

ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_plantilla_id_fkey;
ALTER TABLE tickets ADD CONSTRAINT tickets_plantilla_id_fkey
  FOREIGN KEY (plantilla_id) REFERENCES ticket_plantillas(id) ON DELETE SET NULL;

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE ticket_categorias          ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_tipologias          ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_campos_tipologia    ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_causas              ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_valores_campo       ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_novedades_igsi      ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_cierres             ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_adjuntos            ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_historial           ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_tiempos             ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_objetivos_tiempo    ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_calendario          ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_config              ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_reglas_recordatorio ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_recordatorios       ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_notificaciones      ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_bugs                ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_bug_tickets         ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_plantillas          ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_plantilla_items     ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lectura catálogo ticket_categorias" ON ticket_categorias;
CREATE POLICY "Lectura catálogo ticket_categorias" ON ticket_categorias FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Lectura catálogo ticket_tipologias" ON ticket_tipologias;
CREATE POLICY "Lectura catálogo ticket_tipologias" ON ticket_tipologias FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Lectura catálogo ticket_campos_tipologia" ON ticket_campos_tipologia;
CREATE POLICY "Lectura catálogo ticket_campos_tipologia" ON ticket_campos_tipologia FOR SELECT TO authenticated USING (true);

-- ── Permisos: ADMIN_TIN tiene todos los recursos del módulo ──────────────────
INSERT INTO permisos_rol (rol_id, recurso, puede_ver, puede_editar, puede_crear)
SELECT r.id, x.recurso, true, true, true
FROM roles_personalizados r
CROSS JOIN (VALUES
  ('menu:tickets'), ('menu:tickets-dashboard'), ('menu:tickets-bugs'), ('menu:tickets-config'),
  ('tickets:atender'), ('tickets:coordinar'), ('tickets:restringidas')
) AS x(recurso)
WHERE r.nombre = 'ADMIN_TIN'
ON CONFLICT (rol_id, recurso) DO NOTHING;
