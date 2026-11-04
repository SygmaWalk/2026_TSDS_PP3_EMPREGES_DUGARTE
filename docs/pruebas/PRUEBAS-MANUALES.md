# Probar EmpreGest manualmente y ejecutar pruebas de base

> Actualización posterior del 01/10/2026: ya están implementados localmente [dirección, mapa, cobertura y tarifas de entrega](2026-10-01-entregas-y-cobertura.md). Las limitaciones de entrega descritas en el informe anterior son históricas. Aceptación manual pendiente.

## Arranque diario y entorno de trabajo

Abrir Docker Desktop y esperar a que esté listo. Desde la carpeta del repositorio:

```powershell
cd C:\dev\2026_TSDS_PP3_EMPREGES_DUGARTE
npx supabase start --exclude imgproxy,logflare,vector,supavisor
npm run dev
```

La segunda línea inicia los servicios locales con las mismas exclusiones utilizadas durante la actualización. Si ya están funcionando, no hace falta iniciarlos otra vez. La última línea mantiene el servidor de la aplicación abierto en la terminal; usar la dirección que indique Vite. No ejecutar otra copia si ya hay una en marcha.

Docker ejecuta los contenedores. Supabase local proporciona base de datos, autenticación y servicios. Vite sirve la interfaz. Abrir Docker por sí solo no garantiza que todos los servicios del proyecto estén listos.

La configuración actual de .env.local usa http://127.0.0.1:54321: las cuentas y los productos de esta aplicación se guardan en la base local. El proyecto alojado en Supabase es otro entorno. No existe sincronización automática de datos entre ambos. Usaremos la nube para probar el despliegue compartido, después de revisar/aplicar las migraciones y configurar la URL y la clave publicable de ese entorno. Subir código a GitHub no realiza ese cambio por sí solo.

Para terminar: Ctrl+C detiene Vite. Si también se desea detener la base, ejecutar npx supabase stop desde el repositorio, conservando los datos locales.

## Entrar a la aplicación local — actualizado 01/10/2026

Seguí [la guía de roles y permisos](2026-10-01-acceso-y-permisos.md). Ya no hay autorregistro interno ni creación autónoma de emprendimientos.

1. Mantener Docker y Supabase local en ejecución; iniciar Vite con `npm run dev` si todavía no está abierto.
2. Abrir http://127.0.0.1:5173/.
3. Usar una cuenta habilitada por el administrador o una de las cinco cuentas ficticias preparadas en el archivo local `.qa-persistencia.local`.
4. Con el perfil de gestión completa, entrar a «Prueba de persistencia», crear un producto y pulsar Mostrar.
5. Agregarlo al carrito, cambiar cantidades y recargar. Elegir el mismo negocio y abrir Carrito: debe conservar la selección.
6. Cerrar sesión y comparar con el perfil lector, que puede consultar productos sin modificarlos.

El carrito se almacena en este navegador, separado por cuenta y emprendimiento. Se guardan solo identificadores y cantidades. Los nombres, precios y disponibilidad se vuelven a obtener del catálogo. No sincroniza selecciones entre computadoras; borrar los datos del sitio elimina el carrito guardado. Usar siempre la misma dirección, por ejemplo `127.0.0.1`, porque `localhost` constituye un origen diferente.

La tienda pública independiente ya está disponible en #/tienda/<slug>, desde «Abrir tienda pública». No requiere iniciar sesión y tiene un carrito invitado separado por negocio. Desde el carrito de la tienda pública ya se puede confirmar con nombre y teléfono. Ver [guía de confirmación y pruebas pendientes](2026-10-01-confirmacion-pedidos.md). Seguí [la guía de imágenes y tienda pública](2026-10-01-catalogo-publico-e-imagenes.md) para probarla.

## Las 95 pruebas SQL

Los archivos son:

