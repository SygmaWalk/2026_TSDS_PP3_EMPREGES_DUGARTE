import assert from 'node:assert/strict'
import test from 'node:test'
import {
  actualizarProducto,
  convertirPrecio,
  crearProducto,
  validarProducto,
} from './producto.js'

test('acepta precios con coma o punto y hasta dos decimales', () => {
  assert.equal(convertirPrecio('8500,50'), 8500.5)
  assert.equal(convertirPrecio('8500.50'), 8500.5)
  assert.equal(convertirPrecio('8500,505'), null)
})

test('normaliza los campos opcionales y el nombre', () => {
  const resultado = validarProducto({
    nombre: '  24 Minis  ',
    precio: '11000',
    descripcion: '   ',
    imagenPath: ' productos/minis.webp ',
  })

  assert.equal(resultado.esValido, true)
  assert.deepEqual(resultado.datosNormalizados, {
    nombre: '24 Minis',
    precio: 11000,
    descripcion: null,
    imagenPath: 'productos/minis.webp',
  })
})

test('rechaza nombre vacío y precios inválidos', () => {
  const resultado = validarProducto({ nombre: '   ', precio: '0' })

  assert.equal(resultado.esValido, false)
  assert.equal(resultado.errores.nombre, 'Ingresá el nombre del producto.')
  assert.equal(resultado.errores.precio, 'El precio debe ser mayor que cero.')
})

test('evita nombres duplicados sin distinguir mayúsculas ni espacios externos', () => {
  const existentes = [{ id: 'uno', nombre: '24 Minis' }]
  const alta = validarProducto(
    { nombre: '  24 MINIS ', precio: '12000' },
    existentes,
  )
  const edicionPropia = validarProducto(
    { nombre: '  24 MINIS ', precio: '12000' },
    existentes,
    'uno',
  )

  assert.equal(alta.esValido, false)
  assert.equal(edicionPropia.esValido, true)
})

test('un producto nuevo comienza oculto', () => {
  const producto = crearProducto(
    { nombre: '12 Minis', precio: 6000, descripcion: null, imagenPath: null },
    {
      generarId: () => 'producto-1',
      emprendimientoId: 7,
      ahora: '2026-09-10T00:00:00.000Z',
    },
  )

  assert.equal(producto.id, 'producto-1')
  assert.equal(producto.emprendimientoId, 7)
  assert.equal(producto.visible, false)
})

test('editar conserva identidad, pertenencia, visibilidad y fecha de creación', () => {
  const original = {
    id: 'producto-1',
    emprendimientoId: 7,
    nombre: '12 Minis',
    precio: 6000,
    visible: true,
    fechaCreacion: '2026-09-09T00:00:00.000Z',
    fechaModificacion: '2026-09-09T00:00:00.000Z',
  }
  const actualizado = actualizarProducto(
    original,
    { nombre: '24 Minis', precio: 11000 },
    { ahora: '2026-09-10T00:00:00.000Z' },
  )

  assert.equal(actualizado.id, original.id)
  assert.equal(actualizado.emprendimientoId, original.emprendimientoId)
  assert.equal(actualizado.visible, true)
  assert.equal(actualizado.fechaCreacion, original.fechaCreacion)
  assert.equal(actualizado.fechaModificacion, '2026-09-10T00:00:00.000Z')
})
