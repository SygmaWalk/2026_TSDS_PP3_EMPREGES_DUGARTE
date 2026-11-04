# ND2026-8: alta y edición de productos

## Objetivo

Implementar la interfaz y la lógica de cliente necesarias para crear y editar
productos básicos, con validación de nombre y precio.

## Flujo implementado

1. El emprendedor completa nombre, descripción, precio y ruta de imagen.
2. El formulario normaliza espacios y acepta coma o punto decimal.
3. Se validan los campos obligatorios, el precio positivo, el límite de dos
   decimales y los nombres duplicados.
4. Un alta agrega el producto como oculto.
5. Una edición conserva identidad, emprendimiento, visibilidad y fecha de creación.

## Decisión temporal de integración

La pantalla funciona con estado local de React durante la sesión de demostración.
Todavía no escribe en Supabase porque las políticas RLS creadas en ND2026-7
bloquean correctamente las altas y ediciones de los roles `anon` y
`authenticated`.

Permitir escrituras anónimas o incluir una clave `service_role` en Vite expondría
el catálogo completo. La integración persistente se realizará cuando el modelo de
usuarios y membresías permita comprobar que la persona administra el
emprendimiento afectado.

## Verificación

```bash
npm test
npm run lint
npm run build
```

Las pruebas unitarias cubren normalización, precios, obligatoriedad, duplicados,
estado oculto inicial y conservación de campos protegidos durante la edición.
