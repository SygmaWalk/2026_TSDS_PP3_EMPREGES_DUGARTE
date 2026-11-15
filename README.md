# EmpreGest

Aplicación para emprendimientos gastronómicos: catálogo público, carrito persistente, compra autenticada, pedidos, entregas, cobros, clientes, inventario y permisos por cuenta y negocio.

## Continuar desde otra PC

Requisitos: Git, Node.js 24.15 o posterior compatible y Docker Desktop si se utiliza Supabase local.

```sh
git clone https://github.com/SygmaWalk/2026_TSDS_PP3_EMPREGES_DUGARTE.git
cd 2026_TSDS_PP3_EMPREGES_DUGARTE
npm ci
```

En una copia existente, conservar primero los cambios propios y actualizar `main` con `git pull --ff-only`. Crear una rama para la siguiente historia del sprint.

Copiar `.env.example` a `.env.local`. Configurar `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` para el entorno elegido. Nunca usar una clave secreta o `service_role` en variables `VITE_`.

Para una instalación local nueva, iniciar Docker Desktop y ejecutar:

```sh
npx supabase start
npx supabase status
npx supabase migration list --local
npm run dev
```

La URL y la clave publicable del entorno local se obtienen con `supabase status`. Para actualizar una instalación existente, aplicar las migraciones pendientes con `npx supabase migration up --local`. No ejecutar un reinicio de la base para actualizar una instalación con datos que se quieran conservar.

El registro público crea cuentas cliente. Las cuentas internas, sus permisos y los administradores requieren aprovisionamiento autorizado; registrarse no concede acceso al panel de un negocio.

## Google y despliegue

Para probar Google en otra PC, guardar el ID y secreto OAuth en un archivo local `.env` siguiendo los nombres de `.env.example`. Habilitar `[auth.external.google]` en `supabase/config.toml` para esa PC y reiniciar Supabase. Para mapas, configurar la clave de navegador y `VITE_GOOGLE_MAPS_ENABLED=true` en `.env.local`.

El código incluye el botón y retorno de OAuth con PKCE. `VITE_AUTH_GOOGLE_ENABLED=true` muestra el acceso con Google cuando el proveedor está configurado en el mismo proyecto Supabase. El secreto de Google permanece en Supabase, nunca en el frontend.

La aplicación retorna a `ORIGEN/#/ingresar`. El origen del sitio debe estar permitido en la configuración de autenticación de Supabase. La confirmación real del recorrido con Google sigue pendiente.

Para usar la nube desde esta PC, crear `.env.cloud.local` con la URL y clave publicable del proyecto y ejecutar `npm run dev -- --mode cloud`. El modo cloud también hereda valores de `.env.local`; verificar explícitamente las opciones de Google y Maps que se quieran usar.

El proyecto Vercel se llama `2026-tsds-pp-3-empreges-dugarte`. Usar Vite, `npm run build`, salida `dist` y las variables públicas de Supabase. Para Maps agregar VITE_GOOGLE_MAPS_ENABLED=true, VITE_GOOGLE_MAPS_API_KEY y un VITE_GOOGLE_MAPS_MAP_ID propio. Autorizar Maps JavaScript API y Places API (New) en Google Cloud. Volver a desplegar al cambiar variables. Antes de dar por aceptado el acceso con Google, verificar el dominio de producción, su dirección de retorno en Supabase y el regreso a la tienda con el carrito.

## Comprobaciones

```sh
npm run lint
npm test
npm run build
npx supabase test db --local
```

Las pruebas de frontend no sustituyen las verificaciones de permisos y persistencia contra la base real. Los scripts `scripts/verificar-*-local.mjs` documentan recorridos de integración local; revisar sus requisitos antes de ejecutarlos.

- [Pruebas E2E y aceptación manual del sprint 6](docs/pruebas/2026-11-12-sprint-6-e2e.md)
- [Administración de cuentas](docs/pruebas/2026-10-30-administracion-cuentas.md)
- [Cierre técnico del sprint 5](docs/pruebas/2026-10-30-cierre-tecnico-sprint-5.md)

Playwright prueba los informes de EmpreGest contra Supabase local. La guía del sprint 6 incluye comandos, resultados y los recorridos manuales pendientes. El sprint actual y los criterios de aceptación se siguen en Jira; código publicado no equivale a historia aceptada.


## Documentación vigente

- [Guía del código y flujos](docs/GUIA-CODIGO.md).
- [Demo local con cuentas, productos y fotografías](docs/pruebas/demo-local.md).
- [Pruebas manuales y automatizadas](docs/pruebas/PRUEBAS-MANUALES.md).

Los informes fechados en docs/pruebas describen la ejecución de esa fecha. Sus cuentas, identificadores y resultados pueden diferir de la instalación actual. Los documentos iniciales reemplazados pueden recuperarse desde el historial de Git.
