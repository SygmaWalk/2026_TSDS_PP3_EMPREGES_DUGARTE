# ND2026-30 — Registro manual de pagos
Verificación local: 09/10/2026.

Implementado: Efectivo/Transferencia, Pendiente/Pagado y fecha/hora del cobro. Método y estado visibles en listado y detalle; el método puede guardarse sin registrar cobro. Confirmación explícita del importe completo, sin pasarela. El registro guarda el usuario que confirma en usuario_pago. Permiso separado pedidos.registrar_pago, además de pedidos.ver; habilitado únicamente al emprendedor de demostración por scripts/preparar-pagos-demo-local.mjs (administradores ya lo reciben).

Reglas: el pago no modifica el estado ni la fecha de preparación. Puede cobrarse un pedido entregado; no se registra en uno cancelado. Un pago confirmado no puede editarse/revertirse desde este panel. Cancelar posteriormente conserva pago, método y fecha, con advertencia visible; no realiza ni registra devoluciones. Los pedidos existentes comienzan Pendiente, sin método ni fecha asignados. Las escrituras concurrentes verifican version_pago bajo bloqueo de fila; solo una puede completar.

Validación:
- 103 pruebas frontend aprobadas en 16 archivos; lint y build correctos.
- 95 comprobaciones de base de datos aprobadas.
- scripts/verificar-pagos-local.mjs: 29 comprobaciones API/Realtime/navegador aprobadas, incluyendo permisos y revocación, aislamiento, métodos inválidos, separación de preparación/pago, cancelación, concurrencia, conservación, listado/detalle, persistencia y vista móvil.
- Asesor de seguridad local sin hallazgos.
- Migración 20261009231459_registrar_pagos_pedidos.sql generada y registrada localmente. Reconstrucción en base temporal correcta; revisar test-results/pagos-schema-diff.json para diferencias previas ajenas.
- Capturas de detalle revisadas: test-results/pago-detalle-escritorio.png y pago-detalle-movil.png. Sin desborde horizontal.
- Advertencia de build existente: paquete principal mayor a 500 kB (543,31 kB sin comprimir).

Datos temporales de ensayo eliminados; no se registraron pagos sobre pedidos preexistentes del usuario. Sin cambios en Jira o Drive ni despliegue en nube.

Validación manual pendiente: abrir un pedido de prueba → Pago del pedido; guardar método y verificar Pendiente; marcar como pagado, revisar confirmación y confirmar; comprobar fecha/hora y método en detalle/listado y al recargar. Capturar detalle y listado para evidencia. José decide el cierre manual de ND2026-30.
