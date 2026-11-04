# ND2026-31 — Cancelación de pedidos
Verificación local: 09/10/2026.

Implementado: cancelación desde Pendiente, Confirmado, En preparación y Listo para entregar. Requiere pedidos.ver y pedidos.actualizar_estado. Motivo obligatorio de 1 a 500 caracteres; conserva productos, importes, contacto e historial. Registra actor y fecha/hora. No permite cancelar entregados, repetir cancelación ni reabrir cancelados. El panel incluye confirmación, opción de volver sin guardar, motivo visible y filtro Cancelado. Las operaciones concurrentes usan bloqueo de fila y estado previo; solo una puede completar.

Validación ejecutada:
- 98 pruebas frontend aprobadas.
- 95 comprobaciones pgTAP aprobadas.
- 61 comprobaciones de integración aprobadas mediante scripts/verificar-cancelacion-local.mjs: incluye regresión de estados/avisos y cancelación, aislamiento, revocación de permisos, concurrencia, motivo inválido, conservación de datos, cuatro estados cancelables, terminales y navegador.
- Lint y build correctos. Persiste advertencia de paquete principal mayor a 500 kB (539,05 kB).
- Asesor de seguridad local sin hallazgos.
- Migración 20261009230553_cancelar_pedidos.sql generada y registrada localmente; reconstrucción en base temporal correcta. Diff restante limitado a las dos funciones preexistentes preparar_registro_catalogo y rls_auto_enable.
- Capturas en test-results/cancelacion-formulario-{escritorio,movil}.png y cancelacion-detalle-{escritorio,movil}.png. Revisados formulario de escritorio y detalle móvil; sin desborde en ambos tamaños.

Los datos temporales del ensayo se eliminaron al finalizar. No se cancelaron pedidos preexistentes del usuario, no se vació la base ni se desplegó en la nube. No se modificó Jira. El primer ensayo de navegador encontró el servidor detenido; se inició y la ejecución completa posterior pasó.

Validación manual sugerida: crear un pedido de prueba; abrir Pedidos → Ver detalle → Cancelar pedido; comprobar bloqueo sin motivo y Volver sin cancelar; confirmar con motivo; recargar, filtrar Cancelado y comprobar productos, motivo e historial. Registrar captura de detalle e historial. La aceptación manual y el cambio de estado de la historia quedan a cargo de José.

La cancelación no procesa devoluciones de pagos ni restituye stock: esas operaciones no existen en el alcance actual.
