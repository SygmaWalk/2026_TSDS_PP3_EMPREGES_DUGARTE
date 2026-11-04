import {render,screen} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {expect,test,vi} from 'vitest'
import ProductosPanel from './ProductosPanel.jsx'
// jsdom no implementa la API modal; el comportamiento real se verifica con Playwright.
Object.defineProperties(HTMLDialogElement.prototype,{
 showModal:{configurable:true,value:function(){this.setAttribute('open','')}},
 close:{configurable:true,value:function(){this.removeAttribute('open')}}
})
const negocio={id:1,permisos:['productos.ver','productos.crear','productos.editar','productos.publicar']}
test('lista primero, guarda producto y retira el formulario al confirmar',async()=>{
 const repository={crear:vi.fn().mockResolvedValue({id:1,nombre:'Nuevo QA',precio:100,visible:false})}
 const user=userEvent.setup()
 render(<ProductosPanel negocio={negocio} productosIniciales={[]} repository={repository}/>)
 expect(screen.queryByLabelText(/^Nombre/)).not.toBeInTheDocument()
 expect(screen.queryByText(/carrito/i)).not.toBeInTheDocument()
 await user.click(screen.getByRole('button',{name:'Nuevo producto',exact:true}))
 await user.type(screen.getByLabelText(/^Nombre/),'Nuevo QA');await user.type(screen.getByLabelText(/^Precio/),'100')
 await user.click(screen.getByRole('button',{name:'Crear producto',exact:true}))
 expect(await screen.findByRole('heading',{name:'Nuevo QA'})).toBeVisible()
 expect(screen.queryByLabelText(/^Nombre/)).not.toBeInTheDocument()
 expect(repository.crear).toHaveBeenCalledTimes(1)
})
test('un error no pierde la edición ni cambia el listado',async()=>{
 const repository={editar:vi.fn().mockRejectedValue(new Error('Sin conexión'))},user=userEvent.setup()
 render(<ProductosPanel negocio={negocio} productosIniciales={[{id:1,nombre:'Producto QA',precio:100,visible:false}]} repository={repository}/>)
 await user.click(screen.getByRole('button',{name:'Editar Producto QA'}))
 await user.clear(screen.getByLabelText(/^Precio/));await user.type(screen.getByLabelText(/^Precio/),'200')
 await user.click(screen.getByRole('button',{name:'Guardar cambios'}))
 expect(await screen.findByRole('alert')).toHaveTextContent('Sin conexión')
 expect(screen.getByLabelText(/^Precio/)).toHaveValue('200')
})

test('consulta antes de eliminar, permite cancelar y requiere confirmación explícita',async()=>{
 const repository={retirar:vi.fn().mockResolvedValueOnce({accion:'eliminar',dependencias:[],nombre:'Producto QA'}).mockResolvedValueOnce({accion:'eliminar',dependencias:[],nombre:'Producto QA'}).mockResolvedValueOnce({accion:'eliminar',id:1})}
 const user=userEvent.setup()
 render(<ProductosPanel negocio={negocio} productosIniciales={[{id:1,nombre:'Producto QA',precio:100,visible:false}]} repository={repository}/>)
 await user.click(screen.getByRole('button',{name:'Eliminar Producto QA'}))
 await user.click(await screen.findByRole('button',{name:'Volver',exact:true}))
 expect(repository.retirar).toHaveBeenCalledTimes(1)
 expect(screen.getByRole('heading',{name:'Producto QA'})).toBeVisible()
 await user.click(screen.getByRole('button',{name:'Eliminar Producto QA'}))
 await user.click(await screen.findByRole('button',{name:'Eliminar definitivamente'}))
 expect(repository.retirar).toHaveBeenLastCalledWith(1,'eliminar')
 expect(await screen.findByRole('status')).toHaveTextContent('Producto eliminado definitivamente.')
 expect(screen.queryByRole('heading',{name:'Producto QA'})).not.toBeInTheDocument()
})
test('un componente utilizado informa dependencias y no ofrece confirmar el retiro',async()=>{
 const repository={retirar:vi.fn().mockResolvedValue({accion:'archivar',dependencias:[{id:2,nombre:'Combo familiar'}],nombre:'Gaseosa'})}
 const user=userEvent.setup()
 render(<ProductosPanel negocio={negocio} productosIniciales={[{id:1,nombre:'Gaseosa',precio:100,visible:true}]} repository={repository}/>)
 await user.click(screen.getByRole('button',{name:'Eliminar Gaseosa'}))
 expect(await screen.findByText('Combo familiar')).toBeVisible()
 expect(screen.queryByRole('button',{name:'Archivar producto'})).not.toBeInTheDocument()
 expect(repository.retirar).toHaveBeenCalledTimes(1)
})
