import {render,screen,act} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {useState} from 'react'
import {test,expect,vi} from 'vitest'
import EntregaPedido from '../entregas/EntregaPedido.jsx'
import {cargarDirecciones} from './direccionesRepository.js'
vi.mock('./direccionesRepository.js',()=>({cargarDirecciones:vi.fn()}))
vi.mock('../entregas/MapaPuntoLazy.jsx',()=>({default:()=>null}))
const casa={id:'casa',nombre:'Casa',direccion:'Primera calle 123',referencia:'Piso 1',latitud:0,longitud:0,predeterminada:true}
const trabajo={...casa,id:'trabajo',nombre:'Trabajo',direccion:'Otra calle 456',latitud:1,predeterminada:false}
const client={from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{direccion_origen:'Origen',latitud:0,longitud:0,modalidad:'zonas',zonas:[],franjas:[]}})})})}),rpc:vi.fn().mockResolvedValue({data:{franja:'Centro',distancia_m:0,costo_centavos:15000}})}
function Form(){const [valor,onChange]=useState({modalidad:'envio',direccion:'',referencia:'',punto:null,cotizacion:null});return <EntregaPedido client={client} negocio={{id:1}} valor={valor} onChange={onChange} subtotal={100000}/>}
test('cotiza la predeterminada y al cambiar espera la tarifa del nuevo destino',async()=>{
 let responder
 client.rpc.mockResolvedValueOnce({data:{franja:'Centro',distancia_m:0,costo_centavos:15000}})
   .mockImplementationOnce(()=>new Promise(r=>{responder=r}))
 cargarDirecciones.mockResolvedValue([casa,trabajo])
 render(<Form/>)
 expect(await screen.findByText(/Dentro de cobertura · Centro/)).toBeVisible()
 expect(screen.getByLabelText('Referencia (opcional)')).toHaveValue('Piso 1')
 await userEvent.selectOptions(screen.getByLabelText('Mis direcciones guardadas'),'trabajo')
 expect(screen.getByLabelText('Dirección de entrega')).toHaveValue(trabajo.direccion)
 expect(screen.queryByText(/Dentro de cobertura/)).not.toBeInTheDocument()
 await act(async()=>responder({data:{franja:'Norte',distancia_m:500,costo_centavos:30000}}))
 expect(await screen.findByText(/Dentro de cobertura · Norte/)).toBeVisible()
})
test('una carga tardía no reemplaza una dirección que el usuario está escribiendo',async()=>{
 let resolver;cargarDirecciones.mockReturnValue(new Promise(r=>{resolver=r}));render(<Form/>);await userEvent.type(screen.getByLabelText('Dirección de entrega'),'Mi dirección nueva');await act(async()=>resolver([casa]));expect(screen.getByLabelText('Dirección de entrega')).toHaveValue('Mi dirección nueva')
})
