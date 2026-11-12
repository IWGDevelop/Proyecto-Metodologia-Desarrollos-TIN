-- ═════════════════════════════════════════════════════════════════════════════
-- Módulo Tickets TIN-FLOW — partes interesadas de un ticket.
-- El solicitante (o TIN) puede involucrar a otros funcionarios en su ticket. Las
-- partes interesadas ven el ticket en «Mis tickets de TI», pueden comentar y
-- adjuntar, y reciben los avisos y correos de las novedades del ticket.
-- Se ejecuta DESPUÉS de migration_tickets.sql. Es idempotente.
-- ═════════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE TABLE IF NOT EXISTS ticket_interesados (
  ticket_id    uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  usuario_id   uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  agregado_por uuid REFERENCES perfiles(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ticket_id, usuario_id)
);
CREATE INDEX IF NOT EXISTS idx_ticket_interesados_usuario ON ticket_interesados(usuario_id);

COMMENT ON TABLE ticket_interesados IS
  'Funcionarios involucrados en un ticket como partes interesadas: lo ven, comentan y reciben sus novedades';

-- Solo el servidor (service role) lee y escribe
ALTER TABLE ticket_interesados ENABLE ROW LEVEL SECURITY;

-- Nuevo tipo de evento del historial: se agregó o se quitó una parte interesada
ALTER TABLE ticket_historial DROP CONSTRAINT IF EXISTS ticket_historial_tipo_evento_check;
ALTER TABLE ticket_historial ADD CONSTRAINT ticket_historial_tipo_evento_check CHECK (tipo_evento IN (
  'CREACION','ASIGNACION','CAMBIO_ESTADO','CAMBIO_PRIORIDAD','CAMBIO_TIPOLOGIA',
  'COMENTARIO','ADJUNTO','RECORDATORIO','APROBACION','RECHAZO',
  'CLASIFICACION_CAUSA','ENLACE_BUG','REAPERTURA','CIERRE','PRIMERA_RESPUESTA',
  'INTERESADO'));

COMMIT;
