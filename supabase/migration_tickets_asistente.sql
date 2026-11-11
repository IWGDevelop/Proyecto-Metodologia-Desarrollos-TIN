-- ═════════════════════════════════════════════════════════════════════════════
-- Módulo Tickets TIN-FLOW — historial del asistente de IA (Gemini).
-- Guarda cada pregunta y respuesta del asistente de TIN-TICKETS, con el usuario,
-- la hora, la tipología sugerida, el modelo, la duración y los tokens, para
-- trazabilidad y estadísticas de uso.
-- Se ejecuta DESPUÉS de migration_tickets.sql. Es idempotente.
-- ═════════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE TABLE IF NOT EXISTS ticket_asistente_interacciones (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id             uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  -- Agrupa los mensajes de una misma conversación (se reinicia con "Nueva conversación")
  conversacion_id        uuid NOT NULL,
  -- Número de la pregunta dentro de la conversación (1, 2, 3…)
  turno                  int  NOT NULL DEFAULT 1,
  pregunta               text NOT NULL,
  respuesta              text,
  -- Tipología que el asistente propuso con el botón "Abrir el formulario"
  tipologia_sugerida_id  uuid REFERENCES ticket_tipologias(id) ON DELETE SET NULL,
  -- OK: respondió · CANCELADA: el usuario cerró o reinició antes de terminar
  -- ERROR: falló Gemini o el servidor · LIMITE: superó el límite de mensajes por minuto
  estado                 text NOT NULL DEFAULT 'OK' CHECK (estado IN ('OK', 'CANCELADA', 'ERROR', 'LIMITE')),
  error                  text,
  modelo                 text,
  duracion_ms            int,
  tokens_entrada         int,
  tokens_salida          int,
  tokens_razonamiento    int,
  created_at             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ticket_asistente_fecha        ON ticket_asistente_interacciones(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ticket_asistente_usuario      ON ticket_asistente_interacciones(usuario_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ticket_asistente_conversacion ON ticket_asistente_interacciones(conversacion_id, turno);
CREATE INDEX IF NOT EXISTS idx_ticket_asistente_tipologia    ON ticket_asistente_interacciones(tipologia_sugerida_id) WHERE tipologia_sugerida_id IS NOT NULL;

COMMENT ON TABLE ticket_asistente_interacciones IS
  'Historial del asistente de IA de TIN-TICKETS: una fila por pregunta, con su respuesta y métricas';

-- Solo el servidor (service role) escribe y lee: sin políticas para usuarios autenticados
ALTER TABLE ticket_asistente_interacciones ENABLE ROW LEVEL SECURITY;

-- ── Vista de uso diario (zona horaria de Colombia) ───────────────────────────
CREATE OR REPLACE VIEW v_ticket_asistente_uso_diario
WITH (security_invoker = true) AS
SELECT
  (created_at AT TIME ZONE 'America/Bogota')::date                     AS dia,
  count(*)                                                             AS preguntas,
  count(DISTINCT usuario_id)                                           AS usuarios,
  count(DISTINCT conversacion_id)                                      AS conversaciones,
  count(*) FILTER (WHERE tipologia_sugerida_id IS NOT NULL)            AS con_tipologia_sugerida,
  count(*) FILTER (WHERE estado = 'ERROR')                             AS errores,
  count(*) FILTER (WHERE estado = 'LIMITE')                            AS bloqueadas_por_limite,
  round(avg(duracion_ms) FILTER (WHERE estado = 'OK'))::int            AS duracion_promedio_ms,
  coalesce(sum(tokens_entrada), 0)                                     AS tokens_entrada,
  coalesce(sum(tokens_salida), 0) + coalesce(sum(tokens_razonamiento), 0) AS tokens_salida
FROM ticket_asistente_interacciones
GROUP BY 1;

COMMIT;

-- ── Consultas útiles ─────────────────────────────────────────────────────────
-- Uso de los últimos 30 días:
--   SELECT * FROM v_ticket_asistente_uso_diario WHERE dia >= current_date - 30 ORDER BY dia DESC;
-- Usuarios que más lo usan:
--   SELECT p.nombre_completo, count(*) AS preguntas, max(i.created_at) AS ultima
--   FROM ticket_asistente_interacciones i JOIN perfiles p ON p.id = i.usuario_id
--   GROUP BY 1 ORDER BY 2 DESC;
-- Tipologías más sugeridas:
--   SELECT c.nombre AS categoria, t.nombre AS tipologia, count(*) AS veces
--   FROM ticket_asistente_interacciones i
--   JOIN ticket_tipologias t ON t.id = i.tipologia_sugerida_id
--   JOIN ticket_categorias c ON c.id = t.categoria_id
--   GROUP BY 1, 2 ORDER BY 3 DESC;
-- Una conversación completa:
--   SELECT turno, created_at, pregunta, respuesta FROM ticket_asistente_interacciones
--   WHERE conversacion_id = '<id>' ORDER BY turno;
