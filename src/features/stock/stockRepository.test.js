import {expect,test} from 'vitest'
import {cantidadStock} from './stockRepository.js'
test('cantidades admiten hasta tres decimales y coma',()=>{
 expect(cantidadStock('2,125')).toBe(2.125)
 expect(cantidadStock('24')).toBe(24)
})
test.each(['0','-1','1.0001','NaN','Infinity','1e3','',1000000000])('rechaza cantidad inválida %s',valor=>{
 expect(()=>cantidadStock(valor)).toThrow()
})
