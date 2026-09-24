-- ── Tabla: solicitudes_visto_bueno ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS solicitudes_visto_bueno (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  requerimiento_id        uuid        NOT NULL REFERENCES requerimientos(id) ON DELETE CASCADE,
  tipo                    text        NOT NULL CHECK (tipo IN ('DOCUMENTACION', 'SALIDA_VIVO')),
  estado                  text        NOT NULL DEFAULT 'PENDIENTE'
                                      CHECK (estado IN ('PENDIENTE', 'COMPLETADO', 'CANCELADO')),
  solicitado_por          text,
  solicitado_por_email    text,
  mensaje                 text,
  fecha_propuesta_salida  date,
  completado_at           timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_svb_requerimiento_id
  ON solicitudes_visto_bueno(requerimiento_id);

-- ── Tabla: firmas_visto_bueno ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS firmas_visto_bueno (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitud_id       uuid        NOT NULL REFERENCES solicitudes_visto_bueno(id) ON DELETE CASCADE,
  requerimiento_id   uuid        NOT NULL REFERENCES requerimientos(id) ON DELETE CASCADE,
  email_requerido    text        NOT NULL,
  nombre_requerido   text,
  es_estrategia      boolean     NOT NULL DEFAULT false,
  firmado            boolean     NOT NULL DEFAULT false,
  firmado_por_email  text,
  firmado_por_nombre text,
  firmado_at         timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fvb_solicitud_id
  ON firmas_visto_bueno(solicitud_id);

CREATE INDEX IF NOT EXISTS idx_fvb_requerimiento_id
  ON firmas_visto_bueno(requerimiento_id);

CREATE INDEX IF NOT EXISTS idx_fvb_email_firmado
  ON firmas_visto_bueno(email_requerido, firmado);

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE solicitudes_visto_bueno ENABLE ROW LEVEL SECURITY;
ALTER TABLE firmas_visto_bueno      ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acceso autenticado a solicitudes_visto_bueno"
  ON solicitudes_visto_bueno FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "Acceso autenticado a firmas_visto_bueno"
  ON firmas_visto_bueno FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
