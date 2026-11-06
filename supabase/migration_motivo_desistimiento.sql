-- Motivo del desistimiento de un requerimiento (se pide al pasar a DESISTIDO).
-- Ejecutar en: Supabase SQL Editor

ALTER TABLE requerimientos
  ADD COLUMN IF NOT EXISTS motivo_desistimiento TEXT
  CHECK (motivo_desistimiento IS NULL OR motivo_desistimiento IN (
    'Cambio de prioridad',
    'Inviabilidad técnica',
    'Falta de respuesta del solicitante',
    'Otro'
  ));
