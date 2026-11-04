# Verificación de identidad visual de la tienda — ND2026-47
Fecha: 12 de octubre de 2026. Entorno: Supabase local y aplicación React/Vite.

## Alcance implementado
Editor accesible desde el panel del emprendimiento: Identidad de la tienda → Personalizar tienda. Permite cargar logo y portada JPG, PNG o WebP de hasta 5 MB, quitar imágenes, seleccionar colores, guardar y recuperar borradores, previsualizar en computadora o celular y publicar. La tienda pública utiliza únicamente la versión publicada. La vista previa permite revisar la presentación, no efectuar compras.

Los colores admitidos requieren un principal oscuro y fondo claro con contraste de al menos 4,5:1 para los textos validados. Los archivos se validan por formato, tamaño y decodificación en el navegador. La configuración predeterminada sigue disponible para tiendas sin publicación.

## Persistencia y acceso
Permiso tienda.configurar; habilitado en la cuenta de prueba emprendedor@example.test para Tienda de prueba. Borradores y archivos no publicados restringidos al acceso interno autorizado. Las imágenes publicadas son visibles cuando el emprendimiento está activo. Guardado y publicación usan control de versión para impedir sobrescribir cambios concurrentes. Las escrituras directas a la tabla están bloqueadas.

Migración: supabase/migrations/20261012225024_identidad_visual_tienda.sql. Incluye tabla, funciones, permisos, políticas y bucket privado. Se verificó su reproducción en base temporal sin reiniciar ni borrar la base de trabajo. La comparación final solo conserva las diferencias de formato preexistentes en preparar_registro_catalogo y rls_auto_enable.

## Resultados
- Lint: aprobado.
- Pruebas unitarias: 171 aprobadas en 29 archivos.
- Pruebas SQL existentes: 95 aprobadas.
- Integración de identidad: 45 comprobaciones aprobadas, incluyendo aislamiento entre negocios, restricciones de acceso, borradores, contraste, versiones, publicación, imágenes y navegador.
- Regresión de tienda pública: aprobado el flujo de compra, persistencia, recuperación sin duplicar y actualización de stock.
- Compilación: aprobada. Permanece advertencia de tamaño del archivo JavaScript principal, superior a 500 kB.
- Asesor de seguridad local: sin incidencias.
- Capturas revisadas: test-results/apariencia-escritorio.png y test-results/apariencia-movil.png.

## Comprobación manual pendiente del usuario
1. Entrar al panel de Tienda de prueba y abrir Personalizar tienda.
2. Seleccionar logo, portada y colores; previsualizar en computadora y celular.
3. Guardar borrador y verificar que la tienda pública conserva la versión anterior.
4. Volver al editor y comprobar que el borrador permanece.
5. Publicar y abrir o actualizar la tienda pública para comprobar la nueva identidad.
6. Adjuntar las evidencias de aceptación y decidir el cierre de la historia en Jira.

## Límites y continuidad
Las imágenes reemplazadas o desvinculadas permanecen privadas en almacenamiento; no se implementó limpieza automática de archivos huérfanos. La vista previa de computadora puede desplazarse horizontalmente en pantallas pequeñas. Presentación y orden del catálogo corresponden al siguiente bloque ND2026-48. Esta verificación no supone aceptación manual ni cierre en Jira; no se cambiaron estados, descripciones o comentarios. No se desplegaron cambios en la nube.
