import {render,screen,fireEvent} from '@testing-library/react'
import {expect,test} from 'vitest'
import PlantillaTienda from './PlantillaTienda.jsx'
import {configuracionTienda} from './plantillaTienda.js'
test('ignora configuración de otra tienda',()=>{
 expect(configuracionTienda({id:1},{emprendimientoId:2,logoUrl:'/ajeno.png'}).logoUrl).toBeNull()
})
test('imágenes fallidas recuperan alternativas sin impedir la compra',()=>{
 render(<PlantillaTienda negocio={{id:1,nombre:'Mi tienda'}} publicada={{emprendimientoId:1,logoUrl:'/logo.png',portadaUrl:'/portada.png'}}><button>Comprar</button></PlantillaTienda>)
 fireEvent.error(screen.getByAltText('Logo de Mi tienda'))
 expect(screen.getByLabelText('Identidad de Mi tienda')).toHaveTextContent('M')
 expect(screen.queryByAltText('Logo de Mi tienda')).not.toBeInTheDocument()
 expect(screen.getByRole('button',{name:'Comprar'})).toBeVisible()
})
test('el salto de teclado enfoca contenido sin cambiar la ruta de tienda',()=>{
 render(<PlantillaTienda negocio={{id:1,nombre:'Mi tienda'}}><button>Comprar</button></PlantillaTienda>)
 const hash=location.hash
 fireEvent.click(screen.getByRole('button',{name:'Ir al contenido de la tienda'}))
 expect(document.getElementById('store-main-content')).toHaveFocus()
 expect(location.hash).toBe(hash)
})
