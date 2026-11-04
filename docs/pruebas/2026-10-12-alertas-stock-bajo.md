# Verificación local — ND2026-34: Alertar stock bajo

Fecha: 12/10/2026. Alcance contrastado con ND2026-34 en Jira mediante lectura.
Estado: implementado y verificado localmente; pendiente aceptación manual del usuario.

## Resultado
- Mínimo opcional por producto, configurable con permiso stock.registrar y acceso a productos e inventario.
- Valores desde cero, hasta tres decimales; campo vacío desactiva la configuración.
- Sin valor predeterminado inventado para productos existentes.
- Stock bajo si disponible > 0 y disponible <= mínimo.
- Sin existencias cuando disponible = 0, incluso sin mínimo configurado.
- Filtro «En el mínimo o por debajo»: incluye todos los productos con mínimo configurado que cumplen disponible <= mínimo, también los agotados.
- Filtro independiente «Sin existencias»: incluye agotados con o sin mínimo.
- Producto simple: compara existencias propias. Combo: compara unidades armables a partir de componentes. En el detalle se informa también la disponibilidad limitada por componentes para productos simples.
- Búsqueda y filtros se aplican antes de paginar, incluyendo productos fuera de la primera página.
- Estado calculado a partir del stock actual. La interfaz consulta cada 15 segundos mientras está visible y al recuperar el foco; guardar cambios propios actualiza inmediatamente.
- La actualización conserva los formularios abiertos.
- Configuración interna; no se exponen mínimos al catálogo público.

## Comprobaciones
- Suite completa de aplicación: 158 aprobadas y un fallo detectado en validación del mínimo. Se corrigió el patrón de validación.
- Reejecución de todo el módulo de stock después de la corrección: 23 pruebas aprobadas, incluido el caso que había fallado.
- 95 pruebas SQL aprobadas.
- 40 comprobaciones de integración y navegador aprobadas en scripts/verificar-stock-bajo-local.mjs.
- Cobertura: igualdad/bajo/sobre umbral, cero, decimales, desactivación, límites inválidos, permisos revocados, aislamiento entre negocios, bloqueo de escrituras directas, combo, venta, devolución, paginación, configuración en navegador y actualización automática.
- Lint y compilación correctos. Persiste advertencia de tamaño del archivo JavaScript principal (584,50 kB sin comprimir).
- Asesor de seguridad local sin hallazgos.
- Migración 20261012173158_alertas_stock_bajo.sql reproducida en base temporal. Solo diferencias de formato en dos funciones preexistentes ajenas al alcance.
- Revisión visual de test-results/stock-bajo-escritorio.png y test-results/stock-bajo-movil.png sin desbordes.
- Datos temporales de pruebas eliminados al finalizar.

## Aceptación manual
1. Inventario → Ver movimientos de un producto → Configurar mínimo.
2. Colocar un mínimo igual a sus existencias: debe aparecer Stock bajo.
3. Reponer por encima del mínimo: debe desaparecer.
4. Comprobar un producto con cero: debe mostrar Sin existencias.
5. Probar ambos filtros y desactivar un mínimo dejando el campo vacío.

Jira y documentos de Drive permanecen sin modificaciones.
