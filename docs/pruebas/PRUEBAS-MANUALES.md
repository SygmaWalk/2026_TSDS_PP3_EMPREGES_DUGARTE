# Verificar EmpreGest

La guía de [demo local](demo-local.md) contiene las cuentas, los datos esperados y el recorrido de presentación. La lista de [aceptación manual del sprint](2026-11-12-sprint-6-e2e.md) detalla qué revisar por historia.

## Preparación

Instalar las dependencias con npm ci. Iniciar Docker y ejecutar npx supabase start y npx supabase migration up --local. Completar .env.local con la URL y clave publicable obtenidas mediante npx supabase status. Iniciar npm run dev -- --host 127.0.0.1 --port 5173 --strictPort.

## Pruebas automatizadas

Desde la raíz del proyecto ejecutar npm run lint, npm test y npm run build.
Con Docker activo, ejecutar npx supabase test db --local.
Para los informes, instalar los navegadores con npx playwright install chromium firefox webkit y ejecutar npx playwright test tests/informes-sprint.spec.js --workers=2.

Los scripts verificar-*-local.mjs tienen requisitos propios. Los preparadores antiguos dependen de archivos .qa-*.local y tiendas históricas. Para una demo nueva usar preparar-demo-local.mjs.

## Cambios de navegación

- En Clientes, alternar Directorio y Clientes frecuentes.
- En Productos, abrir Configurar adicionales y promociones y volver al listado.
- En Entregas, alternar Origen y Cobertura y tarifas; comprobar que los valores ingresados se conservan.
- En Identidad de la tienda, alternar Editar identidad y Previsualizar. Volver a editar para guardar o publicar.
- En Mi cuenta, abrir Agregar dirección; verificar foco del diálogo, cancelación y guardado.
- En el carrito, comparar el mensaje de visitante con el de una cuenta autenticada.

## Aceptación pendiente

Completar OAuth en producción, repetir el acceso con la misma identidad y comprobar el retorno al carrito. Probar ubicación y sugerencias reales de Places en teléfono físico. Revisar contraste, lectura, controles táctiles y comodidad con una persona. Los resultados automatizados complementan estas comprobaciones.

Los informes fechados conservan evidencia de versiones anteriores. Consultar README y esta guía para el arranque vigente.
