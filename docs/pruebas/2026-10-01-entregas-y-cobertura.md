# Entregas con dirección, mapa y tarifas — ND2026-25 / ND2026-65 — 01/10/2026

## Estado

Implementación local de [ND2026-25](https://sygmawalk.atlassian.net/browse/ND2026-25) y [ND2026-65](https://sygmawalk.atlassian.net/browse/ND2026-65). Aceptación manual pendiente. No se cambiaron estados ni sprints de Jira, ni documentos de Drive.

Repositorio: C:\dev\2026_TSDS_PP3_EMPREGES_DUGARTE. Rama ND2026-3-integrar-persistencia-productos; base dc14e17 más cambios locales sin commit. Vite en http://127.0.0.1:5173 y Supabase local en el puerto 54321. Sin despliegue ni publicación en GitHub.

## Qué se puede usar

- Cada emprendimiento autorizado puede configurar dirección de origen, punto del mapa y hasta 20 franjas sucesivas, con límite máximo de 100 km.
- Nuevo permiso individual entregas.configurar. Un miembro de otro negocio o sin ese permiso no puede modificar la configuración. El administrador tiene acceso central.
- La primera franja incluye desde 0 hasta su límite; las siguientes abarcan más del límite anterior hasta el nuevo, inclusive. No se introducen huecos ni superposiciones porque el inicio se deriva del límite anterior.
- El cliente elige retiro o envío a domicilio. Para envío completa dirección, referencia opcional y punto del mapa; luego calcula la cobertura y el costo antes de confirmar.
- El subtotal, el envío y el total aparecen separados. Retiro tiene costo de envío cero.
- Fuera de cobertura o sin configuración no se confirma un envío; se informa el motivo y se ofrece elegir retiro o consultar al negocio.
- El servidor calcula la tarifa y vuelve a validar la versión de la configuración al confirmar. Una cotización vieja o un costo manipulado no generan el pedido.
- El pedido conserva la dirección, punto, distancia, franja, origen y tarifa aplicados. Las modificaciones posteriores no cambian el comprobante ni el detalle histórico.
- Si se pierde la respuesta, se conserva el mismo intento para reintentarlo sin duplicar pedidos. Una recarga también conserva su entrega. Los pedidos anteriores sin datos de entrega muestran esa ausencia explícitamente.

## Primer recorrido manual en Tienda de prueba

1. Mantener Docker, Supabase local y Vite activos. Abrir http://127.0.0.1:5173/#/ingresar.
2. Ingresar con el perfil **editor** de .qa-tienda.local. Ese archivo contiene las credenciales locales; no copiarlas a evidencias públicas.
3. En **Mis emprendimientos → Tienda de prueba**, pulsar **Configurar entregas**. Si no aparece, recargar para actualizar los permisos.
4. Completar **Dirección de origen**, marcar su ubicación en el mapa y definir las franjas. Para una prueba ficticia se puede usar 2 km a $500 y 5 km a $900, dejando identificado que son valores de prueba. No se cargaron esos valores automáticamente en tu tienda.
5. Pulsar **Guardar entregas** y comprobar el mensaje de guardado.
6. Abrir la tienda pública de Tienda de prueba en una ventana privada: http://127.0.0.1:5173/#/tienda/tienda-0-f1633b5c-30be-4a88-bcf0-904e57067fd3.
7. Agregar un producto, abrir **Carrito → Continuar con el pedido** y completar el contacto.
8. Elegir **Envío a domicilio**, escribir la dirección y marcar un destino cercano al origen. La dirección escrita no mueve el mapa automáticamente.
9. Pulsar **Calcular envío**. Revisar franja, distancia, envío y total; después **Confirmar pedido**.
10. Guardar captura del comprobante y su número. Recargar: debe conservar el mismo pedido.
11. Volver a la sesión editor, entrar a **Ver pedidos** y abrir ese número. Comparar contacto, dirección, punto y total con el comprobante.

El script preparar-entregas-demo-local.mjs concedió únicamente el permiso de entregas al editor verificado de Tienda de prueba. No cambió el origen, las tarifas ni los pedidos existentes.

## Matriz para completar por José

“M” indica prueba manual. Estos casos complementan los anteriores; no los reemplazan. José informó en el chat que verificó el funcionamiento, sin recabar capturas ni detallar resultados por caso. Se registra esa revisión informal; cada caso queda pendiente de registrar individualmente y adjuntar evidencia. Las capturas automatizadas se identifican por separado.

| Caso | Acción | Resultado esperado | Estado manual | Evidencia |
|---|---|---|---|---|
| M-ENT-01 | Configurar origen y dos franjas, guardar, salir y volver a entrar | Se conservan dirección, punto y tarifas | Pendiente de registrar | Pendiente |
| M-ENT-02 | Intentar límites iguales/decrecientes, tarifa negativa o sin punto | No guarda y explica el error | Pendiente de registrar | Pendiente |
| M-ENT-03 | Destino dentro de la primera franja, calcular y confirmar | Aplica primera tarifa; subtotal + envío = total | Pendiente de registrar | Pendiente |
| M-ENT-04 | Destino después de la primera franja y dentro de la segunda | Aplica segunda tarifa sin sumarla a la primera | Pendiente de registrar | Pendiente |
| M-ENT-05 | Marcar destino fuera de cobertura | Informa fuera de cobertura y no habilita confirmar envío | Pendiente de registrar | Pendiente |
| M-ENT-06 | Elegir envío sin dirección o sin punto | No permite confirmar | Pendiente de registrar | Pendiente |
| M-ENT-07 | Calcular envío y cambiar destino/dirección | Exige calcular otra vez antes de confirmar | Pendiente de registrar | Pendiente |
| M-ENT-08 | Calcular; cambiar tarifas en otra ventana; confirmar | Rechaza cotización anterior, conserva datos y exige recalcular | Pendiente de registrar | Pendiente |
| M-ENT-09 | Confirmar con envío; cambiar configuración; consultar pedido | Dirección y tarifa históricas no cambian | Pendiente de registrar | Pendiente |
| M-ENT-10 | Elegir retiro y confirmar | Envío $0, total igual al subtotal y modalidad retiro registrada | Pendiente de registrar | Pendiente |
| M-ENT-11 | Recargar el comprobante y abrir el pedido en el panel | Mismo número, un pedido y mismos datos | Pendiente de registrar | Pendiente |
| M-ENT-12 | Ingresar como lector y comparar con editor | Solo editor autorizado ve Configurar entregas | Pendiente de registrar | Pendiente |
| M-ENT-13 | Repetir selección del mapa y confirmación en móvil | Campos, controles, mapa y total utilizables sin desborde | Pendiente de registrar | Pendiente |

Para cada caso registrar fecha, entorno, datos de prueba, resultado observado, Pasó/Falló y captura. Si falla, conservar evidencia y describir la diferencia; no cambiar el resultado esperado para hacerlo pasar. Usar contactos y direcciones ficticios en las evidencias compartidas.

## Verificación automatizada

- Frontend: 81 pruebas, incluyendo 8 nuevas de configuración, cotización obligatoria, invalidación del destino, respuesta tardía, cambio de tarifa, fuera de cobertura y recuperación del intento/comprobante.
- PostgreSQL: 95 pruebas pgTAP existentes aprobadas.
- Integración de entregas: 25 verificaciones aprobadas contra Auth y API locales. Cubren falta de configuración, límites radiales, tarifa cero, coordenadas inválidas, franjas inválidas, acceso ajeno, revocación sin renovar sesión, importe manipulado, dirección obligatoria, cambio de configuración, historial, retiro y compatibilidad con solicitudes anteriores.
- Integración de pedidos anterior: 27 verificaciones aprobadas, incluyendo atomicidad y reintentos concurrentes.
- Navegador Chromium real: configuración → selección por clic → cotización → pedido invitado → recarga → detalle interno. Se capturaron vistas de 1280 px y 390 px y se comprobó ausencia de desborde horizontal. Se verificó la carga real de imágenes de OpenStreetMap.
- Lint sin errores. Compilación correcta; Vite conserva aviso de tamaño del paquete principal, aproximadamente 511 kB antes de compresión. El mapa se carga aparte al necesitarlo.
- Supabase advisors local, seguridad nivel warn/error: sin incidencias.
- Migración 20261001220636_entregas_radiales.sql registrada en la base local. Reconstrucción en base temporal mediante db diff correcta; solo quedaron las dos diferencias preexistentes de formato de preparar_registro_catalogo y rls_auto_enable. No se reinició ni borró la base del usuario.

La primera ejecución del navegador agotó el tiempo esperando el mapa después del cambio de dependencias. La repetición completó el flujo. Las primeras capturas se tomaban antes de terminar la carga/transición; se ajustó la espera y se verificaron nuevamente. Las capturas finales sustituyen esas imágenes preliminares.

Repetir desde la raíz del repositorio, con servicios locales activos:

~~~powershell
npm test
npm run lint
npm run build
npx supabase test db --local
node scripts/verificar-entregas-local.mjs
node scripts/verificar-pedidos-local.mjs
~~~

El script de entregas crea usuarios, negocios y pedidos exclusivamente ficticios y los limpia al terminar. Sus capturas quedan en test-results/configurar-entregas-*.png, checkout-envio-*.png y detalle-envio-*.png. No equivalen a la aceptación manual del usuario.

## Decisiones y límites

Leaflet 1.9.4 y mapas estándar de OpenStreetMap, con atribución visible. Las imágenes requieren conexión a Internet aunque la aplicación y la base sean locales. Hay entrada alternativa de coordenadas; no se usa geocodificación, cálculo de rutas ni descarga masiva de mapas. Referencias: [Leaflet](https://leafletjs.com/examples/quick-start/) y [política de mapas de OSM](https://operations.osmfoundation.org/policies/tiles/).

El cálculo es radial esférico (Haversine, radio terrestre medio 6371008,8 m). Coordenadas WGS84 con seis decimales; distancia redondeada a centésimas de metro antes de comparar límites. Esta precisión de cálculo no garantiza exactitud de una dirección real. La dirección y el punto deben revisarse antes de confirmar.

Pendiente: aceptación manual y evidencias; direcciones guardadas de clientes (ND2026-42), administración visual de permisos, cambios de estado de pedidos y despliegue compartido corresponden a otros alcances. No se declara cerrado el sprint ni estas historias solo por tener pruebas automatizadas aprobadas.

## Ampliación: mapa del pedido y acceso a ruta por calles

El detalle interno incorpora un mapa de consulta con origen y destino históricos. Permite acercar y desplazar la vista; tocarlo no cambia el pedido. No consulta la configuración actual para reconstruir el origen. Si faltan coordenadas válidas, informa la ausencia; no inventa un punto ni una ruta.

El botón **Ver ruta en Google Maps** abre otra pestaña con las coordenadas guardadas. El usuario autorizó expresamente ese enlace en el chat. La URL no lleva nombre, teléfono ni dirección escrita; las coordenadas se comparten con Google al abrir el enlace. Google permite elegir transporte y consultar recorrido por calles, distancia y tiempo. La aplicación no calcula ni dibuja esa ruta internamente y no garantiza que sea la menor distancia o duración en todas las condiciones. El costo histórico continúa basado en distancia radial.

Esta modalidad usa [Maps URLs](https://developers.google.com/maps/documentation/urls/get-started), sin clave de API. Dibujar rutas dentro de EmpreGest requeriría una integración adicional con un servicio como [Routes API](https://developers.google.com/maps/documentation/routes/compute-route-over), con sus credenciales, condiciones y facturación.

Verificación de esta ampliación:
- 17 pruebas dirigidas de interfaz aprobadas (3 nuevas, 6 del panel y 8 de entregas).
- Lint y compilación correctos; continúa el aviso de tamaño del paquete principal.
- Las 25 comprobaciones de integración local de entregas vuelven a pasar.
- Navegador: pedido con envío, recarga, modificación posterior del origen actual y consulta del detalle. El mapa y el enlace conservan las coordenadas originales; hacer clic en el mapa no cambia los marcadores ni los datos del pedido.
- Capturas automatizadas actualizadas en test-results/detalle-envio-escritorio.png y test-results/detalle-envio-movil.png, con datos ficticios. Se comprobó el destino del enlace; no se evaluó la calidad del recorrido que Google ofrezca.
- No hubo cambios de esquema, tarifas ni pedidos del usuario.

| Caso | Acción | Resultado esperado | Estado manual | Evidencia |
|---|---|---|---|---|
| M-ENT-14 | Abrir un pedido con envío y revisar su mapa | El destino coincide con el punto elegido por el cliente; el mapa no permite cambiarlo | Pendiente de registrar | Pendiente |
| M-ENT-15 | Pulsar Ver ruta en Google Maps | Abre Google Maps con origen y destino correctos; permite consultar recorrido por calles | Pendiente de registrar | Pendiente |
| M-ENT-16 | Cambiar origen de configuración y volver al pedido anterior | Mapa y enlace conservan el origen histórico y el importe del pedido | Pendiente de registrar | Pendiente |

Para evidencia manual del nuevo detalle, capturar la sección **Ubicación de entrega** con ambos puntos y, por separado, la ruta abierta en Google Maps. Anotar el número del pedido, entorno local, fecha y resultado observado. No atribuir las capturas automatizadas a una ejecución manual de José.
