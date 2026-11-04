
import {expect,test} from 'vitest'
import {validarDesglose,centavosImporte} from './desglosePago.js'
test('suma importes exactos en centavos y admite coma decimal',()=>{
 expect(validarDesglose('0,10','0.20',0.30)).toEqual({efectivo:0.1,transferencia:0.2})
 expect(centavosImporte('12,34')).toBe(1234)
})
test.each(['-1','1.001','NaN','Infinity','1e3','','1.000,50'])('rechaza importe inválido %s',valor=>{
 expect(()=>validarDesglose(valor,'1',10)).toThrow()
})
test('rechaza cobro parcial, exceso y ceros en un pago mixto',()=>{
 for(const [e,t]of [['4','5'],['6','5'],['0','10']])expect(()=>validarDesglose(e,t,10)).toThrow()
})
