# Catálogo público, imágenes y carrito invitado — 01/10/2026

> Actualización posterior del 01/10/2026: la confirmación ya está implementada localmente. Consultar [el informe de pedidos](2026-10-01-confirmacion-pedidos.md). Las menciones a confirmación pendiente de este informe describen el estado de la entrega anterior.

## Alcance y entorno

Implementado y verificado en el repositorio local, rama `ND2026-3-integrar-persistencia-productos`, sobre HEAD `dc14e17` con cambios sin commit. Vite: http://127.0.0.1:5173; Supabase local: http://127.0.0.1:54321. No se desplegó a la nube ni se cambiaron estados en Jira.

- Cada emprendimiento activo tiene una tienda en `#/tienda/<slug>`, accesible sin iniciar sesión desde «Abrir tienda pública».
- El visitante solo consulta productos visibles del negocio. La tienda usa una conexión anónima independiente incluso si hay una sesión interna abierta.
- El formulario permite subir, reemplazar y quitar imágenes JPG, PNG o WebP, hasta 5 MiB (5.242.880 bytes). El archivo se guarda junto con el producto.
- El almacenamiento es privado. Las políticas permiten nuevas descargas públicas solo de imágenes asociadas a productos visibles de negocios activos; los miembros autorizados también consultan sus imágenes internas.
- El carrito invitado persiste por navegador y negocio. Al recargar, volver a la ventana o actualizar el catálogo se recuperan precios actuales y se retiran productos que ya no estén disponibles. Solo se guardan identificadores y cantidades.
- La confirmación de pedidos sigue pendiente. El subtotal no incluye envío.

## Resultado de las verificaciones automatizadas

| Verificación | Resultado | Alcance |
|---|---|---|
| Vitest | 59 pruebas aprobadas, 9 archivos | Incluye 5 casos de tienda pública: recarga/precio vigente, separación por tienda, productos retirados, error/reintento y tienda no disponible. |
| PostgreSQL / pgTAP | 78 comprobaciones aprobadas | Restricciones de catálogo, roles, permisos, revocación y aislamiento. Las imágenes se comprueban adicionalmente mediante la API real. |
| API local con Auth y Storage | Aprobada | Subida real, lectura pública/interna, acceso ajeno y lector, MIME/tamaño, reemplazo, limpieza, alta fallida, referencia ajena, productos ocultos y negocio inactivo. |
| Navegador Chromium | Aprobada | Validación y guardado de imagen, tienda sin sesión, descarga de imagen, carrito con tres unidades después de recargar, eliminación y tienda inexistente. |
| Vista de escritorio y móvil | Aprobada en los tamaños probados | 1280 × 900 y 390 × 844; capturas revisadas y comprobación de ausencia de desborde horizontal. |
| Lint y compilación | Aprobados | Verificaciones del frontend. |
| Migraciones | Reconstrucción completada en base temporal | La migración incluye el bucket y las políticas. El diff conserva únicamente diferencias de formato preexistentes en dos funciones públicas; no hay diferencias en los objetos nuevos. |

Estos resultados corresponden a los escenarios ejecutados; no garantizan ausencia de defectos. No equivalen a pruebas manuales realizadas por José ni actualizan el documento de Drive.

Capturas automatizadas locales en `test-results/`: `gestion-imagenes`, `tienda-publica` y `carrito-invitado`, cada una con sufijo `-escritorio.png` y `-movil.png`. Son evidencia de la ejecución automática, no del trabajo manual.

## Cómo empezar la revisión manual

1. Mantener Docker, Supabase local y Vite abiertos según [PRUEBAS-MANUALES](PRUEBAS-MANUALES.md).
2. Abrir la tienda de demostración: http://127.0.0.1:5173/#/tienda/tienda-0-f1633b5c-30be-4a88-bcf0-904e57067fd3.
3. Para editar los productos, consultar el archivo local `.qa-tienda.local`: contiene las cuentas ficticias `editor`, `lector` y `ajeno`, con correo y contraseña. Entrar por `#/ingresar` con el editor y abrir «Tienda de prueba».
4. Usar una imagen propia de prueba. La imagen inicial es un recurso gráfico ficticio, no la fotografía de un producto real.
5. Anotar resultado observado, fecha y evidencia para cada caso. Evitar capturar contraseñas.

Las cuentas y el enlace solo sirven mientras se conserven estos datos locales. El archivo de credenciales y las capturas están excluidos de Git.

## Casos manuales pendientes

