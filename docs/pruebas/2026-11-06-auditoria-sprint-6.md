# Auditoría Sprint 6 — 06/11/2026

Sprint activo Jira 42, fin 13/11/2026 a las 19:27 (Argentina). Su objetivo menciona 38–41; la asignación real incluye más historias.

## Estado contrastado con código
- Listo en Jira: 38 adicionales internos, 39 selección de adicionales, 40 promociones, 43 clientes frecuentes, 62 administración central. Los cierres documentan alcance local; no implican publicación de toda la rama.
- En curso: 42 perfil/direcciones (antes Por hacer; implementado local c61141b), 44 pedido habitual (antes Por hacer), 61 permisos internos, 63 Google y nueva 66 zonas rectangulares (c61141b).
- Por hacer: 41 modificar pedidos, 64 historial personal, 35 ventas por período, 36 productos más vendidos, 37 ventas por zona.
- El historial de clientes existente es interno al emprendimiento (ND2026-29), no la pantalla personal de ND2026-64. Esta última no está implementada en Mi cuenta.
- Las descripciones de 35–37 todavía indican Sprint 8, pero su campo sprint apunta al 6 activo. Se conserva asignación; planificación pendiente de conciliar.
- Las zonas rectangulares se registran como ND2026-66, sin reabrir 25/65 cerradas con alcance radial. Direcciones privadas pertenecen a 42.

## Avance ND2026-44
Se refinó Jira conforme a la aclaración de José: recomendación para el Cliente registrado, no compra del emprendimiento en nombre del cliente. Mínimo 3 pedidos; hasta los últimos 20 no cancelados de la misma cuenta/tienda; producto presente en mayoría estricta; cantidad modal, desempate por fecha y cantidad menor.
La consulta mi_pedido_habitual protege identidad y cuenta habilitada; excluye cancelados y productos no disponibles. No usa modelos de IA ni concede fidelización.
Antes de agregar, se vuelven a consultar historial y catálogo. Se rechaza incoherencia de precio y stock insuficiente incluyendo unidades existentes. El carrito conserva sus selecciones; adicionales históricos no se repiten. No se confirma ni cobra automáticamente.
Se corrigió el escenario SQL de archivo de producto para respetar visible=false al archivar.
Verificación técnica: pruebas de componente y carrito; 10 comprobaciones SQL con rollback. Lint y compilación. Pendiente recorrido completo de aceptación manual y publicación, diferidos por el usuario. Permanece En curso.

## Orden recomendado
Consolidar 44; desarrollar 41 (modificación con diferencias de stock, importes y trazabilidad); desarrollar 64 (historial personal). Conciliar planificación de informes 35–37. No detener desarrollo por las pruebas manuales pospuestas ni por Google Maps, cuyo proveedor está pendiente de facturación.
