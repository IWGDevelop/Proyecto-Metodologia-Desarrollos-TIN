-- Agrega el estado DESISTIDO al CHECK constraint de la columna estado
-- en la tabla requerimientos.
-- Ejecutar en: Supabase SQL Editor

-- 1. Eliminar el CHECK constraint existente (nombre auto-generado por Postgres)
DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'requerimientos'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%estado%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE requerimientos DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

-- 2. Recrear el CHECK constraint con DESISTIDO incluido
ALTER TABLE requerimientos
  ADD CONSTRAINT requerimientos_estado_check
  CHECK (estado IN (
    'SIN_GESTION',
    'ANALISIS',
    'EN_DEFINICION_USUARIO',
    'EN_DESARROLLO',
    'PRUEBAS_USUARIO',
    'STAND_BY',
    'ENTREGADO',
    'CERRADO',
    'DESISTIDO'
  ));
