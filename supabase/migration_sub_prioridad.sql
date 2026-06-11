-- Agregar columna sub_prioridad a la tabla requerimientos (si no existe)
ALTER TABLE requerimientos
  ADD COLUMN IF NOT EXISTS sub_prioridad SMALLINT DEFAULT NULL;

ALTER TABLE requerimientos
  DROP CONSTRAINT IF EXISTS chk_sub_prioridad;

ALTER TABLE requerimientos
  ADD CONSTRAINT chk_sub_prioridad
    CHECK (sub_prioridad IS NULL OR sub_prioridad BETWEEN 1 AND 9);

-- Recrear la vista para que incluya sub_prioridad
DROP VIEW IF EXISTS v_metricas_requerimientos;
CREATE VIEW v_metricas_requerimientos AS
SELECT
  r.*,
  EXTRACT(DAY FROM (now() - r.updated_at))::int AS dias_en_estado_actual
FROM requerimientos r;
