-- ── Tabla: tareas_solicitud ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tareas_solicitud (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  requerimiento_id        uuid        NOT NULL REFERENCES requerimientos(id) ON DELETE CASCADE,
  descripcion             text        NOT NULL,
  responsable_email       text,
  fecha_compromiso        date,
  completada              boolean     NOT NULL DEFAULT false,
  fecha_cumplimiento      date,
  motivo_incumplimiento   text,
  penalizacion_cop        numeric,
  created_by              text,
  created_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tareas_solicitud_requerimiento_id
  ON tareas_solicitud(requerimiento_id);

CREATE INDEX IF NOT EXISTS idx_tareas_solicitud_responsable
  ON tareas_solicitud(responsable_email);

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE tareas_solicitud ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acceso autenticado a tareas_solicitud"
  ON tareas_solicitud FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
