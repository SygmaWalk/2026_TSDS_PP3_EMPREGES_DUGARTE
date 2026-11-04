# Verificación de presentación y orden del catálogo — ND2026-48
Fecha: 13 de octubre de 2026. Entorno: aplicación React/Vite y Supabase local.

## Alcance
Se incorporó Presentación del catálogo al editor accesible desde Panel del emprendimiento → Personalizar tienda. Permite elegir cuadrícula o lista y ordenar los productos mediante botones Subir/Bajar accesibles con teclado. Los productos ocultos se identifican en el editor y mantienen su posición; no aparecen en la tienda pública. Los productos nuevos se agregan al final por orden de alta.

Se reutilizan Guardar borrador, Previsualizar y Publicar. El guardado de identidad y distribución se realiza en una sola transacción con control de versión. La vista previa y la tienda pública reutilizan el mismo componente de catálogo. Ambas presentaciones conservan los precios, imágenes disponibles, restricciones de stock y botones de compra.

## Persistencia y permisos
Funciones catalogo_configurable y guardar_configuracion_tienda, protegidas por tienda.configurar y pertenencia al emprendimiento. La consulta interna devuelve únicamente identificador, nombre y visibilidad de los productos del negocio autorizado. La distribución acepta solo lista/cuadricula e identificadores únicos de productos existentes del mismo negocio. Se limita a 5.000 identificadores y 100 KB de configuración.

Migración: supabase/migrations/20261013043755_distribucion_catalogo.sql. Generada desde la base local y comprobada mediante reconstrucción en base temporal. El historial local coincide con los archivos. La comparación final conserva únicamente las diferencias de formato preexistentes de preparar_registro_catalogo y rls_auto_enable. No se reinició la base de trabajo ni se desplegaron cambios en la nube.

## Resultados de verificación
- Lint: aprobado.
- Pruebas unitarias: 177 aprobadas en 30 archivos.
- Integración de distribución: 40 comprobaciones aprobadas. Incluye permisos, aislamiento, entradas inválidas, conflicto de versión, persistencia, ocultar/mostrar, nuevos productos, conservación de identidad, teclado, error de conexión, publicación, eliminación de productos y compra desde lista en celular.
- Regresión de identidad visual: 45 comprobaciones aprobadas.
- Regresión de tienda y confirmación de pedido: aprobada; incluye recarga, respuesta perdida sin duplicación, actualización de precios y descuento de stock.
- Compilación: aprobada. Continúa la advertencia de tamaño del archivo JavaScript principal superior a 500 kB.
- Asesor de seguridad local: sin incidencias.
- Capturas de escritorio y celular revisadas: test-results/catalogo-lista-*.png y test-results/catalogo-orden-*.png.

El primer intento de la prueba de navegador esperaba el catálogo después de una compra, pero la aplicación conservaba correctamente el comprobante. Se corrigió la prueba para usar Volver a la tienda y se ejecutó nuevamente con resultado aprobado.

## Aceptación manual pendiente
1. Abrir Personalizar tienda y elegir Lista.
2. Cambiar el orden con Subir/Bajar; comprobar también con Tab y Enter.
3. Previsualizar en computadora y celular.
4. Guardar borrador y comprobar que la tienda pública conserva la versión anterior.
5. Recargar el borrador y verificar la presentación y el orden.
6. Publicar, actualizar la tienda y comprobar el orden, las imágenes y los precios.
7. Ocultar un producto y comprobar que los demás conservan su orden; crear otro y verificar que aparece al final.
8. Completar una compra en ambas presentaciones y registrar evidencia.

Las comprobaciones automáticas no sustituyen la aceptación manual. No se modificaron estados, descripciones ni comentarios en Jira.

## Límites
La configuración no incluye categorías ni arrastre de secciones. Los cambios publicados se reflejan al abrir o actualizar el catálogo; no se agregaron notificaciones en tiempo real para la apariencia. Si un producto se elimina mientras se edita, el guardado informa el conflicto; Recargar borrador elimina referencias obsoletas antes de volver a guardar.
