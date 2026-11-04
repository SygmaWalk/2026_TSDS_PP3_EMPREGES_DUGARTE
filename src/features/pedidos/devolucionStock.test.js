import {describe,it,expect} from 'vitest'
import {cantidadesDevolucion} from './devolucionStock.js'
describe('Devolución selectiva de existencias',()=>{
 const consumos=[{producto_id:1,cantidad:2},{producto_id:2,cantidad:5}]
 it('permite devolver parcialmente y conservar el resto consumido',()=>{expect(cantidadesDevolucion(consumos,{1:'1,125'})).toEqual([{producto_id:1,cantidad:1.125},{producto_id:2,cantidad:0}])})
 it.each(['3','-1','NaN','1.0001'])('rechaza cantidades inválidas: %s',valor=>{expect(()=>cantidadesDevolucion(consumos,{1:valor})).toThrow()})
})
