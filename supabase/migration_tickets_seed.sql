-- ═════════════════════════════════════════════════════════════════════════════
-- Módulo Tickets TIN-FLOW — datos iniciales
-- Se ejecuta después de migration_tickets.sql. Es idempotente: cada bloque usa
-- ON CONFLICT DO NOTHING o WHERE NOT EXISTS y busca los ids por nombre, así que
-- se puede volver a correr sin duplicar datos ni pisar ajustes hechos en
-- Configuración.
-- ═════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. Categorías (15) ────────────────────────────────────────────────────────
INSERT INTO ticket_categorias (nombre, orden) VALUES
  ('Configuración de equipos', 10),
  ('Delegación de cuentas', 20),
  ('Soporte IGSI', 30),
  ('Soporte de equipo de cómputo', 40),
  ('Compras', 50),
  ('Sistemas de gestión', 60),
  ('Capacitación', 70),
  ('Gestión de inventarios', 80),
  ('Redes', 90),
  ('Auditoría', 100),
  ('Informes', 110),
  ('Pruebas de desarrollos', 120),
  ('Mantenimiento de equipos', 130),
  ('Visitas a sucursales', 140),
  ('Otros', 150)
ON CONFLICT (nombre) DO NOTHING;

-- ── 2. Tipologías (55) ────────────────────────────────────────────────────────
-- descripcion_ayuda = "información que se pide" del catálogo.
-- prioridad_defecto queda NULL: la prioridad se calcula por impacto al crear.
INSERT INTO ticket_tipologias (
  categoria_id, nombre, descripcion_ayuda, tipo_gestion, se_mide_contra,
  requiere_aprobacion, visibilidad_restringida, adjunto_obligatorio, es_novedad_igsi, orden)
SELECT c.id, v.nombre, v.ayuda, v.tipo_gestion, v.se_mide_contra,
       v.aprobacion, v.restringida, v.adjunto, v.igsi, v.orden
FROM (VALUES
  -- Configuración de equipos
  ('Configuración de equipos', 'Alistamiento para nuevo ingreso',
   'Funcionario y cargo, fecha en que lo necesita, software requerido, perfil de referencia (igual al usuario…)',
   'SOLICITUD', 'FECHA', true, false, false, false, 10),
  ('Configuración de equipos', 'Reasignación de equipo',
   'Placa o serial, funcionario que entrega y que recibe, software adicional requerido, fecha requerida',
   'SOLICITUD', 'FECHA', false, false, false, false, 20),
  ('Configuración de equipos', 'Instalación de software',
   'Placa o serial, nombre y versión del software, justificación de uso',
   'SOLICITUD', 'FECHA', true, false, false, false, 30),
  ('Configuración de equipos', 'Configuración de correo o impresora',
   'Placa o serial, cuenta de correo o impresora a configurar, sede y puesto',
   'SOLICITUD', 'FECHA', false, false, false, false, 40),
  -- Delegación de cuentas
  ('Delegación de cuentas', 'Delegación por vacaciones o licencia',
   'Cuenta a delegar, usuario que recibe el acceso, fecha de inicio y fin',
   'SOLICITUD', 'FECHA', true, false, false, false, 10),
  ('Delegación de cuentas', 'Delegación por retiro',
   'Cuenta a delegar, usuario que recibe el acceso, fecha de retiro, tiempo que se mantiene la delegación',
   'SOLICITUD', 'FECHA', true, false, false, false, 20),
  ('Delegación de cuentas', 'Quitar delegación',
   'Cuenta delegada, usuario al que se le retira el acceso, fecha efectiva',
   'SOLICITUD', 'FECHA', false, false, false, false, 30),
  -- Soporte IGSI
  ('Soporte IGSI', 'Novedad en IGSI',
   'Documento afectado (SS, DO, remesa o manifiesto) y su número, servicio y modalidad, acción que intentaba hacer, qué pasó y qué esperaba, mensaje de error, capturas de pantalla. Al cerrar, TIN la clasifica como técnica o conceptual (ver pestaña Novedades IGSI)',
   'INCIDENTE', 'SLA', false, false, true, true, 10),
  -- Soporte de equipo de cómputo
  ('Soporte de equipo de cómputo', 'Falla de hardware',
   'Placa o serial, sede y puesto, desde cuándo ocurre, foto del daño',
   'INCIDENTE', 'SLA', false, false, true, false, 10),
  ('Soporte de equipo de cómputo', 'Lentitud del equipo',
   'Placa o serial, desde cuándo ocurre, aplicaciones abiertas cuando sucede',
   'INCIDENTE', 'SLA', false, false, false, false, 20),
  ('Soporte de equipo de cómputo', 'Periféricos (pantalla, teclado, mouse, diadema)',
   'Placa o serial del equipo, periférico afectado, foto',
   'INCIDENTE', 'SLA', false, false, true, false, 30),
  ('Soporte de equipo de cómputo', 'Error de sistema operativo',
   'Placa o serial, mensaje o captura del error, desde cuándo ocurre',
   'INCIDENTE', 'SLA', false, false, true, false, 40),
  -- Compras
  ('Compras', 'Equipo nuevo',
   'Tipo de equipo, cantidad, justificación, centro de costo, fecha requerida',
   'PLANIFICADA', 'FECHA_SIN_APROBACION', true, false, false, false, 10),
  ('Compras', 'Licencia',
   'Software, cantidad de licencias, usuarios, centro de costo, fecha requerida',
   'PLANIFICADA', 'FECHA_SIN_APROBACION', true, false, false, false, 20),
  ('Compras', 'Accesorio o periférico',
   'Elemento, cantidad, justificación, centro de costo',
   'PLANIFICADA', 'FECHA_SIN_APROBACION', true, false, false, false, 30),
  ('Compras', 'Renovación',
   'Elemento o servicio a renovar, fecha de vencimiento, centro de costo',
   'PLANIFICADA', 'FECHA_SIN_APROBACION', true, false, false, false, 40),
  -- Sistemas de gestión
  ('Sistemas de gestión', 'Reporte o actualización de indicador',
   'Indicador, periodo, fuente de datos, fecha límite',
   'SOLICITUD', 'FECHA', false, false, false, false, 10),
  ('Sistemas de gestión', 'Evidencia para requisito BASC',
   'Requisito BASC relacionado, evidencia requerida, periodo, fecha límite',
   'SOLICITUD', 'FECHA', false, false, false, false, 20),
  ('Sistemas de gestión', 'Actualización documental (procedimientos y formatos de TIN)',
   'Documento o formato, cambio solicitado, versión actual, fecha límite',
   'SOLICITUD', 'FECHA', true, false, false, false, 30),
  ('Sistemas de gestión', 'Acción correctiva o de mejora',
   'Origen (hallazgo, indicador, queja), descripción, responsable, fecha límite, ticket padre si viene de auditoría',
   'SOLICITUD', 'FECHA', false, false, false, false, 40),
  ('Sistemas de gestión', 'Seguimiento interno del proceso',
   'Tema de seguimiento, periodo, responsable, fecha de revisión',
   'SOLICITUD', 'FECHA', false, false, false, false, 50),
  -- Capacitación
  ('Capacitación', 'Inducción TI a nuevo ingreso',
   'Funcionario, cargo, fecha de ingreso, herramientas a cubrir, modalidad',
   'PLANIFICADA', 'FECHA', false, false, false, false, 10),
  ('Capacitación', 'Capacitación en IGSI',
   'Módulos a cubrir, participantes, modalidad, fecha propuesta',
   'PLANIFICADA', 'FECHA', false, false, false, false, 20),
  ('Capacitación', 'Capacitación en otra herramienta',
   'Herramienta, tema, participantes, modalidad, fecha propuesta',
   'PLANIFICADA', 'FECHA', false, false, false, false, 30),
  -- Gestión de inventarios
  ('Gestión de inventarios', 'Asignación',
   'Placa o serial, funcionario que recibe, fecha, acta firmada',
   'SOLICITUD', 'FECHA', false, false, false, false, 10),
  ('Gestión de inventarios', 'Devolución por retiro',
   'Placa o serial, funcionario que entrega, estado del equipo, acta firmada',
   'SOLICITUD', 'FECHA', false, false, false, false, 20),
  ('Gestión de inventarios', 'Traslado entre funcionarios o sedes',
   'Placa o serial, origen y destino, motivo, acta firmada',
   'SOLICITUD', 'FECHA', false, false, false, false, 30),
  ('Gestión de inventarios', 'Baja de equipo',
   'Placa o serial, motivo, concepto técnico, estado del equipo',
   'SOLICITUD', 'FECHA', true, false, false, false, 40),
  -- Redes
  ('Redes', 'Sin internet',
   'Sede y puesto, si afecta a una o varias personas, hora de inicio',
   'INCIDENTE', 'SLA', false, false, false, false, 10),
  ('Redes', 'Wi-Fi',
   'Sede y zona, dispositivo afectado, hora de inicio',
   'INCIDENTE', 'SLA', false, false, false, false, 20),
  ('Redes', 'VPN',
   'Usuario, mensaje de error, desde dónde se conecta, hora de inicio',
   'INCIDENTE', 'SLA', false, false, true, false, 30),
  ('Redes', 'Punto de red',
   'Sede y puesto, cantidad de puntos, fecha requerida',
   'SOLICITUD', 'FECHA', false, false, false, false, 40),
  ('Redes', 'Acceso a carpetas compartidas',
   'Ruta de la carpeta, tipo de acceso (lectura o edición), aprobación del dueño de la carpeta',
   'SOLICITUD', 'SLA', true, false, false, false, 50),
  -- Auditoría
  ('Auditoría', 'Solicitud de información',
   'Tipo de auditoría (interna, externa, BASC, cliente), auditor, alcance y periodo, información requerida, fecha de entrega',
   'SOLICITUD', 'FECHA', false, true, false, false, 10),
  ('Auditoría', 'Revisión de usuarios y permisos',
   'Sistemas a revisar, periodo, solicitante, fecha de entrega',
   'SOLICITUD', 'FECHA', false, true, false, false, 20),
  ('Auditoría', 'Revisión de registros de acceso',
   'Sistema, usuarios o eventos a revisar, periodo, fecha de entrega',
   'SOLICITUD', 'FECHA', false, true, false, false, 30),
  ('Auditoría', 'Verificación de controles (copias de seguridad, licencias, inventario)',
   'Control a verificar, periodo, evidencia requerida, fecha de entrega',
   'SOLICITUD', 'FECHA', false, true, false, false, 40),
  ('Auditoría', 'Atención de hallazgo',
   'Número de hallazgo, descripción, auditoría de origen, fecha de cierre; genera ticket hijo en Sistemas de gestión',
   'SOLICITUD', 'FECHA', false, true, false, false, 50),
  -- Informes
  ('Informes', 'Informe nuevo',
   'Nombre y objetivo del informe, fuente de datos (IGSI, inventario, tickets, otra), campos requeridos, periodicidad, destinatarios, fecha requerida',
   'SOLICITUD', 'FECHA', true, false, false, false, 10),
  ('Informes', 'Ajuste a informe existente',
   'Nombre del informe, cambio solicitado, ejemplo o captura de cómo debe quedar, fecha requerida',
   'SOLICITUD', 'FECHA', false, false, false, false, 20),
  ('Informes', 'Extracción puntual de datos',
   'Sistema, filtros (fechas, cliente, servicio, modalidad, documento), formato de entrega (Excel o PDF), uso que se le dará, fecha requerida',
   'SOLICITUD', 'FECHA', true, false, false, false, 30),
  ('Informes', 'Informe de gestión de TI',
   'Periodo, indicadores a incluir, destinatario, fecha de entrega',
   'SOLICITUD', 'FECHA', false, false, false, false, 40),
  -- Pruebas de desarrollos
  ('Pruebas de desarrollos', 'Prueba de funcionalidad nueva',
   'Desarrollo o requerimiento a probar, documento de la cadena (SS, DO, remesa o manifiesto), servicio y modalidad, casos de prueba, ambiente, fecha límite',
   'SOLICITUD', 'FECHA', false, false, false, false, 10),
  ('Pruebas de desarrollos', 'Prueba de corrección de bug',
   'Número del bug (B-xxx), pasos para reproducir, resultado esperado, evidencia de la prueba',
   'SOLICITUD', 'FECHA', false, false, true, false, 20),
  ('Pruebas de desarrollos', 'Prueba de regresión antes de publicar',
   'Versión, módulos y documentos a cubrir, funcionarios que prueban, fecha de publicación',
   'SOLICITUD', 'FECHA', false, false, false, false, 30),
  ('Pruebas de desarrollos', 'Prueba con fallas',
   'Caso de prueba, resultado obtenido y esperado, capturas; devuelve el bug a En desarrollo',
   'INCIDENTE', 'SLA', false, false, true, false, 40),
  -- Mantenimiento de equipos
  ('Mantenimiento de equipos', 'Mantenimiento preventivo programado',
   'Sede, equipos a intervenir (placas), fecha programada, responsable, formato de mantenimiento diligenciado',
   'PLANIFICADA', 'FECHA', false, false, false, false, 10),
  ('Mantenimiento de equipos', 'Mantenimiento correctivo con proveedor o garantía',
   'Placa o serial, falla diagnosticada, proveedor, número de caso de garantía, fecha de entrega y de devolución',
   'SOLICITUD', 'FECHA', true, false, true, false, 20),
  ('Mantenimiento de equipos', 'Mantenimiento de servidores y red',
   'Equipo o servicio, ventana de mantenimiento, servicios afectados, aviso previo a usuarios',
   'PLANIFICADA', 'FECHA', true, false, false, false, 30),
  ('Mantenimiento de equipos', 'Revisión de impresoras y periféricos',
   'Sede, equipos, fecha programada, hallazgos',
   'PLANIFICADA', 'FECHA', false, false, false, false, 40),
  -- Visitas a sucursales
  ('Visitas a sucursales', 'Visita de soporte programada',
   'Sucursal, fecha, objetivo, tickets a atender en sitio, gastos de viaje',
   'PLANIFICADA', 'FECHA', true, false, false, false, 10),
  ('Visitas a sucursales', 'Visita por novedad urgente',
   'Sucursal, ticket que la origina, por qué no se puede resolver de forma remota, impacto en la operación',
   'SOLICITUD', 'SLA', true, false, false, false, 20),
  ('Visitas a sucursales', 'Visita de inventario o auditoría',
   'Sucursal, alcance (equipos, licencias, controles BASC), fecha, acta de la visita',
   'PLANIFICADA', 'FECHA', false, false, false, false, 30),
  ('Visitas a sucursales', 'Instalación o adecuación en sede',
   'Sucursal, trabajo a realizar (equipos, puntos de red, cableado), materiales, fecha',
   'PLANIFICADA', 'FECHA', true, false, false, false, 40),
  -- Otros
  ('Otros', 'Sin clasificar',
   'Texto libre; TIN reclasifica al atender',
   'SOLICITUD', 'SLA', false, false, false, false, 10)
) AS v(categoria, nombre, ayuda, tipo_gestion, se_mide_contra, aprobacion, restringida, adjunto, igsi, orden)
JOIN ticket_categorias c ON c.nombre = v.categoria
ON CONFLICT (categoria_id, nombre) DO NOTHING;

