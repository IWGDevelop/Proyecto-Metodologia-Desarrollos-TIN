-- ============================================================
-- MIGRACIÓN: Justificación de variación negativa de HH reales
-- Ejecutar en el SQL Editor de Supabase
-- ============================================================

-- Cuando las horas hombre ahorradas/mes reales quedan por debajo de las
-- estimadas, el usuario debe justificar por qué fueron inferiores.
ALTER TABLE requerimientos
  ADD COLUMN IF NOT EXISTS justificacion_variacion_hh text;

-- ─── FIN ──────────────────────────────────────────────────────────────────────
