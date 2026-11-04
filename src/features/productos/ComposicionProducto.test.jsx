import {it,expect,vi} from 'vitest'
import {render,screen} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ProductoForm from './ProductoForm.jsx'
it('exige componentes para un combo y mantiene su precio propio',async()=>{
 const user=userEvent.setup(),guardar=vi.fn()
 render(<ProductoForm productosExistentes={[{id:1,nombre:'Gaseosa',precio:1000}]} onGuardar={guardar}/>)
 await user.type(screen.getByLabelText(/Nombre/),'Combo')
 await user.type(screen.getByLabelText(/Precio/),'4000')
 await user.click(screen.getByRole('checkbox'))
 await user.click(screen.getByRole('button',{name:'Crear producto'}))
 expect(guardar).not.toHaveBeenCalled()
 await user.click(screen.getByRole('button',{name:'Agregar componente'}))
 await user.selectOptions(screen.getByLabelText('Componente 1'),'1')
 await user.clear(screen.getByLabelText('Cantidad del componente 1'))
 await user.type(screen.getByLabelText('Cantidad del componente 1'),'2')
 await user.click(screen.getByRole('button',{name:'Crear producto'}))
 expect(guardar).toHaveBeenCalledWith(expect.objectContaining({precio:4000,esCombo:true,componentes:[{componente_id:1,cantidad:2}]}))
})
