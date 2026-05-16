-- ============================================================
-- MIGRACIÓN: Horas de desarrollo estimadas + fecha_inicio tareas reunión
-- Ejecutar en el SQL Editor de Supabase
-- ============================================================

-- ─── Columna horas_estimadas_desarrollo en requerimientos ────────────────────
ALTER TABLE requerimientos
  ADD COLUMN IF NOT EXISTS horas_estimadas_desarrollo DECIMAL(8,2);

-- ─── Columnas de cumplimiento en tareas_reunion ───────────────────────────────
ALTER TABLE tareas_reunion
  ADD COLUMN IF NOT EXISTS fecha_cumplimiento    date,
  ADD COLUMN IF NOT EXISTS motivo_incumplimiento text,
  ADD COLUMN IF NOT EXISTS penalizacion_cop      numeric,
  ADD COLUMN IF NOT EXISTS fecha_inicio          date;

-- ─── Vista v_metricas_requerimientos (recreada para incluir nuevas columnas) ──
-- IMPORTANTE: usar DROP + CREATE porque CREATE OR REPLACE no puede añadir
-- columnas nuevas cuando la definición anterior usaba r.* (columnas expandidas).
DROP VIEW IF EXISTS v_metricas_requerimientos;

CREATE VIEW v_metricas_requerimientos AS
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

-- ─── FIN ──────────────────────────────────────────────────────────────────────
