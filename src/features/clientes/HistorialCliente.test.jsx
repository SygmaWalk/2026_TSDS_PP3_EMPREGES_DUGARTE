import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import HistorialCliente from './HistorialCliente.jsx'
const pedido = {id:42,fecha_creacion:'2026-10-11T12:00:00Z',nombre_contacto:'Ana original',telefono_contacto:'1112345678',estado:'Pendiente',estado_pago:'Pendiente',subtotal:1500,total:1500,detalles_pedido:[],entrega:{modalidad:'retiro'}}
test('abre el pedido dentro de la ficha y vuelve al historial', async () => {
 const repository={historial:vi.fn().mockResolvedValue({pedidos:[pedido],total:1}),detallePedido:vi.fn().mockResolvedValue(pedido)}
 render(<HistorialCliente clienteId={7} repository={repository}/>)
 await userEvent.click(await screen.findByRole('button',{name:'Ver pedido #42'}))
 expect(await screen.findByText('Productos del pedido')).toBeVisible()
 expect(repository.detallePedido).toHaveBeenCalledWith(42,7)
 expect(screen.queryByRole('button',{name:/Pasar a/})).not.toBeInTheDocument()
 await userEvent.click(screen.getByRole('button',{name:'← Volver al historial del cliente'}))
 expect(await screen.findByRole('button',{name:'Ver pedido #42'})).toBeVisible()
})
test('pagina historial y permite recuperarse de un error', async () => {
 const repository={historial:vi.fn().mockResolvedValueOnce({pedidos:[pedido],total:26}).mockRejectedValueOnce(Error('Sin conexión')).mockResolvedValue({pedidos:[],total:26})}
 render(<HistorialCliente clienteId={7} repository={repository}/>)
 const nav=await screen.findByRole('navigation',{name:'Páginas del historial'})
 await userEvent.click(await within(nav).findByRole('button',{name:'Más pedidos'}))
 expect(await screen.findByRole('alert')).toHaveTextContent('Sin conexión')
 await userEvent.click(screen.getByRole('button',{name:'Actualizar historial'}))
 expect(await screen.findByText('Este cliente todavía no tiene pedidos asociados.')).toBeVisible()
 expect(repository.historial).toHaveBeenLastCalledWith(7,1)
})