-- ── 3. Campos por tipología (223) ─────────────────────────────────────────────
-- Solicitante, área, sede, descripción y adjuntos (capturas, fotos, actas) son
-- campos comunes del ticket y no se repiten aquí. "Novedad en IGSI" usa su propio
-- formulario (ticket_novedades_igsi) y "Sin clasificar" solo la descripción.
-- es_fecha_requerida = true copia el valor a tickets.fecha_requerida.
INSERT INTO ticket_campos_tipologia (
  tipologia_id, clave, etiqueta, tipo_dato, obligatorio, orden, opciones, ayuda, es_fecha_requerida)
SELECT t.id, v.clave, v.etiqueta, v.tipo_dato, v.obligatorio, v.orden, v.opciones::jsonb, v.ayuda, v.es_fecha
FROM (VALUES
  -- Configuración de equipos / Alistamiento para nuevo ingreso
  ('Configuración de equipos', 'Alistamiento para nuevo ingreso', 'funcionario', 'Nombre del funcionario que ingresa', 'TEXTO', true, 10, NULL, NULL, false),
  ('Configuración de equipos', 'Alistamiento para nuevo ingreso', 'cargo', 'Cargo', 'TEXTO', true, 20, NULL, NULL, false),
  ('Configuración de equipos', 'Alistamiento para nuevo ingreso', 'fecha_requerida', 'Fecha requerida', 'FECHA', true, 30, NULL, 'Fecha en que necesitas la solicitud lista', true),
  ('Configuración de equipos', 'Alistamiento para nuevo ingreso', 'software_requerido', 'Software requerido', 'TEXTO_LARGO', true, 40, NULL, NULL, false),
  ('Configuración de equipos', 'Alistamiento para nuevo ingreso', 'perfil_referencia', 'Perfil de referencia', 'USUARIO', false, 50, NULL, 'Funcionario con la misma configuración, si aplica', false),
  -- Configuración de equipos / Reasignación de equipo
  ('Configuración de equipos', 'Reasignación de equipo', 'placa_serial', 'Placa o serial del equipo', 'TEXTO', true, 10, NULL, 'Está en la etiqueta de inventario pegada al equipo', false),
  ('Configuración de equipos', 'Reasignación de equipo', 'funcionario_entrega', 'Funcionario que entrega', 'USUARIO', true, 20, NULL, NULL, false),
  ('Configuración de equipos', 'Reasignación de equipo', 'funcionario_recibe', 'Funcionario que recibe', 'USUARIO', true, 30, NULL, NULL, false),
  ('Configuración de equipos', 'Reasignación de equipo', 'software_adicional', 'Software adicional requerido', 'TEXTO_LARGO', false, 40, NULL, NULL, false),
  ('Configuración de equipos', 'Reasignación de equipo', 'fecha_requerida', 'Fecha requerida', 'FECHA', true, 50, NULL, 'Fecha en que necesitas la solicitud lista', true),
  -- Configuración de equipos / Instalación de software
  ('Configuración de equipos', 'Instalación de software', 'placa_serial', 'Placa o serial del equipo', 'TEXTO', true, 10, NULL, 'Está en la etiqueta de inventario pegada al equipo', false),
  ('Configuración de equipos', 'Instalación de software', 'software', 'Nombre del software', 'TEXTO', true, 20, NULL, NULL, false),
  ('Configuración de equipos', 'Instalación de software', 'version_software', 'Versión', 'TEXTO', false, 30, NULL, NULL, false),
  ('Configuración de equipos', 'Instalación de software', 'justificacion', 'Justificación', 'TEXTO_LARGO', true, 40, NULL, 'Para qué se necesita', false),
  ('Configuración de equipos', 'Instalación de software', 'fecha_requerida', 'Fecha requerida', 'FECHA', true, 50, NULL, 'Fecha en que necesitas la solicitud lista', true),
  -- Configuración de equipos / Configuración de correo o impresora
  ('Configuración de equipos', 'Configuración de correo o impresora', 'placa_serial', 'Placa o serial del equipo', 'TEXTO', true, 10, NULL, 'Está en la etiqueta de inventario pegada al equipo', false),
  ('Configuración de equipos', 'Configuración de correo o impresora', 'que_configurar', 'Qué se configura', 'LISTA', true, 20, '["Cuenta de correo","Impresora"]', NULL, false),
  ('Configuración de equipos', 'Configuración de correo o impresora', 'cuenta_o_impresora', 'Cuenta de correo o impresora', 'TEXTO', true, 30, NULL, 'Dirección de correo o nombre de la impresora', false),
  ('Configuración de equipos', 'Configuración de correo o impresora', 'puesto', 'Puesto', 'TEXTO', true, 40, NULL, 'Puesto o ubicación dentro de la sede', false),
  ('Configuración de equipos', 'Configuración de correo o impresora', 'fecha_requerida', 'Fecha requerida', 'FECHA', true, 50, NULL, 'Fecha en que necesitas la solicitud lista', true),
  -- Delegación de cuentas / Delegación por vacaciones o licencia
  ('Delegación de cuentas', 'Delegación por vacaciones o licencia', 'cuenta_delegar', 'Cuenta a delegar', 'TEXTO', true, 10, NULL, 'Correo o usuario de la cuenta', false),
  ('Delegación de cuentas', 'Delegación por vacaciones o licencia', 'usuario_recibe', 'Usuario que recibe el acceso', 'USUARIO', true, 20, NULL, NULL, false),
  ('Delegación de cuentas', 'Delegación por vacaciones o licencia', 'fecha_inicio', 'Fecha de inicio', 'FECHA', true, 30, NULL, 'Desde cuándo debe estar activa la delegación', true),
  ('Delegación de cuentas', 'Delegación por vacaciones o licencia', 'fecha_fin', 'Fecha de fin', 'FECHA', true, 40, NULL, 'Hasta cuándo se mantiene la delegación', false),
  -- Delegación de cuentas / Delegación por retiro
  ('Delegación de cuentas', 'Delegación por retiro', 'cuenta_delegar', 'Cuenta a delegar', 'TEXTO', true, 10, NULL, 'Correo o usuario de la cuenta', false),
  ('Delegación de cuentas', 'Delegación por retiro', 'usuario_recibe', 'Usuario que recibe el acceso', 'USUARIO', true, 20, NULL, NULL, false),
  ('Delegación de cuentas', 'Delegación por retiro', 'fecha_retiro', 'Fecha de retiro', 'FECHA', true, 30, NULL, 'Último día del funcionario', true),
  ('Delegación de cuentas', 'Delegación por retiro', 'dias_delegacion', 'Tiempo que se mantiene la delegación (días)', 'NUMERO', true, 40, NULL, NULL, false),
  -- Delegación de cuentas / Quitar delegación
  ('Delegación de cuentas', 'Quitar delegación', 'cuenta_delegada', 'Cuenta delegada', 'TEXTO', true, 10, NULL, NULL, false),
  ('Delegación de cuentas', 'Quitar delegación', 'usuario_retira', 'Usuario al que se le retira el acceso', 'USUARIO', true, 20, NULL, NULL, false),
  ('Delegación de cuentas', 'Quitar delegación', 'fecha_efectiva', 'Fecha efectiva', 'FECHA', true, 30, NULL, 'Desde cuándo se retira el acceso', true),
  -- Soporte de equipo de cómputo / Falla de hardware
  ('Soporte de equipo de cómputo', 'Falla de hardware', 'placa_serial', 'Placa o serial del equipo', 'TEXTO', true, 10, NULL, 'Está en la etiqueta de inventario pegada al equipo', false),
  ('Soporte de equipo de cómputo', 'Falla de hardware', 'puesto', 'Puesto', 'TEXTO', true, 20, NULL, 'Puesto o ubicación dentro de la sede', false),
  ('Soporte de equipo de cómputo', 'Falla de hardware', 'desde_cuando', 'Desde cuándo ocurre', 'TEXTO', true, 30, NULL, 'Ej. desde hoy a las 9 a. m., desde hace una semana', false),
  -- Soporte de equipo de cómputo / Lentitud del equipo
  ('Soporte de equipo de cómputo', 'Lentitud del equipo', 'placa_serial', 'Placa o serial del equipo', 'TEXTO', true, 10, NULL, 'Está en la etiqueta de inventario pegada al equipo', false),
  ('Soporte de equipo de cómputo', 'Lentitud del equipo', 'desde_cuando', 'Desde cuándo ocurre', 'TEXTO', true, 20, NULL, 'Ej. desde hoy a las 9 a. m., desde hace una semana', false),
  ('Soporte de equipo de cómputo', 'Lentitud del equipo', 'aplicaciones_abiertas', 'Aplicaciones abiertas cuando sucede', 'TEXTO_LARGO', true, 30, NULL, NULL, false),
  -- Soporte de equipo de cómputo / Periféricos (pantalla, teclado, mouse, diadema)
  ('Soporte de equipo de cómputo', 'Periféricos (pantalla, teclado, mouse, diadema)', 'placa_serial', 'Placa o serial del equipo', 'TEXTO', true, 10, NULL, 'Está en la etiqueta de inventario pegada al equipo', false),
  ('Soporte de equipo de cómputo', 'Periféricos (pantalla, teclado, mouse, diadema)', 'periferico', 'Periférico afectado', 'LISTA', true, 20, '["Pantalla","Teclado","Mouse","Diadema","Otro"]', NULL, false),
  -- Soporte de equipo de cómputo / Error de sistema operativo
  ('Soporte de equipo de cómputo', 'Error de sistema operativo', 'placa_serial', 'Placa o serial del equipo', 'TEXTO', true, 10, NULL, 'Está en la etiqueta de inventario pegada al equipo', false),
  ('Soporte de equipo de cómputo', 'Error de sistema operativo', 'mensaje_error', 'Mensaje de error', 'TEXTO_LARGO', false, 20, NULL, 'Copia el texto del mensaje si apareció; la captura va como adjunto', false),
  ('Soporte de equipo de cómputo', 'Error de sistema operativo', 'desde_cuando', 'Desde cuándo ocurre', 'TEXTO', true, 30, NULL, 'Ej. desde hoy a las 9 a. m., desde hace una semana', false),
  -- Compras / Equipo nuevo
  ('Compras', 'Equipo nuevo', 'tipo_equipo', 'Tipo de equipo', 'TEXTO', true, 10, NULL, 'Ej. portátil, escritorio, impresora', false),
  ('Compras', 'Equipo nuevo', 'cantidad', 'Cantidad', 'NUMERO', true, 20, NULL, NULL, false),
  ('Compras', 'Equipo nuevo', 'justificacion', 'Justificación', 'TEXTO_LARGO', true, 30, NULL, 'Para qué se necesita', false),
  ('Compras', 'Equipo nuevo', 'centro_costo', 'Centro de costo', 'TEXTO', true, 40, NULL, 'Centro de costo al que se carga la compra', false),
  ('Compras', 'Equipo nuevo', 'fecha_requerida', 'Fecha requerida', 'FECHA', true, 50, NULL, 'Fecha en que necesitas la solicitud lista', true),
  -- Compras / Licencia
  ('Compras', 'Licencia', 'software', 'Software', 'TEXTO', true, 10, NULL, NULL, false),
  ('Compras', 'Licencia', 'cantidad_licencias', 'Cantidad de licencias', 'NUMERO', true, 20, NULL, NULL, false),
  ('Compras', 'Licencia', 'usuarios', 'Usuarios que la usarán', 'TEXTO_LARGO', true, 30, NULL, NULL, false),
  ('Compras', 'Licencia', 'centro_costo', 'Centro de costo', 'TEXTO', true, 40, NULL, 'Centro de costo al que se carga la compra', false),
  ('Compras', 'Licencia', 'fecha_requerida', 'Fecha requerida', 'FECHA', true, 50, NULL, 'Fecha en que necesitas la solicitud lista', true),
  -- Compras / Accesorio o periférico
  ('Compras', 'Accesorio o periférico', 'elemento', 'Elemento', 'TEXTO', true, 10, NULL, NULL, false),
  ('Compras', 'Accesorio o periférico', 'cantidad', 'Cantidad', 'NUMERO', true, 20, NULL, NULL, false),
  ('Compras', 'Accesorio o periférico', 'justificacion', 'Justificación', 'TEXTO_LARGO', true, 30, NULL, 'Para qué se necesita', false),
  ('Compras', 'Accesorio o periférico', 'centro_costo', 'Centro de costo', 'TEXTO', true, 40, NULL, 'Centro de costo al que se carga la compra', false),
  ('Compras', 'Accesorio o periférico', 'fecha_requerida', 'Fecha requerida', 'FECHA', true, 50, NULL, 'Fecha en que necesitas la solicitud lista', true),
  -- Compras / Renovación
  ('Compras', 'Renovación', 'elemento_servicio', 'Elemento o servicio a renovar', 'TEXTO', true, 10, NULL, NULL, false),
  ('Compras', 'Renovación', 'fecha_vencimiento', 'Fecha de vencimiento', 'FECHA', true, 20, NULL, 'La renovación debe quedar lista antes de esta fecha', true),
  ('Compras', 'Renovación', 'centro_costo', 'Centro de costo', 'TEXTO', true, 30, NULL, 'Centro de costo al que se carga la compra', false),
  -- Sistemas de gestión / Reporte o actualización de indicador
  ('Sistemas de gestión', 'Reporte o actualización de indicador', 'indicador', 'Indicador', 'TEXTO', true, 10, NULL, NULL, false),
  ('Sistemas de gestión', 'Reporte o actualización de indicador', 'periodo', 'Periodo', 'TEXTO', true, 20, NULL, 'Ej. enero a junio de 2026', false),
  ('Sistemas de gestión', 'Reporte o actualización de indicador', 'fuente_datos', 'Fuente de datos', 'LISTA', true, 30, '["IGSI","Inventario","Tickets","Otra"]', NULL, false),
  ('Sistemas de gestión', 'Reporte o actualización de indicador', 'fecha_limite', 'Fecha límite', 'FECHA', true, 40, NULL, 'Fecha máxima de entrega', true),
  -- Sistemas de gestión / Evidencia para requisito BASC
  ('Sistemas de gestión', 'Evidencia para requisito BASC', 'requisito_basc', 'Requisito BASC relacionado', 'TEXTO', true, 10, NULL, NULL, false),
  ('Sistemas de gestión', 'Evidencia para requisito BASC', 'evidencia_requerida', 'Evidencia requerida', 'TEXTO_LARGO', true, 20, NULL, NULL, false),
  ('Sistemas de gestión', 'Evidencia para requisito BASC', 'periodo', 'Periodo', 'TEXTO', true, 30, NULL, 'Ej. enero a junio de 2026', false),
  ('Sistemas de gestión', 'Evidencia para requisito BASC', 'fecha_limite', 'Fecha límite', 'FECHA', true, 40, NULL, 'Fecha máxima de entrega', true),
  -- Sistemas de gestión / Actualización documental (procedimientos y formatos de TIN)
  ('Sistemas de gestión', 'Actualización documental (procedimientos y formatos de TIN)', 'documento', 'Documento o formato', 'TEXTO', true, 10, NULL, NULL, false),
  ('Sistemas de gestión', 'Actualización documental (procedimientos y formatos de TIN)', 'cambio_solicitado', 'Cambio solicitado', 'TEXTO_LARGO', true, 20, NULL, NULL, false),
  ('Sistemas de gestión', 'Actualización documental (procedimientos y formatos de TIN)', 'version_actual', 'Versión actual', 'TEXTO', false, 30, NULL, NULL, false),
  ('Sistemas de gestión', 'Actualización documental (procedimientos y formatos de TIN)', 'fecha_limite', 'Fecha límite', 'FECHA', true, 40, NULL, 'Fecha máxima de entrega', true),
  -- Sistemas de gestión / Acción correctiva o de mejora
  ('Sistemas de gestión', 'Acción correctiva o de mejora', 'origen', 'Origen', 'LISTA', true, 10, '["Hallazgo","Indicador","Queja","Otro"]', NULL, false),
  ('Sistemas de gestión', 'Acción correctiva o de mejora', 'responsable', 'Responsable de la acción', 'USUARIO', true, 20, NULL, NULL, false),
  ('Sistemas de gestión', 'Acción correctiva o de mejora', 'fecha_limite', 'Fecha límite', 'FECHA', true, 30, NULL, 'Fecha máxima de entrega', true),
  ('Sistemas de gestión', 'Acción correctiva o de mejora', 'ticket_padre', 'Ticket de auditoría que la origina', 'TEXTO', false, 40, NULL, 'Número TK-xxxx, si viene de una auditoría', false),
  -- Sistemas de gestión / Seguimiento interno del proceso
  ('Sistemas de gestión', 'Seguimiento interno del proceso', 'tema', 'Tema de seguimiento', 'TEXTO', true, 10, NULL, NULL, false),
  ('Sistemas de gestión', 'Seguimiento interno del proceso', 'periodo', 'Periodo', 'TEXTO', true, 20, NULL, 'Ej. enero a junio de 2026', false),
  ('Sistemas de gestión', 'Seguimiento interno del proceso', 'responsable', 'Responsable', 'USUARIO', true, 30, NULL, NULL, false),
  ('Sistemas de gestión', 'Seguimiento interno del proceso', 'fecha_revision', 'Fecha de revisión', 'FECHA', true, 40, NULL, 'Fecha en que debe hacerse la revisión', true),
  -- Capacitación / Inducción TI a nuevo ingreso
  ('Capacitación', 'Inducción TI a nuevo ingreso', 'funcionario', 'Nombre del funcionario', 'TEXTO', true, 10, NULL, NULL, false),
  ('Capacitación', 'Inducción TI a nuevo ingreso', 'cargo', 'Cargo', 'TEXTO', true, 20, NULL, NULL, false),
  ('Capacitación', 'Inducción TI a nuevo ingreso', 'fecha_ingreso', 'Fecha de ingreso', 'FECHA', true, 30, NULL, 'Primer día del funcionario', true),
  ('Capacitación', 'Inducción TI a nuevo ingreso', 'herramientas', 'Herramientas a cubrir', 'TEXTO_LARGO', true, 40, NULL, NULL, false),
  ('Capacitación', 'Inducción TI a nuevo ingreso', 'modalidad', 'Modalidad', 'LISTA', true, 50, '["Presencial","Virtual"]', NULL, false),
  -- Capacitación / Capacitación en IGSI
  ('Capacitación', 'Capacitación en IGSI', 'modulos', 'Módulos a cubrir', 'TEXTO_LARGO', true, 10, NULL, NULL, false),
  ('Capacitación', 'Capacitación en IGSI', 'participantes', 'Participantes', 'TEXTO_LARGO', true, 20, NULL, NULL, false),
  ('Capacitación', 'Capacitación en IGSI', 'modalidad', 'Modalidad', 'LISTA', true, 30, '["Presencial","Virtual"]', NULL, false),
  ('Capacitación', 'Capacitación en IGSI', 'fecha_propuesta', 'Fecha propuesta', 'FECHA', true, 40, NULL, 'Fecha sugerida para la capacitación', true),
  -- Capacitación / Capacitación en otra herramienta
  ('Capacitación', 'Capacitación en otra herramienta', 'herramienta', 'Herramienta', 'TEXTO', true, 10, NULL, NULL, false),
  ('Capacitación', 'Capacitación en otra herramienta', 'tema', 'Tema', 'TEXTO', true, 20, NULL, NULL, false),
  ('Capacitación', 'Capacitación en otra herramienta', 'participantes', 'Participantes', 'TEXTO_LARGO', true, 30, NULL, NULL, false),
  ('Capacitación', 'Capacitación en otra herramienta', 'modalidad', 'Modalidad', 'LISTA', true, 40, '["Presencial","Virtual"]', NULL, false),
  ('Capacitación', 'Capacitación en otra herramienta', 'fecha_propuesta', 'Fecha propuesta', 'FECHA', true, 50, NULL, 'Fecha sugerida para la capacitación', true),
  -- Gestión de inventarios / Asignación
  ('Gestión de inventarios', 'Asignación', 'placa_serial', 'Placa o serial del equipo', 'TEXTO', true, 10, NULL, 'Está en la etiqueta de inventario pegada al equipo', false),
  ('Gestión de inventarios', 'Asignación', 'funcionario_recibe', 'Funcionario que recibe', 'USUARIO', true, 20, NULL, NULL, false),
  ('Gestión de inventarios', 'Asignación', 'fecha_asignacion', 'Fecha de asignación', 'FECHA', true, 30, NULL, 'Fecha en que se entrega el equipo', true),
  ('Gestión de inventarios', 'Asignación', 'acta_firmada', 'Acta firmada adjunta', 'CASILLA', false, 40, NULL, 'Marca si ya adjuntaste el acta firmada', false),
  -- Gestión de inventarios / Devolución por retiro
  ('Gestión de inventarios', 'Devolución por retiro', 'placa_serial', 'Placa o serial del equipo', 'TEXTO', true, 10, NULL, 'Está en la etiqueta de inventario pegada al equipo', false),
  ('Gestión de inventarios', 'Devolución por retiro', 'funcionario_entrega', 'Funcionario que entrega', 'USUARIO', true, 20, NULL, NULL, false),
  ('Gestión de inventarios', 'Devolución por retiro', 'estado_equipo', 'Estado del equipo', 'LISTA', true, 30, '["Bueno","Regular","Dañado"]', NULL, false),
  ('Gestión de inventarios', 'Devolución por retiro', 'acta_firmada', 'Acta firmada adjunta', 'CASILLA', false, 40, NULL, 'Marca si ya adjuntaste el acta firmada', false),
  ('Gestión de inventarios', 'Devolución por retiro', 'fecha_devolucion', 'Fecha de devolución', 'FECHA', true, 50, NULL, 'Fecha en que se recibe el equipo', true),
  -- Gestión de inventarios / Traslado entre funcionarios o sedes
  ('Gestión de inventarios', 'Traslado entre funcionarios o sedes', 'placa_serial', 'Placa o serial del equipo', 'TEXTO', true, 10, NULL, 'Está en la etiqueta de inventario pegada al equipo', false),
  ('Gestión de inventarios', 'Traslado entre funcionarios o sedes', 'origen', 'Origen', 'TEXTO', true, 20, NULL, 'Funcionario o sede de donde sale', false),
  ('Gestión de inventarios', 'Traslado entre funcionarios o sedes', 'destino', 'Destino', 'TEXTO', true, 30, NULL, 'Funcionario o sede que lo recibe', false),
  ('Gestión de inventarios', 'Traslado entre funcionarios o sedes', 'motivo', 'Motivo', 'TEXTO_LARGO', true, 40, NULL, NULL, false),
  ('Gestión de inventarios', 'Traslado entre funcionarios o sedes', 'acta_firmada', 'Acta firmada adjunta', 'CASILLA', false, 50, NULL, 'Marca si ya adjuntaste el acta firmada', false),
  ('Gestión de inventarios', 'Traslado entre funcionarios o sedes', 'fecha_requerida', 'Fecha requerida', 'FECHA', true, 60, NULL, 'Fecha en que necesitas la solicitud lista', true),
  -- Gestión de inventarios / Baja de equipo
  ('Gestión de inventarios', 'Baja de equipo', 'placa_serial', 'Placa o serial del equipo', 'TEXTO', true, 10, NULL, 'Está en la etiqueta de inventario pegada al equipo', false),
  ('Gestión de inventarios', 'Baja de equipo', 'motivo', 'Motivo', 'TEXTO_LARGO', true, 20, NULL, NULL, false),
  ('Gestión de inventarios', 'Baja de equipo', 'concepto_tecnico', 'Concepto técnico', 'TEXTO_LARGO', true, 30, NULL, NULL, false),
  ('Gestión de inventarios', 'Baja de equipo', 'estado_equipo', 'Estado del equipo', 'LISTA', true, 40, '["Bueno","Regular","Dañado"]', NULL, false),
  ('Gestión de inventarios', 'Baja de equipo', 'fecha_requerida', 'Fecha requerida', 'FECHA', true, 50, NULL, 'Fecha en que necesitas la solicitud lista', true),
  -- Redes / Sin internet
  ('Redes', 'Sin internet', 'puesto', 'Puesto', 'TEXTO', true, 10, NULL, 'Puesto o ubicación dentro de la sede', false),
  ('Redes', 'Sin internet', 'alcance', 'A quién afecta', 'LISTA', true, 20, '["Solo a mí","Varias personas","Toda la sede"]', NULL, false),
  ('Redes', 'Sin internet', 'hora_inicio', 'Hora de inicio', 'TEXTO', true, 30, NULL, 'Hora aproximada en que empezó la falla', false),
  -- Redes / Wi-Fi
  ('Redes', 'Wi-Fi', 'zona', 'Zona', 'TEXTO', true, 10, NULL, 'Zona o piso dentro de la sede', false),
  ('Redes', 'Wi-Fi', 'dispositivo', 'Dispositivo afectado', 'TEXTO', true, 20, NULL, 'Ej. portátil, celular corporativo', false),
  ('Redes', 'Wi-Fi', 'hora_inicio', 'Hora de inicio', 'TEXTO', true, 30, NULL, 'Hora aproximada en que empezó la falla', false),
  -- Redes / VPN
  ('Redes', 'VPN', 'usuario_vpn', 'Usuario de la VPN', 'TEXTO', true, 10, NULL, NULL, false),
  ('Redes', 'VPN', 'mensaje_error', 'Mensaje de error', 'TEXTO_LARGO', false, 20, NULL, 'Copia el texto del mensaje si apareció', false),
  ('Redes', 'VPN', 'ubicacion_conexion', 'Desde dónde se conecta', 'TEXTO', true, 30, NULL, 'Ej. casa, otra sede, red de un cliente', false),
  ('Redes', 'VPN', 'hora_inicio', 'Hora de inicio', 'TEXTO', true, 40, NULL, 'Hora aproximada en que empezó la falla', false),
  -- Redes / Punto de red
  ('Redes', 'Punto de red', 'puesto', 'Puesto', 'TEXTO', true, 10, NULL, 'Puesto o ubicación dentro de la sede', false),
  ('Redes', 'Punto de red', 'cantidad_puntos', 'Cantidad de puntos', 'NUMERO', true, 20, NULL, NULL, false),
  ('Redes', 'Punto de red', 'fecha_requerida', 'Fecha requerida', 'FECHA', true, 30, NULL, 'Fecha en que necesitas la solicitud lista', true),
  -- Redes / Acceso a carpetas compartidas
  ('Redes', 'Acceso a carpetas compartidas', 'ruta_carpeta', 'Ruta de la carpeta', 'TEXTO', true, 10, NULL, 'Ej. \\servidor\area\carpeta', false),
  ('Redes', 'Acceso a carpetas compartidas', 'tipo_acceso', 'Tipo de acceso', 'LISTA', true, 20, '["Lectura","Edición"]', NULL, false),
  ('Redes', 'Acceso a carpetas compartidas', 'dueno_carpeta', 'Dueño de la carpeta', 'USUARIO', true, 30, NULL, NULL, false),
  ('Redes', 'Acceso a carpetas compartidas', 'aprobacion_dueno', 'El dueño de la carpeta aprobó el acceso', 'CASILLA', true, 40, NULL, 'Adjunta el correo de aprobación si lo tienes', false),
  -- Auditoría / Solicitud de información
  ('Auditoría', 'Solicitud de información', 'tipo_auditoria', 'Tipo de auditoría', 'LISTA', true, 10, '["Interna","Externa","BASC","Cliente"]', NULL, false),
  ('Auditoría', 'Solicitud de información', 'auditor', 'Auditor', 'TEXTO', true, 20, NULL, NULL, false),
  ('Auditoría', 'Solicitud de información', 'alcance_periodo', 'Alcance y periodo', 'TEXTO_LARGO', true, 30, NULL, NULL, false),
  ('Auditoría', 'Solicitud de información', 'informacion_requerida', 'Información requerida', 'TEXTO_LARGO', true, 40, NULL, NULL, false),
  ('Auditoría', 'Solicitud de información', 'fecha_entrega', 'Fecha de entrega', 'FECHA', true, 50, NULL, 'Fecha en que debe entregarse la información', true),
  -- Auditoría / Revisión de usuarios y permisos
  ('Auditoría', 'Revisión de usuarios y permisos', 'sistemas', 'Sistemas a revisar', 'TEXTO_LARGO', true, 10, NULL, NULL, false),
  ('Auditoría', 'Revisión de usuarios y permisos', 'periodo', 'Periodo', 'TEXTO', true, 20, NULL, 'Ej. enero a junio de 2026', false),
  ('Auditoría', 'Revisión de usuarios y permisos', 'fecha_entrega', 'Fecha de entrega', 'FECHA', true, 30, NULL, 'Fecha en que debe entregarse la información', true),
  -- Auditoría / Revisión de registros de acceso
  ('Auditoría', 'Revisión de registros de acceso', 'sistema', 'Sistema', 'TEXTO', true, 10, NULL, NULL, false),
  ('Auditoría', 'Revisión de registros de acceso', 'usuarios_eventos', 'Usuarios o eventos a revisar', 'TEXTO_LARGO', true, 20, NULL, NULL, false),
  ('Auditoría', 'Revisión de registros de acceso', 'periodo', 'Periodo', 'TEXTO', true, 30, NULL, 'Ej. enero a junio de 2026', false),
  ('Auditoría', 'Revisión de registros de acceso', 'fecha_entrega', 'Fecha de entrega', 'FECHA', true, 40, NULL, 'Fecha en que debe entregarse la información', true),
  -- Auditoría / Verificación de controles (copias de seguridad, licencias, inventario)
  ('Auditoría', 'Verificación de controles (copias de seguridad, licencias, inventario)', 'control', 'Control a verificar', 'LISTA', true, 10, '["Copias de seguridad","Licencias","Inventario","Otro"]', NULL, false),
  ('Auditoría', 'Verificación de controles (copias de seguridad, licencias, inventario)', 'periodo', 'Periodo', 'TEXTO', true, 20, NULL, 'Ej. enero a junio de 2026', false),
  ('Auditoría', 'Verificación de controles (copias de seguridad, licencias, inventario)', 'evidencia_requerida', 'Evidencia requerida', 'TEXTO_LARGO', true, 30, NULL, NULL, false),
  ('Auditoría', 'Verificación de controles (copias de seguridad, licencias, inventario)', 'fecha_entrega', 'Fecha de entrega', 'FECHA', true, 40, NULL, 'Fecha en que debe entregarse la información', true),
  -- Auditoría / Atención de hallazgo
  ('Auditoría', 'Atención de hallazgo', 'numero_hallazgo', 'Número de hallazgo', 'TEXTO', true, 10, NULL, NULL, false),
  ('Auditoría', 'Atención de hallazgo', 'auditoria_origen', 'Auditoría de origen', 'TEXTO', true, 20, NULL, NULL, false),
  ('Auditoría', 'Atención de hallazgo', 'fecha_cierre', 'Fecha de cierre', 'FECHA', true, 30, NULL, 'Fecha comprometida para cerrar el hallazgo', true),
  -- Informes / Informe nuevo
  ('Informes', 'Informe nuevo', 'nombre_informe', 'Nombre del informe', 'TEXTO', true, 10, NULL, NULL, false),
  ('Informes', 'Informe nuevo', 'objetivo', 'Objetivo del informe', 'TEXTO_LARGO', true, 20, NULL, NULL, false),
  ('Informes', 'Informe nuevo', 'fuente_datos', 'Fuente de datos', 'LISTA', true, 30, '["IGSI","Inventario","Tickets","Otra"]', NULL, false),
  ('Informes', 'Informe nuevo', 'campos_requeridos', 'Campos requeridos', 'TEXTO_LARGO', true, 40, NULL, NULL, false),
  ('Informes', 'Informe nuevo', 'periodicidad', 'Periodicidad', 'LISTA', true, 50, '["Única vez","Diaria","Semanal","Mensual","Trimestral","Anual"]', NULL, false),
  ('Informes', 'Informe nuevo', 'destinatarios', 'Destinatarios', 'TEXTO', true, 60, NULL, NULL, false),
  ('Informes', 'Informe nuevo', 'fecha_requerida', 'Fecha requerida', 'FECHA', true, 70, NULL, 'Fecha en que necesitas la solicitud lista', true),
  -- Informes / Ajuste a informe existente
  ('Informes', 'Ajuste a informe existente', 'nombre_informe', 'Nombre del informe', 'TEXTO', true, 10, NULL, NULL, false),
  ('Informes', 'Ajuste a informe existente', 'cambio_solicitado', 'Cambio solicitado', 'TEXTO_LARGO', true, 20, NULL, 'El ejemplo o la captura de cómo debe quedar va como adjunto', false),
  ('Informes', 'Ajuste a informe existente', 'fecha_requerida', 'Fecha requerida', 'FECHA', true, 30, NULL, 'Fecha en que necesitas la solicitud lista', true),
  -- Informes / Extracción puntual de datos
  ('Informes', 'Extracción puntual de datos', 'sistema', 'Sistema', 'TEXTO', true, 10, NULL, NULL, false),
  ('Informes', 'Extracción puntual de datos', 'filtros', 'Filtros', 'TEXTO_LARGO', true, 20, NULL, 'Fechas, cliente, servicio, modalidad, documento', false),
  ('Informes', 'Extracción puntual de datos', 'formato_entrega', 'Formato de entrega', 'LISTA', true, 30, '["Excel","PDF"]', NULL, false),
  ('Informes', 'Extracción puntual de datos', 'uso', 'Uso que se le dará', 'TEXTO_LARGO', true, 40, NULL, NULL, false),
  ('Informes', 'Extracción puntual de datos', 'fecha_requerida', 'Fecha requerida', 'FECHA', true, 50, NULL, 'Fecha en que necesitas la solicitud lista', true),
  -- Informes / Informe de gestión de TI
  ('Informes', 'Informe de gestión de TI', 'periodo', 'Periodo', 'TEXTO', true, 10, NULL, 'Ej. enero a junio de 2026', false),
  ('Informes', 'Informe de gestión de TI', 'indicadores', 'Indicadores a incluir', 'TEXTO_LARGO', true, 20, NULL, NULL, false),
  ('Informes', 'Informe de gestión de TI', 'destinatario', 'Destinatario', 'TEXTO', true, 30, NULL, NULL, false),
  ('Informes', 'Informe de gestión de TI', 'fecha_entrega', 'Fecha de entrega', 'FECHA', true, 40, NULL, 'Fecha en que debe entregarse la información', true),
  -- Pruebas de desarrollos / Prueba de funcionalidad nueva
  ('Pruebas de desarrollos', 'Prueba de funcionalidad nueva', 'desarrollo', 'Desarrollo o requerimiento a probar', 'TEXTO', true, 10, NULL, NULL, false),
  ('Pruebas de desarrollos', 'Prueba de funcionalidad nueva', 'documento_cadena', 'Documento de la cadena', 'LISTA', true, 20, '["SS","DO","Remesa","Manifiesto","No aplica"]', NULL, false),
  ('Pruebas de desarrollos', 'Prueba de funcionalidad nueva', 'servicio', 'Servicio', 'TEXTO', true, 30, NULL, NULL, false),
  ('Pruebas de desarrollos', 'Prueba de funcionalidad nueva', 'modalidad', 'Modalidad', 'TEXTO', true, 40, NULL, NULL, false),
  ('Pruebas de desarrollos', 'Prueba de funcionalidad nueva', 'casos_prueba', 'Casos de prueba', 'TEXTO_LARGO', true, 50, NULL, NULL, false),
  ('Pruebas de desarrollos', 'Prueba de funcionalidad nueva', 'ambiente', 'Ambiente', 'LISTA', true, 60, '["Pruebas","Producción"]', NULL, false),
  ('Pruebas de desarrollos', 'Prueba de funcionalidad nueva', 'fecha_limite', 'Fecha límite', 'FECHA', true, 70, NULL, 'Fecha máxima de entrega', true),
  -- Pruebas de desarrollos / Prueba de corrección de bug
  ('Pruebas de desarrollos', 'Prueba de corrección de bug', 'numero_bug', 'Número del bug', 'TEXTO', true, 10, NULL, 'Formato B-xxx', false),
  ('Pruebas de desarrollos', 'Prueba de corrección de bug', 'pasos_reproducir', 'Pasos para reproducir', 'TEXTO_LARGO', true, 20, NULL, NULL, false),
  ('Pruebas de desarrollos', 'Prueba de corrección de bug', 'resultado_esperado', 'Resultado esperado', 'TEXTO_LARGO', true, 30, NULL, 'La evidencia de la prueba va como adjunto', false),
  ('Pruebas de desarrollos', 'Prueba de corrección de bug', 'fecha_requerida', 'Fecha requerida', 'FECHA', true, 40, NULL, 'Fecha en que necesitas la solicitud lista', true),
  -- Pruebas de desarrollos / Prueba de regresión antes de publicar
  ('Pruebas de desarrollos', 'Prueba de regresión antes de publicar', 'version', 'Versión', 'TEXTO', true, 10, NULL, NULL, false),
  ('Pruebas de desarrollos', 'Prueba de regresión antes de publicar', 'modulos_documentos', 'Módulos y documentos a cubrir', 'TEXTO_LARGO', true, 20, NULL, NULL, false),
  ('Pruebas de desarrollos', 'Prueba de regresión antes de publicar', 'funcionarios_prueban', 'Funcionarios que prueban', 'TEXTO_LARGO', true, 30, NULL, NULL, false),
  ('Pruebas de desarrollos', 'Prueba de regresión antes de publicar', 'fecha_publicacion', 'Fecha de publicación', 'FECHA', true, 40, NULL, 'Fecha prevista de publicación', true),
  -- Pruebas de desarrollos / Prueba con fallas
  ('Pruebas de desarrollos', 'Prueba con fallas', 'caso_prueba', 'Caso de prueba', 'TEXTO', true, 10, NULL, NULL, false),
  ('Pruebas de desarrollos', 'Prueba con fallas', 'resultado_obtenido', 'Resultado obtenido', 'TEXTO_LARGO', true, 20, NULL, NULL, false),
  ('Pruebas de desarrollos', 'Prueba con fallas', 'resultado_esperado', 'Resultado esperado', 'TEXTO_LARGO', true, 30, NULL, NULL, false),
  ('Pruebas de desarrollos', 'Prueba con fallas', 'numero_bug', 'Número del bug', 'TEXTO', false, 40, NULL, 'Formato B-xxx, si la prueba es de un bug', false),
  -- Mantenimiento de equipos / Mantenimiento preventivo programado
  ('Mantenimiento de equipos', 'Mantenimiento preventivo programado', 'equipos', 'Equipos a intervenir (placas)', 'TEXTO_LARGO', true, 10, NULL, NULL, false),
  ('Mantenimiento de equipos', 'Mantenimiento preventivo programado', 'fecha_programada', 'Fecha programada', 'FECHA', true, 20, NULL, 'Fecha del mantenimiento', true),
  ('Mantenimiento de equipos', 'Mantenimiento preventivo programado', 'responsable', 'Responsable', 'USUARIO', true, 30, NULL, NULL, false),
  ('Mantenimiento de equipos', 'Mantenimiento preventivo programado', 'formato_diligenciado', 'Formato de mantenimiento diligenciado', 'CASILLA', false, 40, NULL, 'Marca al adjuntar el formato diligenciado', false),
  -- Mantenimiento de equipos / Mantenimiento correctivo con proveedor o garantía
  ('Mantenimiento de equipos', 'Mantenimiento correctivo con proveedor o garantía', 'placa_serial', 'Placa o serial del equipo', 'TEXTO', true, 10, NULL, 'Está en la etiqueta de inventario pegada al equipo', false),
  ('Mantenimiento de equipos', 'Mantenimiento correctivo con proveedor o garantía', 'falla_diagnosticada', 'Falla diagnosticada', 'TEXTO_LARGO', true, 20, NULL, NULL, false),
  ('Mantenimiento de equipos', 'Mantenimiento correctivo con proveedor o garantía', 'proveedor', 'Proveedor', 'TEXTO', true, 30, NULL, NULL, false),
  ('Mantenimiento de equipos', 'Mantenimiento correctivo con proveedor o garantía', 'numero_caso_garantia', 'Número de caso de garantía', 'TEXTO', false, 40, NULL, NULL, false),
  ('Mantenimiento de equipos', 'Mantenimiento correctivo con proveedor o garantía', 'fecha_entrega', 'Fecha de entrega al proveedor', 'FECHA', true, 50, NULL, 'Fecha en que se entrega el equipo', true),
  ('Mantenimiento de equipos', 'Mantenimiento correctivo con proveedor o garantía', 'fecha_devolucion', 'Fecha de devolución', 'FECHA', false, 60, NULL, 'Fecha prevista de regreso del equipo', false),
  -- Mantenimiento de equipos / Mantenimiento de servidores y red
  ('Mantenimiento de equipos', 'Mantenimiento de servidores y red', 'equipo_servicio', 'Equipo o servicio', 'TEXTO', true, 10, NULL, NULL, false),
  ('Mantenimiento de equipos', 'Mantenimiento de servidores y red', 'fecha_programada', 'Fecha de la ventana', 'FECHA', true, 20, NULL, 'Día de la ventana de mantenimiento', true),
  ('Mantenimiento de equipos', 'Mantenimiento de servidores y red', 'ventana_mantenimiento', 'Horario de la ventana', 'TEXTO', true, 30, NULL, 'Ej. 7:00 p. m. a 10:00 p. m.', false),
  ('Mantenimiento de equipos', 'Mantenimiento de servidores y red', 'servicios_afectados', 'Servicios afectados', 'TEXTO_LARGO', true, 40, NULL, NULL, false),
  ('Mantenimiento de equipos', 'Mantenimiento de servidores y red', 'aviso_previo', 'Se avisó previamente a los usuarios', 'CASILLA', false, 50, NULL, NULL, false),
  -- Mantenimiento de equipos / Revisión de impresoras y periféricos
  ('Mantenimiento de equipos', 'Revisión de impresoras y periféricos', 'equipos', 'Equipos', 'TEXTO_LARGO', true, 10, NULL, NULL, false),
  ('Mantenimiento de equipos', 'Revisión de impresoras y periféricos', 'fecha_programada', 'Fecha programada', 'FECHA', true, 20, NULL, 'Fecha de la revisión', true),
  ('Mantenimiento de equipos', 'Revisión de impresoras y periféricos', 'hallazgos', 'Hallazgos', 'TEXTO_LARGO', false, 30, NULL, 'Se diligencia después de la revisión', false),
  -- Visitas a sucursales / Visita de soporte programada
  ('Visitas a sucursales', 'Visita de soporte programada', 'sucursal', 'Sucursal', 'LISTA', true, 10, '["Bogotá","Cali","Medellín","Buenaventura","Cartagena","Mosquera","Pereira","Costa Norte"]', NULL, false),
  ('Visitas a sucursales', 'Visita de soporte programada', 'fecha_visita', 'Fecha de la visita', 'FECHA', true, 20, NULL, 'Fecha programada de la visita', true),
  ('Visitas a sucursales', 'Visita de soporte programada', 'objetivo', 'Objetivo', 'TEXTO_LARGO', true, 30, NULL, NULL, false),
  ('Visitas a sucursales', 'Visita de soporte programada', 'tickets_atender', 'Tickets a atender en sitio', 'TEXTO_LARGO', false, 40, NULL, 'Números TK-xxxx', false),
  ('Visitas a sucursales', 'Visita de soporte programada', 'gastos_viaje', 'Gastos de viaje estimados', 'NUMERO', true, 50, NULL, 'Valor estimado en pesos', false),
  -- Visitas a sucursales / Visita por novedad urgente
  ('Visitas a sucursales', 'Visita por novedad urgente', 'sucursal', 'Sucursal', 'LISTA', true, 10, '["Bogotá","Cali","Medellín","Buenaventura","Cartagena","Mosquera","Pereira","Costa Norte"]', NULL, false),
  ('Visitas a sucursales', 'Visita por novedad urgente', 'ticket_origen', 'Ticket que la origina', 'TEXTO', true, 20, NULL, 'Número TK-xxxx', false),
  ('Visitas a sucursales', 'Visita por novedad urgente', 'motivo_no_remoto', 'Por qué no se puede resolver de forma remota', 'TEXTO_LARGO', true, 30, NULL, NULL, false),
  ('Visitas a sucursales', 'Visita por novedad urgente', 'impacto_operacion', 'Impacto en la operación', 'TEXTO_LARGO', true, 40, NULL, NULL, false),
  -- Visitas a sucursales / Visita de inventario o auditoría
  ('Visitas a sucursales', 'Visita de inventario o auditoría', 'sucursal', 'Sucursal', 'LISTA', true, 10, '["Bogotá","Cali","Medellín","Buenaventura","Cartagena","Mosquera","Pereira","Costa Norte"]', NULL, false),
  ('Visitas a sucursales', 'Visita de inventario o auditoría', 'alcance', 'Alcance', 'LISTA', true, 20, '["Equipos","Licencias","Controles BASC","Todos"]', NULL, false),
  ('Visitas a sucursales', 'Visita de inventario o auditoría', 'fecha_visita', 'Fecha de la visita', 'FECHA', true, 30, NULL, 'Fecha programada de la visita', true),
  ('Visitas a sucursales', 'Visita de inventario o auditoría', 'acta_visita', 'Acta de la visita adjunta', 'CASILLA', false, 40, NULL, 'Se adjunta al terminar la visita', false),
  -- Visitas a sucursales / Instalación o adecuación en sede
  ('Visitas a sucursales', 'Instalación o adecuación en sede', 'sucursal', 'Sucursal', 'LISTA', true, 10, '["Bogotá","Cali","Medellín","Buenaventura","Cartagena","Mosquera","Pereira","Costa Norte"]', NULL, false),
  ('Visitas a sucursales', 'Instalación o adecuación en sede', 'trabajo', 'Trabajo a realizar', 'TEXTO_LARGO', true, 20, NULL, 'Equipos, puntos de red, cableado', false),
  ('Visitas a sucursales', 'Instalación o adecuación en sede', 'materiales', 'Materiales', 'TEXTO_LARGO', true, 30, NULL, NULL, false),
  ('Visitas a sucursales', 'Instalación o adecuación en sede', 'fecha_trabajo', 'Fecha requerida', 'FECHA', true, 40, NULL, 'Fecha en que debe quedar listo el trabajo', true)
) AS v(categoria, tipologia, clave, etiqueta, tipo_dato, obligatorio, orden, opciones, ayuda, es_fecha)
JOIN ticket_categorias c ON c.nombre = v.categoria
JOIN ticket_tipologias  t ON t.categoria_id = c.id AND t.nombre = v.tipologia
ON CONFLICT (tipologia_id, clave) DO NOTHING;

