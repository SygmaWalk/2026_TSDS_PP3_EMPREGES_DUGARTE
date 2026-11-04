# Persistencia local de productos — 22/09/2026

## Alcance

Rama `ND2026-3-integrar-persistencia-productos`, basada en `cea95ca` más los cambios de esta sesión. Implementa acceso por correo y contraseña, registro de cuenta, recuperación y cierre de sesión, selección/alta de emprendimientos y alta, edición y visibilidad de productos persistidas en Supabase.

Las membresías y políticas RLS existentes determinan los permisos. La interfaz no permite elegir un emprendimiento ajeno. Las operaciones de datos también filtran por emprendimiento; el servidor mantiene la comprobación de autorización. Identificadores y fechas proceden de PostgreSQL.

El formulario espera la respuesta del servidor, bloquea acciones simultáneas y conserva los campos cuando no se pudo guardar. Una sesión nueva o un cambio de emprendimiento desmonta los datos anteriores.

## Ejecutar localmente

1. Abrir Docker Desktop y arrancar el entorno local de Supabase según la configuración existente del repositorio.
2. Ejecutar `npm ci`.
3. Crear `.env.local` a partir de `.env.example`. Obtener la URL y la clave **publicable local** desde `npx supabase status`. Nunca copiar la clave secreta ni `service_role` a variables `VITE_`.
4. Comprobar que las cuatro migraciones estén aplicadas con `npx supabase migration list --local`. Si se trata de un entorno nuevo, aplicar las migraciones versionadas antes de usar el formulario.
5. Ejecutar `npm run dev` y abrir la dirección indicada.
6. Crear una cuenta propia. La configuración local actual no exige confirmación de correo; si el entorno la exige, confirmar antes de ingresar.
7. Crear o seleccionar un emprendimiento y cargar sus productos.

Al recargar se recupera la sesión y se vuelve al selector de emprendimientos. Al elegir el mismo negocio, sus productos se consultan nuevamente desde la base.

## Validación

- 52 comprobaciones pgTAP aprobadas: `npx supabase test db --local`.
- Asesor de seguridad local sin hallazgos: `npx supabase db advisors --local --type security --fail-on warn`.
- 49 pruebas de frontend aprobadas: `npm run test:report`; informe en `.vitest/`. Incluyen las 34 pruebas anteriores, cuatro de guardado asincrónico, cuatro de acceso/sesión y siete de almacenamiento/restauración del carrito.
- Análisis de código y compilación aprobados: `npm run lint` y `npm run build`.
- Prueba real de API: `node scripts/verificar-persistencia-local.mjs`. Crea dos cuentas y un negocio temporales, verifica alta/edición, unicidad, nueva sesión, lectura pública y rechazo de modificaciones ajenas, y limpia únicamente sus registros al terminar. El script rechaza direcciones que no sean `127.0.0.1`.

Para una revisión visual temporal, el script admite `--preparar-ui`. Conserva sus registros y una cuenta en `.qa-persistencia.local` (ignorada por Git). Al terminar, cerrar sesión y ejecutar el mismo script con `--limpiar-ui`. No compartir el archivo temporal.

### Recorrido manual realizado

Con una cuenta temporal en Supabase local:

1. Ingresar y seleccionar «Prueba de persistencia».
2. Crear «Producto navegador QA» a $2.500,50: queda oculto.
3. Mostrarlo y editar el precio a $2.750,75.
4. Recargar la página y seleccionar el mismo emprendimiento.
5. Verificar que conserva el nombre, precio $2.750,75 y estado Visible. Resultado: aprobado.

Se comprobó también el cierre de sesión. Las dos cuentas y todos los registros temporales creados para esta revisión se eliminaron al terminar.

## Pendientes y límites

- La integración fue comprobada solo contra Supabase local. No se aplicaron migraciones ni se modificaron datos remotos.
- Catálogo y carrito dentro del panel siguen siendo una vista previa. Falta la ruta pública independiente del catálogo (ND2026-4).
- Actualización solicitada por el usuario: el carrito se conserva al recargar y al volver al mismo emprendimiento, separado por cuenta y negocio en este navegador. Todavía no se confirman pedidos. Ver `PRUEBAS-MANUALES.md`.
- El modelo implementa membresías mínimas, no todos los roles y flujos de ND2026-24.
- Las imágenes siguen siendo rutas; no se implementó carga a Storage.
- No se cerraron historias de Jira. Antes de cerrar ND2026-3/10 falta completar la matriz de aceptación, revisar los cambios y decidir su publicación.

## Referencias de implementación

- https://supabase.com/docs/guides/auth/quickstarts/react
- https://supabase.com/docs/guides/database/postgres/row-level-security
