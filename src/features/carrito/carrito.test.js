// @vitest-environment node
import { describe, expect, test } from 'vitest'
import {
  agregarAlCarrito,
  cambiarCantidad,
  quitarDelCarrito,
  calcularSubtotalCentavos,
  sincronizarCarrito,
  validarCantidad,
} from './carrito.js'

const producto = {
  id: 'p1',
  emprendimientoId: 1,
  nombre: 'Tequeños',
  precio: 1000,
  visible: true,
}

describe('ND2026-5: reglas del carrito', () => {
  test('CP-CAR-01: agrega un producto sin modificar el carrito anterior', () => {
    const original = []
    const carrito = agregarAlCarrito(original, producto)
    expect(original).toEqual([])
    expect(carrito).toEqual([
      expect.objectContaining({
        id: 'p1',
        cantidad: 1,
        precioCentavos: 100000,
      }),
    ])
  })

  test('CP-CAR-02: agregar el mismo producto incrementa la cantidad sin duplicar filas', () => {
    const carrito = agregarAlCarrito(agregarAlCarrito([], producto), producto)
    expect(carrito).toHaveLength(1)
    expect(carrito[0].cantidad).toBe(2)
  })

  test('CP-CAR-03: dos unidades de 1000 y una de 1500 suman 3500', () => {
    let carrito = agregarAlCarrito([], producto)
    carrito = cambiarCantidad(carrito, 'p1', '2')
    carrito = agregarAlCarrito(carrito, { ...producto, id: 'p2', precio: 1500 })
    expect(calcularSubtotalCentavos(carrito)).toBe(350000)
  })

  test('CP-CAR-04: quitar el último producto deja subtotal cero', () => {
    const carrito = quitarDelCarrito(agregarAlCarrito([], producto), 'p1')
    expect(carrito).toEqual([])
    expect(calcularSubtotalCentavos(carrito)).toBe(0)
  })

  test.each([
    '',
    '0',
    '-1',
    '1.5',
    'abc',
    'Infinity',
    '1e2',
    '9007199254740992',
  ])(
    'CP-CAR-05: rechaza cantidad inválida %j sin cambiar el estado anterior',
    (cantidad) => {
      const carrito = agregarAlCarrito([], producto)
      expect(() => cambiarCantidad(carrito, 'p1', cantidad)).toThrow(
        'cantidad entera',
      )
      expect(carrito[0].cantidad).toBe(1)
    },
  )

  test('CP-CAR-06: calcula 0,10 + 0,20 exactamente en centavos', () => {
    const carrito = agregarAlCarrito(
      agregarAlCarrito([], { ...producto, precio: 0.1 }),
      { ...producto, id: 'p2', precio: 0.2 },
    )
    expect(calcularSubtotalCentavos(carrito)).toBe(30)
  })

  test('CP-CAR-07: rechaza productos ocultos', () => {
    expect(() => agregarAlCarrito([], { ...producto, visible: false })).toThrow(
      'no está disponible',
    )
  })

  test('CP-CAR-08: impide mezclar emprendimientos aunque coincida el identificador del producto', () => {
    const carrito = agregarAlCarrito([], producto)
    expect(() =>
      agregarAlCarrito(carrito, { ...producto, emprendimientoId: 2 }),
    ).toThrow('mismo emprendimiento')
  })

  test('CP-CAR-09: al vaciar el carrito permite elegir otro emprendimiento', () => {
    const vacio = quitarDelCarrito(agregarAlCarrito([], producto), 'p1')
    expect(
      agregarAlCarrito(vacio, { ...producto, emprendimientoId: 2 })[0]
        .emprendimientoId,
    ).toBe(2)
  })

  test('CP-CAR-10: rechaza un subtotal fuera del rango de enteros seguros', () => {
    const carrito = agregarAlCarrito([], producto)
    expect(() =>
      cambiarCantidad(carrito, 'p1', Number.MAX_SAFE_INTEGER),
    ).toThrow('límite de cálculo')
  })

  test('CP-CAR-11: refleja precio y nombre actuales conservando la cantidad', () => {
    const carrito = cambiarCantidad(agregarAlCarrito([], producto), 'p1', 2)
    const actualizado = sincronizarCarrito(carrito, [
      { ...producto, nombre: 'Minis', precio: 1500 },
    ])
    expect(actualizado[0]).toEqual(
      expect.objectContaining({ nombre: 'Minis', cantidad: 2 }),
    )
    expect(calcularSubtotalCentavos(actualizado)).toBe(300000)
  })

  test('CP-CAR-12: retira productos ocultos, eliminados o de otra tienda al sincronizar', () => {
    const carrito = agregarAlCarrito([], producto)
    expect(
      sincronizarCarrito(carrito, [{ ...producto, visible: false }]),
    ).toEqual([])
    expect(sincronizarCarrito(carrito, [])).toEqual([])
    expect(
      sincronizarCarrito(carrito, [{ ...producto, emprendimientoId: 2 }]),
    ).toEqual([])
  })

  test('acepta cantidades enteras con espacios exteriores', () => {
    expect(validarCantidad(' 12 ')).toBe(12)
  })
})
