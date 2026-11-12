-- ═════════════════════════════════════════════════════════════════════════════
-- Módulo Tickets TIN-FLOW — horas hábiles por estado y total de la solicitud.
-- ticket_tiempos guarda, además de las medidas de indicador, cuántas horas hábiles
-- pasó el ticket en cada estado y el total de la solicitud (creación → cierre, o
-- hasta el cálculo si sigue abierta). Horas hábiles: lunes a viernes, 8:00 a 17:00
-- sin el almuerzo de 12:00 a 14:00 (7 h/día), sin sábados, domingos ni festivos
-- de Colombia. Se ejecuta DESPUÉS de migration_tickets.sql. Es idempotente.
-- ═════════════════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE ticket_tiempos ADD COLUMN IF NOT EXISTS t_transcurrido   numeric;
ALTER TABLE ticket_tiempos ADD COLUMN IF NOT EXISTS horas_por_estado jsonb;

COMMENT ON COLUMN ticket_tiempos.t_transcurrido IS
  'Horas hábiles de la solicitud: de la creación al cierre, o hasta calculado_en si sigue abierta';
COMMENT ON COLUMN ticket_tiempos.horas_por_estado IS
  'Horas hábiles en cada estado, p. ej. {"ABIERTO": 1.5, "EN_PROCESO": 6.25}; Cerrado no cuenta';

COMMIT;

-- ── Consultas útiles ─────────────────────────────────────────────────────────
-- Horas por estado de cada ticket:
--   SELECT t.numero, e.key AS estado, e.value::numeric AS horas
--   FROM ticket_tiempos tt JOIN tickets t ON t.id = tt.ticket_id, jsonb_each_text(tt.horas_por_estado) e
--   ORDER BY t.numero, e.key;
-- Promedio de horas por estado:
--   SELECT e.key AS estado, round(avg(e.value::numeric), 2) AS horas_promedio
--   FROM ticket_tiempos tt, jsonb_each_text(tt.horas_por_estado) e GROUP BY 1 ORDER BY 2 DESC;
