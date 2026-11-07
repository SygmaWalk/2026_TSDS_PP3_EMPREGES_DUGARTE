import {render,screen} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {test,expect,vi} from 'vitest'
import PedidoHabitual from './PedidoHabitual.jsx'
test('consulta privada, revisa y revalida antes de agregar sin confirmar pedido',async()=>{
 const data={pedidos:3,minimo:3,items:[{id:1,nombre:'Pizza',cantidad:1,veces:3,precioCentavos:90000,disponible:true}]}
 const client={rpc:vi.fn().mockResolvedValue({data})},onAgregar=vi.fn()
 render(<PedidoHabitual client={client} negocioId={2} onAgregar={onAgregar}/> )
 await userEvent.click(screen.getByRole('button',{name:'Ver mi pedido habitual'}))
 expect(await screen.findByText('Pizza')).toBeVisible()
 expect(onAgregar).not.toHaveBeenCalled()
 await userEvent.click(screen.getByRole('button',{name:'Agregar sugerencia al carrito'}))
 expect(client.rpc).toHaveBeenCalledTimes(2)
 expect(client.rpc).toHaveBeenLastCalledWith('mi_pedido_habitual',{p_negocio:2})
 expect(onAgregar).toHaveBeenCalledWith(data.items)
})

test('si falla la actualización del catálogo conserva el carrito',async()=>{
 const data={pedidos:3,minimo:3,items:[{id:1,nombre:'Pizza',cantidad:1,veces:3,precioCentavos:90000,disponible:true}]}
 const client={rpc:vi.fn().mockResolvedValue({data})},onAgregar=vi.fn(),cargarProductos=vi.fn().mockRejectedValue(Error('No se pudo actualizar el catálogo.'))
 render(<PedidoHabitual client={client} negocioId={2} onAgregar={onAgregar} cargarProductos={cargarProductos}/> )
 await userEvent.click(screen.getByRole('button',{name:'Ver mi pedido habitual'}));await screen.findByText('Pizza')
 await userEvent.click(screen.getByRole('button',{name:'Agregar sugerencia al carrito'}));expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo actualizar');expect(onAgregar).not.toHaveBeenCalled()
})
