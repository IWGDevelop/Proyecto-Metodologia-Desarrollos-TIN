-- ═════════════════════════════════════════════════════════════════════════════
-- Módulo Tickets TIN-FLOW — más documentos afectados y empresa en la novedad IGSI.
-- Documentos nuevos: Seguimiento, Cotización, Tarifario, Cumplido remesa,
-- Cumplido manifiesto, OP y Liquidación (además de SS, DO, Remesa, Manifiesto y Otro).
-- Empresa: IWF (Interworld Freight) o ILT (Interworld Land Transport).
-- Aplica también a los bugs de IGSI. Se ejecuta DESPUÉS de migration_tickets.sql.
-- Es idempotente.
-- ═════════════════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE ticket_novedades_igsi DROP CONSTRAINT IF EXISTS ticket_novedades_igsi_tipo_documento_check;
ALTER TABLE ticket_novedades_igsi ADD CONSTRAINT ticket_novedades_igsi_tipo_documento_check CHECK (tipo_documento IN (
  'SS','DO','REMESA','MANIFIESTO',
  'SEGUIMIENTO','COTIZACION','TARIFARIO','CUMPLIDO_REMESA','CUMPLIDO_MANIFIESTO','OP','LIQUIDACION',
  'OTRO'));

ALTER TABLE ticket_bugs DROP CONSTRAINT IF EXISTS ticket_bugs_tipo_documento_check;
ALTER TABLE ticket_bugs ADD CONSTRAINT ticket_bugs_tipo_documento_check CHECK (tipo_documento IN (
  'SS','DO','REMESA','MANIFIESTO',
  'SEGUIMIENTO','COTIZACION','TARIFARIO','CUMPLIDO_REMESA','CUMPLIDO_MANIFIESTO','OP','LIQUIDACION',
  'OTRO'));

-- Empresa del documento afectado (las novedades anteriores quedan sin empresa)
ALTER TABLE ticket_novedades_igsi ADD COLUMN IF NOT EXISTS empresa text;
ALTER TABLE ticket_novedades_igsi DROP CONSTRAINT IF EXISTS ticket_novedades_igsi_empresa_check;
ALTER TABLE ticket_novedades_igsi ADD CONSTRAINT ticket_novedades_igsi_empresa_check CHECK (empresa IS NULL OR empresa IN ('IWF','ILT'));
COMMENT ON COLUMN ticket_novedades_igsi.empresa IS 'Empresa del documento afectado: IWF (Interworld Freight) o ILT (Interworld Land Transport)';

COMMIT;
