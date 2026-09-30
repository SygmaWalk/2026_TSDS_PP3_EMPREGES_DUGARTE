import { agregarAlCarrito, cambiarCantidad } from './carrito.js'

export function claveCarrito(usuarioId, emprendimientoId) {
  if (!usuarioId || emprendimientoId == null) return null
  return `empregest:carrito:v1:${encodeURIComponent(usuarioId)}:${encodeURIComponent(emprendimientoId)}`
}

export function recuperarCarrito(clave, productos) {
  if (!clave) return { items: [], aviso: '' }
  try {
    const texto = window.localStorage.getItem(clave)
    if (!texto) return { items: [], aviso: '' }
    const guardado = JSON.parse(texto)
    if (guardado.version !== 1 || !Array.isArray(guardado.items)) throw new Error('Formato inválido')
    let items = []
    for (const seleccion of guardado.items) {
      if (!seleccion || !Number.isSafeInteger(seleccion.cantidad) || seleccion.cantidad < 1) continue
      const producto = productos.find(actual => String(actual.id) === String(seleccion.id))
      if (!producto?.visible || items.some(item => item.id === producto.id)) continue
      try {
        // Nombres, precios y pertenencia siempre proceden del catálogo recién consultado.
        items = cambiarCantidad(agregarAlCarrito(items, producto), producto.id, seleccion.cantidad)
      } catch {
        // Se descarta solo la selección incompatible o fuera del rango de cálculo seguro.
      }
    }
    return { items, aviso: '' }
  } catch {
    return { items: [], aviso: 'No se pudo recuperar el carrito guardado en este navegador.' }
  }
}

export function guardarCarrito(clave, items) {
  if (!clave) return ''
  try {
    if (items.length === 0) window.localStorage.removeItem(clave)
    else window.localStorage.setItem(clave, JSON.stringify({
      version: 1,
      items: items.map(({ id, cantidad }) => ({ id, cantidad })),
    }))
    return ''
  } catch {
    return 'El navegador no pudo guardar el carrito. Los últimos cambios podrían perderse al recargar.'
  }
}
