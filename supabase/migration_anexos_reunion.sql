-- ── Tabla: anexos_reunion ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS anexos_reunion (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reunion_id      uuid NOT NULL REFERENCES reuniones(id) ON DELETE CASCADE,
  titulo          text NOT NULL,
  nombre_archivo  text NOT NULL,
  url_storage     text NOT NULL,
  tipo_archivo    text,
  tamanio_bytes   bigint,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Índice para consultas por reunión
CREATE INDEX IF NOT EXISTS idx_anexos_reunion_reunion_id ON anexos_reunion(reunion_id);

-- RLS: heredar acceso de reuniones (misma política que otras tablas)
ALTER TABLE anexos_reunion ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acceso autenticado a anexos_reunion"
  ON anexos_reunion
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
