import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import ConfirmarPedido from './ConfirmarPedido.jsx'
import { claveConfirmacion, leerConfirmacion } from './pedidosRepository.js'
const negocio={id:71,nombre:'Tienda A'}
const items=[{id:3,nombre:'Pan de campo',cantidad:2,precioCentavos:100050}]
const clave=claveConfirmacion('tienda-a')
const recibo={id:12,estado:'Pendiente',fecha:'2026-10-01T13:00:00Z',subtotal_centavos:200100,items:[{producto_id:3,nombre:'Pan de campo',cantidad:2,precio_centavos:100050}]}
beforeEach(()=>sessionStorage.clear())
function montar(client,extra={}){return render(<ConfirmarPedido client={client} negocio={negocio} items={items} clave={clave} onConfirmado={vi.fn()} onVolver={vi.fn()} {...extra}/>)}
async function completar(){
 const user=userEvent.setup()
 await user.type(screen.getByLabelText('Nombre de contacto'),'Cliente QA')
 await user.type(screen.getByLabelText('Teléfono de contacto'),'+54 (11) 1234-5678')
 await user.selectOptions(screen.getByLabelText('¿Cómo pensás pagar?'),'Transferencia')
 return user
}
test('carrito vacío no puede enviarse',()=>{
 const rpc=vi.fn();montar({rpc},{items:[]})
 expect(screen.getByRole('button',{name:'Confirmar pedido',exact:true})).toBeDisabled()
 expect(rpc).not.toHaveBeenCalled()
})
test('teléfono inválido se informa sin enviar datos',async()=>{
 const rpc=vi.fn();montar({rpc})
 const user=await completar()
 await user.clear(screen.getByLabelText('Teléfono de contacto'))
 await user.type(screen.getByLabelText('Teléfono de contacto'),'abc')
 await user.click(screen.getByRole('button',{name:'Confirmar pedido',exact:true}))
 expect(screen.getByRole('alert')).toHaveTextContent('teléfono válido')
 expect(rpc).not.toHaveBeenCalled()
})
test('doble clic envía una solicitud y solo vacía el carrito después de confirmar',async()=>{
 let resolver
 const rpc=vi.fn(()=>new Promise(resolve=>{resolver=resolve}))
 const onConfirmado=vi.fn();montar({rpc},{onConfirmado})
 const user=await completar()
 await user.dblClick(screen.getByRole('button',{name:'Confirmar pedido',exact:true}))
 expect(rpc).toHaveBeenCalledTimes(1);expect(onConfirmado).not.toHaveBeenCalled()
 expect(rpc.mock.calls[0][1]).toMatchObject({p_negocio:71,p_contacto:{nombre:'Cliente QA',telefono:'+541112345678',metodo_pago:'Transferencia'},p_items:[{producto_id:3,cantidad:2,precio_centavos:100050}]})
 resolver({data:recibo,error:null})
 expect(await screen.findByRole('heading',{name:'Tu pedido quedó registrado'})).toBeVisible()
 expect(onConfirmado).toHaveBeenCalledTimes(1)
 expect(leerConfirmacion(clave).estado).toBe('confirmado')
})
test('respuesta perdida conserva datos y UUID al recargar y reintentar',async()=>{
 const rpc=vi.fn().mockRejectedValueOnce(new Error('red')).mockResolvedValueOnce({data:recibo,error:null})
 const onConfirmado=vi.fn();let vista=montar({rpc},{onConfirmado})
 const user=await completar()
 await user.click(screen.getByRole('button',{name:'Confirmar pedido',exact:true}))
 expect(await screen.findByRole('alert')).toHaveTextContent('sin duplicar')
 expect(onConfirmado).not.toHaveBeenCalled()
 const primero=rpc.mock.calls[0][1]
 vista.unmount();vista=montar({rpc},{onConfirmado})
 expect(screen.getByLabelText('Nombre de contacto')).toBeDisabled()
 await user.click(screen.getByRole('button',{name:'Reintentar confirmación'}))
 expect(await screen.findByRole('heading',{name:'Tu pedido quedó registrado'})).toBeVisible()
 expect(rpc.mock.calls[1][1]).toEqual(primero)
 vista.unmount()
})
test('rechazo por precio permite volver al carrito sin perder la selección',async()=>{
 const rpc=vi.fn().mockResolvedValue({data:null,error:{code:'22023',message:'Cambió el precio. Actualizá el catálogo.'}})
 const onConfirmado=vi.fn(),onVolver=vi.fn();montar({rpc},{onConfirmado,onVolver})
 const user=await completar();await user.click(screen.getByRole('button',{name:'Confirmar pedido',exact:true}))
 expect(await screen.findByRole('alert')).toHaveTextContent('Cambió el precio')
 expect(onConfirmado).not.toHaveBeenCalled()
 expect(leerConfirmacion(clave)).toBeNull()
 await user.click(screen.getByRole('button',{name:'Volver al carrito'}))
 expect(onVolver).toHaveBeenCalledWith('carrito')
})
test('el recibo se conserva tras recarga sin realizar un nuevo envío',()=>{
 sessionStorage.setItem(clave,JSON.stringify({estado:'confirmado',recibo,negocio}))
 const rpc=vi.fn();montar({rpc})
 expect(screen.getByRole('heading',{name:'Tu pedido quedó registrado'})).toBeVisible()
 expect(screen.getByText('Pedido #12')).toBeVisible()
 expect(rpc).not.toHaveBeenCalled()
})
test('si no puede conservar el intento, no envía el pedido',async()=>{
 const rpc=vi.fn();montar({rpc});const user=await completar()
 const spy=vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new Error('sin almacenamiento')})
 try{
  await user.click(screen.getByRole('button',{name:'Confirmar pedido',exact:true}))
  expect(screen.getByRole('alert')).toHaveTextContent('almacenamiento')
  expect(rpc).not.toHaveBeenCalled()
 }finally{spy.mockRestore()}
})


test('precarga el perfil sin reemplazar un intento pendiente recuperado', () => {
  const perfil = { nombre: 'Nombre nuevo', telefono: '1123456789', direccion: 'Calle nueva 123' }
  let vista = montar({ rpc: vi.fn() }, { perfil })
  expect(screen.getByLabelText('Nombre de contacto')).toHaveValue('Nombre nuevo')
  vista.unmount()
  sessionStorage.setItem(clave, JSON.stringify({ estado: 'pendiente', intento: { p_clave: 'intento-recuperado', p_contacto: { nombre: 'Nombre original', telefono: '1198765432' }, p_items: [] }, resumen: [] }))
  vista = montar({ rpc: vi.fn() }, { perfil })
  expect(screen.getByLabelText('Nombre de contacto')).toHaveValue('Nombre original')
  expect(screen.getByLabelText('Nombre de contacto')).toBeDisabled()
  vista.unmount()
})
