# ND2026-32 — Entradas, producción y ajustes de inventario
Fecha: 12/10/2026. Entorno: Supabase local.

## Implementación
Panel Inventario vinculado a los productos existentes. Búsqueda por nombre, existencias por producto, productos publicados y ocultos, y paginación de 25 registros.
Movimientos disponibles: Entrada, Producción, Ajuste positivo y Ajuste negativo. Cantidad positiva con hasta tres decimales; el tipo determina el signo. Motivo obligatorio y referencia o lote opcional. Fecha y responsable registrados en el servidor.
Las existencias son la suma del historial, sin un valor editable que lo reemplace. No se permiten escrituras directas ni editar/eliminar movimientos desde el panel; los errores reales se corrigen mediante otro ajuste.
Productos existentes y nuevos inician en cero hasta registrar movimientos. No se atribuyó stock inicial ficticio ni se tocaron los pedidos históricos.
Se requiere productos.ver y stock.ver para consultar, y además stock.registrar para registrar. El editor de Tienda de prueba recibió estos permisos de inventario.
Los movimientos se serializan por producto, validan el saldo consultado e incorporan una clave de reintento para evitar duplicar una entrada tras un error de conexión.

## Verificación
- ESLint y compilación correctos; permanece el aviso del paquete principal superior a 500 kB.
- Aplicación: 141 pruebas aprobadas en 23 archivos.
- Base de datos: 95 pruebas pgTAP aprobadas.
- scripts/verificar-stock-local.mjs: 43 comprobaciones aprobadas, con cantidades decimales, reintentos, concurrencia, rechazo de negativos, autorización y revocación, aislamiento, conservación histórica, paginación y registro real desde navegador.
- Capturas de escritorio y móvil inspeccionadas; sin desbordamiento horizontal ni errores JavaScript.
- Asesor de seguridad local: sin incidencias.
- Migración supabase/migrations/20261012162620_movimientos_stock.sql reproducida en una base temporal. Sin diferencias del inventario; el diff conserva las dos diferencias previas de formato de preparar_registro_catalogo y rls_auto_enable.
Las cuentas, negocios, productos y movimientos temporales se eliminaron al finalizar.

## Aceptación pendiente
Desde Tienda de prueba → Inventario: registrar una entrada de 10 unidades, una producción de 5 y un ajuste negativo de 2, cada uno con motivo. Comprobar saldo 13, historial y persistencia al recargar. Intentar un ajuste negativo de 14 y comprobar su rechazo sin nuevo movimiento.

## Límite actual
ND2026-33 integrará descuento por pedidos y devolución selectiva al cancelar; ND2026-34 agregará umbrales de stock bajo. La composición de productos y combos todavía no está implementada. En esta entrega las compras siguen funcionando con las reglas previas y no consumen estos saldos.
No incluye materias primas, vencimientos ni conversión entre unidades. Las cantidades representan unidades del producto que administra cada negocio.
No se modificaron estados o descripciones de Jira ni documentos de Drive. Sin despliegue en la nube.
