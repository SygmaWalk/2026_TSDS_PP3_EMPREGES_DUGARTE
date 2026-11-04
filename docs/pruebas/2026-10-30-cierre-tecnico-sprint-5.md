# Sprint 5 de EmpreGest · verificación técnica local

30 de octubre de 2026, Argentina. Los ensayos de cierre se completaron después de las 19 h con la aplicación de Vite en 127.0.0.1:5173, Supabase local y Chromium. Se utilizó la copia de trabajo de la rama ND2026-3-integrar-persistencia-productos sobre dc14e17, incluidos los cambios locales de octubre. El identificador del commit por sí solo es insuficiente para reproducir esta versión.

| Historia | Ensayo | Resultado observado |
|---|---|---|
| [34 · Stock bajo](https://sygmawalk.atlassian.net/browse/ND2026-34) | `node scripts/verificar-stock-bajo-local.mjs` | Pasaron 40 comprobaciones. El aviso apareció al alcanzar el mínimo y desapareció al reponer. Se probaron agotados, filtros, permisos, compra con cuenta y devolución. |
| [46 · Plantilla](https://sygmawalk.atlassian.net/browse/ND2026-46) | `node scripts/verificar-plantilla-tienda-local.mjs` | Pasó el recorrido en escritorio y móvil. El carrito sobrevivió al ingreso, el pedido quedó vinculado al comprador y el reintento tras perder la respuesta recuperó el pedido sin duplicar el descuento de stock. |
| [47 · Identidad visual](https://sygmawalk.atlassian.net/browse/ND2026-47) | `node scripts/verificar-apariencia-local.mjs` | Pasaron 47 comprobaciones de edición, vista previa, publicación, persistencia y permisos. En modo oscuro el precio probado superó o igualó el contraste de 4,5 a 1. El salto de teclado enfocó el contenido de la vista previa. |
| [48 · Distribución](https://sygmawalk.atlassian.net/browse/ND2026-48) | `node scripts/verificar-distribucion-local.mjs` | Pasaron 41 comprobaciones. Se confirmó un pedido desde lista en celular y otro desde cuadrícula en escritorio, ambos vinculados a la cuenta de prueba. Se verificaron orden, visibilidad, stock, borrador, publicación y conservación de identidad. |

La suite de aplicación aprobó sus 189 pruebas en 32 archivos. ESLint y la compilación de producción terminaron correctamente. La compilación informó un paquete principal de 611,76 kB sin comprimir.

Los cuatro ensayos finalizaron con salida 0 y ejecutaron la limpieza de sus datos temporales. Las capturas quedaron en `test-results/`, con los prefijos `stock-bajo-`, `plantilla-tienda-`, `apariencia-`, `catalogo-lista-` y `catalogo-orden-`.

Se actualizó la regla de compra de ND2026-6 y ND2026-63 para reflejar la decisión del 16 de octubre. Los visitantes pueden consultar el catálogo y armar el carrito. El servidor exige una cuenta Cliente habilitada al confirmar. La prueba del proveedor real de Google sigue pendiente en el backlog.

El registro acredita comprobaciones automatizadas en el entorno local. La integración en Git, la validación del entorno de entrega, la Sprint Review y la retrospectiva quedan pendientes.
