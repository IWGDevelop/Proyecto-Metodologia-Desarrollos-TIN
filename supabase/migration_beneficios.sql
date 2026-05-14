-- ============================================================
-- MIGRACIÓN: Cuantificación económica de beneficios cualitativos
-- Ejecutar en el SQL Editor de Supabase DESPUÉS del schema.sql inicial
-- ============================================================

-- ─── Nuevos campos en tabla requerimientos ────────────────────────────────────
ALTER TABLE requerimientos
  ADD COLUMN IF NOT EXISTS total_beneficios_cualitativos_anual DECIMAL(15,2),
  ADD COLUMN IF NOT EXISTS impacto_economico_total_anual       DECIMAL(15,2);

-- Índice para ordenar por impacto total
CREATE INDEX IF NOT EXISTS idx_req_impacto_total_anual
  ON requerimientos (impacto_economico_total_anual DESC);

-- ─── Vista v_top_impacto (actualizada) ────────────────────────────────────────
-- Ordena por impacto_economico_total_anual (HH + cualitativos)
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
  ahorro_anual_cop,
  total_beneficios_cualitativos_anual,
  impacto_economico_total_anual
FROM requerimientos
WHERE es_borrador = false
  AND (ahorro_anual_cop IS NOT NULL OR impacto_economico_total_anual IS NOT NULL)
ORDER BY COALESCE(impacto_economico_total_anual, ahorro_anual_cop, 0) DESC
LIMIT 20;

-- ─── Vista v_impacto_economico (actualizada) ──────────────────────────────────
-- Incluye totales de cualitativos e impacto total
CREATE OR REPLACE VIEW v_impacto_economico AS
SELECT
  alcance,
  tipo_solucion,
  COUNT(*)                                          AS total_requerimientos,
  SUM(horas_ahorradas_mes)                          AS total_horas_mes,
  SUM(horas_ahorradas_mes * 12)                     AS total_horas_anio,
  SUM(ahorro_mensual_cop)                           AS total_ahorro_mensual_cop,
  SUM(ahorro_anual_cop)                             AS total_ahorro_anual_cop,
  AVG(horas_ahorradas_mes)                          AS promedio_horas_mes,
  SUM(total_beneficios_cualitativos_anual)          AS total_cualitativos_anual,
  SUM(impacto_economico_total_anual)                AS total_impacto_anual
FROM requerimientos
WHERE es_borrador = false
GROUP BY alcance, tipo_solucion;

-- ─── Vista v_metricas_requerimientos (actualizada) ────────────────────────────
CREATE OR REPLACE VIEW v_metricas_requerimientos AS
SELECT
  r.*,
  (r.fecha_inicio_desarrollo - r.fecha_envio_tin)       AS dias_respuesta_tin,
  (NOW()::date - r.updated_at::date)                    AS dias_en_estado_actual,
  (r.fecha_real_entrega - r.fecha_inicio_desarrollo)    AS dias_desarrollo,
  (r.fin_pruebas_usuario - r.inicio_pruebas_usuario)    AS dias_pruebas,
  CASE
    WHEN r.prioridad = 1 AND (r.fecha_inicio_desarrollo - r.fecha_envio_tin) <= 5  THEN true
    WHEN r.prioridad = 2 AND (r.fecha_inicio_desarrollo - r.fecha_envio_tin) <= 15 THEN true
    WHEN r.prioridad = 3 AND (r.fecha_inicio_desarrollo - r.fecha_envio_tin) <= 30 THEN true
    WHEN r.prioridad = 4 AND (r.fecha_inicio_desarrollo - r.fecha_envio_tin) <= 60 THEN true
    WHEN r.fecha_envio_tin IS NULL OR r.fecha_inicio_desarrollo IS NULL            THEN NULL
    ELSE false
  END AS cumple_sla
FROM requerimientos r;

-- ─── FIN DE LA MIGRACIÓN ──────────────────────────────────────────────────────
