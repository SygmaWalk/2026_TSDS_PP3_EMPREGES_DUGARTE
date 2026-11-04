# ND2026-29 — Búsqueda de clientes e historial
Fecha: 11/10/2026. Entorno: local.

## Funcionalidad
- Búsqueda parcial por nombre (sin distinguir mayúsculas) o teléfono. La búsqueda numérica admite espacios, guiones y paréntesis. Se aplica antes de paginar, sobre todos los contactos autorizados del negocio.
- Listado de pedidos vinculados a la ficha, ordenado por fecha descendente y número como desempate. Páginas de 25 pedidos.
- Cada entrada muestra número, fecha, contacto original, estado, total y estado de pago.
- El detalle completo se abre en modo consulta dentro de la ficha. Se conserva la página del historial al volver, así como el filtro de clientes al regresar al listado.
- Editar el teléfono de la ficha no rompe los vínculos con pedidos anteriores.
- Se requieren clientes.ver y pedidos.ver para consultar el historial. Los filtros de negocio/ficha y las políticas RLS se mantienen en las consultas.
- Estados de carga, error, reintento y búsqueda vacía contemplados. Respuestas antiguas no reemplazan búsquedas más recientes.

## Verificación de integración
El archivo scripts/verificar-historial-clientes-local.mjs aprobó 51 comprobaciones sobre Supabase local, incluyendo las regresiones de fichas comerciales y las nuevas verificaciones:
- Búsqueda por nombre y teléfono, entradas especiales y ausencia de resultados.
- Más de 25 clientes: búsqueda fuera de la primera página.
- Historial de 26 pedidos en dos páginas, sin duplicados.
- Vínculo histórico tras cambio de teléfono; datos originales conservados en el detalle.
- Aislamiento entre fichas y emprendimientos; lectura denegada sin permisos o tras revocarlos.
- Búsqueda, apertura del detalle y regreso desde el navegador.
- Presentación de escritorio y móvil sin desbordamiento horizontal; sin errores JavaScript.
Los usuarios, negocios y pedidos temporales se eliminaron al finalizar.

Capturas inspeccionadas: test-results/cliente-historial-escritorio.png y test-results/cliente-historial-movil.png.

## Alcance y aceptación
No se modificó el esquema de la base de datos ni se agregaron permisos. La búsqueda utiliza el teléfono actual de la ficha; no interpreta un teléfono anterior como alias. No ignora tildes y no admite asteriscos como comodines.

Pendiente aceptación manual: buscar un cliente por parte de su nombre y teléfono, abrir su ficha, verificar el orden del historial, consultar un pedido y regresar conservando la búsqueda.

Sin cambios en Jira ni Drive y sin despliegue en la nube.

## Controles de aplicación
ESLint sin errores. Vitest: 117 pruebas aprobadas en 20 archivos. Compilación correcta; continúa el aviso de tamaño del paquete principal (562,69 kB). Sin cambios de dependencias.
