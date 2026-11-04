import { render,screen,act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect,test,vi,beforeEach } from 'vitest'
import { prepararConfiguracion } from './entregasRepository.js'
import ConfirmarPedido from '../pedidos/ConfirmarPedido.jsx'
vi.mock('./MapaPuntoLazy.jsx',()=>({default:({onChange})=><button type="button" onClick={()=>onChange({latitud:0,longitud:0.001})}>Marcar punto de prueba</button>}))
const config={direccion_origen:'Origen de prueba',latitud:0,longitud:0,franjas:[{hasta_m:1000,tarifa_centavos:20000}]}
const quote={costo_centavos:20000,version:'version-1',franja:'Franja 1',distancia_m:111.2}
beforeEach(()=>sessionStorage.clear())
function montar(rpc){
 const client={rpc,from:()=>({select:()=>({eq:()=>({maybeSingle:()=>Promise.resolve({data:config})})})})}
 render(<ConfirmarPedido client={client} negocio={{id:1,nombre:'Tienda'}} items={[{id:2,nombre:'Pan',cantidad:1,precioCentavos:100000}]} clave="qa-envio" onConfirmado={vi.fn()} onVolver={vi.fn()}/>)
}
async function completar(){
 const user=userEvent.setup()
 await user.type(screen.getByLabelText('Nombre de contacto'),'Cliente QA')
 await user.type(screen.getByLabelText('Teléfono de contacto'),'1123456789')
 await user.selectOptions(screen.getByLabelText('¿Cómo pensás pagar?'),'Efectivo')
 await user.selectOptions(screen.getByLabelText('Modalidad de entrega'),'envio')
 await user.type(screen.getByLabelText('Dirección de entrega'),'Destino de prueba 123')
 await user.click(await screen.findByRole('button',{name:'Marcar punto de prueba'}))
 return user
}
test('convierte km y pesos sin truncar decimales y permite envío gratuito',()=>{
 expect(prepararConfiguracion(1,'Origen 123',{latitud:0,longitud:0},[{km:'1,125',precio:'0'},{km:'2',precio:'12,34'}]).franjas).toEqual([{hasta_m:1125,tarifa_centavos:0},{hasta_m:2000,tarifa_centavos:1234}])
})
test('rechaza franjas iguales, decrecientes, negativas y fuera del límite',()=>{
 for(const filas of [[{km:'1',precio:'0'},{km:'1',precio:'2'}],[{km:'2',precio:'0'},{km:'1',precio:'2'}],[{km:'1',precio:'-1'}],[{km:'101',precio:'0'}],[{km:'1',precio:'0.001'}]]) expect(()=>prepararConfiguracion(1,'Origen 123',{latitud:0,longitud:0},filas)).toThrow()
})
test('exige cotización y la invalida al cambiar dirección o punto',async()=>{
 const rpc=vi.fn().mockResolvedValue({data:quote});montar(rpc);const user=await completar()
 const confirmar=screen.getByRole('button',{name:'Confirmar pedido',exact:true})
 expect(confirmar).toBeDisabled()
 await user.click(screen.getByRole('button',{name:'Calcular envío'}));expect(confirmar).toBeEnabled()
 await user.type(screen.getByLabelText('Dirección de entrega'),' A');expect(confirmar).toBeDisabled()
 await user.click(screen.getByRole('button',{name:'Calcular envío'}));expect(confirmar).toBeEnabled()
 await user.click(screen.getByRole('button',{name:'Marcar punto de prueba'}));expect(confirmar).toBeDisabled()
})
test('ignora cotización tardía si cambia el destino',async()=>{
 let resolver;const rpc=vi.fn(()=>new Promise(r=>{resolver=r}));montar(rpc);const user=await completar()
 await user.click(screen.getByRole('button',{name:'Calcular envío'}))
 await user.type(screen.getByLabelText('Dirección de entrega'),' cambiado')
 await act(async()=>resolver({data:quote}))
 expect(screen.getByRole('button',{name:'Confirmar pedido',exact:true})).toBeDisabled()
 expect(screen.queryByText(/Dentro de cobertura/)).not.toBeInTheDocument()
})
test('rechazo por cambio de tarifa exige recalcular antes de reenviar',async()=>{
 const rpc=vi.fn().mockResolvedValueOnce({data:quote}).mockResolvedValueOnce({error:{code:'22023',message:'Cambió la configuración o el costo del envío.'}})
 montar(rpc);const user=await completar()
 await user.click(screen.getByRole('button',{name:'Calcular envío'}))
 await user.click(screen.getByRole('button',{name:'Confirmar pedido',exact:true}))
 expect(await screen.findByRole('alert')).toHaveTextContent('Cambió')
 expect(screen.getByRole('button',{name:'Confirmar pedido',exact:true})).toBeDisabled()
 expect(rpc.mock.calls[1][1].p_contacto.entrega).toMatchObject({modalidad:'envio',direccion:'Destino de prueba 123',latitud:0,longitud:0.001,costo_centavos:20000,version:'version-1'})
})
test('fuera de cobertura deja el pedido sin confirmar',async()=>{
 const rpc=vi.fn().mockResolvedValue({error:{code:'22023',message:'El punto está fuera de la cobertura.'}})
 montar(rpc);const user=await completar();await user.click(screen.getByRole('button',{name:'Calcular envío'}))
 expect(await screen.findByRole('alert')).toHaveTextContent('fuera de la cobertura')
 expect(screen.getByRole('button',{name:'Confirmar pedido',exact:true})).toBeDisabled()
})

