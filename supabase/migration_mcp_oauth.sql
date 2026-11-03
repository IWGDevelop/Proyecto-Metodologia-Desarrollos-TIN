-- ============================================================
-- MIGRACIÓN: OAuth 2.1 para el servidor MCP (Claude web / Desktop / Code)
-- Ejecutar en el SQL Editor de Supabase
-- ============================================================

-- Clientes registrados por Dynamic Client Registration (RFC 7591).
-- Los clientes que se identifican con un Client ID Metadata Document (URL HTTPS) no se guardan aquí.
CREATE TABLE IF NOT EXISTS mcp_oauth_clientes (
  client_id      text        PRIMARY KEY,
  client_name    text,
  redirect_uris  text[]      NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- Códigos de autorización (un solo uso, vencen a los 10 minutos). Solo se guarda el hash.
CREATE TABLE IF NOT EXISTS mcp_oauth_codigos (
  code_hash       text        PRIMARY KEY,
  client_id       text        NOT NULL,
  client_nombre   text        NOT NULL,
  usuario_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  redirect_uri    text        NOT NULL,
  code_challenge  text        NOT NULL,
  resource        text        NOT NULL,
  scope           text,
  expira_en       timestamptz NOT NULL,
  usado_en        timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Una fila por conexión autorizada (usuario + aplicación). Guarda los hashes del
-- access token (1 hora) y del refresh token (90 días, se rota en cada uso).
CREATE TABLE IF NOT EXISTS mcp_oauth_sesiones (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id          text        NOT NULL,
  client_nombre      text        NOT NULL,
  resource           text        NOT NULL,
  scope              text,
  access_hash        text        NOT NULL UNIQUE,
  access_expira_en   timestamptz NOT NULL,
  refresh_hash       text        NOT NULL UNIQUE,
  refresh_expira_en  timestamptz NOT NULL,
  ultimo_uso         timestamptz,
  revocado_en        timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mcp_oauth_sesiones_usuario_id ON mcp_oauth_sesiones(usuario_id);

-- ── RLS ───────────────────────────────────────────────────────────────────────
-- Sin políticas: solo el service_role (endpoints OAuth y Server Actions) accede.
ALTER TABLE mcp_oauth_clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE mcp_oauth_codigos  ENABLE ROW LEVEL SECURITY;
ALTER TABLE mcp_oauth_sesiones ENABLE ROW LEVEL SECURITY;

-- ─── FIN ──────────────────────────────────────────────────────────────────────
