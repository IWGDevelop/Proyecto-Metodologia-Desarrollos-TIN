-- ── 1. Actualizar constraint de ROL para incluir PRESIDENCIA ─────────────────
ALTER TABLE perfiles DROP CONSTRAINT IF EXISTS perfiles_rol_check;

ALTER TABLE perfiles
  ADD CONSTRAINT perfiles_rol_check
  CHECK (rol IN ('ADMIN_TIN', 'USUARIO', 'PRESIDENCIA'));

-- ── 2. Corregir constraint de EMPRESA para aceptar NULL ───────────────────────
-- (falla cuando el campo llega vacío desde el formulario)
ALTER TABLE perfiles DROP CONSTRAINT IF EXISTS perfiles_empresa_check;

ALTER TABLE perfiles
  ADD CONSTRAINT perfiles_empresa_check
  CHECK (empresa IS NULL OR empresa IN ('IWF', 'ILT', 'IWG'));
