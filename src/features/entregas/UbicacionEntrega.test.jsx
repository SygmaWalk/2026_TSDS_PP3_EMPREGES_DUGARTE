import {render,screen} from '@testing-library/react'
import {expect,test,vi} from 'vitest'
import UbicacionEntrega from './UbicacionEntrega.jsx'
import {rutaEntrega} from './rutaEntrega.js'
vi.mock('./MapaPuntoLazy.jsx',()=>({default:({punto,origen,soloLectura})=><div data-testid="mapa" data-punto={JSON.stringify(punto)} data-origen={JSON.stringify(origen)} data-lectura={String(soloLectura)}/>}))
const entrega={modalidad:'envio',direccion:'Destino QA',latitud:-34.61,longitud:-58.39,origen:{direccion:'Origen histórico QA',latitud:-34.6,longitud:-58.38}}
test('detalle utiliza puntos históricos y mapa de consulta, sin contacto en enlace externo',()=>{
 render(<UbicacionEntrega entrega={{...entrega,telefono:'1123456789',nombre:'Cliente'}}/>)
 expect(screen.getByTestId('mapa')).toHaveAttribute('data-lectura','true')
 expect(JSON.parse(screen.getByTestId('mapa').getAttribute('data-origen'))).toEqual(entrega.origen)
 const link=screen.getByRole('link',{name:/Ver ruta en Google Maps/}),url=new URL(link.href)
 expect(url.origin+url.pathname).toBe('https://www.google.com/maps/dir/')
 expect([...url.searchParams.keys()]).toEqual(['api','origin','destination'])
 expect(url.searchParams.get('origin')).toBe('-34.6,-58.38')
 expect(url.searchParams.get('destination')).toBe('-34.61,-58.39')
 expect(link).toHaveAttribute('target','_blank')
 expect(link).toHaveAttribute('rel','noopener noreferrer')
})
test('sin origen guardado permite ver el destino pero no inventa una ruta',()=>{
 render(<UbicacionEntrega entrega={{...entrega,origen:null}}/>)
 expect(screen.getByTestId('mapa')).toBeInTheDocument()
 expect(screen.queryByRole('link')).not.toBeInTheDocument()
 expect(screen.getByText(/no tiene un origen válido/)).toBeVisible()
})
test('retiro, pedido antiguo y coordenadas inválidas no generan ruta',()=>{
 for(const dato of [null,{modalidad:'retiro'},{...entrega,latitud:null},{...entrega,longitud:181},{...entrega,origen:{latitud:'',longitud:0}}])expect(rutaEntrega(dato)).toBeNull()
 const vista=render(<UbicacionEntrega entrega={{...entrega,latitud:null}}/>)
 expect(screen.queryByTestId('mapa')).not.toBeInTheDocument()
 expect(screen.getByText(/no tiene un punto de entrega válido/)).toBeVisible()
 vista.rerender(<UbicacionEntrega entrega={{modalidad:'retiro'}}/>)
 expect(vista.container).toBeEmptyDOMElement()
})
