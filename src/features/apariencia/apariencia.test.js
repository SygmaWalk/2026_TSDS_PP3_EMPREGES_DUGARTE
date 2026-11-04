import {expect,test} from 'vitest'
import {validarColores,paraPlantilla} from './apariencia.js'
import {configuracionTienda} from '../catalogo/plantillaTienda.js'
test.each([['#9f2144','#faf8f4'],['#204c3b','#ffffff'],['#000000','#ffffff']])('acepta combinación legible %s/%s',(p,f)=>expect(()=>validarColores(p,f)).not.toThrow())
test.each([['#ffffff','#faf8f4'],['#9f2144','#000000'],['red','#ffffff'],['#zzzzzz','#ffffff'],['#999999','#ffffff']])('rechaza combinación ilegible %s/%s',(p,f)=>expect(()=>validarColores(p,f)).toThrow())
test('normaliza configuración para plantilla y descarta imágenes de otro negocio',()=>{
 const config=configuracionTienda({id:1},paraPlantilla(1,{logo_path:'2/imagen.png',portada_path:null,color_principal:'#204c3b',color_fondo:'#ffffff'}))
 expect(config.logoPath).toBeNull()
 expect(config.colorPrincipal).toBe('#204c3b')
})
