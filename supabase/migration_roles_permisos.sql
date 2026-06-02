-- ── Tabla: roles_personalizados ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS roles_personalizados (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      text NOT NULL UNIQUE,
  descripcion text,
  activo      boolean NOT NULL DEFAULT true,
  es_sistema  boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ── Tabla: permisos_rol ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS permisos_rol (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rol_id       uuid NOT NULL REFERENCES roles_personalizados(id) ON DELETE CASCADE,
  recurso      text NOT NULL,
  puede_ver    boolean NOT NULL DEFAULT false,
  puede_editar boolean NOT NULL DEFAULT false,
  puede_crear  boolean NOT NULL DEFAULT false,
  UNIQUE(rol_id, recurso)
);

CREATE INDEX IF NOT EXISTS idx_permisos_rol_rol_id ON permisos_rol(rol_id);

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE roles_personalizados ENABLE ROW LEVEL SECURITY;
ALTER TABLE permisos_rol         ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acceso autenticado a roles_personalizados"
  ON roles_personalizados FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "Acceso autenticado a permisos_rol"
  ON permisos_rol FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- ── Seeds: roles del sistema ──────────────────────────────────────────────────
INSERT INTO roles_personalizados (nombre, descripcion, es_sistema) VALUES
  ('ADMIN_TIN',   'Administrador TIN — acceso completo al sistema',           true),
  ('USUARIO',     'Usuario estándar — acceso a sus requerimientos',           true),
  ('PRESIDENCIA', 'Presidencia — acceso al dashboard y reportes ejecutivos',  true)
ON CONFLICT (nombre) DO NOTHING;
