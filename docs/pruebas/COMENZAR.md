# Cómo ver y comprender las pruebas de EmpreGest

## Actualización del 22/09/2026

La rama local ND2026-3-integrar-persistencia-productos incorpora acceso y guardado real en Supabase local. Seguí [la guía de persistencia](2026-09-22-persistencia-local.md) para configurar y probar esta versión. Las instrucciones de demostración de abajo describen la rama anterior de carrito.

## Abrir el trabajo desde GitHub

En tu repositorio local, revisar primero `git status`. Conservar cualquier cambio
pendiente antes de cambiar de rama. No usar `reset --hard` para traer este trabajo.

```bash
git fetch origin
git switch --track origin/ND2026-5-carrito-vitest
npm ci
npm run dev
```

Si ya existe la rama local, usar `git switch ND2026-5-carrito-vitest` y revisar
`git status` antes de actualizarla. Si se recuperó el bundle de la entrega anterior,
conservar esa rama y abrir una rama local distinta desde la versión publicada:

```bash
git switch -c ND2026-5-carrito-publicado --track origin/ND2026-5-carrito-vitest
```

La publicación mediante el conector puede tener identificadores de commit distintos
al bundle aunque conserve los mismos cambios. No forzar una actualización ni borrar
el trabajo local para resolver esa diferencia.
Esta rama incluye los avances de ND2026-8/9/10 y la base actualizada de `main`.
Todavía es una demostración: crear un producto y pulsar Mostrar antes de buscarlo
en Catálogo. Agregarlo al carrito y cambiar de pantalla para probar el flujo.

## Ver las pruebas

Abrir otra terminal en el mismo repositorio:

| Comando | Para qué sirve |
|---|---|
| `npm test` | Ejecutar una vez y ver el resultado en la terminal |
| `npm run test:watch` | Volver a ejecutar al guardar cambios |
| `npm run test:ui` | Abrir Vitest UI; usar el enlace que imprime la terminal |
| `npm run test:report` | Generar el informe HTML de una ejecución en `.vitest/` |
| `npm run test:report:open` | Servir el informe ya generado; abrir el enlace impreso |

Vitest UI muestra archivos, nombres de casos, aprobados, fallidos y detalles de
errores. El informe HTML es una fotografía de una ejecución: cambiar código no
lo actualiza; hay que volver a generar el informe.

## Primer ejemplo para estudiar

Abrir `src/features/carrito/carrito.test.js` y buscar CP-CAR-03.

1. **Preparar:** un producto de $1.000 y otro de $1.500.
2. **Actuar:** seleccionar dos unidades del primero y una del segundo.
3. **Comprobar:** esperar 350000 centavos, equivalentes a $3.500.

`expect(...).toBe(350000)` expresa el resultado esperado. Vitest llama las
funciones, compara y señala un fallo si recibe otro valor. Para aprender, podés
cambiar temporalmente el esperado a 350001, ejecutar solo ese caso y observar el
mensaje; luego restaurar 350000. No guardar ni integrar ese cambio intencional.

```bash
npm test -- src/features/carrito/carrito.test.js -t CP-CAR-03
```

Después abrir CP-UI-02 en `src/App.test.jsx`: usa etiquetas y botones para realizar
el recorrido de la interfaz. Aquí el objetivo es comprobar que las piezas estén
conectadas correctamente, además de que el cálculo aislado funcione.

## Qué cambió respecto de node:test

Vitest es ahora el ejecutor de las pruebas JavaScript. Las ocho pruebas previas
conservan sus comprobaciones con `node:assert/strict`, que es una biblioteca de
aserciones compatible: no es el ejecutor `node:test`. Las pruebas nuevas usan
`expect` de Vitest. React Testing Library aporta utilidades para interactuar con
componentes; jsdom aporta el DOM simulado. Ninguna de estas herramientas sustituye
las pruebas de PostgreSQL ni comprueba una conexión real a Supabase por sí sola.

## Consultar resultados en GitHub

El workflow `Pruebas de frontend` ejecuta instalación reproducible, lint, pruebas
y build al abrir/actualizar un PR o al subir cambios a `main`.

En el PR, abrir Checks y la ejecución de `Pruebas de frontend`. Los logs muestran
los resultados. En el resumen de la ejecución, descargar el artefacto
`informe-vitest`, disponible durante 14 días si el workflow pudo generarlo.
Extraerlo y servir la carpeta que contiene `index.html` con Vite para navegar el
informe. Si se extrae en `.vitest/`, usar `npm run test:report:open`.

Un workflow agregado no implica que ya haya corrido: comprobar su estado en
GitHub. Tampoco se configura en esta tarea una regla que bloquee técnicamente las
integraciones. No subir carpetas generadas de informes ni `node_modules` al repo.

## Documentación y Jira

Leer `ND2026-5-carrito.md` para criterios, casos y revisión manual pendiente.
En Jira, ND2026-16 puede enlazar ese documento, el PR y una ejecución concreta.
Un resultado siempre debe identificar commit y entorno. Mantener separados los
casos definidos, el código automatizado y los resultados de cada ejecución.

No marcar ND2026-5 ni ND2026-3 como Listo solo por ver pruebas verdes. El alcance
integrado y los pendientes están detallados en la matriz de pruebas.

## Referencias

- [Vitest](https://vitest.dev/guide/)
- [Vitest UI e informes](https://vitest.dev/guide/ui)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
