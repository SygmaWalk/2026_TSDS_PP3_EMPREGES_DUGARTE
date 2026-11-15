# Guía del código de EmpreGest

Actualizada el 14/11/2026. Esta guía explica las responsabilidades de cada segmento del proyecto y los puntos de entrada para modificarlo.

## Arranque y navegación

| Archivo | Responsabilidad |
| --- | --- |
| src/main.jsx | Monta React y carga los estilos iniciales. |
| src/App.jsx | Recupera la sesión, procesa el retorno OAuth y selecciona portada, tienda, ingreso o panel. Desmonta el área privada cuando cambia la identidad. |
| src/navigation.js | Gestiona rutas con hash, historial del navegador y confirmación de salida con cambios pendientes. Define secciones y permisos asociados. |
| src/lib/supabase.js | Construye un cliente autenticado y otro público para impedir que el catálogo herede permisos administrativos. |
| src/ThemeToggle.jsx y src/theme.css | Selección de tema y colores de superficies, texto, controles y estados. |
| src/Workspace.jsx | Espacio de trabajo anterior, conservado con sus pruebas. El flujo de producción entra por App y los módulos features. |

## Acceso y administración — src/features/acceso

Acceso.jsx contiene ingreso y registro con correo, contraseña y Google. oauth.js inicia PKCE, interpreta errores y recupera el destino de compra.
accesoRepository.js consulta el rol, la habilitación y las asociaciones autorizadas.
Emprendimientos.jsx distribuye la experiencia según rol y ruta.
PanelNegocio.jsx construye el menú del negocio y los avisos de pedidos.
ResumenNegocio.jsx consulta pendientes, pedidos en preparación y ventas de siete días.
AdministracionCuentas.jsx y administracionRepository.js consultan cuentas y guardan asociaciones y permisos mediante el servidor.
AdministracionNegocios.jsx crea o edita tiendas.
InterfazAcceso.jsx reúne la marca y la insignia del rol.

Los botones visibles dependen de permisos; las políticas RLS y funciones de base vuelven a comprobar la autorización.

## Catálogo público — src/features/catalogo

Inicio.jsx busca y pagina tiendas activas.
PortadaLocal.jsx consulta la identidad publicada de cada tienda.
ImagenIdentidad.jsx descarga imágenes del almacenamiento y libera las URL temporales al desmontarse.
PlantillaTienda.jsx y plantillaTienda.js presentan portada, logo, navegación y colores de la tienda.
catalogoRepository.js reúne identidad, productos, disponibilidad, adicionales y promociones.
TiendaPublica.jsx coordina catálogo, carrito y confirmación.
PedidoHabitual.jsx consulta y agrega sugerencias; pedidoHabitual.js aplica sus reglas en el cliente.

## Productos — src/features/productos

ProductosPanel.jsx coordina listado, formulario y reglas comerciales.
ProductoForm.jsx edita los campos y componentes de combos; ProductoList.jsx muestra acciones disponibles.
producto.js normaliza y valida datos.
productosRepository.js encapsula lecturas y escrituras autorizadas.
ImagenProducto.jsx e imagenes.js cargan, validan y gestionan imágenes.
ReglasCatalogo.jsx configura adicionales y promociones.
CatalogoPreview.jsx presenta productos en la vista previa.

Los precios y cantidades se vuelven a verificar al confirmar una compra. Cambiar el catálogo conserva los nombres e importes históricos de los pedidos.

## Carrito — src/features/carrito

carrito.js transforma las líneas, cantidades y precios y calcula importes en centavos.
carritoStorage.js conserva el carrito por cuenta y negocio en este navegador.
Carrito.jsx presenta adicionales, cantidades, subtotal y continuación del flujo.
La prop sesionIniciada adapta el mensaje de ayuda. La autorización para comprar se comprueba al confirmar.

## Pedidos — src/features/pedidos

| Segmento | Archivos principales y función |
| --- | --- |
| Compra | ConfirmarPedido.jsx revisa contacto, pago previsto, entrega y confirmación. pedidosRepository.js solicita la operación al servidor y maneja su resultado. |
| Panel | PanelPedidos.jsx lista, filtra y abre pedidos; panelPedidosRepository.js consulta y solicita las operaciones. |
| Edición | EditarPedido.jsx permite revisar cambios antes de guardar y consultar modificaciones. |
| Estados | estadosPedido.js define el recorrido operativo; FinalizarEntrega.jsx coordina entrega y cobro. |
| Cobro | PagoPedido.jsx, DesgloseCobro.jsx y desglosePago.js gestionan efectivo, transferencia y cobro dividido. |
| Stock devuelto | DevolucionStock.jsx y devolucionStock.js validan cantidades a reintegrar al cancelar. |
| Informes | VentasPeriodo.jsx consulta fechas y presenta ventas cobradas, unidades y zonas. |
| Avisos | sonidoPedidos.js prepara el sonido; el panel administra la suscripción y los avisos. |

La clave de confirmación evita duplicar pedidos al reintentar. El servidor recalcula el total y verifica versiones en operaciones que pueden competir. El medio de pago previsto se registra separado del cobro real.

## Entregas — src/features/entregas

ConfigEntregas.jsx mantiene origen y cobertura en estado común al alternar vistas.
entregasRepository.js valida la configuración y solicita tarifas.
EditorZonas.jsx permite dibujar y editar rectángulos; zonas.js comprueba límites.
EntregaPedido.jsx integra retiro o envío en la compra.
ResumenEntrega.jsx, UbicacionEntrega.jsx y rutaEntrega.js muestran el destino conservado.
MapaPuntoLazy.jsx elige proveedor; MapaPunto.jsx usa Leaflet y MapaGoogle.jsx usa Google.
googleMaps.js comparte la carga del SDK y comunica fallos.

