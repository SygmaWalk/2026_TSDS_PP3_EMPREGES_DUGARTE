# Prueba local integrada — Cocina Demo

## Entorno

Una sola tienda local: Cocina Demo, slug cocina-demo, id 294.
Catálogo: http://127.0.0.1:5197/#/tienda/cocina-demo
Panel: http://127.0.0.1:5197/#/panel/294/clientes
El servidor de desarrollo usa Supabase local. Si no está encendido, ejecutar npm run dev y usar el puerto que indique (habitualmente 5173).
Las cuentas y contraseñas existentes se conservan; consultar CUENTAS-PRUEBA.local. El emprendedor y lector de la antigua Tienda de prueba conservan sus permisos en Cocina Demo. Las asociaciones con los negocios eliminados desaparecieron; el administrador sigue teniendo acceso global.

## Catálogo y compra

1. Abrir el catálogo. Hay Pizza muzzarella ($1.000), Empanada de carne ($500) y Gaseosa ($800), con 50 unidades iniciales por producto.
2. Agregar una pizza y abrir el carrito. La promoción aplica 10 % al producto: $900.
3. Marcar Queso extra ($125): subtotal $1.025. Añadir Aceitunas ($75): subtotal $1.100.
4. Con dos unidades y ambos extras, subtotal $2.200. Los extras se aplican por unidad.
5. Continuar e ingresar con una cuenta Cliente local. Completar nombre, teléfono y forma de pago prevista; confirmar.
6. Ingresar como emprendedor o administrador: comprobar pedido, cantidades, extras e importe; recorrer los estados y registrar el pago.
7. El pedido nuevo debe aparecer en la ficha comercial correspondiente y afectar su frecuencia, salvo que se cancele.

La promoción de demostración vence 30 días después de preparar el escenario (06/11/2026). Puede editarse en Productos → Configurar adicionales y promociones.

## Clientes frecuentes (ND2026-43)

Entrar a Clientes → Clientes frecuentes. Dejar fechas vacías y mínimo 3:

| Cliente | Pedidos válidos | Importe | Frecuente |
| --- | ---: | ---: | --- |
| Ana Demo | 3 | $3.000 | Sí |
| Bruno Demo | 1 | $5.000 | No |
| Carla Demo | 0 | $0 | No |

Ana tiene además un pedido cancelado de $5.000: aparece en su historial pero no suma. Los pedidos son ejemplos históricos precargados, sin cobros registrados; el stock inicial disponible es para nuevas pruebas. El importe acumulado incluye envío, cuenta todos los estados salvo Cancelado y no representa recaudación.

- Ordenar por importe: Bruno aparece primero.
- Cambiar mínimo a 4: ninguno es frecuente.
- Seleccionar un período futuro: todos tienen cero pedidos y cero importe.
- Abrir Ver ficha e historial de Ana Demo: ver los tres pedidos válidos y el cancelado.
- Las fechas incluyen el día final completo, en horario argentino.
- El mínimo se configura por consulta; no es una regla de premios ni una configuración permanente del negocio.

Después de realizar nuevas compras, estos totales cambiarán: es el resultado esperado. El verificador scripts/verificar-frecuencia-demo-local.mjs requiere el escenario original, antes de agregar compras.

## Reinicio realizado y respaldo

Con autorización del usuario se eliminaron las seis tiendas locales anteriores (ids 4, 28, 50, 56, 57, 288) y sus datos comerciales, conservando las diez cuentas. La operación se ejecutó en una transacción.
Respaldo completo PostgreSQL, con catálogo de archivo verificado: respaldo-antes-demo-20261106.local/base.dump. Contiene datos y autenticación: permanece ignorado por Git. Incluye copias de los archivos locales de pruebas anteriores. Los archivos .qa-tienda.local y .qa-persistencia.local conservan identificadores antiguos: no usar sus antiguos preparadores de datos sobre este escenario. Se conservan para recuperar las credenciales y trazabilidad.
No se modificó Supabase de nube ni Vercel.

## Verificación automática

- npm test: 191 pruebas aprobadas (33 archivos).
- npm run lint y npm run build: aprobados. Continúa advertencia de tamaño del paquete principal.
- supabase test db --local: 106 pruebas aprobadas, incluidas 11 nuevas de frecuencia.
- supabase db advisors --local --type security: sin hallazgos.
- node scripts/verificar-frecuencia-demo-local.mjs: aprobados cálculos, filtros, paginación, rechazo de acceso anónimo y ajeno, navegación a ficha e historial.
- Las pruebas SQL verifican límites de fecha Argentina y revocación de ambos permisos sin renovar la sesión.

Implementación: public.frecuencia_clientes delega en función privada con identidad y permisos clientes.ver + pedidos.ver, agregación y paginación en servidor. Frontend en Clientes → Clientes frecuentes. Migración 20261106035834_clientes_frecuentes.sql aplicada solamente en local.
