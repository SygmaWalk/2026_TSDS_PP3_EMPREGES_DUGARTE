import {render,screen} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {expect,test,vi} from 'vitest'
import PanelStock from './PanelStock.jsx'
const producto={producto_id:1,nombre:'Gaseosa',disponible:10,visible:true}
const negocio={id:2,nombre:'Tienda',permisos:['productos.ver','stock.ver','stock.registrar']}
function base(){return {listar:vi.fn().mockResolvedValue({productos:[producto],total:1}),historial:vi.fn().mockResolvedValue({movimientos:[],total:0}),registrar:vi.fn().mockResolvedValue({disponible:12})}}
async function formulario(repo,permisos=negocio.permisos){
 render(<PanelStock negocio={{...negocio,permisos}} repository={repo}/>)
 await userEvent.click(await screen.findByRole('button',{name:'Ver inventario de Gaseosa'}))
 if(permisos.includes('stock.registrar'))await userEvent.click(screen.getByRole('button',{name:'Registrar movimiento'}))
}
test('registra cantidad y motivo con una clave de reintento',async()=>{
 const repo=base();await formulario(repo)
 await userEvent.type(screen.getByLabelText('Cantidad de unidades'),'2')
 await userEvent.type(screen.getByLabelText('Motivo del movimiento'),'Reposición')
 await userEvent.click(screen.getByRole('button',{name:'Guardar movimiento'}))
 expect(await screen.findByText('Movimiento registrado. Stock disponible: 12')).toBeVisible()
 expect(repo.registrar).toHaveBeenCalledWith(producto,expect.objectContaining({tipo:'Entrada',cantidad:'2',motivo:'Reposición',clave:expect.any(String)}))
})
test('error de red conserva borrador y reutiliza clave para evitar duplicar',async()=>{
 const repo=base();repo.registrar.mockRejectedValueOnce(Error('Sin conexión'));await formulario(repo)
 await userEvent.type(screen.getByLabelText('Cantidad de unidades'),'2')
 await userEvent.type(screen.getByLabelText('Motivo del movimiento'),'Reposición')
 await userEvent.click(screen.getByRole('button',{name:'Guardar movimiento'}))
 expect(await screen.findByRole('alert')).toHaveTextContent('Sin conexión')
 expect(screen.getByLabelText('Cantidad de unidades')).toHaveValue('2')
 const clave=repo.registrar.mock.calls[0][1].clave
 await userEvent.click(screen.getByRole('button',{name:'Guardar movimiento'}))
 expect(await screen.findByText('Movimiento registrado. Stock disponible: 12')).toBeVisible()
 expect(repo.registrar.mock.calls[1][1].clave).toBe(clave)
})
test('solo consulta no muestra escritura ni permite eliminar movimientos',async()=>{
 await formulario(base(),['productos.ver','stock.ver'])
 expect(screen.queryByRole('button',{name:'Registrar movimiento'})).not.toBeInTheDocument()
 expect(await screen.findByText('Todavía no hay movimientos registrados.')).toBeVisible()
})
test('cantidad inválida se rechaza antes de registrar',async()=>{
 const repo=base();await formulario(repo)
 await userEvent.type(screen.getByLabelText('Cantidad de unidades'),'-2')
 await userEvent.type(screen.getByLabelText('Motivo del movimiento'),'Ajuste')
 await userEvent.click(screen.getByRole('button',{name:'Guardar movimiento'}))
 expect(await screen.findByRole('alert')).toHaveTextContent('mayor a cero')
 expect(repo.registrar).not.toHaveBeenCalled()
})
