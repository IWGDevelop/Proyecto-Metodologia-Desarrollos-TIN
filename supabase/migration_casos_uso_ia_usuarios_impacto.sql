-- Casos de Uso IA: usuarios como perfiles (emails), salario del cargo para valorizar
-- las horas hombre ahorradas e impactos indirectos.

-- Emails de perfiles que usan la herramienta (mismo formato que requerimientos.partes_interesadas)
ALTER TABLE casos_uso_ia
  ADD COLUMN IF NOT EXISTS usuarios_emails TEXT[] NOT NULL DEFAULT '{}';

-- Cargo cuyas horas hombre se ahorran y su salario mensual aproximado (COP)
ALTER TABLE casos_uso_ia
  ADD COLUMN IF NOT EXISTS cargo_ahorro TEXT DEFAULT NULL;

ALTER TABLE casos_uso_ia
  ADD COLUMN IF NOT EXISTS salario_cargo DECIMAL(15,2) DEFAULT NULL;

ALTER TABLE casos_uso_ia
  DROP CONSTRAINT IF EXISTS chk_casos_uso_ia_salario_cargo;

ALTER TABLE casos_uso_ia
  ADD CONSTRAINT chk_casos_uso_ia_salario_cargo
    CHECK (salario_cargo IS NULL OR salario_cargo >= 0);

-- Impactos indirectos: [{ "descripcion": "...", "valor_anual_cop": 0 }]
ALTER TABLE casos_uso_ia
  ADD COLUMN IF NOT EXISTS impactos_indirectos JSONB NOT NULL DEFAULT '[]';