-- ── 4. Causas de cierre (19) ──────────────────────────────────────────────────
-- IGSI: técnica / conceptual de las novedades IGSI. GENERAL: resto de tickets.
INSERT INTO ticket_causas (ambito, tipo_causa, subcausa, orden) VALUES
  ('IGSI', 'Técnica', 'Error del sistema (falla, caída o mensaje inesperado)', 10),
  ('IGSI', 'Técnica', 'Integración o reporte externo que no responde', 20),
  ('IGSI', 'Técnica', 'Parametrización o dato maestro incorrecto (tarifas, clientes, rutas)', 30),
  ('IGSI', 'Técnica', 'Lentitud o bloqueo de la aplicación', 40),
  ('IGSI', 'Técnica', 'Comportamiento que requiere ajuste o desarrollo', 50),
  ('IGSI', 'Conceptual', 'Falta de validación del funcionario (datos no revisados antes de guardar)', 60),
  ('IGSI', 'Conceptual', 'Dato mal digitado o incompleto', 70),
  ('IGSI', 'Conceptual', 'Paso del proceso omitido o en otro orden', 80),
  ('IGSI', 'Conceptual', 'Servicio o modalidad mal seleccionados', 90),
  ('IGSI', 'Conceptual', 'Desconocimiento del procedimiento', 100),
  ('GENERAL', 'Solicitud atendida', 'Atendida según lo solicitado', 10),
  ('GENERAL', 'Falla técnica', 'Hardware', 20),
  ('GENERAL', 'Falla técnica', 'Software', 30),
  ('GENERAL', 'Falla técnica', 'Red o conectividad', 40),
  ('GENERAL', 'Uso', 'Error de uso', 50),
  ('GENERAL', 'Uso', 'Desconocimiento del procedimiento', 60),
  ('GENERAL', 'Tercero', 'Proveedor o garantía', 70),
  ('GENERAL', 'No procede', 'Duplicado', 80),
  ('GENERAL', 'No procede', 'Fuera del alcance de TIN', 90)
