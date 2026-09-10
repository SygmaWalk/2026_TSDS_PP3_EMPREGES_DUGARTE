const LIMITE_PRECIO = 9_999_999_999.99

export function convertirPrecio(valor) {
  const precioComoTexto = String(valor ?? '').trim().replace(',', '.')

  if (!/^\d+(?:\.\d{1,2})?$/.test(precioComoTexto)) {
    return null
  }

  const precio = Number(precioComoTexto)
  return Number.isFinite(precio) ? precio : null
}

export function validarProducto(datos, productosExistentes = [], productoId = null) {
  const nombre = String(datos.nombre ?? '').trim()
  const precio = convertirPrecio(datos.precio)
  const errores = {}

  if (!nombre) {
    errores.nombre = 'Ingresá el nombre del producto.'
  } else {
    const nombreNormalizado = nombre.toLocaleLowerCase('es')
    const nombreDuplicado = productosExistentes.some(
      (producto) =>
        producto.id !== productoId &&
        producto.nombre.trim().toLocaleLowerCase('es') === nombreNormalizado,
    )

    if (nombreDuplicado) {
      errores.nombre = 'Ya existe un producto con ese nombre.'
    }
  }

  if (precio === null) {
    errores.precio = 'Ingresá un precio válido con hasta dos decimales.'
  } else if (precio <= 0) {
    errores.precio = 'El precio debe ser mayor que cero.'
  } else if (precio > LIMITE_PRECIO) {
    errores.precio = 'El precio supera el máximo permitido.'
  }

  return {
    esValido: Object.keys(errores).length === 0,
    errores,
    datosNormalizados: {
      nombre,
      descripcion: String(datos.descripcion ?? '').trim() || null,
      precio,
      imagenPath: String(datos.imagenPath ?? '').trim() || null,
    },
  }
}

export function crearProducto(datos, opciones = {}) {
  const ahora = opciones.ahora ?? new Date().toISOString()
  const generarId = opciones.generarId ?? (() => crypto.randomUUID())

  return {
    id: generarId(),
    emprendimientoId: opciones.emprendimientoId ?? 1,
    ...datos,
    visible: false,
    fechaCreacion: ahora,
    fechaModificacion: ahora,
  }
}

export function actualizarProducto(producto, cambios, opciones = {}) {
  return {
    ...producto,
    ...cambios,
    id: producto.id,
    emprendimientoId: producto.emprendimientoId,
    visible: producto.visible,
    fechaCreacion: producto.fechaCreacion,
    fechaModificacion: opciones.ahora ?? new Date().toISOString(),
  }
}
