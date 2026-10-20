-- ── Catálogo parametrizable de procesos internos ─────────────────────────────
-- Los procesos dejan de estar fijos en el código: se administran en Configuración → Procesos.
-- `valor` es el código que se guarda en requerimientos.proceso_interno, perfiles.proceso_interno, etc.
-- y no cambia una vez creado; el nombre visible (`label`) sí se puede editar.

CREATE TABLE IF NOT EXISTS procesos_internos (
  valor       text        PRIMARY KEY,
  label       text        NOT NULL,
  activo      boolean     NOT NULL DEFAULT true,   -- inactivo: no se ofrece en los formularios, pero sigue mostrándose en los registros existentes
  orden       integer     NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

INSERT INTO procesos_internos (valor, label, activo, orden) VALUES
  ('FINANCIERO',        'Financiero',           true,  10),
  ('OPERACIONES',       'Operaciones',          true,  20),
  ('COMERCIAL',         'Comercial',            true,  30),
  ('CARGA',             'Carga',                true,  40),
  ('SISTEMAS_GESTION',  'Sistemas de gestión',  true,  50),
  ('SERVICIO_CLIENTE',  'Servicio al cliente',  true,  60),
  ('COMPRAS',           'Compras',              true,  70),
  ('SEGUROS',           'Seguros',              true,  80),
  ('DATOS',             'Datos',                true,  90),
  ('TI',                'TI',                   true, 100),
  ('PRICING',           'Pricing',              true, 110),
  ('ESTRATEGIA',        'Estrategia',           true, 120),
  ('MARKETING',         'Marketing',            true, 130),
  ('TRAFICO_SEGURIDAD', 'Tráfico y Seguridad',  true, 140),
  ('IA',                'IA',                   true, 150),
  -- Valor heredado: se conserva para los registros antiguos pero ya no se ofrece
  ('GENERAL',           'Estrategia (legacy)',  false, 160)
ON CONFLICT (valor) DO NOTHING;

-- Quitar las restricciones CHECK con la lista fija de procesos, para admitir procesos nuevos
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.conrelid::regclass AS tabla, c.conname
    FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE c.contype = 'c'
      AND n.nspname = 'public'
      AND (pg_get_constraintdef(c.oid) ILIKE '%proceso_interno%' OR pg_get_constraintdef(c.oid) ILIKE '%proceso_solicitante%')
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.tabla, r.conname);
  END LOOP;
END $$;

-- ── RLS: lectura para usuarios autenticados; la escritura se hace desde el servidor ──
ALTER TABLE procesos_internos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lectura de procesos_internos" ON procesos_internos;
CREATE POLICY "Lectura de procesos_internos"
  ON procesos_internos FOR SELECT TO authenticated USING (true);
