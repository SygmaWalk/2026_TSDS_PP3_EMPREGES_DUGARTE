# Panel de pedidos del emprendimiento — ND2026-26 — 01/10/2026

> Actualización posterior del 01/10/2026: ya están implementados localmente [dirección, mapa, cobertura y tarifas de entrega](2026-10-01-entregas-y-cobertura.md). Las limitaciones de entrega descritas en el informe anterior son históricas. Aceptación manual pendiente.

## Estado y alcance

Panel implementado y verificado localmente según los criterios consultados de [ND2026-26](https://sygmawalk.atlassian.net/browse/ND2026-26). Jira sigue en «Por hacer»; no se movió la historia a un sprint ni se modificó su estado. Aceptación manual pendiente.

Rama `ND2026-3-integrar-persistencia-productos`, HEAD `dc14e17` más cambios locales sin commit. Aplicación http://127.0.0.1:5173/ y Supabase local 54321. No se publicó a GitHub, Drive ni a la nube.

Incluye:

- Entrada «Ver pedidos» en cada emprendimiento autorizado y navegación Productos/Pedidos.
- Listado por fecha descendente e identificador descendente para resolver empates.
- Contacto, teléfono, subtotal, estado y fecha en la lista; productos, cantidades y precios históricos en el detalle.
- Filtros por estado y fechas, limpieza de filtros, paginación de 25 registros y cantidad total de coincidencias.
- La fecha «Hasta» incluye todo ese día. Fechas mostradas y límites usan la zona horaria del dispositivo que consulta.
- Actualización por botón y al volver a enfocar la ventana. No es una suscripción en tiempo real.
- Estados visibles de carga, ausencia de pedidos, ausencia de coincidencias, error/reintento y detalle ya no disponible.
- Consulta por permiso independiente `pedidos.ver`; no requiere permiso de productos.

Actualmente todos los pedidos tienen estado Pendiente, por lo que el filtro ofrece «Todos los estados» y «Pendiente». Los nuevos estados y sus transiciones corresponden a otra historia.

Dirección, modalidad, zona y tarifa de entrega no existen todavía en el modelo de pedidos. El criterio condicional de mostrar zona/costo no puede validarse con datos reales hasta integrar ND2026-25. El panel informa esa ausencia; no inventa un envío gratuito ni una dirección.

## Cómo entrar a Tienda de prueba

1. Mantener Docker, Supabase local y Vite activos.
2. Abrir http://127.0.0.1:5173/#/ingresar.
3. Si hay otra sesión, volver a «Mis emprendimientos» y cerrar sesión.
4. Consultar correo y contraseña del perfil `editor` en el archivo local `.qa-tienda.local` y usarlos para ingresar.
5. En la tarjeta «Tienda de prueba», pulsar **Ver pedidos**.
6. Abrir **Ver detalle** en un pedido. Desde Productos también se puede pulsar **Pedidos**.

La cuenta editor de esta demostración recibió explícitamente `pedidos.ver`. El perfil lector conserva sus permisos previos de productos: no se le concedió acceso a los contactos. No se modificaron otras cuentas.

El script `node scripts/preparar-panel-demo-local.mjs` comprueba que la cuenta y negocio pertenezcan al juego de datos de prueba antes de conceder el permiso. Conserva pedidos existentes; solo crea uno ficticio si el negocio no tiene ninguno. En esta ejecución encontró pedidos existentes y los conservó.

Las credenciales son locales, ficticias y están excluidas de Git. La administración visual de permisos sigue pendiente en ND2026-61.

## Seguridad implementada

Migración: `supabase/migrations/20261001141521_panel_pedidos.sql`.

- Se añade `pedidos.ver` a los permisos individuales permitidos.
- Las políticas de lectura usan el usuario autenticado y las tablas actuales de cuenta, asociación y permisos.
- Las cuentas habilitadas de rol Emprendimiento necesitan asociación habilitada y permiso para ese negocio.
- El Administrador del sistema conserva lectura administrativa.
- Las consultas directas a detalles dependen de que el pedido padre sea visible por RLS.
- Un visitante, un Cliente o un usuario con solo permisos de productos no puede consultar contactos del panel.
- No se conceden INSERT, UPDATE ni DELETE; este panel no modifica pedidos.
- La revocación de permiso, asociación o cuenta se aplica en las siguientes consultas con el mismo token. No retira información que el navegador ya mostró; la interfaz actualiza permisos periódicamente y al enfocar la ventana.
- Las consultas de listado y detalle incluyen el emprendimiento además de RLS. Cada recarga verifica acceso antes de consultar y oculta resultados anteriores durante la carga.

## Evidencia automatizada

| Verificación | Resultado |
|---|---|
| Frontend existente | 67 pruebas aprobadas |
| Panel y fechas | 6 pruebas nuevas aprobadas: límites de fecha, carga/vacío, error/reintento, filtros, paginación/detalle y detalle no disponible |
| Base de datos | 95 comprobaciones pgTAP aprobadas en 3 archivos; 17 nuevas corresponden al panel |
| API y navegador reales | Recorrido compra pública → pedido guardado → acceso interno → listado → detalle aprobado |
| Paginación y fechas con datos reales | 27 pedidos históricos, páginas 25+2, límite entre días y filtros verificados |
| Revocación | Se retiró permiso con sesión abierta; API negó lectura y el panel ocultó el contacto al actualizar |
| Demostración existente | Editor de Tienda de prueba pudo entrar y alternar Productos/Pedidos |
| Presentación | Capturas revisadas a 1280 × 900 y 390 × 844, sin desborde horizontal |
| Lint y compilación | Aprobados |
| Seguridad y migración | Asesor local sin hallazgos; migración registrada y reconstrucción comprobada en base temporal |

El diff de reconstrucción mantiene únicamente las diferencias de formato preexistentes en dos funciones públicas. No hay diferencias en los objetos nuevos del panel.

Las pruebas de API/navegador crean su propio negocio, cuenta y pedidos ficticios y los eliminan al terminar. Las capturas automáticas de ese negocio no representan registros que deban permanecer en la base. Las secuencias pueden avanzar durante las pruebas.

Capturas: `test-results/panel-pedidos-escritorio.png`, `panel-pedidos-movil.png`, `detalle-pedido-escritorio.png` y `detalle-pedido-movil.png`.

## Casos manuales pendientes

| Caso | Procedimiento y resultado esperado | Estado | Evidencia |
|---|---|---|---|
| PP01 · Acceso | Ingresar como editor y abrir Ver pedidos de Tienda de prueba. Debe mostrar solo los pedidos de ese negocio. | No ejecutado | Pendiente |
| PP02 · Recorrido completo | Confirmar un pedido con contacto ficticio desde su tienda pública. En el panel, pulsar Actualizar pedidos. El mismo número debe aparecer al comienzo. | No ejecutado | Comprobante y listado |
| PP03 · Detalle | Abrir el pedido de PP02. Comparar contacto, productos, cantidades, subtotal, fecha y Pendiente con el comprobante. | No ejecutado | Captura del detalle |
| PP04 · Fecha/estado | Elegir Pendiente y un intervalo que incluya el pedido. Aplicar. Luego usar un día sin pedidos y limpiar filtros. | No ejecutado | Resultados y estado vacío |
| PP05 · Permisos | Ingresar como lector de productos. No debe aparecer Ver pedidos; no debe mostrar contactos del negocio. | No ejecutado | Pantalla de acceso |
| PP06 · Navegación | Con editor, alternar Productos/Pedidos y volver a Mis emprendimientos. | No ejecutado | Pendiente |
| PP07 · Móvil | Revisar lista, filtros y detalle a 390 px. Deben poder usarse sin desplazamiento horizontal. | No ejecutado | Capturas |
| PP08 · Error de conexión | Con el panel abierto, desactivar la red en las herramientas del navegador y actualizar; comprobar error claro. Restaurar conexión y reintentar. | No ejecutado | Error y recuperación |

Registrar fecha, entorno, rama/versión, esperado, obtenido y evidencia. La aceptación manual de José sigue sin ejecutar y el documento de Drive no fue modificado.

## Repetir pruebas

Desde el repositorio, con Supabase local activo y Vite en 5173 para el navegador:

```powershell
npm test
npm run lint
npm run build
npx supabase test db --local
node scripts/verificar-panel-pedidos-local.mjs
```

## Pendientes

Revisión manual y evidencia; integración de entrega/dirección/zona/tarifa; cambios de estado; administración visual de cuentas/permisos; publicación y validación en la nube. Los estados de Jira se revisarán después de verificar el alcance y documentar los resultados.

Referencia técnica: [RLS de Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security).
