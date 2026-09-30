# Sprint 3 — estado y plan al 22/09/2026

Sprint activo: 22/09 al 02/10/2026. Jira: https://sygmawalk.atlassian.net/jira/software/projects/ND2026/boards/2/backlog

## Alcance actualizado

21 puntos originales de estimación: 16 en curso y 5 por hacer; ninguna historia completa. Los puntos no representan porcentaje de avance ni horas restantes. Se incorporó ND2026-24 (5 puntos) por ser una dependencia ya iniciada. Las demás siete historias sin sprint permanecen en backlog (25 puntos). Los sprints futuros conservan su planificación.

| Historia | Estado | Disponible localmente | Falta para aceptar |
|---|---|---|---|
| ND2026-3 Productos (5) | En curso | Alta, edición, visibilidad y persistencia con permisos por membresía | Completar imágenes, validar recorrido público y revisar/integrar cambios |
| ND2026-4 Catálogo (3) | En curso | Vista previa con productos visibles | Ruta pública por emprendimiento, imágenes y estados vacío/error sin sesión |
| ND2026-5 Carrito (3) | En curso | Agregar, cantidades, quitar, subtotal y conservación tras recarga | Integrar almacenamiento para clientes sin sesión y validar compra pública |
| ND2026-6 Confirmar pedido (5) | Por hacer | Criterios definidos | Esquema pedido/detalle, formulario, confirmación persistente y pruebas |
| ND2026-24 Acceso y roles (5) | En curso | Registro, inicio/cierre y recuperación de sesión; membresías | Distinguir Emprendedor/Colaborador, permisos por rol y flujo público sin sesión |

ND2026-10 continúa En curso. ND2026-14, 15 y 16 pasan a En curso: hay implementación y pruebas locales, pero falta integrar y validar el recorrido público. ND2026-7, 8 y 9 conservan sus estados previos. La descripción de ND2026-5 ahora exige conservar el carrito también al recargar la página.

## Capacidad disponible

El usuario confirmó entre 10 y 20 horas hasta el 2 de octubre. No se equiparan horas con puntos. Priorizar completar y validar lo ya iniciado, y después la confirmación de pedidos; no incorporar más backlog además de ND2026-24 sin revisar el esfuerzo restante. Los 21 puntos son el alcance registrado, no una garantía de entrega dentro de esas horas. Si el esfuerzo restante no cabe, replanificar explícitamente las historias pendientes antes de cerrar el sprint.

## Orden de ejecución

1. Completar permisos de ND2026-24 y la aceptación de productos ND2026-3/10; revisar la integración local y publicarla mediante el flujo habitual del repositorio.
2. Terminar ND2026-4: catálogo accesible sin sesión por emprendimiento, que muestre solo productos disponibles y sus imágenes cuando existan.
3. Integrar ND2026-5 con ese catálogo: carrito por emprendimiento para el visitante, cantidades/precios revalidados y recarga conservada en el mismo navegador.
4. Implementar ND2026-6: pedido y detalle guardados de forma atómica, validar precios/disponibilidad en servidor, contacto, subtotal, fecha y estado Pendiente, respuesta clara y prueba de extremo a extremo.
5. Revisar capacidad con ese incremento funcionando antes de agregar más historias al sprint. No sumar los 25 puntos pendientes completos al compromiso actual.

## Incorporación progresiva del backlog

| Historia | Dependencias y momento |
|---|---|
| ND2026-26 Panel (5) | Siguiente prioridad operativa tras pedidos ND2026-6 y permisos ND2026-24; lista, detalle, filtros y aislamiento |
| ND2026-25 Zonas y envío (3) | Tras confirmación persistente; costo validado por servidor y guardado históricamente. Adelantar si la entrega es imprescindible para el primer uso |
| ND2026-27 Estados (3) | Tras panel y permisos; definir transiciones válidas y registrar fecha |
| ND2026-30 Pagos (3) | Tras panel; registrar manualmente método, estado y fecha, sin pasarela |
| ND2026-31 Cancelación (3) | Tras panel; motivo, fecha e historial, con reglas de estados permitidos |
| ND2026-28 Clientes (3) | Tras pedidos; normalizar teléfono por emprendimiento y preservar contacto histórico del pedido |
| ND2026-29 Historial (5) | Tras ND2026-28 y pedidos; búsqueda y acceso autorizado al detalle |

Estas dependencias también quedaron registradas en las descripciones de Jira. Incorporar una historia cuando pueda implementarse, probarse y revisarse dentro de la capacidad restante; no basta con empezar código.

## Evidencia y límites

- Rama local: ND2026-3-integrar-persistencia-productos. Cambios todavía sin commit ni publicación en GitHub.
- 49 pruebas de aplicación aprobadas, lint y build correctos tras actualizar la CLI.
- Guía reproducible: docs/pruebas/PRUEBAS-MANUALES.md.
- La vista actual de catálogo y carrito es interna. No constituye aún el flujo público completo ni permite confirmar pedidos.
- No se cerraron historias por el mero resultado de las pruebas automatizadas.