Usamos el prefijo MT para distinguir estos casos de los M01–M16 ya documentados; no reemplaza sus identificadores ni presupone que se hayan ejecutado.

| Caso | Pasos | Resultado esperado | Estado | Evidencia |
|---|---|---|---|---|
| MT01 · Tienda pública | Abrir el enlace en ventana privada, sin iniciar sesión. | Nombre del negocio, dos productos visibles y ninguna herramienta de gestión; el producto oculto no aparece. | No ejecutado | Pendiente |
| MT02 · Imagen nueva | Con editor, crear un producto con JPG/PNG/WebP válido y publicarlo. Abrir la tienda y actualizar. | Producto guardado y fotografía visible en panel y tienda. | No ejecutado | Pendiente |
| MT03 · Reemplazar/quitar | Editar el producto, cambiar la fotografía, guardar y revisar la tienda; luego quitarla y guardar. | Se muestra la nueva fotografía; al quitarla aparece «Sin imagen». | No ejecutado | Pendiente |
| MT04 · Archivo inválido | Elegir un archivo de otro tipo y luego una imagen mayor de 5 MiB. | Mensaje claro; no se guarda ese archivo. Corregir la selección permite continuar. | No ejecutado | Pendiente |
| MT05 · Lectura | Ingresar con el lector y abrir «Tienda de prueba». | Consulta productos e imágenes; no dispone de acciones de creación, edición ni publicación. | No ejecutado | Pendiente |
| MT06 · Carrito y recarga | Sin sesión, agregar «Producto con imagen», fijar cantidad 3 y recargar. Abrir Carrito. | Conserva 3 unidades; a precio 1.500,50 el subtotal es 4.501,50. | No ejecutado | Captura antes y después o grabación |
| MT07 · Quitar del carrito | Quitar el último producto y recargar. | Carrito vacío; el producto no reaparece. | No ejecutado | Pendiente |
| MT08 · Precio actualizado | Agregar un producto como invitado. En otra ventana, editar su precio con editor. Volver a la tienda y actualizar catálogo. | Conserva cantidad y usa el nuevo precio para el subtotal. | No ejecutado | Pendiente |
| MT09 · Producto oculto | Agregar un producto como invitado. Ocultarlo desde el panel y actualizar catálogo público. | Desaparece del catálogo y del carrito recuperado. | No ejecutado | Pendiente |
| MT10 · Móvil y enlace inválido | Revisar tienda/carrito a 390 px; abrir un slug inexistente. | Sin desplazamiento horizontal; enlace inválido informa tienda no disponible. | No ejecutado | Pendiente |

En cada prueba conservar también rama/commit y aclarar «cambios locales sin commit» si corresponde. Al terminar, restaurar los productos de demostración si se usarán en otra prueba.

## Repetir las comprobaciones automáticas

Desde el repositorio:

```powershell
npm test
npm run lint
npm run build
npx supabase test db --local
node scripts/verificar-tienda-local.mjs
node scripts/verificar-tienda-ui-local.mjs
```

La prueba de API crea y elimina sus propios datos temporales. La de navegador necesita Vite en el puerto 5173 y la tienda de prueba preparada; modifica únicamente la imagen del producto de esa tienda. Si la tienda preparada ya no existe, crearla con `node scripts/verificar-tienda-local.mjs --preparar-ui` y usar el nuevo enlace del archivo. La preparación se niega a sobrescribir una configuración existente.

`node scripts/verificar-tienda-local.mjs --limpiar-ui` elimina únicamente las cuentas, negocios, productos e imágenes de la demostración registrada en `.qa-tienda.local`. No usarlo antes de finalizar la revisión manual.

## Límites y siguiente trabajo

- No hay confirmación de pedido, pago ni cálculo de envío en esta entrega.
- Guardar el producto y limpiar imágenes son operaciones separadas. Una interrupción puede dejar un archivo privado sin referencia; la limpieza es de mejor esfuerzo y no se promete una transacción conjunta.
- Ocultar un producto bloquea nuevas descargas anónimas; no puede retirar una imagen que un navegador ya descargó.
- El carrito no se sincroniza entre dispositivos. Borrar datos del sitio lo elimina. `localhost` y `127.0.0.1` tienen almacenamiento distinto.
- Falta ejecutar y documentar la aceptación manual, revisar los criterios completos de las historias y probar el despliegue compartido. No se cerraron historias de Jira.
- El siguiente bloque funcional propuesto es confirmar el pedido (ND2026-6), una vez revisado este recorrido.
