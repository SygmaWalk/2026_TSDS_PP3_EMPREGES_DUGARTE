# ND2026-5 — Carrito: implementación y pruebas

Estado: avance de frontend para revisión. No equivale a aceptación de la historia completa.

## Alcance

Relaciona ND2026-5 con sus subtareas ND2026-14 (operaciones), ND2026-15 (subtotal)
y ND2026-16 (validación). Usa la demostración de productos de ND2026-8/9/10.
Se sincronizó la base con `main` antes de comenzar. No se modifican las migraciones ni Jira.

- Agregar productos visibles, acumular unidades, actualizar cantidades y quitar ítems.
- Subtotal en centavos enteros; formato monetario ARS solo al mostrarlo.
- Estado del carrito en `App`, por encima de las pantallas: permanece al navegar
  entre Productos, Catálogo y Carrito dentro de la aplicación.
- Mensajes de error para cantidades vacías, cero, negativas, fraccionarias,
  texto y cálculos fuera del rango seguro.
- Etiquetas para los controles, mensajes anunciables y estilos adaptables.

## Decisiones provisionales que se deben revisar

1. Un carrito corresponde a un solo emprendimiento. Se rechaza mezclar tiendas.
2. Si se oculta un producto, se retira del carrito de esta sesión y se informa al
   administrador en el mensaje de la acción. Si cambia su precio, se actualiza el
   subtotal con el precio actual. Estas reglas son adicionales a los criterios
   mínimos de Jira y deben confirmarse antes de la integración con datos reales.
3. No se impone una cantidad máxima comercial ni stock ficticio. Se rechaza una
   cantidad que provoque cálculos fuera del rango entero seguro de JavaScript.
4. La navegación es interna mediante estado React. No implementa rutas públicas,
   URLs independientes, historial del navegador ni autenticación.

## Matriz de trazabilidad

| Criterio de Jira | Casos | Evidencia automática disponible |
|---|---|---|
| Agregar un producto disponible | CP-CAR-01, 02, 07; CP-UI-02, 06 | Reglas de alta y recorrido de interfaz |
| Modificar la cantidad | CP-CAR-03, 05; CP-UI-02, 03 | Cantidades válidas e inválidas |
| Quitar un producto | CP-CAR-04; CP-UI-02 | Eliminar el último ítem y subtotal cero |
| Mostrar subtotal actualizado | CP-CAR-03, 06, 10; CP-UI-02, 05 | Varias líneas, centavos y precio actualizado |
| Impedir cantidades menores a uno o inválidas | CP-CAR-05; CP-UI-03 | Ocho entradas inválidas y conservación del último subtotal |
| Conservar productos durante la navegación | CP-UI-02 | Catálogo → carrito → catálogo → productos → carrito |

Regresión y decisiones adicionales: CP-UI-01 comprueba validaciones del formulario
de productos; CP-UI-04 comprueba ocultamiento. CP-CAR-08/09 comprueban separación
de emprendimientos; CP-CAR-11/12, actualización de datos y disponibilidad.

## Dónde se implementan

- `src/features/carrito/carrito.js`: reglas y operaciones sin interfaz.
- `src/features/carrito/carrito.test.js`: 20 ejecuciones unitarias, incluyendo casos parametrizados.
- `src/features/carrito/Carrito.jsx`: lista, formulario de cantidad y subtotal.
- `src/App.test.jsx`: 6 pruebas de interacción con React Testing Library y jsdom.
- `src/features/productos/producto.test.js`: 8 pruebas previas, ahora ejecutadas por Vitest.

React Testing Library interactúa con un DOM simulado. Esto no es una ejecución
de Playwright, una prueba en navegador real ni una verificación de Supabase.

## Casos manuales para la revisión local

Precondiciones: instalar con `npm ci` y abrir la aplicación con `npm run dev`.
Usar datos ficticios. Estado inicial de todos estos casos: **no ejecutado por José**.

| Caso | Pasos | Resultado esperado |
|---|---|---|
| MAN-CAR-01 | Crear Tequeños a 1000 y Arepitas a 1500; mostrar ambos; abrir Catálogo; agregar Tequeños dos veces y Arepitas una; abrir Carrito | Dos filas, cantidades 2 y 1; subtotal $3.500,00 |
| MAN-CAR-02 | Cambiar Tequeños a 3 y pulsar Actualizar | Subtotal $4.500,00 |
| MAN-CAR-03 | Probar vacío, 0, -1, 1.5 y texto; pulsar Actualizar | Error claro y subtotal anterior sin modificaciones |
| MAN-CAR-04 | Ir a Catálogo, volver a Productos y regresar a Carrito | Misma selección y cantidades confirmadas |
| MAN-CAR-05 | Quitar ambas filas | Carrito vacío, contador cero y subtotal $0,00 |
| MAN-CAR-06 | Repetir en celular y escritorio; recorrer controles con Tab y activar con Enter | Sin desbordamiento, controles legibles, foco visible y operación por teclado |
| MAN-CAR-07 | Agregar producto; volver a Productos y ocultarlo | Se informa el retiro; ya no aparece en catálogo ni carrito |
| MAN-CAR-08 | Agregar producto, editar su precio en Productos y volver al carrito | Se conserva cantidad y cambia subtotal con el nuevo precio |

Registrar cada ejecución con: fecha/hora, persona, commit (`git rev-parse HEAD`),
entorno/navegador, caso, resultado real, estado, evidencia y defecto relacionado.
Si un caso falla, conservar la evidencia, corregir y registrar una nueva ejecución.

## Límites y pendientes para cerrar la historia

- Productos y carrito siguen en memoria: se pierden al recargar. La conservación
  entre recargas no se declara cubierta por el criterio de navegación.
- Falta conectar el catálogo real y comprobar el recorrido con Supabase.
- Falta la revisión visual y manual en navegador de escritorio/celular.
- No existe confirmación, registro de pedidos, stock ni cálculo de envío.
- ND2026-4 no queda terminada por esta vista: faltan lectura real, tratamiento de
  cargas/errores, acceso público independiente y resolución de imágenes.
- El servidor deberá validar disponibilidad, pertenencia y cantidades, y
  recalcular precios y total. Los controles del carrito no garantizan seguridad.
- Los cambios de precio/disponibilidad entre sesiones o dispositivos necesitan
  validación cuando se implemente la confirmación de pedidos.

## Resultado de esta preparación

34 pruebas aprobadas (8 de productos, 20 de carrito y 6 de interacción), lint y
build satisfactorios en el entorno Linux de preparación, con Node 24.19.0.
Las pruebas SQL no se ejecutaron en esta tarea. La revisión visual quedó bloqueada
porque el navegador remoto no puede acceder al servidor local (`ERR_BLOCKED_BY_CLIENT`).
El informe HTML generado localmente es reproducible con `npm run test:report`.
La ejecución remota y su commit se consultan en Checks del PR; su estado debe
verificarse antes de presentar esa ejecución como aprobada.
