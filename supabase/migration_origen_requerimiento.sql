-- Agregar campo origen_requerimiento a la tabla requerimientos
ALTER TABLE requerimientos
  ADD COLUMN IF NOT EXISTS origen_requerimiento text
    CHECK (origen_requerimiento IN ('LISTA_MEJORAS_PENDIENTES', 'TIN_NOVA', 'DESARROLLO_EXTERNO'));

-- Recrear la vista para incluir el nuevo campo
-- Nota: impacto_economico_total_anual ya existe como columna real en la tabla,
-- por eso no se recalcula aquí (evita error de columna duplicada)
DROP VIEW IF EXISTS v_metricas_requerimientos;
CREATE VIEW v_metricas_requerimientos AS
SELECT
  r.*,
  EXTRACT(DAY FROM (now() - r.updated_at))::int AS dias_en_estado_actual
FROM requerimientos r;
