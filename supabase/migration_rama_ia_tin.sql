-- Rama del desarrollo: agrega la opción combinada 'IA-TIN' además de 'TIN' e 'IA'.
-- Elimina cualquier CHECK existente sobre requerimientos.rama y crea uno nuevo.

DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class t ON t.oid = con.conrelid
    WHERE t.relname = 'requerimientos'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%rama%'
  LOOP
    EXECUTE format('ALTER TABLE requerimientos DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE requerimientos
  ADD CONSTRAINT requerimientos_rama_check
  CHECK (rama IS NULL OR rama IN ('TIN', 'IA', 'IA-TIN'));
