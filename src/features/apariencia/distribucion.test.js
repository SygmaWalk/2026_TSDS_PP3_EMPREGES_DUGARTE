import {expect,test} from 'vitest'
import {ordenarProductos,moverProducto} from './distribucion.js'
const productos=[{id:3},{id:1},{id:2}]
test('ordena por alta cuando no hay configuración',()=>expect(ordenarProductos(productos).map(p=>p.id)).toEqual([1,2,3]))
test('respeta orden guardado y agrega productos nuevos al final',()=>expect(ordenarProductos([...productos,{id:4}],[3,1]).map(p=>p.id)).toEqual([3,1,2,4]))
test('ocultar o eliminar no altera el orden relativo',()=>expect(ordenarProductos([{id:3},{id:2}],[3,1,2]).map(p=>p.id)).toEqual([3,2]))
test('tolera configuración ausente o antigua',()=>expect(ordenarProductos(productos,null).map(p=>p.id)).toEqual([1,2,3]))
test('mueve sin mutar la entrada ni omitir productos ocultos',()=>{const order=[3,1,2];expect(moverProducto(productos,order,1,-1)).toEqual([1,3,2]);expect(order).toEqual([3,1,2])})
test('conserva los extremos',()=>{expect(moverProducto(productos,[],1,-1)).toEqual([1,2,3]);expect(moverProducto(productos,[],3,1)).toEqual([1,2,3])})
