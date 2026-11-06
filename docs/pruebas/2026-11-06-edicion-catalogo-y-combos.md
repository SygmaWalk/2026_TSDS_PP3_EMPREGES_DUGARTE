# Catálogo: edición y presentación — 06/11/2026

## Cambios

- Acceso destacado en Productos a Configurar adicionales y promociones.
- Adicionales y promociones separados, con precio/descuento, estado, productos asociados y vigencia visible.
- Formularios de reglas con campos y casillas alineados.
- Productos, reglas y catálogo admiten textos largos sin ensanchar la página. Los campos no se estiran verticalmente al compartir una fila con una imagen o descripción.
- El error 22023 de composición ahora muestra la explicación del servidor, incluido el bloqueo de conversión a combo cuando quedan existencias propias. La regla de inventario se conserva.
- Ayuda para distinguir componentes obligatorios de adicionales opcionales; se excluyen productos archivados y componentes ya seleccionados de las otras filas.

## Prueba local

Con administrador, en Cocina Demo: crear temporalmente combo de pizza y gaseosa, guardar, volver a editar y cambiar cantidad de pizza a dos. Confirmada persistencia de composición en base. Intentar convertir pizza existente con stock a combo: mensaje específico visible y producto original conservado. Abrir edición de Queso extra y Promo de prueba. No se cambiaron sus valores. Combo temporal eliminado al finalizar la verificación.

Textos largos sin espacios inyectados solo en el navegador para verificar ancho a 1280 y 390 px: sin desbordamiento horizontal. Capturas en test-results/catalogo-ajustado-1280.png y catalogo-ajustado-390.png (no versionadas). Los textos reales de la base no se alteraron.

Pruebas de formulario/composición y regresión del mensaje del repositorio, lint y build. La recomendación personal que estaba en curso es un cambio separado y no se considera cerrada por esta verificación.

## Recorrido manual

Productos → Configurar adicionales y promociones → Adicionales o Promociones → Editar.
Nuevo producto → nombre y precio → Es un combo → Agregar componente → seleccionar producto y cantidad → repetir si corresponde → Crear producto. El combo se crea oculto; publicarlo con Mostrar.
Un componente debe existir previamente como producto de la misma tienda. Los extras de precio no aparecen como componentes de inventario. Para conservar el producto individual con stock, crear un combo nuevo en vez de convertirlo.
