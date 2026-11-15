# Demo local de EmpreGest

## Antes de presentar

Abrí [Mesa del Sur](http://127.0.0.1:5173/#/tienda/demo-mesa-del-sur) en una ventana y [el ingreso](http://127.0.0.1:5173/#/ingresar) en una ventana privada u otro perfil. Reservá una para la clienta y otra para el negocio. Usá siempre 127.0.0.1 durante la demo para conservar la sesión y el carrito. Para la presentación usá correo y contraseña.

Las contraseñas generadas están en `CUENTAS-DEMO.local`, en la raíz del repositorio, excluido de Git. Compartí pantalla desde la app y mantené ese archivo cerrado al presentar.

| Correo | Qué permite mostrar |
| --- | --- |
| ana@demo.example.test | Tres compras en Mesa del Sur, dirección Casa, pizza habitual y dos sellos |
| bruno@demo.example.test | Dos pedidos propios, uno en preparación y uno cancelado |
| clara@demo.example.test | Cuenta nueva sin historial |
| cocina@demo.example.test | Gestión de Mesa del Sur, pedidos, catálogo, stock, entregas y clientes |
| consulta@demo.example.test | Consultas en Mesa del Sur con permisos de lectura |
| admin@demo.example.test | Administración del sistema, las dos tiendas y permisos por cuenta |

## Recorrido de 12 minutos

1. **Mostrá la tienda como visitante (2 min).** Abrí Mesa del Sur. Mostrá la pizza de $12.000, el adicional de queso de $800, el combo para dos de $15.500 y la limonada con promoción. Abrí [Café del Patio](http://127.0.0.1:5173/#/tienda/demo-cafe-del-patio) para mostrar que tiene su propio catálogo. Volvé a Mesa del Sur.
2. **Mostrá qué recuerda el sistema (2 min).** Ingresá como Ana. En Mi cuenta abrí **Ver mis pedidos**. Expandí su compra con envío: una pizza de $12.000 y $1.500 de entrega suman $13.500. En **Ver mis tarjetones** aparecen dos sellos por las dos compras pagadas y entregadas. En otra sesión, Clara permite mostrar el estado vacío.
3. **Armá una compra (3 min).** Con Ana, volvé al catálogo de Mesa del Sur. Elegí **Ver mi pedido habitual → Agregar sugerencia al carrito**. Mostrá una pizza. Agregá queso extra si querés mostrar cómo cambia el precio. Elegí envío a la dirección **Casa**, en Centro. Con queso, una pizza y el envío suman **$14.300**. Revisá el total. Confirmar crea un pedido real dentro de la demo; para repetir la presentación con los mismos totales históricos, detenete antes de confirmar.
4. **Pasá al lado del negocio (3 min).** En la segunda ventana ingresá como cocina. Desde **Resumen del negocio → Abrir pedidos**, abrí el pendiente de Ana para mostrar el detalle y la edición. El de Bruno ya está en preparación. Si confirmaste una compra nueva, usá esa para avanzar estados y registrar el cobro. En **Clientes**, abrí la ficha de Ana para contrastar la vista del negocio con el historial personal.
5. **Cerrá con informes y permisos (2 min).** En Pedidos abrí **Ventas y pedidos por período**. Elegí el día de la carga (en esta PC, 13/11/2026). En el escenario inicial hay cinco pedidos recibidos, dos pizzas pagadas y **$25.500 cobrados**, de los cuales $1.500 son envío. Centro tiene un envío; Este aparece sin ventas. Mostrá cómo cambia el panel al ingresar como consulta. Desde administración podés enseñar las dos tiendas y las asociaciones de cuentas.

Los datos cambian cuando se hacen compras o se modifican pedidos. Guardá los números de pedido nuevos que uses. Los ejemplos históricos anteriores describen el punto de partida.

## Revisión visual posterior

| Persona y pantalla | Tarea para observar | Qué anotar |
| --- | --- | --- |
| Visitante en teléfono | Encontrar una pizza, elegir un adicional y abrir el carrito | Si distingue precios por unidad, cantidades, descuento y total sin ayuda |
| Ana en checkout | Elegir Casa y revisar el envío | Si encuentra dirección, tarifa y total antes de confirmar. Probar permiso de ubicación en un teléfono físico y sugerencia real de Places por separado |
| Ana y Clara en Mi cuenta | Abrir un pedido y reconocer el historial vacío | Si identifican la siguiente acción y si los detalles caben a 390 px |
| Cocina en Pedidos | Distinguir pendiente, en preparación, pagado y cancelado | Si se confunden el estado operativo y el de cobro, o si es difícil encontrar el pedido nuevo |
| Consulta y administración | Encontrar informes y distinguir los permisos | Si los textos explican qué puede hacer cada cuenta y si son legibles los gráficos |
| Ana y cocina en beneficios | Completar décimo sello, canjear y probar la compra once | Comprobar la legibilidad del logo, el código y el estado tras el canje. La demo inicial tiene dos sellos |

Para cada observación guardá pantalla, rol, ancho o dispositivo, acción que intentó la persona y dónde dudó. Los recorridos manuales completos por historia están en [la guía del sprint](2026-11-12-sprint-6-e2e.md).

## Volver a abrir o preparar en otra PC

En esta PC los datos persisten en el volumen de Docker. Desde la raíz del proyecto, iniciá Docker Desktop y ejecutá:

```powershell
npx supabase start
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

Para una instalación nueva, copiá el preparador y el SQL junto con el proyecto, instalá dependencias con `npm ci`, iniciá Supabase local, configurá `.env.local` con la URL y la clave publicable de esa instalación y ejecutá:

```powershell
npx supabase migration up --local
node scripts/preparar-demo-local.mjs
```

El preparador genera seis contraseñas por instalación y carga las tiendas juntas. Si ambas ya existen, conserva los pedidos y los cambios hechos durante la demo. No hace falta reiniciar la base ni subir credenciales a GitHub.

## Seguimiento en Jira al 13/11/2026

| Historias marcadas Listo | Evidencia técnica |
| --- | --- |
| 36 y 37, informes | SQL y recorrido de informes en Chromium, Firefox y WebKit |
| 41, modificación | Pruebas de pedidos y SQL de revisión, permisos, versiones, disponibilidad y diferencias de stock |
| 44, pedido habitual | SQL, pruebas del carrito e incorporación de la sugerencia de Ana en navegador |
| 61, permisos | 23 comprobaciones locales de administración, revocación, aislamiento y navegador |
| 64, historial | SQL, componentes y comprobación en navegador de los tres historiales de la demo |
| 66, zonas | Dibujo de zona, tarifa, confirmación, datos históricos y rechazo de solapamientos y tarifas vencidas |
| 67, beneficios | SQL de sellos, emisión, pausa y canje; tarjetón visible en la cuenta de Ana |

Sigue En curso la [historia 63 de Google OAuth](https://sygmawalk.atlassian.net/browse/ND2026-63). Queda verificar en producción el ingreso completo, el segundo acceso con la misma identidad y el retorno a la tienda con el carrito. La revisión visual y en teléfono físico quedó diferida por decisión del usuario.

### Fotografías de la demo

Los catálogos y las portadas usan fotografías ilustrativas de [Pexels](https://www.pexels.com/license/). Para cargarlas en otra instalación, después de crear las tiendas ejecutá `node scripts/fotos-demo-local.mjs`. La descarga inicial requiere internet. La tienda sirve las imágenes desde Supabase local.

Los destinos se editan en un diálogo. En Clientes, alternar Directorio y Clientes frecuentes. En Entregas, alternar Origen y Cobertura y tarifas. En Identidad, volver a Editar identidad después de Previsualizar para guardar o publicar.
