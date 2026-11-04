# Actualización de Supabase local — 22/09/2026

## Resultado

CLI actualizada de 2.116.0 a 2.117.0 y fijada en package.json/package-lock.json. La biblioteca del frontend @supabase/supabase-js permanece en 2.116.0: es un paquete diferente. npm update no avanzaba porque la CLI estaba fijada exactamente en 2.116.0.

Se detuvo el entorno con respaldo habilitado (supabase stop, sin --no-backup), se instaló la versión explícita y se reinició con las exclusiones existentes: imgproxy, logflare, vector y supavisor. No se eliminaron volúmenes ni se ejecutó db reset. No se modificó el proyecto remoto.

## Respaldo

Ubicación fuera del repositorio: C:\dev\empregest-backups\20260922-supabase-2.116.0

Contiene dump completo de PostgreSQL en formato custom, roles, copia del volumen de Storage, configuración, package.json/package-lock.json anteriores, inventario de contenedores y sumas SHA-256. El dump se creó dentro del contenedor y se copió como archivo binario para evitar corrupción por redirección de PowerShell. Se comprobó el listado del archivo y se leyó su contenido completo con pg_restore a un archivo temporal dentro del contenedor; no se realizó una restauración de ensayo en otra base.

El respaldo incluye datos privados y credenciales internas: conservarlo localmente y fuera de Git. No fue necesario restaurarlo porque los volúmenes originales se conservaron.

## Comprobaciones después de actualizar

- CLI instalada: 2.117.0.
- 1 cuenta, 2 emprendimientos, 1 producto y 1 membresía: mismo contenido antes y después, comprobado mediante huellas de filas completas ordenadas.
- Las mismas huellas coinciden después de ejecutar y limpiar la prueba de integración.
- Cuatro migraciones locales aplicadas: 20260903020508, 20260904004318, 20260904041319 y 20260910013508.
- 52 comprobaciones pgTAP aprobadas en dos archivos SQL.
- Asesor de seguridad local sin hallazgos.
- Prueba de API real aprobada: alta, edición, duplicados, nueva sesión, visibilidad pública e aislamiento entre cuentas. Solo crea y limpia sus propios datos temporales.
- 49 pruebas de aplicación aprobadas; lint y build correctos.
- Instalación npm terminó sin vulnerabilidades reportadas.

## Servicios

Los servicios con comprobación de salud quedaron healthy; los demás, en ejecución. PostgreSQL conserva la versión 17.6.1.166.

| Servicio | Imagen elegida por la CLI 2.117.0 |
|---|---|
| Studio | 2026.08.24-sha-8ec45b2 |
| PostgreSQL Meta | v0.99.0 |
| Realtime | v2.130.0 |
| Storage | v1.71.0 |
| PostgREST | v14.5 |
| Auth | v2.196.0 |

PostgREST antes usaba v16.1; la nueva CLI seleccionó v14.5 para este entorno. Se verificó compatibilidad funcional con las pruebas de API y permisos indicadas. El inventario completo antes/después está en el respaldo.

## Repetir las verificaciones

Desde la raíz del repositorio, con Docker y Supabase local en ejecución:

```powershell
npx supabase --version
npx supabase migration list --local
npx supabase test db --local
npx supabase db advisors --local --type security --fail-on warn
node scripts/verificar-persistencia-local.mjs
npm run test:report
npm run lint
npm run build
```

Para detener sin descartar los datos, usar npx supabase stop. La opción --no-backup descarta los volúmenes locales: no es necesaria para esta actualización. En una actualización futura revisar compatibilidad y respaldar antes de decidir si hace falta recrearlos.

## Referencias

- https://supabase.com/docs/guides/local-development/cli/getting-started
- https://supabase.com/docs/reference/cli/supabase-stop
- https://github.com/supabase/cli/releases/tag/v2.117.0
