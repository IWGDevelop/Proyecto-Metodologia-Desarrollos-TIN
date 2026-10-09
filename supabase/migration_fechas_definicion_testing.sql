-- Nuevas fechas del requerimiento: definición de usuario y fin de pruebas (testing)
ALTER TABLE requerimientos
  ADD COLUMN IF NOT EXISTS fecha_estimada_definicion_usuario date,
  ADD COLUMN IF NOT EXISTS fecha_real_definicion_usuario     date,
  ADD COLUMN IF NOT EXISTS fecha_estimada_fin_testing        date,
  ADD COLUMN IF NOT EXISTS fecha_real_fin_testing            date;

-- Cada fecha estimada del tab Fechas genera una tarea con responsable.
-- tipo_fecha identifica de qué fecha proviene la tarea (NULL = tarea creada desde comentarios).
ALTER TABLE tareas_solicitud
  ADD COLUMN IF NOT EXISTS tipo_fecha text;

CREATE UNIQUE INDEX IF NOT EXISTS uq_tareas_solicitud_req_tipo_fecha
  ON tareas_solicitud(requerimiento_id, tipo_fecha)
  WHERE tipo_fecha IS NOT NULL;
