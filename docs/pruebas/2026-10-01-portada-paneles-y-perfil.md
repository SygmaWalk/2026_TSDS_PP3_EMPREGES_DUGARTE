# Portada, paneles y perfil del cliente
Fecha: 1 de octubre de 2026. Entorno: Supabase local y aplicación local.
Trabajo sobre la rama ND2026-3-integrar-persistencia-productos, con cambios sin publicar.

## Qué se incorporó

- Portada pública en http://127.0.0.1:5173/#/ con presentación y directorio real de emprendimientos activos.
- Búsqueda por nombre y paginación de nueve tiendas. Estados de carga, error y ausencia de resultados.
- Enlaces entre portada, tienda pública y cuenta. La portada se puede visitar con una sesión abierta.
- Registro de clientes por correo y contraseña en #/registro. El servidor asigna rol Cliente; la pantalla no permite seleccionar permisos.
- Perfil editable con nombre, teléfono opcional y dirección habitual opcional.
- Precarga de esos datos al confirmar un nuevo pedido. Se pueden revisar y cambiar; el envío sigue requiriendo punto y cotización. Los intentos pendientes conservan sus datos originales.
- Panel individual desde “Abrir panel”, con cantidades reales de productos registrados, publicados, pedidos recibidos y pendientes. Cada cuenta ve las acciones correspondientes a sus permisos.
- Accesos a productos, pedidos, configuración de entregas y tienda pública. Adaptación a móvil.

## Alcance y persistencia

El perfil se guarda con Supabase Auth, en user_metadata.perfil_cliente. Son datos personales editables; no se utilizan como fuente de roles ni permisos. La autorización sigue en cuentas_acceso, membresías, permisos y políticas del servidor. No se agregó una tabla pública de perfiles ni se modificaron reglas de acceso.

La dirección habitual es texto para precargar el formulario; no implica que esté verificada ni que tenga coordenadas. El cliente debe marcar y revisar el punto al pedir envío. Editar el perfil no modifica los contactos ni direcciones históricas de pedidos confirmados.

Esta entrega avanza la funcionalidad de perfil (ND2026-42) y la presentación de tiendas. No equivale a completar el historial de compras (ND2026-64), ingreso con Google (ND2026-63), personalización visual completa ni administración de cuentas. No se cambiaron estados o sprints en Jira, ni documentos de Drive.

## Cómo se maneja la sesión

1. React presenta las pantallas y mantiene el usuario actual en memoria.
2. Supabase Auth verifica el acceso y entrega tokens de sesión.
3. El cliente de Supabase conserva los tokens en el almacenamiento local del navegador. La aplicación no guarda la contraseña en ese almacenamiento.
4. Al recargar o volver otro día, getSession recupera la sesión y Supabase puede renovarla. onAuthStateChange notifica a React los cambios.
5. Apagar el equipo, cerrar la pestaña o volver atrás no ejecuta “Cerrar sesión”.
6. “Cerrar sesión” solicita el cierre a Supabase y retira el usuario de la interfaz. Volver a una ruta privada requiere ingresar.
7. Los permisos reales se verifican en el servidor; mostrar una pantalla no concede acceso.
8. La sesión y el carrito tienen almacenamientos y finalidades distintas. El carrito público sigue siendo por navegador y emprendimiento.

Se mantuvo la persistencia de sesión existente. No se implementó un cierre por inactividad ni una opción de “recordarme”.
El entorno local sigue usando Supabase local. Estas mejoras no publican el proyecto ni conectan automáticamente la aplicación a Supabase en la nube.
En el entorno local la confirmación de correo está desactivada. Si se activa en otro entorno, el registro informa que hay que confirmar el correo; el recorrido de entrega de correo no se verificó aquí.

Documentación oficial:
- https://supabase.com/docs/guides/auth/sessions
- https://supabase.com/docs/reference/javascript/auth-updateuser

## Verificación automatizada y visual

- Suite de componentes y lógica: npm run test -- --maxWorkers=1.
- Análisis de código: npm run lint.
- Compilación: npm run build.
- Recorrido real local: node scripts/verificar-experiencia-local.mjs.
- Regresión de roles: node scripts/verificar-acceso-ui-local.mjs.

