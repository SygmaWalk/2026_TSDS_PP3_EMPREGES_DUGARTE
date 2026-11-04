# ND2026-10: validación de criterios de productos

## Estado

Validación parcial realizada el 10 de septiembre de 2026.

- Pruebas unitarias automatizadas: aprobadas.
- Análisis estático: aprobado.
- Compilación de producción: aprobada.
- Pruebas funcionales manuales en navegador: pendientes.
- Persistencia desde la interfaz hacia Supabase: bloqueada hasta implementar
  usuarios, membresías y políticas RLS de administración.

La historia ND2026-3 no debe marcarse como terminada mientras continúen estos dos
pendientes.

## Matriz de criterios de aceptación

| Criterio de ND2026-3 | Evidencia automatizada | Estado |
|---|---|---|
| Nombre y precio obligatorios | `rechaza nombre vacío y precios inválidos` | Aprobado |
| Descripción e imagen opcionales | `normaliza los campos opcionales y el nombre` | Aprobado |
| Modificación de un producto existente | `editar conserva identidad, pertenencia, visibilidad y fecha de creación` | Aprobado a nivel de lógica |
| Producto visible u oculto | `cambiar visibilidad conserva los demás datos y actualiza la fecha` | Aprobado a nivel de lógica |
| Producto oculto fuera del catálogo público | `el catálogo público recibe únicamente productos visibles` | Aprobado a nivel de lógica |
| Validación previa al guardado | Pruebas de formato, valor, duplicados y normalización | Aprobado a nivel de lógica |

## Ejecución automatizada

Comandos ejecutados:

```bash
npm test
npm run lint
npm run build
```

Resultado:

- 8 de 8 pruebas aprobadas.
- 0 errores de ESLint.
- Compilación de Vite completada correctamente.

## Casos funcionales manuales pendientes

### PF-P01 — Alta válida

1. Ingresar nombre `24 Minis`, precio `11000`, descripción y ruta de imagen.
2. Presionar **Crear producto**.
3. Verificar el mensaje de confirmación.
4. Verificar que el producto figure como **Oculto** y no aparezca en la vista
   pública.

### PF-P02 — Campos obligatorios

1. Intentar crear un producto sin nombre y con precio vacío.
2. Verificar que se muestren ambos errores y no se agregue ningún producto.

### PF-P03 — Precio inválido

1. Probar precio cero, negativo, texto y más de dos decimales.
2. Verificar que cada valor sea rechazado antes del alta.

### PF-P04 — Nombre duplicado

1. Crear `24 Minis`.
2. Intentar crear `  24 MINIS  `.
3. Verificar que se informe el duplicado y se conserve un solo producto.

### PF-P05 — Edición

1. Presionar **Editar** sobre un producto.
2. Cambiar nombre, descripción y precio.
3. Guardar y verificar los nuevos datos en la lista.
4. Entrar nuevamente a editar, modificar un campo y cancelar.
5. Verificar que el cambio cancelado no se aplique.

### PF-P06 — Visibilidad

1. Presionar **Mostrar**.
2. Verificar la etiqueta **Visible** y la aparición en la vista pública.
3. Presionar **Ocultar**.
4. Verificar que el producto desaparezca de la vista pública.

### PF-P07 — Diseño adaptable y accesibilidad básica

1. Repetir PF-P01, PF-P05 y PF-P06 en ancho de computadora y celular.
2. Recorrer los controles con teclado.
3. Verificar foco visible, etiquetas y lectura de los mensajes de estado.

## Defectos y limitaciones registrados

| Código | Tipo | Descripción | Severidad |
|---|---|---|---|
| LIM-P01 | Limitación conocida | Los datos viven en el estado local de React y se pierden al recargar. | Alta para producción |
| BLOQ-P01 | Bloqueo de prueba | El navegador automatizado del entorno no puede abrir el servidor local. | Media |

No se encontraron defectos en las pruebas automatizadas ejecutadas.
