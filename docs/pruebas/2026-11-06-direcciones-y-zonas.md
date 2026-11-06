# Direcciones de clientes y zonas de envío — local

## Recorrido
1. Ingresar como Cliente y abrir Mi perfil > Mis direcciones > Agregar dirección.
2. Completar nombre, dirección y referencia; usar Mi ubicación actual (permiso del navegador) o marcar el mapa. Revisar el punto y guardar. Una dirección puede ser predeterminada.
3. Como administrador o miembro con entregas.configurar: abrir Configurar entregas, fijar origen y elegir radio o zonas rectangulares.
4. En zonas: Dibujar zona, marcar dos esquinas, asignar nombre y tarifa. Los límites pueden ajustarse numéricamente. Guardar entregas.
5. En la tienda, agregar un producto y continuar con el pedido. Elegir envío, seleccionar dirección guardada y Calcular envío. Revisar costo y total antes de confirmar.

## Reglas
- Direcciones privadas: solo la cuenta Cliente habilitada propietaria puede consultarlas y modificarlas. La predeterminada se reemplaza en una transacción y tiene índice único por cuenta.
- Las zonas no se superponen. Los bordes sur/oeste están incluidos y norte/este excluidos: zonas contiguas no cobran dos tarifas.
- Fuera de cobertura no se confirma envío; el cliente puede cambiar destino o elegir retiro.
- Cambiar destino invalida cotización. El servidor vuelve a calcular al confirmar y rechaza precio manipulado o versión desactualizada.
- El pedido guarda dirección, coordenadas, referencia, zona, origen y tarifa como copia histórica. Editar/eliminar la dirección o cambiar tarifas no modifica pedidos previos.
- Radio y zonas son modalidades alternativas; no suman cargos entre sí. Routes no participa de este cálculo.

## Google Maps
Proveedor opcional en MapaPuntoLazy, con Places (New) al buscar dirección. No se agrega ninguna dependencia.
Variables: VITE_GOOGLE_MAPS_API_KEY, VITE_GOOGLE_MAPS_ENABLED, VITE_GOOGLE_MAPS_MAP_ID (opcional local, DEMO_MAP_ID).
Prueba real local: Google respondió BillingNotEnabledMapError. Por eso VITE_GOOGLE_MAPS_ENABLED=false y se conserva Leaflet/OpenStreetMap para todas las pruebas funcionales.
Para activarlo: resolver facturación en Google Cloud, restringir clave a sitios locales y APIs Maps JavaScript/Places (New), activar variable y reiniciar servidor. La búsqueda Places queda pendiente de validación real mientras persista ese bloqueo. La clave está únicamente en .env.local, ignorado por Git.

## Evidencia
- 18 verificaciones SQL transaccionales en supabase/tests/direcciones_zonas.test.sql, con rollback.
- Suite frontend completa: 38 archivos y 201 pruebas aprobadas; incluye selección predeterminada, invalidación y carga tardía.
- scripts/verificar-direcciones-zonas-local.mjs: cuentas/tienda temporales, permiso de ubicación simulado, dirección persistente, dibujo real de rectángulo, pedido de $1000 + $150 de envío = $1150, edición y eliminación sin alterar histórico, rechazo fuera de cobertura, solapamientos, precio manipulado y cotización desactualizada. Limpia sus datos temporales.
- Asesor de seguridad Supabase local: sin observaciones.
- Migración local 20261106223945_direcciones_cliente_y_zonas aplicada y registrada. El comparador reproduce las migraciones en una base sombra; su informe adicional solo incluye funciones anteriores ajenas a esta tarea y se conserva en test-results/diff-esquema-zonas.sql, fuera de migraciones.
- Sin cambios ni despliegue en la nube. No se marcan historias como completas por la parte de Google pendiente.
