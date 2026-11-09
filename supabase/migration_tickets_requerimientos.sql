-- ═════════════════════════════════════════════════════════════════════════════
-- Módulo Tickets TIN-FLOW — soporte de LOGIGSI y TIN-FLOW, y tickets
-- relacionados con requerimientos ya entregados o cerrados.
-- Se ejecuta DESPUÉS de migration_tickets.sql y migration_tickets_seed.sql.
-- Es idempotente: se puede volver a correr sin duplicar datos.
-- ═════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. Ticket ↔ requerimiento (traza del soporte posterior a la entrega) ─────
ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS requerimiento_id uuid REFERENCES requerimientos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tickets_requerimiento ON tickets(requerimiento_id) WHERE requerimiento_id IS NOT NULL;

COMMENT ON COLUMN tickets.requerimiento_id IS
  'Requerimiento de desarrollo (entregado o cerrado) sobre el que se abre el ticket de soporte';

-- ── 2. Categorías nuevas ─────────────────────────────────────────────────────
INSERT INTO ticket_categorias (nombre, orden) VALUES
  ('Soporte LOGIGSI', 33),
  ('Soporte TIN-FLOW', 36)
ON CONFLICT (nombre) DO NOTHING;

-- ── 3. Tipologías ────────────────────────────────────────────────────────────
INSERT INTO ticket_tipologias (
  categoria_id, nombre, descripcion_ayuda, tipo_gestion, se_mide_contra,
  requiere_aprobacion, visibilidad_restringida, adjunto_obligatorio, es_novedad_igsi, orden)
SELECT c.id, v.nombre, v.ayuda, v.tipo_gestion, v.se_mide_contra,
       v.aprobacion, false, v.adjunto, false, v.orden
FROM (VALUES
  -- Soporte LOGIGSI
  ('Soporte LOGIGSI', 'Error o falla en LOGIGSI',
   'Módulo o pantalla, qué estabas haciendo, qué pasó y qué esperabas, mensaje de error, capturas de pantalla',
   'INCIDENTE', 'SLA', false, true, 10),
  ('Soporte LOGIGSI', 'Consulta de uso de LOGIGSI',
   'Módulo o pantalla y la duda puntual',
   'SOLICITUD', 'SLA', false, false, 20),
  ('Soporte LOGIGSI', 'Usuario o permisos en LOGIGSI',
   'Funcionario, tipo de solicitud (crear, modificar, inactivar), rol o permisos requeridos, perfil de referencia',
   'SOLICITUD', 'SLA', true, false, 30),
  ('Soporte LOGIGSI', 'Ajuste a un desarrollo entregado en LOGIGSI',
   'Requerimiento relacionado, qué funciona distinto a lo acordado o qué ajuste se necesita, capturas',
   'SOLICITUD', 'SLA', false, false, 40),
  -- Soporte TIN-FLOW
  ('Soporte TIN-FLOW', 'Error o falla en TIN-FLOW',
   'Módulo o pantalla, qué estabas haciendo, qué pasó y qué esperabas, mensaje de error, capturas de pantalla',
   'INCIDENTE', 'SLA', false, true, 10),
  ('Soporte TIN-FLOW', 'Consulta de uso de TIN-FLOW',
   'Módulo o pantalla y la duda puntual',
   'SOLICITUD', 'SLA', false, false, 20),
  ('Soporte TIN-FLOW', 'Usuario o permisos en TIN-FLOW',
   'Funcionario, tipo de solicitud (crear, modificar, inactivar), rol o permisos requeridos',
   'SOLICITUD', 'SLA', true, false, 30),
  ('Soporte TIN-FLOW', 'Ajuste a un desarrollo entregado en TIN-FLOW',
   'Requerimiento relacionado, qué funciona distinto a lo acordado o qué ajuste se necesita, capturas',
   'SOLICITUD', 'SLA', false, false, 40)
) AS v(categoria, nombre, ayuda, tipo_gestion, se_mide_contra, aprobacion, adjunto, orden)
JOIN ticket_categorias c ON c.nombre = v.categoria
ON CONFLICT (categoria_id, nombre) DO NOTHING;

-- ── 4. Campos por tipología ──────────────────────────────────────────────────
INSERT INTO ticket_campos_tipologia (
  tipologia_id, clave, etiqueta, tipo_dato, obligatorio, orden, opciones, ayuda, es_fecha_requerida)
