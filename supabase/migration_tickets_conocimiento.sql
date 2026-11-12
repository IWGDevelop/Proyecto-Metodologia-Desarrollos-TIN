-- ═════════════════════════════════════════════════════════════════════════════
-- Módulo Tickets TIN-FLOW — base de conocimiento del asistente ConeIA (RAG).
-- Guarda los instructivos y procedimientos de TIN partidos en fragmentos, cada uno
-- con su embedding (Gemini gemini-embedding-001, 768 dimensiones). En cada pregunta
-- el asistente busca solo los fragmentos más parecidos y los envía al modelo, en vez
-- de mandar los documentos completos.
-- Los fragmentos se cargan con: node --env-file=.env.local scripts/cargar-conocimiento-tickets.mjs "<carpeta>"
-- Se ejecuta DESPUÉS de migration_tickets.sql. Es idempotente.
-- ═════════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS ticket_conocimiento (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Código del documento (TIN-I-008) y su título
  documento_codigo  text NOT NULL,
  documento_titulo  text NOT NULL,
  -- Nombre del archivo de origen, para saber qué reemplazar al volver a cargarlo
  archivo           text NOT NULL,
  -- Sección del documento donde está el fragmento (OBJETIVO, DESARROLLO…)
  seccion           text,
  orden             int  NOT NULL,
  contenido         text NOT NULL,
  embedding         extensions.vector(768) NOT NULL,
  modelo_embedding  text NOT NULL DEFAULT 'gemini-embedding-001',
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (archivo, orden)
);

CREATE INDEX IF NOT EXISTS idx_ticket_conocimiento_embedding
  ON ticket_conocimiento USING hnsw (embedding extensions.vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_ticket_conocimiento_documento ON ticket_conocimiento(documento_codigo);

COMMENT ON TABLE ticket_conocimiento IS
  'Fragmentos de instructivos y procedimientos de TIN con su embedding, para el asistente ConeIA (RAG)';

-- Solo el servidor (service role) lee y escribe
ALTER TABLE ticket_conocimiento ENABLE ROW LEVEL SECURITY;

-- Búsqueda por similitud de coseno: devuelve los fragmentos más parecidos a la pregunta
CREATE OR REPLACE FUNCTION buscar_conocimiento_tickets(
  consulta  extensions.vector(768),
  cantidad  int   DEFAULT 5,
  umbral    float DEFAULT 0.65
)
RETURNS TABLE (
  documento_codigo text,
  documento_titulo text,
  seccion          text,
  contenido        text,
  similitud        float
)
LANGUAGE sql STABLE
SET search_path = public, extensions
AS $$
  SELECT c.documento_codigo, c.documento_titulo, c.seccion, c.contenido,
         1 - (c.embedding <=> consulta) AS similitud
  FROM ticket_conocimiento c
  WHERE 1 - (c.embedding <=> consulta) >= umbral
  ORDER BY c.embedding <=> consulta
  LIMIT least(greatest(cantidad, 1), 20);
$$;

REVOKE ALL ON FUNCTION buscar_conocimiento_tickets(extensions.vector, int, float) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION buscar_conocimiento_tickets(extensions.vector, int, float) TO service_role;

-- Documentos usados para responder cada pregunta (trazabilidad del historial)
ALTER TABLE ticket_asistente_interacciones ADD COLUMN IF NOT EXISTS documentos_consultados text[];

COMMIT;

-- ── Consultas útiles ─────────────────────────────────────────────────────────
-- Documentos cargados:
--   SELECT documento_codigo, documento_titulo, count(*) AS fragmentos, max(created_at) AS cargado
--   FROM ticket_conocimiento GROUP BY 1, 2 ORDER BY 1;
-- Documentos más consultados por el asistente:
--   SELECT d AS documento, count(*) FROM ticket_asistente_interacciones, unnest(documentos_consultados) d
--   GROUP BY 1 ORDER BY 2 DESC;