- `supabase/tests/catalogo.test.sql`: 42 comprobaciones de campos, restricciones, unicidad, fechas y permisos del catálogo.
- `supabase/tests/membresias_productos.test.sql`: 36 comprobaciones de roles, permisos individuales, concesión, revocación y aislamiento por negocio.
- `supabase/tests/panel_pedidos.test.sql`: 17 comprobaciones de acceso a pedidos y detalles, aislamiento y revocación.

Usan pgTAP dentro de PostgreSQL. Cada archivo abre una transacción (`BEGIN`), prepara datos ficticios, comprueba resultados y termina con `ROLLBACK`. Los datos de prueba no quedan guardados. Las secuencias pueden avanzar aunque la transacción se revierta.

Para repetirlas desde la terminal del repositorio:

```powershell
npx supabase test db --local
```

La herramienta se conecta automáticamente a la base local. No pide correo ni contraseña de una cuenta de EmpreGest. En los casos de permisos, SQL adopta los roles `anon` o `authenticated` y simula el identificador de un usuario con `request.jwt.claims`. Esto comprueba RLS sin iniciar sesión en la pantalla.

Los usuarios insertados por esos archivos no son cuentas de demostración reutilizables: se revierten al terminar, y no tienen una contraseña preparada para ingresar.

## Prueba de integración con cuentas reales temporales

```powershell
node scripts/verificar-persistencia-local.mjs
```

El script crea dos cuentas temporales en Supabase local, ingresa mediante Auth y ejecuta altas, edición, visibilidad, duplicados y accesos desde una cuenta ajena mediante la API. Al finalizar elimina únicamente sus cuentas y registros. No altera datos remotos.

Para revisión manual se prepararon cinco cuentas locales con --preparar-ui. Consultar sus credenciales y resultados esperados en la guía de roles y permisos. Su preparación no equivale a ejecutar las pruebas manuales.

## Ver tablas directamente

Abrir Supabase Studio local: http://127.0.0.1:54323/. Allí pueden verse Auth/Users y las tablas `cuentas_acceso`, `emprendimientos`, `miembros_emprendimiento`, `permisos_miembro` y `productos`. Los usuarios de Auth son distintos de los roles internos de PostgreSQL.

Si se usa una herramienta SQL externa, la conexión local configurada es host `127.0.0.1`, puerto `54322`, base `postgres`, usuario `postgres`, contraseña local `postgres`. Estos datos son de desarrollo local, no son credenciales para entrar a EmpreGest ni al proyecto remoto.

## Pruebas de interfaz y carrito

```powershell
npm run test:report
npm run test:report:open
```

El informe Vitest corresponde a las pruebas JavaScript; las 78 comprobaciones SQL se muestran por separado en la terminal. Se añadieron casos CP-CAR-P01 a CP-CAR-P07 para conservación al recargar, separación por cuenta/negocio, precios actuales, cantidades inválidas, borrado del último ítem y almacenamiento no disponible.

Referencia del mecanismo de almacenamiento: https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage

## Identificadores y evidencias manuales

Los casos M01 a M14 de la guía de esta conversación usan M como abreviatura de Manual. Es una convención propia de la guía, no un identificador de Jira ni del ejecutor automático. Registrar también la historia relacionada, por ejemplo M10 con ND2026-5.

Las capturas son evidencia válida cuando permiten observar el resultado relevante. Acompañarlas con caso, fecha, entorno, versión o rama, pasos, resultado esperado y resultado obtenido. Para conservación tras recarga, guardar una captura anterior y otra posterior o una grabación corta. Una captura final aislada no demuestra que se haya recargado la página. Evitar mostrar contraseñas o claves.

Ejemplo de nombre: M10-carrito-despues-recarga-2026-09-23.png. El estado empieza en No ejecutado; usar Aprobado o Fallido después de ejecutar, y Bloqueado cuando una dependencia impida la prueba.

## Consultar los pedidos del emprendimiento

Abrir #/ingresar con el perfil editor de .qa-tienda.local y pulsar «Ver pedidos» en Tienda de prueba. Consultar [la guía del panel](2026-10-01-panel-pedidos.md) para filtros, detalle y casos pendientes. El permiso de pedidos es independiente del de productos.
