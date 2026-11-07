import { expect, test } from 'vitest'
import { incorporarHabituales } from './pedidoHabitual.js'
const producto = { id: 1, emprendimientoId: 2, nombre: 'Pizza', precio: 900, visible: true, stockDisponible: 5 }
test('agrega cantidades al carrito y omite productos no disponibles', () => {
  const items = incorporarHabituales([], [{ id: 1, cantidad: 2, disponible: true, precioCentavos: 90000 }, { id: 99, cantidad: 1, disponible: false }], [producto])
  expect(items).toHaveLength(1)
  expect(items[0]).toMatchObject({ cantidad: 2, precioCentavos: 90000 })
  expect(incorporarHabituales(items, [{ id: 1, cantidad: 2, disponible: true, precioCentavos: 90000 }], [producto])[0].cantidad).toBe(4)
})
test('rechaza stock insuficiente sin modificar el carrito anterior', () => {
  const items = incorporarHabituales([], [{ id: 1, cantidad: 4, disponible: true, precioCentavos: 90000 }], [producto])
  expect(() => incorporarHabituales(items, [{ id: 1, cantidad: 2, disponible: true, precioCentavos: 90000 }], [producto])).toThrow(/disponibles/)
  expect(items[0].cantidad).toBe(4)
})

test('rechaza precio obsoleto aunque el producto siga visible',()=>{expect(()=>incorporarHabituales([],[{id:1,cantidad:1,disponible:true,precioCentavos:80000}],[producto])).toThrow(/precio/)})
test('usa stock actualizado al combinar sugerencia con el carrito',()=>{const items=incorporarHabituales([],[{id:1,cantidad:2,disponible:true,precioCentavos:90000}],[producto]);expect(()=>incorporarHabituales(items,[{id:1,cantidad:2,disponible:true,precioCentavos:90000}],[{...producto,stockDisponible:3}])).toThrow(/disponibles/);expect(items[0].cantidad).toBe(2)})
