-- ── Tabla: planeacion_etapas ─────────────────────────────────────────────────
-- Fechas planeadas de inicio y fin por etapa (estado del Kanban) de cada requerimiento.
-- Se contrastan contra lo ejecutado, que sale de historial_estados.
CREATE TABLE IF NOT EXISTS planeacion_etapas (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  requerimiento_id  uuid        NOT NULL REFERENCES requerimientos(id) ON DELETE CASCADE,
  estado            text        NOT NULL,
  fecha_inicio      date,
  fecha_fin         date,
  updated_by        text,
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (requerimiento_id, estado),
  CHECK (fecha_inicio IS NULL OR fecha_fin IS NULL OR fecha_inicio <= fecha_fin)
);

CREATE INDEX IF NOT EXISTS idx_planeacion_etapas_requerimiento_id
  ON planeacion_etapas(requerimiento_id);

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE planeacion_etapas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acceso autenticado a planeacion_etapas" ON planeacion_etapas;
CREATE POLICY "Acceso autenticado a planeacion_etapas"
  ON planeacion_etapas FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
