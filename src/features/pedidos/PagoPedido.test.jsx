import { render,screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {expect,test,vi} from 'vitest'
import PagoPedido from './PagoPedido.jsx'
const pedido={id:1,estado:'Pendiente',estado_pago:'Pendiente',metodo_pago:null,version_pago:0}
test('guardar método no registra cobro y confirmar requiere un paso explícito',async()=>{
 const repository={registrarPago:vi.fn().mockResolvedValue({})},actualizar=vi.fn()
 render(<PagoPedido pedido={pedido} puedeRegistrar repository={repository} onActualizar={actualizar}/>)
 expect(screen.getByRole('button',{name:'Marcar como pagado'})).toBeDisabled()
 await userEvent.selectOptions(screen.getByLabelText('Método de pago efectivo'),'Transferencia')
 await userEvent.click(screen.getByRole('button',{name:'Guardar método'}))
 expect(repository.registrarPago).toHaveBeenLastCalledWith(1,0,'Transferencia',false)
 await userEvent.selectOptions(screen.getByLabelText('Método de pago efectivo'),'Efectivo')
 await userEvent.click(screen.getByRole('button',{name:'Marcar como pagado'}))
 expect(repository.registrarPago).toHaveBeenCalledTimes(1)
 await userEvent.click(screen.getByRole('button',{name:'Volver sin registrar pago'}))
 expect(repository.registrarPago).toHaveBeenCalledTimes(1)
 await userEvent.click(screen.getByRole('button',{name:'Marcar como pagado'}))
 await userEvent.click(screen.getByRole('button',{name:'Confirmar pago recibido'}))
 expect(repository.registrarPago).toHaveBeenLastCalledWith(1,0,'Efectivo',true)
})
test.each([{...pedido,estado:'Cancelado'},{...pedido,estado_pago:'Pagado',metodo_pago:'Efectivo',fecha_pago:'2026-10-09T12:00:00Z'}])('pagado o cancelado no ofrece edición',p=>{
 render(<PagoPedido pedido={p} puedeRegistrar/>)
 expect(screen.queryByLabelText('Método de pago efectivo')).not.toBeInTheDocument()
})
test('lector no puede registrar y un cambio externo invalida la confirmación',async()=>{
 const props={pedido,repository:{registrarPago:vi.fn()},onActualizar:vi.fn()}
 const v=render(<PagoPedido {...props}/>)
 expect(screen.queryByRole('button',{name:'Marcar como pagado'})).not.toBeInTheDocument()
 v.rerender(<PagoPedido {...props} puedeRegistrar/>)
 await userEvent.selectOptions(screen.getByLabelText('Método de pago efectivo'),'Efectivo')
 await userEvent.click(screen.getByRole('button',{name:'Marcar como pagado'}))
 v.rerender(<PagoPedido {...props} puedeRegistrar pedido={{...pedido,version_pago:1,metodo_pago:'Transferencia'}}/>)
 expect(screen.queryByRole('button',{name:'Confirmar pago recibido'})).not.toBeInTheDocument()
 expect(screen.getByLabelText('Método de pago efectivo')).toHaveValue('Transferencia')
})
test('error conserva mensaje y solicita actualizar',async()=>{
 const onActualizar=vi.fn()
 render(<PagoPedido pedido={pedido} puedeRegistrar repository={{registrarPago:vi.fn().mockRejectedValue(Error('Otra persona actualizó el pago.'))}} onActualizar={onActualizar}/>)
 await userEvent.selectOptions(screen.getByLabelText('Método de pago efectivo'),'Efectivo')
 await userEvent.click(screen.getByRole('button',{name:'Guardar método'}))
 expect(await screen.findByRole('alert')).toHaveTextContent('Otra persona')
 expect(onActualizar).toHaveBeenCalledOnce()
})

test('divide el cobro completo y rechaza diferencias sin registrar anticipos',async()=>{
 const repository={registrarPagoDividido:vi.fn().mockResolvedValue({})}
 render(<PagoPedido pedido={{...pedido,total:10000}} puedeRegistrar repository={repository} onActualizar={vi.fn()}/>)
 await userEvent.selectOptions(screen.getByLabelText('Método de pago efectivo'),'Mixto')
 await userEvent.type(screen.getByLabelText('Importe en efectivo'),'4000')
 await userEvent.type(screen.getByLabelText('Importe por transferencia'),'5000')
 await userEvent.click(screen.getByRole('button',{name:'Marcar como pagado'}))
 expect(await screen.findByRole('alert')).toHaveTextContent('sumar el total')
 expect(repository.registrarPagoDividido).not.toHaveBeenCalled()
 await userEvent.clear(screen.getByLabelText('Importe por transferencia'))
 await userEvent.type(screen.getByLabelText('Importe por transferencia'),'6000')
 await userEvent.click(screen.getByRole('button',{name:'Marcar como pagado'}))
 await userEvent.click(screen.getByRole('button',{name:'Confirmar pago recibido'}))
 expect(repository.registrarPagoDividido).toHaveBeenCalledWith(1,0,4000,6000)
})