La cotización válida procede del servidor. El pedido conserva dirección, zona y precio del envío al comprar.

## Cuenta del cliente — src/features/cliente

PerfilCliente.jsx y perfil.js mantienen datos de contacto.
DireccionesCliente.jsx abre un diálogo nativo para editar destinos; direccionesRepository.js los guarda para su propietario.
SelectorDireccion.jsx permite elegirlos durante la compra.
MisPedidos.jsx consulta el historial personal paginado.
MisTarjetones.jsx muestra sellos y beneficios.
ProgramaSellos.jsx configura el programa y registra canjes desde el negocio.
La identidad autenticada determina qué datos personales puede consultar cada cuenta.

## Clientes del negocio — src/features/clientes

PanelClientes.jsx alterna directorio y frecuencia y abre fichas.
HistorialCliente.jsx muestra las compras asociadas a una ficha comercial.
FrecuenciaClientes.jsx calcula consultas por período y mínimo de pedidos.
clientesRepository.js reúne estas operaciones.
La ficha comercial pertenece a un negocio; el historial personal pertenece a la cuenta autenticada.

## Inventario — src/features/stock

PanelStock.jsx presenta existencias, filtros, movimientos y formularios.
stockRepository.js consulta cantidades y registra operaciones.
UmbralStock.jsx edita mínimos; EstadoStock.jsx muestra las alertas.
La disponibilidad de un combo depende de sus componentes. Los pedidos generan consumos y las cancelaciones registran las devoluciones elegidas.

## Apariencia — src/features/apariencia

EditorApariencia.jsx mantiene borrador, archivos nuevos, vista previa y publicación.
aparienciaRepository.js persiste identidad y sube archivos.
apariencia.js valida colores y prepara datos para la plantilla.
DistribucionCatalogo.jsx y distribucion.js definen presentación y orden.
VistaPreviaTienda.jsx presenta el borrador en un iframe.
Guardar conserva un borrador; Publicar actualiza lo que consulta el catálogo público.

## Estilos

index.css establece estilos base; App.css contiene componentes compartidos.
theme.css define el modo oscuro.
acceso/panel.css organiza la navegación del negocio y administracion.css la gestión de cuentas.
acceso/gestion-visual.css contiene los ajustes de navegación, gráficos y espaciado recientes.
cliente/cuenta.css organiza el dashboard personal.
catalogo/experiencia.css y plantillaTienda.css presentan portada, tienda y compra.
apariencia/apariencia.css estiliza el editor.

Comprobar especificidad, orden de importación y ambos temas al cambiar una regla compartida. Las fotografías conservan sus colores.

## Base de datos — supabase

migrations contiene la evolución ordenada del esquema. Las migraciones incorporan catálogo, membresías, imágenes, pedidos, entregas, cobros, fichas comerciales, inventario, identidad visual, promociones, frecuencia, historial, informes y beneficios.

Las tablas public almacenan las entidades expuestas. Las funciones private centralizan comprobaciones y operaciones sensibles. RLS restringe filas según identidad, negocio y permiso. Storage contiene los archivos de productos y tiendas.

tests contiene pruebas SQL pgTAP. config.toml configura Docker local, puertos y autenticación. Las credenciales OAuth se leen del entorno.

## Preparadores y verificaciones — scripts y tests

preparar-demo-local.mjs crea cuentas ficticias y ejecuta demo-local.sql.
El SQL carga ambas tiendas dentro de una transacción y usa las operaciones de negocio para pedidos y cobros.
CUENTAS-DEMO.local conserva las contraseñas de esa instalación y está excluido de Git.
fotos-demo-local.mjs descarga imágenes ilustrativas de Pexels y las incorpora al almacenamiento local.
Los preparadores antiguos requieren sus archivos .qa-*.local; consultar sus precondiciones antes de ejecutarlos.
Los verificar-*-local.mjs ejercitan módulos concretos con Supabase y navegador; algunos requieren Vite en 5173.
tests/informes-sprint.spec.js verifica informes con cuentas y negocios temporales y los elimina al terminar.
Los archivos *.test.js y *.test.jsx cubren lógica y componentes con Vitest.

## Configuración del proyecto

package.json define dependencias y comandos; package-lock.json fija versiones instaladas.
vite.config.js configura desarrollo y build.
vitest.config.js y src/test/setup.js configuran pruebas de componentes.
playwright.config.js define tres navegadores y el servidor de informes en 5187.
eslint.config.js establece comprobaciones estáticas.
.env.example enumera los nombres requeridos. Cada PC conserva sus valores privados fuera de Git.
.github/workflows contiene las verificaciones de integración configuradas en el repositorio.

## Dónde comenzar un cambio

| Necesidad | Punto de entrada |
| --- | --- |
| Cambio visual general | Estilo del módulo, App.css y theme.css |
| Regla de precio o stock | Función SQL correspondiente y repositorio del módulo |
| Nuevo permiso | Migración y comprobaciones del servidor, accesoRepository y navigation |
| Cambio del flujo de compra | TiendaPublica, Carrito, ConfirmarPedido y pedidosRepository |
| Datos para presentar | Preparadores de demo y guía demo-local.md |
| Evidencia de aceptación | PRUEBAS-MANUALES.md y guía del sprint |

Leer primero el componente que muestra la acción, después su repositorio y finalmente la función SQL invocada. Los comentarios añadidos explican decisiones de sesión, vista previa, imágenes y edición. Las pruebas existentes muestran entradas válidas y errores previstos.
