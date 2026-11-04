# Flujo de entrega y método elegido por el cliente
09/10/2026. Ajuste acordado para ND2026-27 y ND2026-30.

El cliente elige Efectivo o Transferencia al confirmar. Se guarda metodo_pago_previsto y se conserva en el recibo y en la huella del intento: reintentar no duplica y reutilizar la clave con otro método se rechaza. Los pedidos anteriores conservan null como elección desconocida; no se inventan datos. La respuesta de intentos anteriores ya guardados sigue recuperable.

Recorridos nuevos:
- Envío: Pendiente → En preparación → En ruta de entrega → Entregado.
- Retiro: Pendiente → En preparación → Listo para retirar → Entregado.
Los estados históricos Confirmado y Listo para entregar no se reescriben; pueden consultarse en filtros de pedidos anteriores y continuar por el flujo compatible. Los nuevos pedidos no pasan por Confirmado.

Para Entregado se utiliza una revisión específica con el método previsto, el método acordado real y una confirmación de cobro sin marcar por defecto. Permite entregar con pago pendiente. Si ya se cobró, conserva método y fecha. Registrar pago antes de entregar sigue disponible. Método previsto y efectivo permanecen separados. El operador sin permiso de pagos puede entregar sin cambiar el cobro. Las operaciones validan versión de pago y estado bajo el mismo bloqueo, y el registro de entrega/cobro es atómico.

Cancelación permitida antes de Entregado, incluyendo En ruta con advertencia de coordinar la interrupción. Requiere motivo y conserva el historial. No realiza devoluciones ni cambios de stock.

Verificación:
- 107 pruebas frontend aprobadas (17 archivos); lint y build correctos.
- 95 pruebas de base aprobadas.
- scripts/verificar-flujo-entrega-local.mjs: 45 comprobaciones aprobadas. Elección obligatoria, recibo/reintentos, métodos inválidos, separación de cobro, ambos recorridos, permisos, carreras, rollback, cobro anticipado, entrega pendiente, compatibilidad histórica, Realtime y recorrido de navegador cliente→operador con cambio de transferencia a efectivo.
- Capturas: test-results/checkout-metodo.png y entrega-pago-{escritorio,movil}.png. Revisados checkout y entrega móvil; sin desborde en escritorio/móvil.
- Migración 20261009232910_flujo_entrega_y_metodo_previsto.sql registrada localmente y reconstruida en base temporal. Diff ajeno restante: preparar_registro_catalogo y rls_auto_enable.
- Asesor de seguridad local sin hallazgos. Advertencia existente: bundle principal 548,66 kB sin comprimir.
- Los dos fallos iniciales de frontend correspondían a expectativas del flujo anterior y al nuevo selector obligatorio en un fixture; se actualizaron y la ejecución completa pasó.

Para comprobar el flujo vigente usar el script verificar-flujo-entrega-local.mjs; los informes y verificadores previos de estados/pagos documentan el recorrido anterior.
Solo entorno local; no se alteraron pedidos preexistentes ni Jira/Drive. Datos temporales de ensayo eliminados. Validación manual pendiente: compra eligiendo Transferencia, avanzar según modalidad, finalizar cambiando a Efectivo y confirmando cobro; repetir dejando cobro pendiente y comprobar elección original, método real e historial al recargar.
