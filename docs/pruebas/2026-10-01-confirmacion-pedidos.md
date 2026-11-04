# Confirmar pedido básico — ND2026-6 — 01/10/2026

> Actualización posterior del 01/10/2026: ya están implementados localmente [dirección, mapa, cobertura y tarifas de entrega](2026-10-01-entregas-y-cobertura.md). Las limitaciones de entrega descritas en el informe anterior son históricas. Aceptación manual pendiente.

> Actualización posterior del 01/10/2026: ya está disponible la [consulta de pedidos por emprendimiento](2026-10-01-panel-pedidos.md). Las referencias al panel pendiente de este informe describen la entrega previa.

## Estado y trazabilidad

Implementación local de [ND2026-6](https://sygmawalk.atlassian.net/browse/ND2026-6), revisada junto con las subtareas ND2026-17, 18, 19 y 20. La historia y sus subtareas continúan en Jira con el estado consultado «Por hacer»: no se realizaron transiciones.

Rama: `ND2026-3-integrar-persistencia-productos`. Base: HEAD `dc14e17`, más cambios locales sin commit. Supabase local en 54321 y aplicación en http://127.0.0.1:5173/. No se publicaron cambios en GitHub ni se aplicaron migraciones remotas.

## Qué se puede hacer

Desde la tienda pública: agregar productos → Carrito → Continuar con el pedido → nombre y teléfono → Confirmar pedido.

El pedido queda guardado con sus productos, cantidades, precios históricos, subtotal, contacto, fecha y estado Pendiente. Se muestra un número y comprobante. El carrito se vacía después de recibir una confirmación válida.

El comprobante no representa un pago ni la aceptación del negocio. El panel para que el emprendimiento consulte y gestione pedidos corresponde a ND2026-26 y sigue pendiente. Por ahora, la comprobación administrativa del registro se realiza desde Supabase Studio local.

La compra invitada está habilitada. Si existe una sesión de Cliente habilitada, la función obtiene su identidad desde la sesión validada por el servidor. No recibe un usuario desde el formulario. Las cuentas internas habilitadas pueden realizar el recorrido como compra sin asociación a Cliente; una cuenta deshabilitada es rechazada.

## Modelo y seguridad

Migración: `supabase/migrations/20261001131744_confirmar_pedidos.sql`.

- `pedidos`: negocio, identidad Cliente opcional, nombre y teléfono de contacto, subtotal decimal, fecha del servidor y estado.
- `detalles_pedido`: producto, nombre y precio al confirmar, cantidad; clave compuesta por pedido/producto. Cambiar el catálogo después no modifica estos importes.
- `private.solicitudes_pedido`: UUID de cada intento, huella del contenido y actor, pedido y respuesta original. No se expone por la API.
- Los pedidos impiden borrar un negocio o producto referenciado. La eliminación administrativa de un pedido elimina sus detalles y registro de reintento.
- RLS activa en las tres tablas. No se permite escritura directa desde el navegador; el visitante tampoco puede listar pedidos/contactos.
- La lectura de pedidos por API queda limitada al administrador. No se extienden implícitamente los permisos de productos a los datos personales de pedidos.
- La función pública es SECURITY INVOKER y delega en una función privada con privilegios acotados por validaciones explícitas. La compra invitada admite intencionalmente `auth.uid()` nulo; las sesiones presentes deben tener cuenta habilitada. Todas las referencias están calificadas y el search_path es vacío.
- La operación guarda cabecera, detalle y control de reintento en una sola transacción. Bloquea las filas consultadas mientras valida precio, visibilidad y negocio activo.
- Se aceptan entre 1 y 100 productos distintos, entre 1 y 999 unidades por producto y un subtotal máximo de 999.999.999.999,99. Estos son límites técnicos de esta implementación.
- Nombre: 2–100 caracteres después de recortar espacios. Teléfono: 7–15 dígitos, con + inicial opcional; se eliminan espacios, paréntesis y guiones. No se verifica la propiedad del número.

El navegador conserva el intento pendiente en sessionStorage antes de enviarlo. Si pierde la respuesta, conserva UUID y datos para reintentar incluso después de recargar la misma pestaña. La base devuelve el mismo comprobante ante solicitudes concurrentes o repetidas con igual contenido. Si cambia el contenido o actor, rechaza reutilizar la clave. El recibo sustituye el contacto almacenado en la pestaña al confirmar.

Los cambios de precio se rechazan para que el cliente revise el importe actualizado; nunca se confirma silenciosamente un precio distinto del que revisó.

## Criterios de aceptación y evidencia automática

| Criterio de ND2026-6 | Comprobación realizada | Resultado |
|---|---|---|
| No confirmar carrito vacío | Botón deshabilitado; API rechaza lista vacía | Aprobado automático |
| Productos y cantidades | Consulta de cabecera y detalles después del envío real | Aprobado automático |
| Subtotal correspondiente | Recálculo en servidor; comparación exacta con detalles; rechazo de precio adulterado | Aprobado automático |
| Contacto básico | Validación de nombre/teléfono y persistencia del teléfono normalizado | Aprobado automático |
| Fecha y hora | Generadas en servidor y mostradas en comprobante | Aprobado automático |
| Estado inicial Pendiente | Base y respuesta verificadas | Aprobado automático |
| Confirmación clara | Comprobante real en Chromium, conservado tras recarga | Aprobado automático |

Resultados de esta ejecución:

- 67 pruebas Vitest aprobadas en 10 archivos. Incluyen siete casos nuevos del formulario y uno que evita borrar una nueva selección al volver a un comprobante anterior.
- 78 comprobaciones pgTAP existentes aprobadas.
- 27 comprobaciones con Auth y API de la base local aprobadas: permisos, entrada inválida, atomicidad, precios, disponibilidad, privacidad, identidad y tres solicitudes concurrentes.
- Flujo Chromium aprobado: carrito vacío, contacto, doble clic, registro en base, recibo tras recarga, vaciado del carrito, respuesta perdida y precio cambiado.
- Capturas revisadas a 1280 × 900 y 390 × 844, sin desborde horizontal.
- Lint, compilación y asesor de seguridad local aprobados.
- Migración registrada localmente y reconstruida en base temporal. El diff solo conserva las diferencias de formato preexistentes de dos funciones públicas, sin diferencias en los nuevos objetos de pedidos.

Los scripts de API y navegador crean sus propios negocios y datos ficticios, y los eliminan al terminar. Por eso los números que aparecen en sus capturas no corresponden a pedidos que deban permanecer en la base. Las secuencias pueden presentar saltos.

## Prueba manual para José

Mantener Docker, Supabase local y Vite activos según [PRUEBAS-MANUALES](PRUEBAS-MANUALES.md).

Usar la [tienda de demostración](http://127.0.0.1:5173/#/tienda/tienda-0-f1633b5c-30be-4a88-bcf0-904e57067fd3) o el enlace «Abrir tienda pública» del negocio elegido. Usar contactos ficticios para las pruebas.

| Caso | Pasos y resultado esperado | Estado manual | Evidencia |
|---|---|---|---|
| MP01 · Vacío | Abrir Carrito sin productos; no debe permitir continuar con el pedido. | No ejecutado | Pendiente |
| MP02 · Contacto | Agregar un producto; intentar confirmar sin nombre o con teléfono inválido. Debe solicitar corrección, sin crear pedido. | No ejecutado | Pendiente |
| MP03 · Pedido válido | Elegir cantidades, ingresar nombre/teléfono y confirmar. Debe aparecer número, fecha, estado Pendiente y subtotal correcto. | No ejecutado | Captura de selección y comprobante |
| MP04 · Persistencia real | En Studio, buscar el número en pedidos y sus filas en detalles_pedido. Comparar contacto, cantidades y subtotal con el comprobante. | No ejecutado | Capturas con datos ficticios |
| MP05 · Recarga | Recargar el comprobante en la misma pestaña; debe conservar el número. Volver a tienda: carrito vacío. | No ejecutado | Antes/después o grabación |
| MP06 · Cambio de precio | Llegar al formulario, cambiar el precio desde otro navegador autorizado y confirmar. Debe pedir revisar el carrito. Volver: conserva cantidades y muestra el precio actual. | No ejecutado | Mensaje y nuevo subtotal |
| MP07 · Producto oculto | Llegar al formulario, ocultar el producto desde otro navegador y confirmar. Debe rechazar el pedido; al actualizar ya no aparece ese producto. | No ejecutado | Mensaje y catálogo |
| MP08 · Móvil | Repetir MP03 a 390 px; campos, botones y comprobante deben ser utilizables sin desplazamiento horizontal. | No ejecutado | Capturas |

Para MP04 abrir http://127.0.0.1:54323/ y consultar las tablas públicas `pedidos` y `detalles_pedido`. No modificar importes manualmente para simular una prueba aprobada.

Registrar fecha, entorno, rama/versión, pasos, esperado, obtenido y evidencia. Los casos siguen «No ejecutado» hasta que José los realice. El documento de Drive no fue actualizado en esta ejecución.

## Repetir las verificaciones

Desde el repositorio:

```powershell
npm test
npm run lint
npm run build
npx supabase test db --local
node scripts/verificar-pedidos-local.mjs
node scripts/verificar-pedidos-ui-local.mjs
```

La prueba de navegador necesita la aplicación activa en el puerto 5173. Capturas automáticas: `test-results/confirmar-pedido-escritorio.png`, `confirmar-pedido-movil.png`, `pedido-registrado-escritorio.png` y `pedido-registrado-movil.png`.

## Pendientes y límites

- Ejecutar aceptación manual, registrar evidencia en Drive y revisar el cierre de Jira.
- Panel operativo y permisos para el emprendimiento, cambios de estado, historial, mapas, entrega y pagos: historias posteriores.
- La protección de duplicados se aplica al mismo intento. Otro UUID representa un pedido nuevo. sessionStorage pertenece a la pestaña; cerrarla o borrar su almacenamiento puede perder la recuperación del intento y el comprobante.
- No se añadió limitación de frecuencia ni CAPTCHA para compras invitadas. Revisar esa protección antes de exponer el endpoint a Internet.
- Publicación y comprobación en la nube pendientes. No hay notificaciones externas ni cobros automáticos.

Referencias técnicas consultadas: [funciones de base de datos](https://supabase.com/docs/guides/database/functions) y [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).