ON CONFLICT (ambito, tipo_causa, subcausa) DO NOTHING;

-- ── 5. Objetivos de tiempo por prioridad (horas hábiles) ──────────────────────
-- Valores de ejemplo, pendientes de aprobación de la Dirección de TI.
INSERT INTO ticket_objetivos_tiempo (prioridad, horas_respuesta, horas_solucion, vigente_desde, aprobado) VALUES
  ('CRITICA', 1, 4, '2026-01-01', false),
  ('ALTA', 2, 8, '2026-01-01', false),
  ('MEDIA', 4, 16, '2026-01-01', false),
  ('BAJA', 8, 40, '2026-01-01', false)
ON CONFLICT (prioridad, vigente_desde) DO NOTHING;

-- ── 6. Reglas de recordatorio (10) ────────────────────────────────────────────
-- CIERRE_AUTO: el cron cierra el ticket tras 3 días hábiles en espera de usuario.
-- Los tickets en RESUELTO sin confirmación se cierran con ticket_config.dias_cierre_automatico.
INSERT INTO ticket_reglas_recordatorio
  (codigo, nombre, disparador, porcentaje, dias_habiles, destinatarios, canal, plantilla, accion, orden) VALUES
  ('RESP_50', '50% del tiempo de respuesta sin responder', 'RESPUESTA', 50, NULL, ARRAY['RESPONSABLE'], 'AMBOS',
   'Ticket, solicitante y tiempo que queda', NULL, 10),
  ('RESP_100', '100% del tiempo de respuesta sin responder', 'RESPUESTA', 100, NULL, ARRAY['RESPONSABLE', 'COORDINADOR'], 'CORREO',
   'El ticket queda marcado como respuesta vencida', 'MARCAR_RESPUESTA_VENCIDA', 20),
  ('SOL_80', '80% del tiempo de solución', 'SOLUCION', 80, NULL, ARRAY['RESPONSABLE', 'COORDINADOR'], 'AMBOS',
   'Tiempo consumido y último movimiento', NULL, 30),
  ('SOL_100', '100% del tiempo de solución', 'SOLUCION', 100, NULL, ARRAY['COORDINADOR', 'DIRECCION'], 'CORREO',
   'El ticket queda marcado como vencido y entra al reporte', 'MARCAR_VENCIDO', 40),
  ('ESP_USR_1', '1 día hábil en espera de usuario', 'ESPERA_USUARIO', NULL, 1, ARRAY['SOLICITANTE'], 'CORREO',
   'Qué información o captura falta', NULL, 50),
  ('ESP_USR_2', '2 días hábiles en espera de usuario', 'ESPERA_USUARIO', NULL, 2, ARRAY['SOLICITANTE', 'JEFE_SOLICITANTE'], 'CORREO',
   'Aviso de cierre automático si no responde', NULL, 60),
  ('ESP_APR_1', '1 día hábil en espera de aprobación', 'ESPERA_APROBACION', NULL, 1, ARRAY['APROBADOR'], 'CORREO',
   'Solicitud pendiente con enlace para aprobar o rechazar', NULL, 70),
  ('FECHA_1', '1 día antes de la fecha requerida', 'FECHA_REQUERIDA', NULL, 1, ARRAY['RESPONSABLE'], 'APP',
   'Para tipologías medidas por fecha', NULL, 80),
  ('RESUMEN_DIARIO', 'Resumen diario, 8:00 a. m.', 'RESUMEN_DIARIO', NULL, NULL, ARRAY['RESPONSABLE'], 'CORREO',
   'Sus tickets abiertos ordenados por tiempo consumido', NULL, 90),
  ('CIERRE_AUTO', 'Cierre automático tras 3 días hábiles en espera de usuario', 'ESPERA_USUARIO', NULL, 3, ARRAY['SOLICITANTE'], 'CORREO',
   'El ticket se cerró automáticamente porque no se recibió respuesta', 'CIERRE_AUTOMATICO', 100)
