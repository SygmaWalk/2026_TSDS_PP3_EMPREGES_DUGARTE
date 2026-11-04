# ND2026-46 — Plantilla estándar de tienda pública
Fecha: 12/10/2026. Entorno local.

## Implementación
PlantillaTienda separa el marco visual del estado del carrito y la confirmación. Incluye encabezado de plataforma, portada, identidad del negocio, logo o inicial, contenido y pie.
La ausencia de logo o portada utiliza alternativas dibujadas con CSS, sin peticiones a imágenes inexistentes. Una imagen que falla vuelve a la alternativa.
Los valores predeterminados y el contrato de presentación se centralizan en plantillaTienda.js. Una configuración de otro negocio se descarta.
En esta etapa la tienda usa exclusivamente los valores predeterminados. La persistencia de borrador/publicación, editor, imágenes almacenadas y colores configurables corresponde al siguiente paso ND2026-47; el orden y selector lista/cuadrícula a ND2026-48.
Se agrega acceso por teclado al contenido sin cambiar la ruta. Catálogo, carrito y comprobantes conservan sus operaciones.

## Comprobaciones
- Lint correcto.
- scripts/verificar-plantilla-tienda-local.mjs aprobado contra Supabase local y navegador.
- Verificado: escritorio y móvil sin desbordes; identidad sin imágenes rotas; productos ocultos/agotados; teclado; carrito vacío; contacto y pago; confirmación real; doble clic; recibo después de recargar; respuesta perdida sin duplicar; actualización de precios y descuento de existencias.
- Revisadas visualmente test-results/plantilla-tienda-escritorio.png y test-results/plantilla-tienda-movil.png.
- Pruebas de componentes cubren configuración de otro negocio, alternativa ante imagen fallida y salto accesible sin cambio de ruta.
- Datos temporales eliminados al finalizar. No se modificó el esquema de base de datos ni se publicó en la nube.

## Jira
Por solicitud del usuario se cambió únicamente el campo Sprint de ND2026-46, ND2026-47 y ND2026-48 a ND2026 Sprint 4 (id 40).
Se verificó por lectura que ND2026-49 a ND2026-60 heredaron el Sprint 4. Todas conservan Por hacer. No se editaron descripciones, comentarios ni estimaciones.
La aceptación manual y el cambio de estado quedan a cargo del usuario.

## Revisión manual
Abrir la tienda pública y recargar. Comprobar identidad, catálogo, carrito y confirmación en computadora y celular. La carga del logo y portada desde el panel estará disponible cuando se implemente ND2026-47.

Resultado final: 162 pruebas aprobadas en 28 archivos. Compilación correcta; permanece el aviso del paquete principal superior a 500 kB (585,98 kB sin comprimir).
