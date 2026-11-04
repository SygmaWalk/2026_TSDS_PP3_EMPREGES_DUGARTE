# EmpreGest

Aplicación para emprendimientos gastronómicos: catálogo público, carrito persistente, compra autenticada, pedidos, entregas, cobros, clientes, inventario y permisos por cuenta y negocio.

## Continuar desde otra PC

Requisitos: Git, Node.js 24 y Docker Desktop si se utiliza Supabase local.

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

La URL y la clave publicable del entorno local se obtienen con `supabase status`. Las 23 migraciones del repositorio representan el esquema esperado. No ejecutar un reinicio de la base para actualizar una instalación con datos que se quieran conservar.

El registro público crea cuentas cliente. Las cuentas internas, sus permisos y los administradores requieren aprovisionamiento autorizado; registrarse no concede acceso al panel de un negocio.

## Google y despliegue

El código incluye el botón y retorno de OAuth con PKCE. `VITE_AUTH_GOOGLE_ENABLED=true` muestra el acceso con Google cuando el proveedor está configurado en el mismo proyecto Supabase. El secreto de Google permanece en Supabase, nunca en el frontend.

La aplicación retorna a `ORIGEN/#/ingresar`. El origen del sitio debe estar permitido en la configuración de autenticación de Supabase. La confirmación real del recorrido con Google sigue pendiente.

Estado al 03/11/2026: Supabase remoto tenía 3 de las 23 migraciones; su actualización debe verificarse antes de apuntar el frontend a la nube. No existe todavía un proyecto Vercel. Configuración prevista: Vite, compilación `npm run build`, salida `dist` y las variables públicas anteriores. El sitio utiliza rutas con fragmento (`#/...`).

## Comprobaciones

```sh
npm run lint
npm test
npm run build
npx supabase test db --local
```

Las pruebas de frontend no sustituyen las verificaciones de permisos y persistencia contra la base real. Los scripts `scripts/verificar-*-local.mjs` documentan recorridos de integración local; revisar sus requisitos antes de ejecutarlos.

- [Resultados de pruebas y guías históricas](docs/pruebas/COMENZAR.md)
- [Administración de cuentas](docs/pruebas/2026-10-30-administracion-cuentas.md)
- [Cierre técnico del sprint 5](docs/pruebas/2026-10-30-cierre-tecnico-sprint-5.md)

Los ejemplos de Playwright en `tests/` consultan el sitio del proveedor y no representan cobertura de EmpreGest. El sprint actual y los criterios de aceptación se siguen en Jira; código publicado no equivale a historia aceptada.