ON CONFLICT (codigo) DO NOTHING;

-- ── 7. Plantillas de ingreso y retiro ─────────────────────────────────────────
INSERT INTO ticket_plantillas (nombre, descripcion) VALUES
  ('Ingreso de personal', 'Tickets que se generan cuando ingresa un funcionario'),
  ('Retiro de personal', 'Tickets que se generan cuando se retira un funcionario')
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO ticket_plantilla_items (plantilla_id, tipologia_id, asunto, orden)
SELECT p.id, t.id, v.asunto, v.orden
FROM (VALUES
  ('Ingreso de personal', 'Configuración de equipos', 'Alistamiento para nuevo ingreso', 'Alistamiento de equipo para nuevo ingreso', 10),
  ('Ingreso de personal', 'Gestión de inventarios', 'Asignación', 'Asignación de equipo al nuevo funcionario', 20),
  ('Ingreso de personal', 'Soporte IGSI', 'Novedad en IGSI', 'Crear usuario y permisos en IGSI', 30),
  ('Ingreso de personal', 'Capacitación', 'Inducción TI a nuevo ingreso', 'Inducción TI al nuevo funcionario', 40),
  ('Retiro de personal', 'Delegación de cuentas', 'Delegación por retiro', 'Delegación de cuentas por retiro', 10),
  ('Retiro de personal', 'Gestión de inventarios', 'Devolución por retiro', 'Devolución de equipo por retiro', 20)
) AS v(plantilla, categoria, tipologia, asunto, orden)
JOIN ticket_plantillas  p ON p.nombre = v.plantilla
JOIN ticket_categorias  c ON c.nombre = v.categoria
JOIN ticket_tipologias  t ON t.categoria_id = c.id AND t.nombre = v.tipologia
WHERE NOT EXISTS (
  SELECT 1 FROM ticket_plantilla_items i WHERE i.plantilla_id = p.id AND i.tipologia_id = t.id);

