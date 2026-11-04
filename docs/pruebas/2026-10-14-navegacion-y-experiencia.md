# Reorganización de navegación y experiencia del emprendedor
Fecha: 14 de octubre de 2026. Entorno: local.

## Cambios realizados
- Inicio operativo en Pedidos para cuentas de emprendimiento con ese permiso. Para otros permisos, se abre la primera sección autorizada.
- Selector de negocio y recuerdo del último negocio por usuario; se verifica la autorización antes de reutilizarlo.
- Menú lateral fijo en escritorio y desplegable en celular. Pedidos, Productos, Inventario, Clientes, Tienda y Entregas se muestran según permisos.
- Rutas por negocio y sección, con enlaces a detalles de pedidos, clientes e inventario. Se utiliza el historial del navegador: Atrás, Adelante y recarga. Los enlaces públicos existentes siguen funcionando.
- Productos prioriza listado y búsqueda; el formulario se abre al crear o editar. Se retiraron del recorrido del emprendedor el carrito de demostración, la vista previa duplicada y sus explicaciones.
- El carrito real permanece en la tienda pública. El módulo Workspace histórico no se usa en el panel operativo; sus pruebas unitarias de lógica se conservaron.
- Pedidos ofrece En curso, Historial y Todos. En curso incluye pedidos pendientes de días anteriores y Listo para retirar. Los filtros y la página se conservan por usuario y negocio en la sesión del navegador. Filtros avanzados, historial de estados y consumo de stock se despliegan cuando se necesitan.
- Los avisos y la activación de sonido permanecen montados al navegar entre secciones del mismo negocio. La activación de sonido sigue dependiendo del navegador; no se implementaron notificaciones con la aplicación cerrada.
- Se advierte sobre cambios sin guardar en productos, identidad, entregas y edición de clientes. Cancelar una salida por Atrás conserva el formulario y restaura la entrada del historial.
- Tailwind integrado mediante el plugin oficial de Vite, con clases prefijadas y sin reiniciar globalmente los estilos existentes. Se utiliza en la estructura compartida; la migración del CSS anterior es gradual.

## Validaciones
- Suite completa: 179 pruebas aprobadas en 31 archivos.
- Revalidación focalizada de permisos, operación de pedidos y productos después de ajustar el historial: 16 pruebas aprobadas.
- Navegador con Supabase local: 23 comprobaciones aprobadas. Incluye inicio, navegación, recarga, alerta de nuevo pedido desde Productos, conservación de activación del sonido, cambios sin guardar, detalles, filtros, cambio de negocio, recuerdo del último negocio, alta de productos y denegación de acceso ajeno.
- Identidad visual: 45 comprobaciones aprobadas.
- Distribución del catálogo: 40 comprobaciones aprobadas.
- Regresión de compra pública aprobada: incluye persistencia, precios, stock y recuperación sin duplicación.
- Capturas revisadas: test-results/navegacion-escritorio.png, navegacion-movil.png y productos-limpio-movil.png.
- Se corrigió una dependencia transitiva source-map-js reportada por npm; la auditoría posterior informó cero vulnerabilidades.
- La compilación conserva la advertencia preexistente de un archivo JavaScript principal mayor a 500 kB.

## Recorrido manual sugerido
1. Ingresar como emprendedor y comprobar que se abre Pedidos.
2. Entrar en Productos e Inventario; usar Atrás, Adelante y recargar.
3. Abrir un pedido, recargar su detalle y volver al listado.
4. Crear o editar un producto y comprobar la advertencia al salir sin guardar.
5. Activar sonido y recibir un pedido desde otra ventana mientras se permanece en Productos.
6. Probar el menú en celular.
7. Si la cuenta tiene varios negocios, cambiar de negocio y comprobar el contexto.

No se modificaron estados, descripciones ni comentarios en Jira. No se alteró el esquema de la base de datos ni se desplegó a la nube. Las pruebas de integración crearon y eliminaron únicamente sus propios datos de prueba.
