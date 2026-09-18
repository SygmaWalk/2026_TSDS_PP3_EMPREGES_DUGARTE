# ND2026-9: visibilidad de productos

## Objetivo

Permitir que el emprendedor muestre u oculte cada producto y comprobar que el
catálogo público no reciba productos ocultos.

## Comportamiento implementado

- Los productos nuevos comienzan ocultos.
- La acción `Mostrar` cambia el estado a visible.
- La acción `Ocultar` retira el producto de la vista pública.
- Cambiar la visibilidad conserva los demás datos y actualiza la fecha de
  modificación.
- El selector del catálogo público filtra los productos por `visible === true`.

La persistencia de este cambio mantiene la misma dependencia de usuarios,
membresías y políticas RLS documentada en ND2026-8.