-- ── 8. Parámetros generales (ticket_config) ───────────────────────────────────
INSERT INTO ticket_config (clave, valor, descripcion) VALUES
  ('horario_laboral', '{"dias":[1,2,3,4,5],"inicio":"08:00","fin":"17:00","almuerzo_inicio":"12:00","almuerzo_fin":"13:00"}'::jsonb,
   'Horario laboral para medir horas hábiles (días 0 = domingo … 6 = sábado, horas HH:MM)'),
  ('dias_cierre_automatico', '3'::jsonb,
   'Días hábiles en Resuelto o en espera de usuario antes del cierre automático'),
  ('emails_coordinador', '[]'::jsonb,
   'Correos del Coordinador TIN (escalamientos y recordatorios)'),
  ('emails_direccion', '[]'::jsonb,
   'Correos de la Dirección de TI (tickets vencidos)'),
  ('hora_resumen_diario', '"08:00"'::jsonb,
   'Hora del resumen diario a cada responsable (HH:MM)'),
  ('igsi_servicios', '{"Transporte nacional":["Carga masiva","Carga semimasiva","Paqueteo"],"Importación":["Marítima","Aérea","Terrestre"],"Exportación":["Marítima","Aérea","Terrestre"],"Distribución urbana":["Última milla","Entregas programadas"],"Almacenamiento":["Bodega","Zona franca"]}'::jsonb,
   'Servicios de IGSI y sus modalidades para el formulario de novedades. Ejemplo, ajustar en Configuración'),
  ('sedes', '["Bogotá","Cali","Medellín","Buenaventura","Cartagena","Mosquera","Pereira","Costa Norte"]'::jsonb,
   'Sedes disponibles (sucursales de TIN-FLOW)'),
  ('umbral_capacitacion', '3'::jsonb,
   'Novedades conceptuales del mismo funcionario en 30 días que sugieren una capacitación')
