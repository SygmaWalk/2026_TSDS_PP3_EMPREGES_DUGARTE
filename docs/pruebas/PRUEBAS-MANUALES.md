# Probar EmpreGest manualmente y ejecutar pruebas de base

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

## Entrar a la aplicación local

1. Mantener Docker y Supabase local en ejecución; iniciar Vite con `npm run dev` desde `C:\dev\2026_TSDS_PP3_EMPREGES_DUGARTE`.
2. Abrir http://127.0.0.1:5173/ y elegir **Crear una cuenta**.
3. Usar un correo propio y elegir una contraseña de al menos 8 caracteres. No existe un usuario o contraseña predeterminados de la aplicación.
4. La configuración local actual no exige confirmación de correo. La cuenta local es independiente de las cuentas del proyecto remoto.
5. Crear un emprendimiento, por ejemplo nombre «Mi negocio de prueba» e identificador «mi-negocio-prueba». Si el identificador ya existe, elegir otro.
6. Entrar al emprendimiento, crear un producto y pulsar Mostrar para que aparezca en la vista de Catálogo.
7. Agregarlo al carrito, cambiar cantidades y recargar. Elegir otra vez el mismo emprendimiento y abrir Carrito: debe conservar la selección.

El carrito se almacena en este navegador, separado por cuenta y emprendimiento. Se guardan solo identificadores y cantidades. Los nombres, precios y disponibilidad se vuelven a obtener del catálogo. No sincroniza selecciones entre computadoras; borrar los datos del sitio elimina el carrito guardado. Usar siempre la misma dirección, por ejemplo `127.0.0.1`, porque `localhost` constituye un origen diferente.

No se puede confirmar el pedido todavía. El catálogo actual es una vista dentro del panel; el acceso público independiente sigue pendiente.

## Las 52 pruebas SQL

Los archivos son:

- `supabase/tests/catalogo.test.sql`: 42 comprobaciones de campos, restricciones, unicidad, fechas y permisos del catálogo.
- `supabase/tests/membresias_productos.test.sql`: 10 comprobaciones de membresías, creación de emprendimiento y autorización por negocio.

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

La revisión anterior en el navegador también usó una de esas cuentas temporales. Se cerró la sesión y se eliminó al terminar; por eso no hay credenciales de prueba permanentes para reutilizar. Para trabajar manualmente, crear una cuenta propia desde la aplicación.

## Ver tablas directamente

Abrir Supabase Studio local: http://127.0.0.1:54323/. Allí pueden verse Auth/Users y las tablas `emprendimientos`, `miembros_emprendimiento` y `productos`. Los usuarios de Auth son distintos de los roles internos de PostgreSQL.

Si se usa una herramienta SQL externa, la conexión local configurada es host `127.0.0.1`, puerto `54322`, base `postgres`, usuario `postgres`, contraseña local `postgres`. Estos datos son de desarrollo local, no son credenciales para entrar a EmpreGest ni al proyecto remoto.

## Pruebas de interfaz y carrito

```powershell
npm run test:report
npm run test:report:open
```

El informe Vitest corresponde a las pruebas JavaScript; las 52 comprobaciones SQL se muestran por separado en la terminal. Se añadieron casos CP-CAR-P01 a CP-CAR-P07 para conservación al recargar, separación por cuenta/negocio, precios actuales, cantidades inválidas, borrado del último ítem y almacenamiento no disponible.

Referencia del mecanismo de almacenamiento: https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage

## Identificadores y evidencias manuales

Los casos M01 a M14 de la guía de esta conversación usan M como abreviatura de Manual. Es una convención propia de la guía, no un identificador de Jira ni del ejecutor automático. Registrar también la historia relacionada, por ejemplo M10 con ND2026-5.

Las capturas son evidencia válida cuando permiten observar el resultado relevante. Acompañarlas con caso, fecha, entorno, versión o rama, pasos, resultado esperado y resultado obtenido. Para conservación tras recarga, guardar una captura anterior y otra posterior o una grabación corta. Una captura final aislada no demuestra que se haya recargado la página. Evitar mostrar contraseñas o claves.

Ejemplo de nombre: M10-carrito-despues-recarga-2026-09-23.png. El estado empieza en No ejecutado; usar Aprobado o Fallido después de ejecutar, y Bloqueado cuando una dependencia impida la prueba.