SELECT t.id, v.clave, v.etiqueta, v.tipo_dato, v.obligatorio, v.orden, v.opciones::jsonb, v.ayuda, false
FROM (VALUES
  -- Error o falla
  ('Soporte LOGIGSI', 'Error o falla en LOGIGSI', 'modulo', 'Módulo o pantalla', 'TEXTO', true, 10, NULL, 'Dónde ocurre la falla'),
  ('Soporte LOGIGSI', 'Error o falla en LOGIGSI', 'que_hacia', '¿Qué estabas haciendo?', 'TEXTO_LARGO', true, 20, NULL, 'Pasos para llegar a la falla'),
  ('Soporte LOGIGSI', 'Error o falla en LOGIGSI', 'mensaje_error', 'Mensaje de error', 'TEXTO_LARGO', false, 30, NULL, 'Copia el texto del mensaje, si apareció'),
  ('Soporte TIN-FLOW', 'Error o falla en TIN-FLOW', 'modulo', 'Módulo o pantalla', 'TEXTO', true, 10, NULL, 'Dónde ocurre la falla'),
  ('Soporte TIN-FLOW', 'Error o falla en TIN-FLOW', 'que_hacia', '¿Qué estabas haciendo?', 'TEXTO_LARGO', true, 20, NULL, 'Pasos para llegar a la falla'),
  ('Soporte TIN-FLOW', 'Error o falla en TIN-FLOW', 'mensaje_error', 'Mensaje de error', 'TEXTO_LARGO', false, 30, NULL, 'Copia el texto del mensaje, si apareció'),
  -- Consulta de uso
  ('Soporte LOGIGSI', 'Consulta de uso de LOGIGSI', 'modulo', 'Módulo o pantalla', 'TEXTO', true, 10, NULL, NULL),
  ('Soporte TIN-FLOW', 'Consulta de uso de TIN-FLOW', 'modulo', 'Módulo o pantalla', 'TEXTO', true, 10, NULL, NULL),
  -- Usuario o permisos
  ('Soporte LOGIGSI', 'Usuario o permisos en LOGIGSI', 'funcionario', 'Funcionario', 'USUARIO', true, 10, NULL, 'A quién se le crea o modifica el acceso'),
  ('Soporte LOGIGSI', 'Usuario o permisos en LOGIGSI', 'tipo_solicitud', 'Tipo de solicitud', 'LISTA', true, 20, '["Crear usuario","Modificar permisos","Inactivar usuario"]', NULL),
  ('Soporte LOGIGSI', 'Usuario o permisos en LOGIGSI', 'rol_permisos', 'Rol o permisos requeridos', 'TEXTO_LARGO', true, 30, NULL, NULL),
  ('Soporte LOGIGSI', 'Usuario o permisos en LOGIGSI', 'perfil_referencia', 'Perfil de referencia', 'USUARIO', false, 40, NULL, 'Funcionario con los mismos permisos, si aplica'),
  ('Soporte TIN-FLOW', 'Usuario o permisos en TIN-FLOW', 'funcionario', 'Funcionario', 'USUARIO', true, 10, NULL, 'A quién se le crea o modifica el acceso'),
  ('Soporte TIN-FLOW', 'Usuario o permisos en TIN-FLOW', 'tipo_solicitud', 'Tipo de solicitud', 'LISTA', true, 20, '["Crear usuario","Modificar permisos","Inactivar usuario"]', NULL),
  ('Soporte TIN-FLOW', 'Usuario o permisos en TIN-FLOW', 'rol_permisos', 'Rol o permisos requeridos', 'TEXTO_LARGO', true, 30, NULL, NULL),
  -- Ajuste a un desarrollo entregado
  ('Soporte LOGIGSI', 'Ajuste a un desarrollo entregado en LOGIGSI', 'ajuste', 'Qué funciona distinto o qué ajuste se necesita', 'TEXTO_LARGO', true, 10, NULL, 'Relaciona el requerimiento entregado en el campo "Requerimiento relacionado"'),
  ('Soporte TIN-FLOW', 'Ajuste a un desarrollo entregado en TIN-FLOW', 'ajuste', 'Qué funciona distinto o qué ajuste se necesita', 'TEXTO_LARGO', true, 10, NULL, 'Relaciona el requerimiento entregado en el campo "Requerimiento relacionado"')
) AS v(categoria, tipologia, clave, etiqueta, tipo_dato, obligatorio, orden, opciones, ayuda)
JOIN ticket_categorias c ON c.nombre = v.categoria
JOIN ticket_tipologias t ON t.categoria_id = c.id AND t.nombre = v.tipologia
ON CONFLICT (tipologia_id, clave) DO NOTHING;

COMMIT;
