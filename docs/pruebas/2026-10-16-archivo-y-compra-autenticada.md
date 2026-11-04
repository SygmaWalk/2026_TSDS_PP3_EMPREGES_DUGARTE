# Eliminación, archivo y compra autenticada
Fecha de revisión: 16/10/2026. Entorno local.

## Comportamiento
Productos → Eliminar consulta primero al servidor. Sin pedidos, consumos ni movimientos propone eliminación definitiva; con historial propone archivo. Los componentes utilizados por otros productos no pueden retirarse: se muestran sus dependencias. Se requiere productos.ver, productos.editar y productos.publicar; servidor revalida antes de ejecutar.
Archivados conserva pedidos, existencias y movimientos. Puede restaurarse desde Mostrar → Archivados; vuelve oculto. El inventario conserva los registros para consultar y ajustar existencias históricas.
Se serializa con el mismo bloqueo de negocio que confirmación y composición; un historial nuevo entre consulta y confirmación exige revisar la acción.
Los archivos de imagen no se eliminan automáticamente.

## Cambio de alcance de compras
Decisión del usuario: exigir una cuenta al confirmar. Catálogo y carrito siguen públicos. El servidor exige una cuenta Cliente habilitada y vincula el pedido a su identidad; cuentas internas e invitados no pueden confirmar. El ingreso devuelve a la tienda y conserva el carrito.
Esta decisión reemplaza los criterios anteriores de compra como invitado. Las historias y evidencias que describen confirmación anónima deben actualizarse manualmente. No se modificó Jira.
Los scripts históricos de integración y SQL que confirman como invitado todavía requieren adaptar su preparación a una cuenta Cliente; no se ejecutaron como regresión vigente.
La cuenta obligatoria no representa protección antifraude completa.

## Verificación
- Suite existente: 179 pruebas aprobadas.
- Tras añadir 3 casos, módulos ProductosPanel y TiendaPublica: 11 pruebas aprobadas.
- scripts/verificar-archivo-productos-local.mjs: 37 comprobaciones aprobadas, incluyendo permisos, aislamiento, revocación, historial, dependencia, confirmación, archivo, restauración, conservación de carrito, compra autenticada, no duplicación y móvil/escritorio en ambos temas.
- Lint y compilación aprobados.
- Asesor de seguridad local: sin incidencias.
- Migración generada desde la base local y reconstruida en base temporal; se agregó revocación explícita a anon para reproducir permisos.
- Datos temporales de ensayo eliminados. No se desplegó en la nube.

## Integraciones por desarrollar
1. Google: ND2026-63; configurar proveedor OAuth y redirecciones en Supabase/Google, errores y cancelación. Mantener separación de roles.
2. Abuso: límites de pedidos por cuenta/negocio, CAPTCHA y verificación. SMS necesita proveedor, presupuesto y límites de reenvío; verificar teléfono no acredita identidad legal.
3. Mercado Pago: conexión por vendedor con OAuth; credenciales solo en servidor, renovación, pedido/importe/moneda/vendedor cotejados con API y webhooks verificados. Pruebas con cuentas y credenciales de prueba; ninguna operación real ejecutada.
4. ARCA: integración separada por CUIT, habilitación/delegación, certificado y punto de venta. Homologación antes de producción; comprobantes con trazabilidad, sin duplicados y separados del estado del cobro.
No se configuraron Google, SMS, Mercado Pago ni ARCA en esta entrega.

Referencias revisadas:
- https://supabase.com/docs/guides/auth/social-login/auth-google
- https://supabase.com/docs/guides/auth/phone-login
- https://www.mercadopago.com.ar/developers/es/docs/split-payments/split-1-1/integration-configuration/create-configuration
- https://www.mercadopago.com.ar/developers/es/docs/checkout-pro-preferences/additional-content/notifications/webhooks
- https://www.arca.gob.ar/ws/WSAA/ADMINREL.DelegarWS.pdf
- https://www.arca.gob.ar/fe/ayuda/webservice.asp