El recorrido real crea tiendas y una cuenta temporales, verifica sus resultados y elimina solo sus propios datos. Consulta la cuenta QA del editor para revisar el panel, sin modificar sus productos, entregas ni pedidos.

Recorrido verificado:
1. Buscar una tienda por nombre; una tienda inactiva no aparece.
2. Registrarse y obtener rol Cliente.
3. Guardar perfil, recargar y comprobar persistencia contra Auth.
4. Restaurar una sesión en un nuevo contexto de navegador usando el almacenamiento anterior.
5. Abrir una tienda, agregar un producto y comprobar nombre/teléfono/dirección precargados.
6. Mantener bloqueado el envío sin punto/cotización.
7. Cerrar sesión, intentar volver a la cuenta y comprobar que se exige ingreso.
8. Abrir el mismo carrito como invitado y comprobar que no hereda el nombre del cliente anterior.
9. Consultar el panel del editor y comparar la cantidad de pedidos con la base local.
10. Revisar escritorio de 1360 px y móvil de 390 px, sin desbordes horizontales ni errores de JavaScript.

La restauración del almacenamiento simula volver al navegador; no se apagó físicamente la PC.
La compilación conserva el aviso de tamaño del paquete principal superior a 500 kB; no impide compilar.

## Resultado de esta ejecución

- 89 pruebas de componentes y lógica aprobadas, en 14 archivos.
- Análisis de código sin errores y compilación correcta, con el aviso de tamaño indicado arriba.
- Recorrido real local completado sin errores de JavaScript.
- Regresión visual aprobada para gestión completa, Cliente, lector, administrador y cuenta deshabilitada.
- Capturas de portada, perfil y panel inspeccionadas visualmente.
- En la primera ejecución de la prueba nueva de recuperación faltaba el identificador del intento en el dato de prueba. Se corrigió ese dato y se repitió la suite completa; no se relajó la validación del producto.

## Capturas automáticas

En test-results/, con variantes -escritorio.png y -movil.png:
- portada-tiendas
- perfil-cliente-nuevo
- emprendimientos-nuevo
- panel-negocio-nuevo

Las capturas de este recorrido usan datos QA. La cuenta y las tiendas temporales de esas capturas se eliminan al finalizar, de modo que los nombres de prueba pueden no aparecer después.

## Pruebas manuales para José

Registrar resultado real, fecha y evidencia; no se consideran ejecutadas por José por haber pasado la automatización.

| Caso | Qué hacer | Evidencia recomendada |
| --- | --- | --- |
| UX01 | Abrir la portada sin iniciar sesión y buscar una tienda existente; probar un nombre inexistente. | Portada y resultado de búsqueda. |
| UX02 | Entrar a una tienda desde el directorio; volver mediante la marca o “Explorar tiendas”. | Directorio y catálogo de la tienda elegida. |
| UX03 | Crear una cuenta de cliente y abrir Mi cuenta. | Pantalla de perfil, sin contraseña visible. |
| UX04 | Guardar nombre, teléfono y dirección; recargar. | Confirmación de guardado y datos persistentes. |
| UX05 | Probar teléfono inválido y luego corregirlo. | Mensaje de validación. |
| UX06 | Armar un carrito con sesión de cliente y continuar. | Contacto precargado; envío aún exige punto y cotización. |
| UX07 | Cambiar datos solo en el pedido y verificar que el perfil conserva los guardados. | Perfil y formulario, usando información ficticia. |
| UX08 | Cerrar sesión y volver atrás o a Mi cuenta. | Pantalla de ingreso; ningún perfil anterior visible. |
| UX09 | Entrar como editor y abrir el panel de una tienda. | Nombre del negocio, resumen y acciones disponibles. |
| UX10 | Comparar pedidos recibidos con el listado y entrar a productos/entregas. | Resumen y listado correspondiente. |
| UX11 | Repetir con una cuenta de lectura. | Controles restringidos según los permisos. |
| UX12 | Revisar portada, perfil y panel en móvil. | Una captura de cada pantalla. |
