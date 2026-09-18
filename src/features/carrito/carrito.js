// Los importes del carrito se calculan con enteros (centavos).
// El servidor deberá recalcularlos al implementar la confirmación del pedido.
export function precioACentavos(precio) {
  const numero = Number(precio)
  const centavos = Math.round(numero * 100)
  if (
    !Number.isFinite(numero) ||
    numero <= 0 ||
    !Number.isSafeInteger(centavos) ||
    centavos < 1
  ) {
    throw new Error('El producto no tiene un precio válido.')
  }
  return centavos
}

export function validarCantidad(valor) {
  const texto = String(valor).trim()
  const cantidad = Number(texto)
  if (!/^\d+$/.test(texto) || !Number.isSafeInteger(cantidad) || cantidad < 1) {
    throw new Error('Ingresá una cantidad entera mayor o igual a uno.')
  }
  return cantidad
}

export function calcularSubtotalCentavos(items) {
  return items.reduce((total, item) => {
    const subtotal =
      total + item.precioCentavos * validarCantidad(item.cantidad)
    if (!Number.isSafeInteger(subtotal)) {
      throw new Error('La cantidad supera el límite de cálculo del carrito.')
    }
    return subtotal
  }, 0)
}

export function agregarAlCarrito(items, producto) {
  if (
    !producto ||
    producto.visible !== true ||
    producto.id == null ||
    producto.emprendimientoId == null
  ) {
    throw new Error('Este producto no está disponible.')
  }
  if (
    items.some((item) => item.emprendimientoId !== producto.emprendimientoId)
  ) {
    throw new Error(
      'El carrito solo puede contener productos del mismo emprendimiento.',
    )
  }
  const existente = items.find((item) => item.id === producto.id)
  const nuevoItem = {
    id: producto.id,
    emprendimientoId: producto.emprendimientoId,
    nombre: producto.nombre,
    precioCentavos: precioACentavos(producto.precio),
    cantidad: existente ? existente.cantidad + 1 : 1,
  }
  const siguientes = existente
    ? items.map((item) => (item.id === producto.id ? nuevoItem : item))
    : [...items, nuevoItem]
  calcularSubtotalCentavos(siguientes)
  return siguientes
}

export function cambiarCantidad(items, productoId, valor) {
  const cantidad = validarCantidad(valor)
  const siguientes = items.map((item) =>
    item.id === productoId ? { ...item, cantidad } : item,
  )
  calcularSubtotalCentavos(siguientes)
  return siguientes
}

export function quitarDelCarrito(items, productoId) {
  return items.filter((item) => item.id !== productoId)
}

// Mantiene precios y disponibilidad coherentes con el catálogo de la sesión.
// Esta comprobación de frontend no reemplaza la validación futura del servidor.
export function sincronizarCarrito(items, productos) {
  const siguientes = items.flatMap((item) => {
    const producto = productos.find(
      (candidato) =>
        candidato.id === item.id &&
        candidato.emprendimientoId === item.emprendimientoId,
    )
    if (!producto || producto.visible !== true) return []
    return [
      {
        ...item,
        nombre: producto.nombre,
        precioCentavos: precioACentavos(producto.precio),
      },
    ]
  })
  calcularSubtotalCentavos(siguientes)
  return siguientes
}

const formato = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
})

export function formatearCentavos(centavos) {
  return formato.format(centavos / 100)
}
