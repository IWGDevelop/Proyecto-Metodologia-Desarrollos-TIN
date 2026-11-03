-- ============================================================
-- MIGRACIÓN: Tokens personales para el servidor MCP (Claude Code)
-- Ejecutar en el SQL Editor de Supabase
-- ============================================================

-- Cada usuario ADMIN_TIN genera tokens desde /perfil para conectar Claude Code
-- al endpoint /api/mcp. Solo se guarda el hash SHA-256 del token, nunca el token.
CREATE TABLE IF NOT EXISTS mcp_tokens (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id   uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre       text        NOT NULL,
  token_hash   text        NOT NULL UNIQUE,
  prefijo      text        NOT NULL,          -- primeros caracteres, para reconocerlo en la UI
  expira_en    timestamptz NOT NULL,
  ultimo_uso   timestamptz,
  revocado_en  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mcp_tokens_usuario_id ON mcp_tokens(usuario_id);

-- ── RLS ───────────────────────────────────────────────────────────────────────
-- Sin políticas: solo el service_role (Server Actions y /api/mcp) accede a la tabla.
ALTER TABLE mcp_tokens ENABLE ROW LEVEL SECURITY;

-- ─── FIN ──────────────────────────────────────────────────────────────────────
