import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { claveCarrito, guardarCarrito, recuperarCarrito } from './carritoStorage.js'

const producto = { id: 1, emprendimientoId: 7, nombre: 'Tequeños', precio: 1500.50, visible: true }
const clave = claveCarrito('usuario-a', 7)
beforeEach(() => localStorage.clear())
afterEach(() => vi.restoreAllMocks())

test('CP-CAR-P01: guarda solo selección y cantidad, y recupera los datos vigentes del catálogo', () => {
  guardarCarrito(clave, [{ id: 1, cantidad: 2, precioCentavos: 1, nombre: 'viejo' }])
  expect(JSON.parse(localStorage.getItem(clave))).toEqual({ version: 1, items: [{ id: 1, cantidad: 2 }] })
  expect(recuperarCarrito(clave, [producto]).items).toEqual([{ id: 1, emprendimientoId: 7, nombre: 'Tequeños', cantidad: 2, precioCentavos: 150050 }])
})

test('CP-CAR-P02: separa carritos de cuentas y emprendimientos diferentes', () => {
  guardarCarrito(clave, [{ id: 1, cantidad: 2 }])
  expect(recuperarCarrito(claveCarrito('usuario-b', 7), [producto]).items).toEqual([])
  expect(recuperarCarrito(claveCarrito('usuario-a', 8), [producto]).items).toEqual([])
  expect(recuperarCarrito(clave, [producto]).items).toHaveLength(1)
})

test('CP-CAR-P03: descarta productos ocultos, inexistentes, cantidades inválidas y duplicados', () => {
  localStorage.setItem(clave, JSON.stringify({ version: 1, items: [
    { id: 1, cantidad: 2 }, { id: 1, cantidad: 3 }, { id: 2, cantidad: 1 },
    { id: 3, cantidad: 1 }, { id: 4, cantidad: 0 }, null,
    { id: 5, cantidad: Number.MAX_SAFE_INTEGER },
  ] }))
  const productos = [producto, { ...producto, id: 2, visible: false }, { ...producto, id: 4 }, { ...producto, id: 5 }]
  expect(recuperarCarrito(clave, productos).items).toEqual([expect.objectContaining({ id: 1, cantidad: 2 })])
})

test('CP-CAR-P04: un carrito vacío elimina la selección guardada', () => {
  guardarCarrito(clave, [{ id: 1, cantidad: 2 }])
  guardarCarrito(clave, [])
  expect(recuperarCarrito(clave, [producto]).items).toEqual([])
  expect(localStorage.getItem(clave)).toBeNull()
})

test('CP-CAR-P05: datos dañados o de otra versión no rompen la aplicación', () => {
  for (const texto of ['{roto', 'null', '{"version":2,"items":[]}']) {
    localStorage.setItem(clave, texto)
    expect(recuperarCarrito(clave, [producto])).toEqual({ items: [], aviso: expect.any(String) })
  }
})

test('CP-CAR-P06: informa restricciones de almacenamiento y conserva la operación en memoria', () => {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Quota') })
  expect(guardarCarrito(clave, [{ id: 1, cantidad: 2 }])).toContain('no pudo guardar')
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Security') })
  expect(recuperarCarrito(clave, [producto]).aviso).toContain('No se pudo recuperar')
})
