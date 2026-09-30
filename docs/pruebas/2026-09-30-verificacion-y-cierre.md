# Verificación local y pendientes de cierre — 30/09/2026

## Fuentes comprobadas

- Chat «Borrador metodología pruebas»: cinco intercambios disponibles, incluida la decisión final de centralizar altas y permisos en el administrador.
- Jira: ND2026-3, 4, 5, 6 y 24; sus subtareas y Sprint 3 activo hasta el 02/10/2026.
- Repositorio real: C:\dev\2026_TSDS_PP3_EMPREGES_DUGARTE. Rama ND2026-3-integrar-persistencia-productos, HEAD cea95ca.
- GitHub actualizado mediante fetch: main en 975b984; rama ND2026-5-carrito-vitest en cea95ca. PR #2 abierto como borrador, sin integrar.
- Documento TESTING SPRINT 3 en Drive: M01–M16 conservan resultado vacío y estado No ejecutado.

## Verificación ejecutada

| Comprobación | Resultado |
|---|---|
| Docker / Supabase local | Contenedores en ejecución; salud de Auth HTTP 200 |
| Aplicación | Iniciada en http://127.0.0.1:5173/; respuesta HTTP 200 |
| npm test -- --maxWorkers=1 | 49 pruebas aprobadas, 7 archivos |
| supabase test db --local | 52 comprobaciones aprobadas, 2 archivos |
| node scripts/verificar-persistencia-local.mjs | Aprobado: alta, edición, duplicados, nueva sesión, visibilidad y aislamiento; limpia sus datos temporales |
| npm run lint | Aprobado después del ajuste descrito abajo |
| npm run build | Aprobado |
| Playwright existente | Solo contiene pruebas de ejemplo contra playwright.dev; no valida el flujo de EmpreGest |

Estas ejecuciones corresponden al árbol de trabajo con cambios locales sin commit, no únicamente al commit cea95ca. No sustituyen la aceptación manual ni comprueban la nube.

Se corrigió eslint.config.js para excluir informes de Playwright y reconocer Node en la configuración y pruebas de navegador. El análisis anterior estaba intentando validar archivos generados como código fuente. No se cambiaron reglas funcionales, datos del negocio, estados de Jira ni documentos compartidos.

## Decisiones vigentes del otro chat

- Roles generales: Administrador del sistema, Emprendimiento y Cliente. Los repartidores quedan fuera.
- Cuentas internas individuales y permisos configurables por emprendimiento.
- Solo el Administrador del sistema habilita/asocia cuentas, modifica permisos y retira accesos.
- Cliente registrado con Google y perfil propio; se conserva la compra como invitado.
- Dirección escrita y ubicación en mapa; tarifa por radios desde cada negocio. Fuera de cobertura, entrega no disponible y sugerencia de contactar al negocio.
- IA y fidelización requieren alcance específico; no están implementadas ni deben darse por cubiertas por historias de estadísticas o frecuencia.

Jira ND2026-24 todavía exige Emprendedor/Colaborador y excluye permisos configurables. Antes de implementar la nueva autorización hay que refinar la historia y dividir administración de cuentas/permisos, acceso con Google y perfil de cliente según su alcance. El flujo local actual permite autorregistro y creación de emprendimientos; deberá adecuarse a la habilitación centralizada acordada.

## Qué falta para cerrar las historias

| Historia | Estado Jira comprobado | Pendiente |
|---|---|---|
| ND2026-3 Productos | En curso | Resolver imágenes utilizables, verificar productos ocultos en catálogo público, evidencia de aceptación y publicar/revisar/integrar cambios. ND2026-7/8/9 figuran Listo; ND2026-10 sigue En curso. |
| ND2026-4 Catálogo | En curso | Ruta pública por emprendimiento sin sesión, imágenes y estados vacío/error; ejecutar ND2026-11/12/13. |
| ND2026-5 Carrito | En curso | Conectar la lógica existente al visitante sin cuenta, conservar por emprendimiento y validar el recorrido público y la recarga. ND2026-14/15/16 siguen En curso. |
| ND2026-6 Pedido | Por hacer | Persistencia de pedido/detalle, contacto, subtotal recalculado en servidor, fecha, estado Pendiente y confirmación clara; pruebas de los criterios. ND2026-17/18/19/20 siguen Por hacer. |
| ND2026-24 Acceso | En curso | Alinear criterios con las decisiones nuevas; implementar y comprobar permisos efectivos, administración de accesos y separación de áreas públicas/internas. |

## Orden propuesto

1. Conservar y revisar el trabajo local, crear commits coherentes y publicarlos para revisión sin mezclar los informes generados ni secretos.
2. Alinear el alcance de autorización con los acuerdos; no desarrollar la distinción antigua Emprendedor/Colaborador.
3. Completar imágenes, catálogo público y carrito del visitante; obtener evidencia de productos, catálogo y carrito.
4. Implementar confirmación de pedidos con validación en servidor y pruebas reales del flujo.
5. Actualizar Jira según evidencia y replanificar lo que no pueda terminarse antes del cierre del sprint. No incorporar Maps, IA o todo el perfil de cliente al compromiso actual sin revisar capacidad.

## Documentación de pruebas

Las fichas actuales sirven para verificar la versión existente. M02 presupone creación autónoma de emprendimiento y la sección P03 todavía menciona Emprendedor/Colaborador: deberán ajustarse al nuevo flujo cuando se refine la autorización. No usar esos resultados para aceptar el modelo nuevo sin adaptar y ampliar casos.

Registrar resultado obtenido, fecha, versión/commit, entorno y capturas antes/después cuando corresponda. Agregar pruebas de concesión/revocación de permisos, prohibición de autoasignación y aislamiento; automatizar casos propios de EmpreGest con Playwright, no contar los ejemplos del proveedor como cobertura del proyecto.

## Confirmación del usuario y comprobación de navegador

El usuario confirmó que aún no ejecutó pruebas manuales: decidió aclarar primero los roles y el recorrido del frontend para que la evidencia represente un flujo coherente. La prioridad es completar y alinear ese recorrido antes de solicitar la ejecución manual completa.

Comprobación de navegador Chromium realizada sobre la aplicación local: pantalla «Ingresar», botones «Ingresar» y «Crear una cuenta», sin errores de JavaScript capturados. Es una comprobación inicial de carga; no equivale a ejecutar M01–M16 ni a probar la compra completa.

## Paso 1 — organización del trabajo local

Se consolidó el trabajo existente en tres bloques de revisión: herramientas y dependencias (155d8cf), implementación y pruebas de acceso/persistencia/carrito (1accc88), y documentación. Los informes de pruebas, credenciales locales, dependencias instaladas y configuración personal de Kilo se conservan fuera del versionado.

La rama de integración parte de ND2026-5-carrito-vitest (PR #2); la revisión adicional debe comparar contra esa rama para evitar duplicar sus cambios. La publicación de esta base no implica aceptar las historias ni implementar el nuevo modelo de permisos. No se integra en main ni se despliega en esta etapa.

El usuario confirmó avanzar con el reemplazo del enfoque Emprendedor/Colaborador. El siguiente paso será actualizar las historias y separar sus criterios según Administrador del sistema, Emprendimiento y Cliente, cuentas internas individuales y permisos gestionados centralmente.
