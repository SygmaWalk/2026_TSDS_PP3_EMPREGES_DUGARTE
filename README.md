# EmpreGest

EmpreGest es una aplicación web orientada a emprendimientos gastronómicos que busca centralizar la gestión de productos, catálogos, pedidos y clientes.

El MVP funcionará inicialmente con un emprendimiento, pero el sistema se diseñará para admitir múltiples emprendimientos sin modificar su estructura fundamental.

## Sprint 1

El primer sprint contempla el flujo básico de catálogo y pedidos:

- Gestionar productos.
- Consultar el catálogo.
- Armar un carrito.
- Confirmar un pedido básico.

## Tecnologías

- React
- Vite
- JavaScript
- Supabase
- PostgreSQL
- Docker
- Git y GitHub

## Ejecución local

Instalar las dependencias:

```bash
npm ci
npm run dev
```

Usar Node.js 24. Esta rama prepara el carrito en modo demostración: productos y
carrito se conservan al navegar dentro de la aplicación, pero se pierden al recargar.
La integración con Supabase y la confirmación de pedidos siguen pendientes.

## Pruebas

```bash
npm test
npm run test:ui
```

- [Cómo ver y comprender los resultados](docs/pruebas/COMENZAR.md)
- [Casos de prueba y pendientes de ND2026-5](docs/pruebas/ND2026-5-carrito.md)

Las pruebas JavaScript se ejecutan con Vitest; las de interacción usan React
Testing Library. Las pruebas SQL existentes permanecen en `supabase/tests/`.
