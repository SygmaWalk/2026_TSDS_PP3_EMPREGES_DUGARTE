# Verificación local: estados y avisos de pedidos
Fecha: 08/10/2026. Historia: ND2026-27 (En curso; pendiente aceptación manual).

## Implementación
Secuencia: Pendiente → Confirmado → En preparación → Listo para entregar → Entregado. Cada transición registra fecha, hora y usuario en un historial protegido. La operación requiere pedidos.ver y pedidos.actualizar_estado, cuenta y asociación habilitadas; el servidor comprueba el negocio. Se impiden saltos, retrocesos y escrituras directas. Dos solicitudes con el mismo estado previo producen un único cambio y un conflicto HTTP 409.

Panel con tarjetas, colores por estado, filtros rápidos, progreso e historial. Los cambios llegan mediante Supabase Realtime con RLS. Las nuevas solicitudes muestran aviso visual y sonido opcional, sin abandonar el detalle ni modificar filtros. Se deduplican eventos y se limita la repetición de sonido durante ráfagas.

## Verificación ejecutada
- npm run lint: correcto.
- npm test -- --maxWorkers=1: 95 pruebas, 15 archivos, aprobadas.
- npm run build: correcto. Advertencia de paquete principal mayor a 500 kB (536,56 kB sin comprimir); no impide ejecutar.
- npx supabase test db --local: 95 comprobaciones aprobadas en tres archivos.
- node scripts/verificar-estados-realtime-local.mjs: 34 comprobaciones aprobadas, incluyendo API, concurrencia, permisos revocados con sesión vigente, historial, eventos reales, aislamiento entre negocios, navegador, sonido, silencio y filtros.
- Capturas revisadas visualmente en escritorio (1360 px) y móvil (390 px), sin desborde horizontal.
- npx supabase db advisors --local --type security: sin hallazgos.
- Migración 20261002202655 registrada en base local. db diff reconstruyó todas las migraciones en una base temporal: sin diferencias de los objetos de esta entrega; persisten diferencias previas de definición en preparar_registro_catalogo y rls_auto_enable.

Se corrigió el código de conflicto de 40001 a PT409 para evitar reintentos automáticos de PostgREST. Se diferenciaron los correos temporales de pgTAP de las cuentas de demostración. La primera conexión de Realtime excedió el límite inicial de espera; se amplió la espera del ensayo a 30 segundos. El navegador requirió iniciar el servidor local. La ejecución final completa pasó.

## Entorno y datos
Cambios únicamente locales, sin publicación en GitHub ni despliegue en Supabase Cloud. No se reinició ni vació la base. El ensayo crea datos temporales propios y los elimina al finalizar.
Se habilitó pedidos.actualizar_estado para el perfil editor de Tienda de prueba mediante scripts/preparar-estados-demo-local.mjs. Los permisos del lector se conservaron.
Capturas automáticas: test-results/pedidos-en-vivo-{escritorio,movil}.png y test-results/estados-detalle-{escritorio,movil}.png. Son evidencia de verificación técnica, no ejecución manual del usuario.

## Alcance de los avisos
El panel debe permanecer abierto y el navegador activo. El sonido empieza desactivado y requiere pulsar Activar sonido al abrir el panel. No hay notificaciones del sistema, push ni avisos con la PC apagada. Cada ventana abierta puede emitir su propio aviso. Al reconectar se actualiza el contenido, pero no se reproducen sonidos por eventos perdidos; también hay actualización cada 30 segundos y al volver a la ventana. No se incorporan cancelaciones, pagos ni reapertura de pedidos entregados.

## Validación manual pendiente
1. Ingresar como emprendedor, abrir Tienda de prueba → Pedidos y activar sonido. Mantener esa ventana abierta.
2. Desde otra ventana (por ejemplo, incógnito), confirmar un pedido en la tienda pública. Verificar aviso, sonido y aparición sin recargar. Registrar captura del aviso y número de pedido; para evidenciar sonido usar un video breve si se desea.
3. Abrirlo y avanzar por los cinco estados. Capturar estado e historial con fecha y hora; recargar y comprobar persistencia.
4. Mantener el mismo pedido abierto en otra ventana autorizada y verificar actualización del estado.
5. Silenciar; crear otro pedido y comprobar aviso visual sin sonido. Probar con un filtro activo y comprobar que se conserva.
6. Ingresar como lector: puede consultar, pero no debe aparecer el botón para cambiar estado.
El documento formal de Drive no fue modificado. La aceptación manual de estas funciones nuevas sigue pendiente.

Referencias técnicas: https://postgrest.org/en/v14/references/errors.html ; https://supabase.com/docs/guides/realtime/postgres-changes
