import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import PanelPedidos from './PanelPedidos.jsx'
import { intervaloFechas } from './panelPedidosRepository.js'
const negocio={id:1,nombre:'Tienda de prueba',slug:'tienda',permisos:['pedidos.ver']}
const pedido={id:10,nombre_contacto:'Cliente QA',telefono_contacto:'1123456789',subtotal:3000,estado:'Pendiente',fecha_creacion:'2026-10-01T13:00:00Z'}
function montar(repository){return render(<PanelPedidos negocio={negocio} usuarioId="u1" rol="emprendimiento" email="qa@example.test" repository={repository} onVolver={vi.fn()} onProductos={vi.fn()}/>)}
test('fecha hasta incluye su día completo y rechaza rangos inválidos',()=>{
 const {inicio,fin}=intervaloFechas('2026-10-01','2026-10-01')
 expect(new Date(inicio).getHours()).toBe(0)
 expect(new Date(fin).getDate()).toBe(2)
 expect(()=>intervaloFechas('2026-10-02','2026-10-01')).toThrow('posterior')
 expect(()=>intervaloFechas('2026-02-30','')).toThrow('válidas')
})
test('distingue carga de ausencia de pedidos',async()=>{
 let resolver;montar({listar:()=>new Promise(r=>resolver=r)})
 expect(screen.getByRole('status')).toHaveTextContent('Cargando pedidos')
 resolver({pedidos:[],total:0})
 expect(await screen.findByRole('heading',{name:'Todavía no hay pedidos'})).toBeVisible()
})
test('muestra error y permite reintentar',async()=>{
 const listar=vi.fn().mockRejectedValueOnce(new Error('No se pudieron cargar los pedidos.')).mockResolvedValueOnce({pedidos:[pedido],total:1})
 montar({listar})
 expect(await screen.findByRole('alert')).toHaveTextContent('No se pudieron')
 await userEvent.click(screen.getByRole('button',{name:'Reintentar',exact:true}))
 expect(await screen.findByRole('button',{name:'Ver pedido #10'})).toBeVisible()
})
test('aplica estado y fecha, diferencia vacío filtrado y limpia filtros',async()=>{
 const listar=vi.fn().mockResolvedValue({pedidos:[],total:0});montar({listar})
 const user=userEvent.setup()
 await screen.findByRole('heading',{name:'Todavía no hay pedidos'})
 await user.selectOptions(screen.getByLabelText('Estado'),'Pendiente')
 await user.type(screen.getByLabelText('Desde'),'2026-10-01')
 await user.type(screen.getByLabelText('Hasta'),'2026-10-02')
 await user.click(screen.getByRole('button',{name:'Aplicar filtros'}))
 expect(await screen.findByRole('heading',{name:'No hay pedidos para estos filtros'})).toBeVisible()
 expect(listar).toHaveBeenLastCalledWith({estado:'Pendiente',desde:'2026-10-01',hasta:'2026-10-02',pagina:0})
 await user.click(screen.getByRole('button',{name:'Limpiar filtros'}))
 expect(await screen.findByRole('heading',{name:'Todavía no hay pedidos'})).toBeVisible()
})
test('pagina sin mezclar resultados y consulta el detalle seleccionado',async()=>{
 const listar=vi.fn().mockResolvedValueOnce({pedidos:[pedido],total:26}).mockResolvedValue({pedidos:[{...pedido,id:11}],total:26})
 const detalle=vi.fn().mockResolvedValue({...pedido,id:11,detalles_pedido:[{producto_id:1,nombre_producto:'Producto histórico',precio_unitario:1500,cantidad:2}]})
 montar({listar,detalle})
 await screen.findByRole('button',{name:'Ver pedido #10'})
 await userEvent.click(screen.getByRole('button',{name:'Siguiente'}))
 expect(await screen.findByRole('button',{name:'Ver pedido #11'})).toBeVisible()
 expect(listar).toHaveBeenLastCalledWith({estado:'',desde:'',hasta:'',pagina:1})
 await userEvent.click(screen.getByRole('button',{name:'Ver pedido #11'}))
 expect(await screen.findByText('2 × Producto histórico')).toBeVisible()
 expect(detalle).toHaveBeenCalledWith(11)
 expect(screen.queryByRole('button',{name:'Productos',exact:true})).not.toBeInTheDocument()
})
test('detalle retirado no deja visible información anterior',async()=>{
 montar({listar:vi.fn().mockResolvedValue({pedidos:[pedido],total:1}),detalle:vi.fn().mockResolvedValue(null)})
 await userEvent.click(await screen.findByRole('button',{name:'Ver pedido #10'}))
 expect(await screen.findByRole('alert')).toHaveTextContent('no está disponible')
 expect(within(screen.getByRole('region',{name:'Detalle del pedido #10'})).queryByText('Cliente QA')).not.toBeInTheDocument()
})

test('despliega en la misma lista, conserva la ruta y abre un solo pedido por vez',async()=>{
 const segundo={...pedido,id:11,nombre_contacto:'Otro cliente'}
 const repo={listar:vi.fn().mockResolvedValue({pedidos:[pedido,segundo],total:2}),detalle:vi.fn().mockImplementation(async id=>({...pedido,id,detalles_pedido:[]}))}
 montar(repo)
 const ruta=window.location.hash
 await userEvent.click(await screen.findByRole('button',{name:'Ver pedido #10'}))
 expect(await screen.findByRole('region',{name:'Detalle del pedido #10'})).toBeVisible()
 expect(screen.getByRole('button',{name:'Cerrar pedido #10'})).toHaveAttribute('aria-expanded','true')
 expect(screen.getByRole('button',{name:'Ver pedido #11'})).toBeVisible()
 expect(screen.getByLabelText('Estado')).toBeVisible()
 expect(window.location.hash).toBe(ruta)
 await userEvent.click(screen.getByRole('button',{name:'Ver pedido #11'}))
 expect(await screen.findByRole('region',{name:'Detalle del pedido #11'})).toBeVisible()
 expect(screen.queryByRole('region',{name:'Detalle del pedido #10'})).not.toBeInTheDocument()
 await userEvent.click(screen.getByRole('button',{name:'Cerrar pedido #11'}))
 expect(screen.queryByRole('region',{name:'Detalle del pedido #11'})).not.toBeInTheDocument()
 expect(screen.getByRole('button',{name:'Ver pedido #11'})).toHaveAttribute('aria-expanded','false')
})
