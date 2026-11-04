# Acceso individual y permisos — ND2026-24

Fecha de documentación: 01/10/2026. Entorno: Supabase local y aplicación en http://127.0.0.1:5173/.
Cambios locales sobre la rama ND2026-3-integrar-persistencia-productos, a partir de dc14e17. No publicados en GitHub ni aplicados a la nube.

## Qué funciona

- Roles Administrador del sistema, Emprendimiento y Cliente.
- Cuenta individual habilitada y asociación habilitada al emprendimiento.
- Permisos independientes de consultar, crear, editar y publicar productos. Crear, editar o publicar requiere también consultar.
- Solo el administrador puede modificar cuentas, asociaciones y permisos a través de las políticas de la API. La interfaz para administrarlos sigue pendiente en ND2026-61.
- La revocación se comprueba en la base en la siguiente operación, sin renovar el token. La interfaz actualiza el acceso cada 30 segundos y al recuperar el foco.
- Un registro de Auth produce Cliente; los metadatos enviados por el usuario no conceden roles internos.
- Se retiraron el registro interno desde la pantalla y la función que permitía crear un negocio y autoasignarse acceso.
- El catálogo visible sigue siendo legible por invitados en la API. Su pantalla pública independiente continúa pendiente.

La migración conserva usuarios, membresías, negocios y productos. Las cuentas anteriores se clasifican inicialmente como Cliente, sin promoverlas por membresías antiguas. El administrador debe revisar y habilitar explícitamente cualquier acceso interno que corresponda.

## Entrar para revisar los cinco perfiles

1. Mantener Docker, Supabase local y Vite en ejecución.
2. Abrir http://127.0.0.1:5173/.
3. Consultar el archivo local [.qa-persistencia.local](../../.qa-persistencia.local). La lista `cuentas` contiene perfil, correo y contraseña para cada cuenta ficticia.
4. Ingresar con una cuenta por vez y cerrar sesión antes de cambiar de perfil.

| Perfil preparado | Resultado esperado |
|---|---|
| Emprendimiento: gestión completa | Entrar a «Prueba de persistencia»; crear, editar y mostrar/ocultar productos |
| lector | Entrar al mismo negocio y ver los productos sin controles de alta, edición o publicación |
| Cliente | Ver la bienvenida de cliente; no acceder al panel interno |
| administrador | Ver «Administración del sistema» y los emprendimientos; administrar productos |
| deshabilitada | Ver el aviso de cuenta no habilitada, sin datos internos |

Son cuentas ficticias exclusivamente locales, preparadas para esta revisión. El archivo de credenciales está excluido de Git. No incluirlo ni mostrar contraseñas en las evidencias.

## Casos manuales propuestos — todavía No ejecutado por el usuario

Estos identificadores nuevos no sustituyen automáticamente los M01–M16 de Drive.

| Caso | Pasos y resultado esperado | Estado |
|---|---|---|
| ACC-01 | Ingresar con datos incorrectos: mensaje claro, sin panel interno | No ejecutado |
| ACC-02 | Ingresar con gestión completa, recargar, verificar que conserva sesión; cerrar sesión y verificar retorno a Ingresar | No ejecutado |
| ACC-03 | Ingresar como lector: consultar el mismo producto sin poder modificarlo | No ejecutado |
| ACC-04 | Ingresar como Cliente: bienvenida sin panel interno ni creación de emprendimiento | No ejecutado |
| ACC-05 | Ingresar como administrador: consultar el negocio y sus productos | No ejecutado |
| ACC-06 | Ingresar con cuenta deshabilitada: aviso sin acceso interno | No ejecutado |

Para cada caso registrar fecha, entorno, versión, esperado, obtenido y captura pertinente. La revocación con sesión abierta y los intentos directos por API se prueban automáticamente; la pantalla para cambiar permisos todavía no está disponible.

## Resultados automatizados verificados

