# ND2026-61 — Administración de cuentas y permisos
Fecha: 30/10/2026. Entorno: Supabase local y frontend local.

## Alcance implementado
La sección Administración → Usuarios y permisos permite buscar cuentas registradas por correo, consultar su estado y habilitar o suspender su acceso. Cada cuenta puede tener acceso interno a varios emprendimientos con permisos independientes.

Se pueden agregar y quitar asociaciones, suspender una asociación conservando sus permisos y conceder o revocar permisos. El guardado requiere confirmación y es atómico. Los cambios sin guardar tienen protección al navegar. Desmarcar acceso interno devuelve la cuenta al rol Cliente y elimina sus asociaciones al guardar.

El registro público sigue creando únicamente cuentas Cliente. El administrador habilita posteriormente las que correspondan como cuentas internas. No se implementó creación de usuarios nuevos ni envío de invitaciones desde este panel. Las cuentas administradoras son de consulta: su aprovisionamiento continúa siendo un procedimiento controlado.

Catálogo: productos (consultar, crear, editar, mostrar/ocultar), pedidos (consultar, cambiar estado/cancelar, registrar cobros), clientes (consultar, editar), inventario (consultar, registrar movimientos), configuración de tienda y entregas. Los permisos de escritura incluyen su consulta requerida. No existen roles fijos Emprendedor/Colaborador.

## Validación automatizada
- Suite existente: 189 pruebas aprobadas en 32 archivos.
- Integración y navegador: 23 comprobaciones aprobadas mediante scripts/verificar-administracion-cuentas-local.mjs.
- ESLint y compilación de producción correctos. Persiste la advertencia de tamaño del paquete principal.
- Asesores de seguridad locales: sin hallazgos.
- Migración 20261030054658_administracion_cuentas.sql registrada localmente. Reconstrucción de comparación sin diferencias de esquema.
- Capturas de escritorio (1360 px) y móvil (390 px), temas claro y oscuro, sin desbordamiento horizontal.
- Datos de ensayo temporales eliminados al finalizar; cuentas de demostración conservadas.

Las comprobaciones cubren denegación anónima, denegación a clientes y cuentas internas, elevación directa bloqueada por RLS, búsqueda autorizada, habilitación, concesión y revocación en una sesión ya iniciada, aislamiento entre negocios, validación de permisos, reversión completa ante datos inválidos, protección de administradores, retiro de asociaciones y suspensión de cuenta. El navegador verifica selección de permisos dependientes y persistencia del guardado.

La base evalúa el acceso vigente en las siguientes operaciones protegidas. La interfaz del usuario afectado actualiza sus controles al volver a enfocar la ventana y cada 30 segundos; no necesita cerrar sesión para que el servidor deniegue una operación revocada.

## Aceptación manual pendiente
1. Ingresar como administrador y abrir Usuarios y permisos.
2. Buscar una cuenta de prueba registrada y habilitar acceso interno.
3. Asociar un emprendimiento con consulta de productos; guardar y capturar la confirmación.
4. En otra ventana, ingresar con esa cuenta: verificar que puede consultar y que no puede crear.
5. Conceder Crear productos desde administración; volver a la ventana del usuario y comprobar el alta.
6. Revocar ese permiso con la sesión abierta; comprobar que el usuario no puede crear más productos.
7. Asociar otro emprendimiento con permisos distintos y comprobar aislamiento.
8. Suspender una asociación y luego la cuenta; comprobar que el acceso correspondiente deja de estar disponible.
9. Ingresar como cliente y verificar que no aparece Usuarios y permisos.

Registrar resultado real y evidencia de estas comprobaciones antes de cerrar la historia manualmente en Jira. Esta ejecución no modifica Jira.

## Pendientes fuera de alcance
ND2026-62: alta y edición de emprendimientos desde la administración.
ND2026-63: credenciales Google y prueba real del inicio de sesión, diferidas por el usuario.
