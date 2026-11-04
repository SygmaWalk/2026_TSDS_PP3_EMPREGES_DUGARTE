import {render,screen} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {expect,test,vi} from 'vitest'
import PanelClientes from './PanelClientes.jsx'
const cliente={id:1,nombre:'Ana',telefono:'+54 11 1234-5678',direccion:'Calle 123',referencia:'Puerta azul',version:0,fecha_actualizacion:'2026-10-10T12:00:00Z'}
const negocio={id:2,nombre:'Tienda',permisos:['clientes.ver','clientes.editar']}
function montar(repo,permisos=negocio.permisos){return render(<PanelClientes repository={repo} negocio={{...negocio,permisos}}/>)}
function base(){return {listar:vi.fn().mockResolvedValue({clientes:[cliente],total:1}),detalle:vi.fn().mockResolvedValue(cliente),guardar:vi.fn().mockImplementation(async c=>({...c,version:c.version+1}))}}
test('edita ficha conservando versión esperada',async()=>{
 const repo=base();montar(repo)
 await userEvent.click(await screen.findByRole('button',{name:'Ver ficha de Ana'}))
 await userEvent.click(await screen.findByRole('button',{name:'Editar datos del cliente'}))
 await userEvent.clear(screen.getByLabelText('Nombre del cliente'));await userEvent.type(screen.getByLabelText('Nombre del cliente'),'Ana María')
 await userEvent.click(screen.getByRole('button',{name:'Guardar datos del cliente'}))
 expect(await screen.findByText('Datos del cliente actualizados.')).toBeVisible()
 expect(repo.guardar).toHaveBeenCalledWith(expect.objectContaining({id:1,version:0,nombre:'Ana María'}))
})
test('lector consulta sin controles de edición',async()=>{
 montar(base(),['clientes.ver'])
 await userEvent.click(await screen.findByRole('button',{name:'Ver ficha de Ana'}))
 expect(await screen.findByText('Tu cuenta tiene acceso de consulta.')).toBeVisible()
 expect(screen.queryByRole('button',{name:'Editar datos del cliente'})).not.toBeInTheDocument()
})
test('teléfono duplicado informa error y mantiene borrador',async()=>{
 const repo=base();repo.guardar.mockRejectedValue(Error('Ese teléfono ya pertenece a otra ficha.'));montar(repo)
 await userEvent.click(await screen.findByRole('button',{name:'Ver ficha de Ana'}))
 await userEvent.click(await screen.findByRole('button',{name:'Editar datos del cliente'}))
 await userEvent.click(screen.getByRole('button',{name:'Guardar datos del cliente'}))
 expect(await screen.findByRole('alert')).toHaveTextContent('otra ficha')
 expect(screen.getByLabelText('Teléfono del cliente')).toHaveValue(cliente.telefono)
})
test('muestra vacío y permite recuperar error de carga',async()=>{
 const repo=base();repo.listar.mockRejectedValueOnce(Error('Sin conexión')).mockResolvedValue({clientes:[],total:0});montar(repo)
 expect(await screen.findByRole('alert')).toHaveTextContent('Sin conexión')
 await userEvent.click(screen.getByRole('button',{name:'Actualizar clientes'}))
 expect(await screen.findByText('Todavía no hay clientes en esta página')).toBeVisible()
})

test('busca, conserva el filtro al volver de una ficha y limpia resultados',async()=>{
 const repo=base();montar(repo)
 await screen.findByRole('button',{name:'Ver ficha de Ana'})
 await userEvent.type(screen.getByLabelText('Buscar por nombre o teléfono'),'ana')
 await userEvent.click(screen.getByRole('button',{name:'Buscar clientes'}))
 expect(await screen.findByText('Resultados para «ana»')).toBeVisible()
 expect(repo.listar).toHaveBeenLastCalledWith(0,'ana')
 await userEvent.click(await screen.findByRole('button',{name:'Ver ficha de Ana'}))
 await userEvent.click(await screen.findByRole('button',{name:'Volver a clientes'}))
 expect(await screen.findByLabelText('Buscar por nombre o teléfono')).toHaveValue('ana')
 await userEvent.click(screen.getByRole('button',{name:'Limpiar búsqueda'}))
 expect(repo.listar).toHaveBeenLastCalledWith(0,'')
})
test('una respuesta lenta anterior no reemplaza la búsqueda actual',async()=>{
 const repo=base();let resolver
 repo.listar.mockImplementationOnce(()=>new Promise(r=>{resolver=r})).mockResolvedValue({clientes:[],total:0})
 montar(repo)
 await userEvent.type(screen.getByLabelText('Buscar por nombre o teléfono'),'Ausente')
 await userEvent.click(screen.getByRole('button',{name:'Buscar clientes'}))
 expect(await screen.findByText('No encontramos clientes con esa búsqueda')).toBeVisible()
 resolver({clientes:[cliente],total:1})
 await screen.findByText('No encontramos clientes con esa búsqueda')
 expect(screen.queryByRole('button',{name:'Ver ficha de Ana'})).not.toBeInTheDocument()
})
test('sin permiso de pedidos no consulta el historial',async()=>{
 const repo=base();repo.historial=vi.fn();montar(repo,['clientes.ver'])
 await userEvent.click(await screen.findByRole('button',{name:'Ver ficha de Ana'}))
 expect(await screen.findByText('Necesitás permiso para consultar pedidos y ver el historial de este cliente.')).toBeVisible()
 expect(repo.historial).not.toHaveBeenCalled()
})
