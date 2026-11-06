# Pedidos desplegables — 06/11/2026

En el panel de pedidos, Ver detalle abre el contenido debajo del resumen de la misma tarjeta. No cambia la URL ni reemplaza el listado. Se mantiene un solo pedido abierto; el botón cambia a Cerrar detalle e informa aria-expanded y aria-controls. Filtros y paginación siguen disponibles y cierran la selección al cambiar de consulta.

El modo compacto evita repetir encabezado, contacto y progreso completo. Conserva productos, adicionales, promociones, importes y operaciones de estado, cancelación y pago. El mapa se consulta en una sección plegable; stock e historial siguen plegables. Si no hay envío, evita repetir subtotal y total; los pedidos antiguos sin datos de entrega muestran el total sin otro recuadro vacío. No se eliminaron datos históricos.

Los enlaces directos antiguos y el historial de clientes conservan el detalle completo.

Validación: 21 pruebas aprobadas de panel, operación, historial del cliente y ubicación. Prueba real de navegador: apertura/cierre sin navegación, listado conservado, actualización con detalle abierto, selección de un solo pedido y sin desborde horizontal a 1280 y 390 px. No se modificaron pedidos en la prueba de navegador. Lint y build aprobados; continúa la advertencia existente de tamaño del paquete principal.

Capturas locales no versionadas: test-results/pedidos-desplegable-1280.png y pedidos-desplegable-390.png.
