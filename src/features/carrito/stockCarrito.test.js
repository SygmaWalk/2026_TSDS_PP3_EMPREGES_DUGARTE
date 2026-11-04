import {it,expect} from 'vitest'
import {agregarAlCarrito,cambiarCantidad} from './carrito.js'
import {recuperarCarrito,guardarCarrito} from './carritoStorage.js'
const producto={id:1,emprendimientoId:1,nombre:'Bebida',precio:100,visible:true,stockDisponible:1}
it('no admite comprar más unidades disponibles',()=>{
 expect(()=>agregarAlCarrito([],{...producto,stockDisponible:0})).toThrow()
 const items=agregarAlCarrito([],producto)
 expect(()=>agregarAlCarrito(items,producto)).toThrow()
 expect(()=>cambiarCantidad(items,1,2)).toThrow()
})
it('ajusta el carrito persistido cuando disminuyen las existencias',()=>{
 guardarCarrito('stock-test',[{id:1,cantidad:3}])
 const resultado=recuperarCarrito('stock-test',[producto])
 expect(resultado.items[0].cantidad).toBe(1)
 expect(resultado.aviso).toContain('existencias actuales')
 const agotado=recuperarCarrito('stock-test',[{...producto,stockDisponible:0}])
 expect(agotado.items).toEqual([])
 window.localStorage.removeItem('stock-test')
})
