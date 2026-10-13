-- ── Control de cambios por requerimiento ─────────────────────────────────────
-- Documenta cada solicitud de cambio que surge de un requerimiento: qué cambia, por qué,
-- su impacto, la decisión tomada y su implementación, con bitácora y anexos de soporte.

CREATE TABLE IF NOT EXISTS control_cambios (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  requerimiento_id        uuid        NOT NULL REFERENCES requerimientos(id) ON DELETE CASCADE,
  consecutivo             integer     NOT NULL,
  titulo                  text        NOT NULL,
  tipo                    text        NOT NULL DEFAULT 'FUNCIONAL',   -- ALCANCE | FUNCIONAL | TECNICO | CRONOGRAMA | DATOS | OTRO
  descripcion             text        NOT NULL,                       -- qué cambia
  justificacion           text,                                       -- por qué se solicita
  solicitado_por          text,
  fecha_solicitud         date        NOT NULL DEFAULT current_date,
  impacto_descripcion     text,
  impacto_dias            integer,                                    -- días adicionales en el cronograma
  impacto_horas           numeric,
  impacto_costo           numeric,
  estado                  text        NOT NULL DEFAULT 'SOLICITADO',  -- SOLICITADO | EN_EVALUACION | APROBADO | RECHAZADO | IMPLEMENTADO
  decision_por            text,
  fecha_decision          date,
  observaciones_decision  text,
  version                 text,                                       -- versión del entregable que incorpora el cambio
  fecha_implementacion    date,
  created_by              text,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  UNIQUE (requerimiento_id, consecutivo)
);

CREATE INDEX IF NOT EXISTS idx_control_cambios_requerimiento_id ON control_cambios(requerimiento_id);

-- Bitácora: creación, ediciones y cambios de estado
CREATE TABLE IF NOT EXISTS control_cambios_eventos (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  control_cambio_id uuid        NOT NULL REFERENCES control_cambios(id) ON DELETE CASCADE,
  accion            text        NOT NULL,   -- CREADO | EDITADO | ESTADO
  estado_anterior   text,
  estado_nuevo      text,
  comentario        text,
  usuario           text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_control_cambios_eventos_cambio ON control_cambios_eventos(control_cambio_id);

-- Anexos de soporte (archivos en Firebase Storage)
CREATE TABLE IF NOT EXISTS control_cambios_anexos (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  control_cambio_id uuid        NOT NULL REFERENCES control_cambios(id) ON DELETE CASCADE,
  nombre_archivo    text        NOT NULL,
  url_storage       text        NOT NULL,
  tipo_archivo      text,
  tamanio_bytes     bigint,
  subido_por        text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_control_cambios_anexos_cambio ON control_cambios_anexos(control_cambio_id);

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE control_cambios         ENABLE ROW LEVEL SECURITY;
ALTER TABLE control_cambios_eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE control_cambios_anexos  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acceso autenticado a control_cambios" ON control_cambios;
CREATE POLICY "Acceso autenticado a control_cambios"
  ON control_cambios FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acceso autenticado a control_cambios_eventos" ON control_cambios_eventos;
CREATE POLICY "Acceso autenticado a control_cambios_eventos"
  ON control_cambios_eventos FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acceso autenticado a control_cambios_anexos" ON control_cambios_anexos;
CREATE POLICY "Acceso autenticado a control_cambios_anexos"
  ON control_cambios_anexos FOR ALL TO authenticated USING (true) WITH CHECK (true);