ON CONFLICT (clave) DO NOTHING;

-- ── 9. Festivos de Colombia 2026 y 2027 (36) ──────────────────────────────────
-- Ley 51 de 1983 (Ley Emiliani): los trasladables pasan al lunes siguiente.
-- Pascua 2026 = 5 de abril; Pascua 2027 = 28 de marzo.
INSERT INTO ticket_calendario (fecha, es_habil, descripcion) VALUES
  -- 2026
  ('2026-01-01', false, 'Año Nuevo'),
  ('2026-01-12', false, 'Día de los Reyes Magos'),
  ('2026-03-23', false, 'Día de San José'),
  ('2026-04-02', false, 'Jueves Santo'),
  ('2026-04-03', false, 'Viernes Santo'),
  ('2026-05-01', false, 'Día del Trabajo'),
  ('2026-05-18', false, 'Ascensión del Señor'),
  ('2026-06-08', false, 'Corpus Christi'),
  ('2026-06-15', false, 'Sagrado Corazón de Jesús'),
  ('2026-06-29', false, 'San Pedro y San Pablo'),
  ('2026-07-20', false, 'Día de la Independencia'),
  ('2026-08-07', false, 'Batalla de Boyacá'),
  ('2026-08-17', false, 'Asunción de la Virgen'),
  ('2026-10-12', false, 'Día de la Raza'),
  ('2026-11-02', false, 'Día de Todos los Santos'),
  ('2026-11-16', false, 'Independencia de Cartagena'),
  ('2026-12-08', false, 'Día de la Inmaculada Concepción'),
  ('2026-12-25', false, 'Navidad'),
  -- 2027
  ('2027-01-01', false, 'Año Nuevo'),
  ('2027-01-11', false, 'Día de los Reyes Magos'),
  ('2027-03-22', false, 'Día de San José'),
  ('2027-03-25', false, 'Jueves Santo'),
  ('2027-03-26', false, 'Viernes Santo'),
  ('2027-05-01', false, 'Día del Trabajo'),
  ('2027-05-10', false, 'Ascensión del Señor'),
  ('2027-05-31', false, 'Corpus Christi'),
  ('2027-06-07', false, 'Sagrado Corazón de Jesús'),
  ('2027-07-05', false, 'San Pedro y San Pablo'),
  ('2027-07-20', false, 'Día de la Independencia'),
  ('2027-08-07', false, 'Batalla de Boyacá'),
  ('2027-08-16', false, 'Asunción de la Virgen'),
  ('2027-10-18', false, 'Día de la Raza'),
  ('2027-11-01', false, 'Día de Todos los Santos'),
  ('2027-11-15', false, 'Independencia de Cartagena'),
  ('2027-12-08', false, 'Día de la Inmaculada Concepción'),
  ('2027-12-25', false, 'Navidad')
ON CONFLICT (fecha) DO NOTHING;

COMMIT;
