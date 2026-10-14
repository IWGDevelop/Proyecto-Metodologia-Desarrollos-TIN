-- Impacto en días de cada penalización (retraso que generó en el requerimiento)
ALTER TABLE penalizaciones_requerimiento
  ADD COLUMN IF NOT EXISTS dias_impacto integer;