| Comprobación | Resultado |
|---|---|
| Vitest: 8 archivos | 54 pruebas aprobadas |
| pgTAP: catálogo y permisos | 78 comprobaciones aprobadas (42 + 36) |
| Integración por API con Auth real | Aprobada: persistencia, aislamiento, roles y revocación con la misma sesión |
| Navegador Chromium sobre la aplicación real | Cinco perfiles aprobados; recarga para cuentas internas y cierre de sesión de todos; sin errores JavaScript |
| Lint y compilación de producción | Aprobados |
| Asesor de seguridad de la base local | Sin hallazgos en niveles advertencia/error |
| Reconstrucción de migraciones en base temporal | Aprobada; dos diferencias de formato en funciones anteriores, comparadas sin diferencias de contenido normalizado |

Captura automática del lector: `test-results/acceso-lector.png`. Es evidencia de la ejecución automática, no de una ejecución manual del usuario. Las salidas generadas y las credenciales permanecen fuera del versionado.

## Repetir las comprobaciones

Desde la raíz del repositorio:

```powershell
npm test -- --maxWorkers=1
npx supabase test db --local
node scripts/verificar-persistencia-local.mjs
npm run lint
npm run build
```

Preparar las cuentas para navegador cuando no exista el archivo local:

```powershell
node scripts/verificar-persistencia-local.mjs --preparar-ui
node scripts/verificar-acceso-ui-local.mjs
```

El primer script sin opciones usa dos cuentas temporales y las elimina al finalizar. Con `--preparar-ui` conserva cinco cuentas y el negocio de prueba. No sobrescribe un archivo de credenciales existente. Al terminar de utilizarlas, `node scripts/verificar-persistencia-local.mjs --limpiar-ui` elimina solamente las cuentas y registros identificados en ese archivo.

## Aprovisionamiento controlado

Las cuentas de Auth se crean por una operación administrativa de servidor o mediante Auth/Users de Studio local. La cuenta nueva siempre comienza como Cliente. Desde una conexión administrativa local se configura `cuentas_acceso`, y luego `miembros_emprendimiento` y `permisos_miembro` según la persona y el negocio. Las credenciales privilegiadas nunca van al frontend.

Para una cuenta de Emprendimiento asignar rol `emprendimiento`, habilitar cuenta y membresía, y conceder permisos concretos: `productos.ver`, `productos.crear`, `productos.editar`, `productos.publicar`. El administrador inicial se configura mediante ese procedimiento controlado. La cuenta de administrador de esta prueba es ficticia y local.

Migración: `supabase/migrations/20261001001007_roles_permisos_individuales.sql`. Incluye adaptación de cuentas anteriores y conserva los datos. Se generó desde la base local y se revisó para incluir la adaptación de datos, los permisos explícitos y solo los cambios de esta historia.

## Pendientes para aceptar la historia

ND2026-24 no se considera cerrada. Falta validar manualmente, integrar el recorrido público con las historias de catálogo/carrito/pedido y actualizar posteriormente la documentación de Drive. La administración visual de cuentas/permisos, Google, perfil y pedidos personales pertenecen a sus historias separadas. No hay cambios de estado en Jira en esta ejecución.

Referencia técnica: [Row Level Security de Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Presentación visual por rol — 01/10/2026

Se rediseñaron el ingreso, el resumen por rol, las tarjetas de emprendimiento y el encabezado de productos. Cada tarjeta muestra los permisos reales; el rol y los permisos permanecen visibles dentro del emprendimiento. La cuenta Cliente tiene una pantalla independiente con perfil e historial señalados como próximos, sin acciones simuladas.

Se comprobaron nuevamente las 54 pruebas de frontend, lint y compilación. La prueba de navegador recorrió los cinco perfiles en 1280 px y 390 px, comprobó ausencia de desbordes horizontales y generó capturas en test-results. Se revisaron visualmente el ingreso, el panel de lectura y las pantallas móviles de productos y Cliente. Las cuentas de prueba y datos existentes se conservaron. Este trabajo no entrega la personalización configurable de la tienda pública de ND2026-47/48 ni cambia estados de Jira.
