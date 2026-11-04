# Google OAuth local y límites de pedidos
Fecha: 27/10/2026.

## Implementado
- Integración con signInWithOAuth de Supabase y flujo PKCE. El SDK intercambia el código y conserva la sesión.
- Botón Continuar con Google en ingreso/registro, visible solo con VITE_AUTH_GOOGLE_ENABLED=true.
- Retorno local validado a la tienda de origen, errores/cancelación genéricos y limpieza de parámetros de retorno.
- Credenciales y proveedor aún sin habilitar; no se ha probado una autenticación real con Google. ND2026-63 no está lista para cerrar.
- Roles existentes controlados por la base de datos. El alta nueva sigue creando Cliente; OAuth no asigna permisos internos.
- Límite de pedidos en servidor: 5 nuevos por cliente/tienda/10 minutos; 20 por cliente/hora entre todas las tiendas. Incluye cancelados. Al vencer la ventana se recupera cupo.
- La repetición del mismo intento confirmado recupera el resultado sin consumir otro cupo. Rechazos no descuentan stock.
- Bloqueo transaccional por cliente e índice por cliente/fecha. Un límite devuelve HTTP 429 y mensaje legible.
- Estos límites frenan ráfagas de pedidos confirmados; no sustituyen CAPTCHA, verificación, límites por IP o protección contra ataques con múltiples cuentas.

## Crear las credenciales
1. Entrar en https://console.cloud.google.com/ y seleccionar/crear el proyecto EmpreGest.
2. En Google Auth Platform completar Branding (nombre, correo de soporte y contacto).
3. Audience: External; mantener Testing y añadir los correos de Google que harán las pruebas.
4. Data Access: openid, correo y perfil básicos. No solicitar Drive, Calendar ni otros accesos.
5. Clients → Create client → Web application.
6. En Authorized JavaScript origins añadir http://localhost:5173 y http://127.0.0.1:5173.
7. En Authorized redirect URIs añadir exactamente http://127.0.0.1:54321/auth/v1/callback.
8. Guardar Client ID y Client Secret en el archivo local .env, que está excluido de Git. No compartir el secreto en el chat.

Variables del .env (conservar las existentes):
SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID=valor_del_cliente
SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET=valor_del_secreto
VITE_AUTH_GOOGLE_ENABLED=true

En supabase/config.toml, sección [auth.external.google], cambiar enabled a true después de completar los valores. El secreto se toma de la variable, no del archivo versionado.
Las direcciones site_url y additional_redirect_urls ya están preparadas para el puerto 5173.
Reiniciar Supabase local conservando datos y reiniciar Vite para aplicar estas configuraciones. No usar db reset ni eliminar volúmenes.
En una integración alojada, configurar el proveedor en el proyecto Supabase correspondiente y usar su callback HTTPS. No sustituir la URL de la base local por una de nube para probar.

## Prueba real pendiente
- Cuenta Google de prueba nueva → Cliente sin acceso interno.
- Cerrar sesión y repetir con la misma Google → misma identidad.
- Cancelar autorización → sin sesión nueva y mensaje claro.
- Iniciar desde carrito → regresar a la tienda conservándolo y confirmar.
- Cuenta interna existente: no obtiene permisos adicionales por utilizar Google.
- Verificar aislamiento entre cuentas e impedir acceso a recursos ajenos.
- Probar código de retorno vencido o usado y recarga del retorno.
- Google y SMS verifican aspectos diferentes; teléfono sigue sin verificación SMS.

## Verificaciones locales
- Suite de aplicación tras primera implementación: 187 pruebas aprobadas.
- Integración de límites: 9 comprobaciones con la API local, incluidos concurrencia, recuperación del mismo intento, aislamiento por cuenta, ventanas de tiempo y cancelados.
- Asesor de seguridad local sin incidencias.
- Migración generada desde la base local y reconstruida en base temporal; no se reinició la base de trabajo.
- Datos temporales de ensayo eliminados.
- Sin cambios en Jira ni despliegue a nube.

Referencias oficiales consultadas:
https://supabase.com/docs/guides/auth/social-sign-in/auth-google
https://supabase.com/docs/guides/auth/sessions/pkce-flow
https://supabase.com/docs/guides/auth/redirect-urls
