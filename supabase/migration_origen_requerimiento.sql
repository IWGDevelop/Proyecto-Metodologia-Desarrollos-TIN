-- Agregar campo origen_requerimiento a la tabla requerimientos
ALTER TABLE requerimientos
  ADD COLUMN IF NOT EXISTS origen_requerimiento text
    CHECK (origen_requerimiento IN ('LISTA_MEJORAS_PENDIENTES', 'TIN_NOVA', 'DESARROLLO_EXTERNO'));

-- Recrear la vista para incluir el nuevo campo
DROP VIEW IF EXISTS v_metricas_requerimientos;
CREATE VIEW v_metricas_requerimientos AS
SELECT
  r.*,
  EXTRACT(DAY FROM (now() - r.updated_at))::int                                AS dias_en_estado_actual,
  COALESCE(r.ahorro_anual_cop, 0)
    + COALESCE(r.total_beneficios_cualitativos_anual, 0)                        AS impacto_economico_total_anual
FROM requerimientos r;