test('recupera dirección y modalidad tras recarga y rechazo definitivo de un intento pendiente',async()=>{
 const intento={p_clave:'intento-pendiente',p_negocio:1,p_contacto:{nombre:'Cliente QA',telefono:'1123456789',entrega:{modalidad:'envio',direccion:'Destino conservado 123',referencia:'Piso 2',latitud:0,longitud:0.001,costo_centavos:20000,version:'anterior'}},p_items:[{producto_id:2,cantidad:1,precio_centavos:100000}]}
 sessionStorage.setItem('qa-envio',JSON.stringify({estado:'pendiente',intento,resumen:[{producto_id:2,nombre:'Pan',cantidad:1,precio_centavos:100000}]}))
 const rpc=vi.fn().mockResolvedValue({error:{code:'22023',message:'Cambió la configuración del envío.'}});montar(rpc)
 expect(screen.getByText('Destino conservado 123')).toBeVisible()
 await userEvent.click(screen.getByRole('button',{name:'Reintentar confirmación'}))
 expect(await screen.findByLabelText('Dirección de entrega')).toHaveValue('Destino conservado 123')
 expect(screen.getByLabelText('Modalidad de entrega')).toHaveValue('envio')
 expect(screen.getByRole('button',{name:'Confirmar pedido',exact:true})).toBeDisabled()
 expect(rpc).toHaveBeenCalledWith('confirmar_pedido',intento)
})
test('comprobante histórico muestra dirección y total con envío tras recarga',()=>{
 sessionStorage.setItem('qa-envio',JSON.stringify({estado:'confirmado',recibo:{id:1,estado:'Pendiente',fecha:'2026-10-01T13:00:00Z',items:[],subtotal_centavos:100000,costo_envio_centavos:20000,total_centavos:120000,entrega:{modalidad:'envio',direccion:'Destino histórico 123',latitud:0,longitud:0.001,distancia_m:111.2,franja:'Franja 1'}}}))
 const rpc=vi.fn();montar(rpc)
 expect(screen.getByText('Destino histórico 123')).toBeVisible()
 expect(screen.getByText('Total del pedido').parentElement).toHaveTextContent('1.200,00')
 expect(rpc).not.toHaveBeenCalled()
})
