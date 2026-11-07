import { agregarAlCarrito, cambiarCantidad, precioACentavos } from '../carrito/carrito.js'

export function incorporarHabituales(items, sugeridos, productos) {
  let siguientes = items
  for (const sugerido of sugeridos.filter(s => s.disponible)) {
    const producto = productos.find(p => p.id === sugerido.id)
    if (!producto || producto.archivado || !producto.visible) throw Error('Un producto cambió. Actualizá el catálogo y volvé a consultar la sugerencia.')
    if (sugerido.precioCentavos !== precioACentavos(producto.precio)) throw Error('Cambió el precio de un producto. Consultá nuevamente la sugerencia antes de agregarla.')
    const anterior = siguientes.find(i => i.id === producto.id)?.cantidad ?? 0
    siguientes = cambiarCantidad(agregarAlCarrito(siguientes, producto), producto.id, anterior + sugerido.cantidad)
  }
  return siguientes
}
