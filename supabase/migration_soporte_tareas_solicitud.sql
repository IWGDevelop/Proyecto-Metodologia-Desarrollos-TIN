-- Soporte de cumplimiento para tareas de comentarios (tareas_solicitud),
-- igual que las tareas de reunión: respuesta escrita + anexos.

ALTER TABLE tareas_solicitud
  ADD COLUMN IF NOT EXISTS respuesta text;

-- ── Tabla: anexos_tarea_solicitud ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS anexos_tarea_solicitud (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tarea_solicitud_id  uuid NOT NULL REFERENCES tareas_solicitud(id) ON DELETE CASCADE,
  nombre_archivo      text NOT NULL,
  url_storage         text NOT NULL,
  tipo_archivo        text,
  tamanio_bytes       bigint,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_anexos_tarea_solicitud_tarea
  ON anexos_tarea_solicitud(tarea_solicitud_id);

-- RLS: misma política que las demás tablas de anexos
ALTER TABLE anexos_tarea_solicitud ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acceso autenticado a anexos_tarea_solicitud" ON anexos_tarea_solicitud;
CREATE POLICY "Acceso autenticado a anexos_tarea_solicitud"
  ON anexos_tarea_solicitud
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
