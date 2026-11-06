import {expect,test} from 'vitest'
import {limitesEntre,prepararZonas} from './zonas.js'
const zona={nombre:'Centro',precio:'12,50',sur:0,norte:1,oeste:0,este:1}
test('ordena esquinas sin depender del sentido del dibujo',()=>expect(limitesEntre({latitud:1,longitud:0},{latitud:0,longitud:1})).toEqual({sur:0,norte:1,oeste:0,este:1}))
test('convierte tarifa y permite zonas contiguas',()=>expect(prepararZonas([zona,{...zona,oeste:1,este:2,precio:'0'}]).map(z=>z.tarifa_centavos)).toEqual([1250,0]))
test('rechaza superposiciones y rectángulos vacíos',()=>{expect(()=>prepararZonas([zona,{...zona,sur:.5,norte:2}])).toThrow(/superponen/);expect(()=>prepararZonas([{...zona,norte:0}])).toThrow(/esquinas/);expect(()=>prepararZonas([{...zona,precio:'1.001'}])).toThrow(/tarifa/)})
