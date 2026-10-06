-- Casos de Uso IA: distinguir solicitudes de uso nuevo vs. registro de uso existente,
-- impacto en minutos y fuentes de datos utilizadas.

ALTER TABLE casos_uso_ia
  ADD COLUMN IF NOT EXISTS tipo_registro TEXT NOT NULL DEFAULT 'SOLICITUD';

ALTER TABLE casos_uso_ia
  DROP CONSTRAINT IF EXISTS chk_casos_uso_ia_tipo_registro;

ALTER TABLE casos_uso_ia
  ADD CONSTRAINT chk_casos_uso_ia_tipo_registro
    CHECK (tipo_registro IN ('SOLICITUD', 'USO_EXISTENTE'));

-- Fuentes de datos (aplica a ambos tipos): GMAIL, GOOGLE_DRIVE, ARCHIVOS_LOCALES, ...
ALTER TABLE casos_uso_ia
  ADD COLUMN IF NOT EXISTS fuentes_datos TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE casos_uso_ia
  ADD COLUMN IF NOT EXISTS fuentes_datos_detalle TEXT DEFAULT NULL;

-- Impacto (solo USO_EXISTENTE): minutos ahorrados por ejecución y frecuencia de la actividad
ALTER TABLE casos_uso_ia
  ADD COLUMN IF NOT EXISTS minutos_ahorrados INTEGER DEFAULT NULL;

ALTER TABLE casos_uso_ia
  ADD COLUMN IF NOT EXISTS frecuencia_uso TEXT DEFAULT NULL;

ALTER TABLE casos_uso_ia
  DROP CONSTRAINT IF EXISTS chk_casos_uso_ia_minutos_ahorrados;

ALTER TABLE casos_uso_ia
  ADD CONSTRAINT chk_casos_uso_ia_minutos_ahorrados
    CHECK (minutos_ahorrados IS NULL OR minutos_ahorrados >= 0);

ALTER TABLE casos_uso_ia
  DROP CONSTRAINT IF EXISTS chk_casos_uso_ia_frecuencia_uso;

ALTER TABLE casos_uso_ia
  ADD CONSTRAINT chk_casos_uso_ia_frecuencia_uso
    CHECK (frecuencia_uso IS NULL OR frecuencia_uso IN ('DIARIA', 'SEMANAL', 'QUINCENAL', 'MENSUAL'));
