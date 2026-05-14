-- ============================================================
-- SCHEMA COMPLETO - Gestión de Requerimientos TIN
-- Ejecutar en el SQL Editor de Supabase
-- ============================================================

-- ============================================================
-- EXTENSIONES
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ============================================================
-- TABLA: requerimientos
-- ============================================================
CREATE TABLE IF NOT EXISTS requerimientos (

  -- Identificación
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero                      TEXT,
  alcance                     TEXT CHECK (alcance IN ('IWF','ILT','IWG')),
  identificacion              TEXT NOT NULL,
  prioridad                   INTEGER CHECK (prioridad BETWEEN 1 AND 4),
  estado                      TEXT DEFAULT 'SIN_GESTION' CHECK (estado IN (
                                'SIN_GESTION','ANALISIS','EN_DESARROLLO',
                                'PRUEBAS_USUARIO','STAND_BY','ENTREGADO','CERRADO')),
  motivo_stand_by             TEXT,
  porcentaje_avance           INTEGER DEFAULT 0 CHECK (porcentaje_avance BETWEEN 0 AND 100),
  es_borrador                 BOOLEAN DEFAULT true,
  fecha_envio_solicitud       TIMESTAMP WITH TIME ZONE,

  -- Sección 2: Solicitante
  fecha_solicitud             DATE DEFAULT CURRENT_DATE,
  tipo_solicitud              TEXT CHECK (tipo_solicitud IN (
                                'NUEVO_DESARROLLO','MEJORA','INTEGRACION','INFORME')),
  empresa                     TEXT,
  sucursal                    TEXT,
  proceso_igsi                TEXT,
  proceso_interno             TEXT CHECK (proceso_interno IN (
                                'FINANCIERO','OPERACIONES','COMERCIAL','CARGA',
                                'SISTEMAS_GESTION','SERVICIO_CLIENTE','COMPRAS',
                                'SEGUROS','DATOS','TI','GENERAL')),
  responsable                 TEXT,
  partes_interesadas          TEXT[],
  nombre_desarrollo           TEXT,
  tipo_solucion               TEXT CHECK (tipo_solucion IN (
                                'DESARROLLO','MEJORA','INTEGRACION','SUPERSET','POR_DEFINIR')),
  viabilidad_tecnica          BOOLEAN,

  -- Sección 3: Descripción
  descripcion_situacion_actual TEXT,
  definicion_requerimiento     TEXT,
  objetivo                     TEXT,
  criterios_validacion         TEXT,
  integra_otros_aplicativos    BOOLEAN DEFAULT false,
  detalle_integracion          TEXT,
  tipo_operacion_integracion   TEXT[],
  definicion_usuarios          TEXT,

  -- Sección 4: Alcance
  impacta                     TEXT CHECK (impacta IN ('FUNCIONARIOS','CLIENTES','AMBOS')),
  tipos_cliente               TEXT[],
  procesos_cargos             JSONB DEFAULT '[]'::jsonb,
  ventajas_beneficios         TEXT,

  -- Sección 5: Impacto y horas hombre
  actividades_impacto         JSONB DEFAULT '[]'::jsonb,
  salario_promedio_cargo      DECIMAL(15,2),
  horas_laborales_mes         INTEGER DEFAULT 192,
  valor_hora_hombre           DECIMAL(15,2),
  horas_ahorradas_mes         DECIMAL(10,2),
  ahorro_mensual_cop          DECIMAL(15,2),
  ahorro_anual_cop            DECIMAL(15,2),
  beneficios_cualitativos     JSONB DEFAULT '[]'::jsonb,

  -- Sección 6: Seguimiento TIN
  fecha_envio_tin             DATE,
  fecha_inicio_desarrollo     DATE,
  fecha_estimada_entrega      DATE,
  fecha_real_entrega          DATE,
  inicio_pruebas_usuario      DATE,
  fin_pruebas_usuario         DATE,
  fecha_salida_vivo           DATE,
  fecha_cierre                DATE,
  horas_hombre_ahorradas      DECIMAL(10,2),

  -- Auditoría
  created_at                  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at                  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- ============================================================
-- TABLA: historial_estados
-- ============================================================
CREATE TABLE IF NOT EXISTS historial_estados (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requerimiento_id    UUID REFERENCES requerimientos(id) ON DELETE CASCADE,
  estado_anterior     TEXT,
  estado_nuevo        TEXT NOT NULL,
  observacion         TEXT,
  usuario             TEXT,
  created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- ============================================================
-- TABLA: comentarios
-- ============================================================
CREATE TABLE IF NOT EXISTS comentarios (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requerimiento_id    UUID REFERENCES requerimientos(id) ON DELETE CASCADE,
  comentario          TEXT NOT NULL,
  usuario             TEXT NOT NULL,
  created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- ============================================================
-- TABLA: anexos
-- ============================================================
CREATE TABLE IF NOT EXISTS anexos (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requerimiento_id    UUID REFERENCES requerimientos(id) ON DELETE CASCADE,
  nombre_archivo      TEXT NOT NULL,
  url_storage         TEXT NOT NULL,
  tipo_archivo        TEXT,
  tamanio_bytes       INTEGER,
  created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- ============================================================
-- TRIGGERS
-- ============================================================

-- 1. Actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_requerimientos_updated_at
  BEFORE UPDATE ON requerimientos
  FOR EACH ROW
  EXECUTE FUNCTION fn_set_updated_at();


-- 2. Registrar cambios de estado en historial_estados
CREATE OR REPLACE FUNCTION fn_historial_estado()
RETURNS TRIGGER AS $$
BEGIN
  IF (OLD.estado IS DISTINCT FROM NEW.estado) THEN
    INSERT INTO historial_estados (
      requerimiento_id,
      estado_anterior,
      estado_nuevo,
      usuario
    ) VALUES (
      NEW.id,
      OLD.estado,
      NEW.estado,
      current_user
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_requerimientos_historial_estado
  AFTER UPDATE ON requerimientos
  FOR EACH ROW
  EXECUTE FUNCTION fn_historial_estado();


-- ============================================================
-- VISTAS
-- ============================================================

-- 1. v_metricas_requerimientos
CREATE OR REPLACE VIEW v_metricas_requerimientos AS
SELECT
  r.*,
  -- Días desde envío TIN hasta inicio de desarrollo
  (r.fecha_inicio_desarrollo - r.fecha_envio_tin)                    AS dias_respuesta_tin,
  -- Días transcurridos en el estado actual
  (NOW()::date - r.updated_at::date)                                 AS dias_en_estado_actual,
  -- Días de desarrollo efectivo
  (r.fecha_real_entrega - r.fecha_inicio_desarrollo)                 AS dias_desarrollo,
  -- Días de pruebas de usuario
  (r.fin_pruebas_usuario - r.inicio_pruebas_usuario)                 AS dias_pruebas,
  -- Cumplimiento de SLA según prioridad
  CASE
    WHEN r.prioridad = 1 AND (r.fecha_inicio_desarrollo - r.fecha_envio_tin) <= 5  THEN true
    WHEN r.prioridad = 2 AND (r.fecha_inicio_desarrollo - r.fecha_envio_tin) <= 15 THEN true
    WHEN r.prioridad = 3 AND (r.fecha_inicio_desarrollo - r.fecha_envio_tin) <= 30 THEN true
    WHEN r.prioridad = 4 AND (r.fecha_inicio_desarrollo - r.fecha_envio_tin) <= 60 THEN true
    WHEN r.fecha_envio_tin IS NULL OR r.fecha_inicio_desarrollo IS NULL            THEN NULL
    ELSE false
  END                                                                AS cumple_sla
FROM requerimientos r;


-- 2. v_impacto_economico
CREATE OR REPLACE VIEW v_impacto_economico AS
SELECT
  alcance,
  tipo_solucion,
  COUNT(*)                             AS total_requerimientos,
  SUM(horas_ahorradas_mes)             AS total_horas_mes,
  SUM(horas_ahorradas_mes * 12)        AS total_horas_anio,
  SUM(ahorro_mensual_cop)              AS total_ahorro_mensual_cop,
  SUM(ahorro_anual_cop)                AS total_ahorro_anual_cop,
  AVG(horas_ahorradas_mes)             AS promedio_horas_mes
FROM requerimientos
WHERE es_borrador = false
GROUP BY alcance, tipo_solucion;


-- 3. v_top_impacto
CREATE OR REPLACE VIEW v_top_impacto AS
SELECT
  id,
  numero,
  identificacion,
  alcance,
  responsable,
  proceso_interno,
  prioridad,
  estado,
  horas_ahorradas_mes,
  ahorro_mensual_cop,
  ahorro_anual_cop
FROM requerimientos
WHERE es_borrador = false
  AND ahorro_anual_cop IS NOT NULL
ORDER BY ahorro_anual_cop DESC
LIMIT 20;


-- ============================================================
-- ÍNDICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_req_estado             ON requerimientos (estado);
CREATE INDEX IF NOT EXISTS idx_req_prioridad          ON requerimientos (prioridad);
CREATE INDEX IF NOT EXISTS idx_req_alcance            ON requerimientos (alcance);
CREATE INDEX IF NOT EXISTS idx_req_tipo_solucion      ON requerimientos (tipo_solucion);
CREATE INDEX IF NOT EXISTS idx_req_es_borrador        ON requerimientos (es_borrador);
CREATE INDEX IF NOT EXISTS idx_req_fecha_envio_tin    ON requerimientos (fecha_envio_tin);
CREATE INDEX IF NOT EXISTS idx_req_ahorro_anual_cop   ON requerimientos (ahorro_anual_cop DESC);

-- Índices auxiliares en tablas relacionadas
CREATE INDEX IF NOT EXISTS idx_historial_req_id       ON historial_estados (requerimiento_id);
CREATE INDEX IF NOT EXISTS idx_comentarios_req_id     ON comentarios (requerimiento_id);
CREATE INDEX IF NOT EXISTS idx_anexos_req_id          ON anexos (requerimiento_id);


-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Habilitar RLS en todas las tablas
ALTER TABLE requerimientos    ENABLE ROW LEVEL SECURITY;
ALTER TABLE historial_estados ENABLE ROW LEVEL SECURITY;
ALTER TABLE comentarios       ENABLE ROW LEVEL SECURITY;
ALTER TABLE anexos            ENABLE ROW LEVEL SECURITY;

-- Políticas permisivas temporales (se restringirán en fase posterior)

-- requerimientos
CREATE POLICY "allow_all_requerimientos"
  ON requerimientos FOR ALL
  USING (true)
  WITH CHECK (true);

-- historial_estados
CREATE POLICY "allow_all_historial"
  ON historial_estados FOR ALL
  USING (true)
  WITH CHECK (true);

-- comentarios
CREATE POLICY "allow_all_comentarios"
  ON comentarios FOR ALL
  USING (true)
  WITH CHECK (true);

-- anexos
CREATE POLICY "allow_all_anexos"
  ON anexos FOR ALL
  USING (true)
  WITH CHECK (true);


-- ============================================================
-- STORAGE: bucket requerimientos-anexos
-- ============================================================

-- Crear el bucket público
INSERT INTO storage.buckets (id, name, public)
VALUES ('requerimientos-anexos', 'requerimientos-anexos', true)
ON CONFLICT (id) DO NOTHING;

-- Política: permitir SELECT público (lectura)
CREATE POLICY "allow_public_select_anexos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'requerimientos-anexos');

-- Política: permitir INSERT (subida de archivos)
CREATE POLICY "allow_public_insert_anexos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'requerimientos-anexos');

-- Política: permitir UPDATE
CREATE POLICY "allow_public_update_anexos"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'requerimientos-anexos')
  WITH CHECK (bucket_id = 'requerimientos-anexos');

-- Política: permitir DELETE
CREATE POLICY "allow_public_delete_anexos"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'requerimientos-anexos');


-- ============================================================
-- FIN DEL SCRIPT
-- ============================================================
