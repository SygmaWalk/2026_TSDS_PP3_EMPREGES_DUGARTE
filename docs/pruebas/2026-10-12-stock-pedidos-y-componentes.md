# Verificación local: pedidos, componentes y stock
Fecha: 12/10/2026. Alcance de implementación: ND2026-33. Estado: implementado y verificado localmente; aceptación manual pendiente.

## Comportamiento
- Producto simple: consume existencias propias y componentes obligatorios.
- Combo: consume únicamente componentes; mantiene su precio de venta sin sumar los precios individuales.
- Componentes anidados: hasta ocho niveles, sin ciclos ni productos de otro emprendimiento.
- Confirmación: valida y descuenta todos los componentes en una sola operación; conserva cantidades y nombres históricos.
- Falta de stock: rechaza el pedido completo. Reintentar la misma confirmación no duplica descuentos.
- Cancelación: permite devolver cero, parte o todo lo consumido por producto. Lo no devuelto continúa consumido; no vuelve a descontarse.
- Catálogo: bloquea productos agotados. La confirmación vuelve a validar existencias frente a compras simultáneas.
- Pedidos anteriores: no reciben descuentos retroactivos. Los productos existentes requieren registrar sus existencias reales.

## Verificación ejecutada
- 149 pruebas de aplicación en 26 archivos: aprobadas.
- 95 pruebas SQL: aprobadas.
- 39 comprobaciones de integración y navegador: aprobadas. Script: scripts/verificar-stock-pedidos-local.mjs.
- Lint y compilación: correctos. Permanece advertencia de tamaño del archivo JavaScript principal (580,41 kB sin comprimir).
- Asesor de seguridad local: sin hallazgos.
- Migración 20261012165043_stock_pedidos_y_componentes.sql reproducida en base temporal. Diferencias residuales: formato de dos funciones preexistentes ajenas a este cambio.
- Revisión visual de cancelación en escritorio y móvil: sin desbordes.
- Los datos temporales del script de integración se eliminaron al terminar.

## Aceptación manual sugerida
1. Cargar existencias de los productos físicos en Inventario.
2. Crear un combo con dos componentes, cantidades definidas y precio propio.
3. Confirmar un pedido y comprobar precio, cantidades descontadas y movimientos Venta.
4. Cancelarlo devolviendo un componente y dejando otro en cero; comprobar existencias y movimientos Devolución.
5. Agotar un componente y comprobar que no se puede confirmar una compra que lo necesita.

La prueba automatizada utilizó dos combos que consumieron 48 minis, cuatro salsas y dos bebidas, y verificó que modificar posteriormente la composición no reescribiera ese consumo histórico.

No se actualizaron Jira ni documentos de Drive. Las historias de adicionales opcionales con precio y las estadísticas no forman parte de esta entrega. Los scripts antiguos que crean pedidos sin cargar stock necesitarán actualizar sus datos de preparación antes de reutilizarse.
