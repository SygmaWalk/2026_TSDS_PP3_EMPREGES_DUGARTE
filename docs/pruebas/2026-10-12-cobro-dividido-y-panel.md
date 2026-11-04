# Cobro final dividido y panel operativo
Fecha: 12/10/2026. Entorno local.

## Cambios
- Se retiraron los bloques “Mi acceso”, los permisos visibles en tarjetas y los textos de ayuda que ocupaban el panel interno.
- El resumen presenta accesos directos a Pedidos, Productos, Clientes y Entregas según las acciones disponibles para la cuenta.
- Los encabezados de Pedidos y Clientes se simplificaron y el regreso conduce al panel del negocio.
- El cobro final puede registrarse por efectivo, transferencia o ambos. En el caso mixto se ingresan dos importes positivos cuya suma debe coincidir exactamente con el total, incluido el envío. No se incorporaron anticipos ni cobros parciales.
- Entrega y cobro dividido se guardan en una única transacción. Un error revierte ambos y su historial; versiones desactualizadas y cobros ya registrados se rechazan.
- La elección inicial del cliente permanece conservada. El detalle muestra el desglose del pago confirmado para su utilización futura en estadísticas.
- En la etapa de revisión final se muestra una sola operación de cobro, evitando formularios competidores.

## Base de datos
Migración: supabase/migrations/20261012025054_cobro_final_dividido.sql.
Campos pago_efectivo y pago_transferencia, restricciones de coherencia y RPC autorizados para registrar el desglose y finalizar la entrega con él.
Los tres pedidos locales que ya estaban pagados recibieron su desglose a partir del método y total existentes, sin cambiar su fecha o elección inicial.
Migración reproducida en una base temporal: el diff conserva únicamente las dos diferencias previas de formato de preparar_registro_catalogo y rls_auto_enable. Sin diferencias nuevas del cobro dividido. Asesor de seguridad: sin incidencias.
Los registros de cobros no pueden editarse directamente desde el cliente.

## Verificación
- Suite de aplicación: 128 pruebas aprobadas en 21 archivos.
- Después de los ajustes finales de presentación y formulario único: 48 pruebas relevantes aprobadas en 7 archivos.
- Base de datos: 95 pruebas pgTAP aprobadas.
- scripts/verificar-cobro-dividido-local.mjs: 73 comprobaciones aprobadas. Incluyen autorización, versiones concurrentes, precisión de importes, sobrepago y pago insuficiente, rollback de entrega e historial, conservación de pagos simples, eventos Realtime, compra y cobro desde navegador.
- ESLint y compilación correctos; continúa el aviso existente del paquete principal superior a 500 kB.
- Presentación revisada en escritorio y móvil, sin desbordamiento horizontal ni errores de JavaScript. Corregido el contraste del nombre del negocio.
- Se limpiaron las cuentas, pedidos y negocios temporales al finalizar.

Durante las ejecuciones iniciales hubo esperas agotadas de Realtime y luego el servidor Vite estaba apagado. Se verificó la autorización de la suscripción, se reinició únicamente el servicio local Realtime y se agregó una espera inicial de registro en el script. Con Vite iniciado, la ejecución final completó todas las comprobaciones. No se eliminó data local.

## Pendiente aceptación del usuario
Revisar el panel del negocio. En un pedido listo para entregar o retirar, elegir Efectivo + transferencia, ingresar ambos importes, confirmar recepción completa y entregar. Revisar después el desglose guardado y la elección original.
Probar una suma incorrecta y verificar que no se confirma la entrega ni el cobro.

## Próximo alcance
ND2026-32: entradas y ajustes de stock. La composición de productos, combos y devolución selectiva requiere implementación posterior conforme al alcance acordado.
No se actualizaron estados o descripciones de Jira, ni documentos de Drive. No hubo despliegue en la nube.
