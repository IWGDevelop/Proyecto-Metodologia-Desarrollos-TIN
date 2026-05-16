-- ============================================================
-- MIGRACIÓN: Tabla de penalizaciones por requerimiento
-- Ejecutar en el SQL Editor de Supabase
-- ============================================================

CREATE TABLE IF NOT EXISTS penalizaciones_requerimiento (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  requerimiento_id uuid        NOT NULL REFERENCES requerimientos(id) ON DELETE CASCADE,
  tipo             text        NOT NULL,         -- ver TIPOS_PENALIZACION en el frontend
  descripcion      text,                         -- detalle adicional opcional
  responsables     text[]      NOT NULL DEFAULT '{}', -- emails de los funcionarios
  monto_cop        numeric     NOT NULL DEFAULT 0,
  comentario_admin text,                         -- comentario del administrador TIN
  comentario_usuario text,                       -- respuesta / comentario del funcionario
  created_by       text,                         -- email del admin que registró
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- Índice para consultas por requerimiento
CREATE INDEX IF NOT EXISTS idx_penalizaciones_req_id
  ON penalizaciones_requerimiento (requerimiento_id);

-- Trigger para updated_at automático
CREATE OR REPLACE FUNCTION update_penalizaciones_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_penalizaciones_updated_at ON penalizaciones_requerimiento;
CREATE TRIGGER trg_penalizaciones_updated_at
  BEFORE UPDATE ON penalizaciones_requerimiento
  FOR EACH ROW EXECUTE FUNCTION update_penalizaciones_updated_at();

-- ─── FIN ──────────────────────────────────────────────────────────────────────
