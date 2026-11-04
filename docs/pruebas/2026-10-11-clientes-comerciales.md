# ND2026-28 — Fichas comerciales de clientes
Fecha de cierre técnico: 11/10/2026. Entorno: Supabase local y Vite.

## Alcance implementado
- Los pedidos generan o reutilizan una ficha de contacto por emprendimiento y teléfono normalizado.
- La normalización quita espacios, paréntesis, guiones y el signo +; no infiere el prefijo de país.
- El listado y la edición requieren los permisos clientes.ver y clientes.editar, respectivamente. El editor de Tienda de prueba tiene ambos.
- Nombre, teléfono, dirección y referencia se pueden corregir sin cambiar la información histórica de los pedidos.
- Los pedidos nuevos reutilizan la ficha sin sobrescribir correcciones internas. Los contactos comerciales no crean cuentas ni conceden acceso a pedidos.
- Se vincularon los 11 pedidos locales existentes a 3 fichas conservando sus datos originales.
- Se evita la duplicación concurrente y se detecta la edición con versiones desactualizadas.

## Verificación
- ESLint: sin errores.
- Vitest: 111 pruebas aprobadas en 18 archivos.
- Compilación: correcta; persiste aviso de tamaño del paquete principal superior a 500 kB.
- Base de datos: 95 pruebas pgTAP aprobadas en la verificación de esta implementación; asesores de seguridad sin incidencias.
- Integración local: 29 comprobaciones aprobadas con scripts/verificar-clientes-local.mjs. Incluyen aislamiento entre negocios, permisos revocados, invitados, duplicación concurrente, conservación histórica y edición real en navegador.
- Capturas de escritorio y móvil inspeccionadas: test-results/cliente-ficha-escritorio.png y test-results/cliente-ficha-movil.png. Sin desbordamiento horizontal ni errores de JavaScript. Datos de prueba temporales eliminados al finalizar.
- Migración reproducida en base temporal mediante db diff: supabase/migrations/20261010212921_clientes_comerciales.sql. No quedan diferencias del esquema de clientes. El resultado conserva únicamente dos diferencias previas ajenas a este cambio: preparar_registro_catalogo y rls_auto_enable.

## Límites y aceptación pendiente
El teléfono agrupa contactos, no demuestra identidad. Compartir número dentro del mismo negocio reutiliza ficha; usar un prefijo distinto puede generar otra. Al cambiar el teléfono no se crean alias ni se fusionan fichas. La búsqueda y el historial desde la ficha corresponden a ND2026-29 y aún no están implementados.

Pendiente aceptación manual del usuario: abrir Clientes, confirmar dos pedidos con el mismo teléfono, comprobar una sola ficha y editarla verificando que los pedidos anteriores conservan sus datos.

No se actualizaron Jira ni documentos de Drive. Los cambios están en el entorno local; no se desplegaron en la nube.
