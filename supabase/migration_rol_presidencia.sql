-- Agrega el valor 'PRESIDENCIA' al CHECK constraint de la columna rol en perfiles
-- Ejecutar en Supabase SQL Editor

-- 1. Eliminar constraint existente (si existe)
ALTER TABLE perfiles DROP CONSTRAINT IF EXISTS perfiles_rol_check;

-- 2. Agregar constraint actualizado con los tres roles
ALTER TABLE perfiles
  ADD CONSTRAINT perfiles_rol_check
  CHECK (rol IN ('ADMIN_TIN', 'USUARIO', 'PRESIDENCIA'));
