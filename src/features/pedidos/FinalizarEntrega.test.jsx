import {render,screen} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {expect,test,vi} from 'vitest'
import FinalizarEntrega from './FinalizarEntrega.jsx'
import {siguienteEstado} from './estadosPedido.js'
const pedido={id:4,estado:'Listo para retirar',version_pago:0,estado_pago:'Pendiente',metodo_pago_previsto:'Transferencia'}
test('flujo distingue envíos, retiros y estados históricos',()=>{
 expect(siguienteEstado('Pendiente')).toBe('En preparación')
 expect(siguienteEstado('En preparación',{modalidad:'envio'})).toBe('En ruta de entrega')
 expect(siguienteEstado('En preparación',{modalidad:'retiro'})).toBe('Listo para retirar')
 expect(siguienteEstado('Listo para entregar',{modalidad:'envio'})).toBe('En ruta de entrega')
 expect(siguienteEstado('Entregado')).toBeNull()
})
test('entrega revisa previsto y permite efectivo real sin dar cobro por hecho',async()=>{
 const repository={finalizarEntrega:vi.fn().mockResolvedValue({})}
 render(<FinalizarEntrega pedido={pedido} puedeRegistrarPago repository={repository} onActualizar={vi.fn()}/>)
 await userEvent.click(screen.getByRole('button',{name:'Revisar y marcar entregado'}))
 expect(screen.getByLabelText('Método acordado al entregar')).toHaveValue('Transferencia')
 expect(screen.getByRole('checkbox')).not.toBeChecked()
 await userEvent.selectOptions(screen.getByLabelText('Método acordado al entregar'),'Efectivo')
 await userEvent.click(screen.getByRole('checkbox'))
 await userEvent.click(screen.getByRole('button',{name:'Confirmar entrega',exact:true}))
 expect(repository.finalizarEntrega).toHaveBeenCalledWith(4,'Listo para retirar',0,'Efectivo',true)
})
test('sin permiso de cobro permite entregar dejando el pago pendiente',async()=>{
 const repository={finalizarEntrega:vi.fn().mockResolvedValue({})}
 render(<FinalizarEntrega pedido={pedido} repository={repository} onActualizar={vi.fn()}/>)
 await userEvent.click(screen.getByRole('button',{name:'Revisar y marcar entregado'}))
 expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
 await userEvent.click(screen.getByRole('button',{name:'Confirmar entrega',exact:true}))
 expect(repository.finalizarEntrega).toHaveBeenCalledWith(4,'Listo para retirar',0,null,false)
})
test('pago externo invalida revisión y no duplica un cobro ya registrado',async()=>{
 const props={pedido,puedeRegistrarPago:true,repository:{finalizarEntrega:vi.fn()},onActualizar:vi.fn()}
 const v=render(<FinalizarEntrega {...props}/>)
 await userEvent.click(screen.getByRole('button',{name:'Revisar y marcar entregado'}))
 v.rerender(<FinalizarEntrega {...props} pedido={{...pedido,version_pago:1,estado_pago:'Pagado',metodo_pago:'Transferencia'}}/>)
 expect(screen.queryByRole('button',{name:'Confirmar entrega',exact:true})).not.toBeInTheDocument()
 await userEvent.click(screen.getByRole('button',{name:'Revisar de nuevo'}))
 expect(screen.getByText(/Pago ya registrado/)).toBeVisible()
 expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
})

test('entrega y cobro dividido se guardan juntos y validan importes',async()=>{
 const repository={finalizarEntregaDividida:vi.fn().mockResolvedValue({}),finalizarEntrega:vi.fn()}
 render(<FinalizarEntrega pedido={{...pedido,total:10000}} puedeRegistrarPago repository={repository} onActualizar={vi.fn()}/>)
 await userEvent.click(screen.getByRole('button',{name:'Revisar y marcar entregado'}))
 await userEvent.selectOptions(screen.getByLabelText('Método acordado al entregar'),'Mixto')
 await userEvent.type(screen.getByLabelText('Importe en efectivo'),'4000')
 await userEvent.type(screen.getByLabelText('Importe por transferencia'),'6000')
 await userEvent.click(screen.getByRole('checkbox'))
 await userEvent.click(screen.getByRole('button',{name:'Confirmar entrega',exact:true}))
 expect(repository.finalizarEntregaDividida).toHaveBeenCalledWith(4,'Listo para retirar',0,4000,6000)
 expect(repository.finalizarEntrega).not.toHaveBeenCalled()
})
