import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import PanelPedidos from './PanelPedidos.jsx'
import { crearSonidoPedidos } from './sonidoPedidos.js'
const negocio={id:1,nombre:'Cocina',slug:'cocina',permisos:['pedidos.ver','pedidos.actualizar_estado']}
const pedido={id:10,estado:'Pendiente',fecha_creacion:'2026-10-02T12:00:00Z',subtotal:1500,nombre_contacto:'Cliente QA',telefono_contacto:'1123456789',detalles_pedido:[]}
function montar(repo,permisos=negocio.permisos){return render(<PanelPedidos repository={repo} negocio={{...negocio,permisos}} usuarioId="u1" rol="emprendimiento"/>)}
function base(){return {listar:vi.fn().mockResolvedValue({pedidos:[pedido],total:1}),detalle:vi.fn().mockResolvedValue(pedido)}}
afterEach(()=>vi.unstubAllGlobals())

test('avanza un único paso y conserva fecha e historial',async()=>{
 const repo=base();repo.cambiarEstado=vi.fn().mockImplementation(async()=>{
  const actualizado={...pedido,estado:'En preparación',fecha_estado:'2026-10-02T12:10:00Z',historial_estados_pedido:[{id:1,estado_anterior:'Pendiente',estado_nuevo:'En preparación',fecha:'2026-10-02T12:10:00Z'}]}
  repo.detalle.mockResolvedValue(actualizado);return actualizado
 })
 montar(repo)
 await userEvent.click(await screen.findByRole('button',{name:'Ver pedido #10'}))
 await userEvent.click(await screen.findByRole('button',{name:'Pasar a En preparación'}))
 expect(repo.cambiarEstado).toHaveBeenCalledWith(10,'Pendiente','En preparación')
 await userEvent.click(screen.getByText('Historial de estados',{exact:true}))
 expect(await screen.findByText('Pendiente → En preparación')).toBeVisible()
 expect(screen.getByRole('button',{name:'Pasar a Listo para retirar'})).toBeVisible()
})
test('lectura no ofrece acciones y un pedido entregado no puede avanzar',async()=>{
 const repo=base();repo.detalle.mockResolvedValue({...pedido,estado:'Entregado'});montar(repo,['pedidos.ver'])
 await userEvent.click(await screen.findByRole('button',{name:'Ver pedido #10'}))
 expect(await screen.findByText('Tu cuenta tiene acceso de consulta a este pedido.')).toBeVisible()
 expect(screen.queryByRole('button',{name:/Pasar a/})).not.toBeInTheDocument()
})
test('conflicto conserva aviso y recupera el estado del servidor',async()=>{
 const repo=base();repo.cambiarEstado=vi.fn().mockImplementation(async()=>{repo.detalle.mockResolvedValue({...pedido,estado:'En preparación'});throw new Error('Otra persona ya actualizó este pedido.')})
 montar(repo);await userEvent.click(await screen.findByRole('button',{name:'Ver pedido #10'}))
 await userEvent.click(await screen.findByRole('button',{name:'Pasar a En preparación'}))
 expect(await screen.findByRole('alert')).toHaveTextContent('Otra persona')
 expect(await screen.findByRole('button',{name:'Pasar a Listo para retirar'})).toBeVisible()
})
test('eventos nuevos se deduplican; actualización y reconexión no son pedidos nuevos',async()=>{
 const repo=base();let evento,conexion;const cerrar=vi.fn()
 repo.suscribir=(e,c)=>{evento=e;conexion=c;return cerrar}
 const {unmount}=montar(repo);await screen.findByRole('button',{name:'Ver pedido #10'})
 act(()=>{conexion('SUBSCRIBED');evento({tipo:'SYNC'});evento({tipo:'UPDATE',id:10})})
 expect(screen.queryByText('Llegó un pedido nuevo')).not.toBeInTheDocument()
 act(()=>{evento({tipo:'INSERT',id:11});evento({tipo:'INSERT',id:11})})
 expect(await screen.findByText('Llegó un pedido nuevo')).toBeVisible()
 await waitFor(()=>expect(repo.listar.mock.calls.length).toBeGreaterThan(1))
 await userEvent.click(screen.getByRole('button',{name:'Ver nuevos pedidos'}))
 expect(screen.queryByText('Llegó un pedido nuevo')).not.toBeInTheDocument()
 unmount();expect(cerrar).toHaveBeenCalledOnce()
})
test('una alerta conserva filtros y el detalle seleccionado',async()=>{
 const repo=base();let evento;repo.suscribir=e=>{evento=e;return vi.fn()};montar(repo)
 await userEvent.click(await screen.findByRole('button',{name:'Ver pedido #10'}))
 await screen.findByRole('heading',{name:'Pedido #10'})
 act(()=>evento({tipo:'INSERT',id:12}))
 await waitFor(()=>expect(repo.detalle.mock.calls.length).toBeGreaterThan(1))
 expect(screen.getByRole('heading',{name:'Pedido #10'})).toBeVisible()
 expect(screen.getByText('Llegó un pedido nuevo')).toBeVisible()
})
test('sonido requiere activación, permite silenciar y libera el contexto',async()=>{
 const start=vi.fn(),close=vi.fn().mockResolvedValue(),resume=vi.fn().mockResolvedValue()
 class Audio {state='running';currentTime=0;destination={};resume=resume;close=close
 createOscillator(){return {frequency:{},connect:vi.fn(),disconnect:vi.fn(),start,stop:vi.fn()}}
 createGain(){return {gain:{setValueAtTime:vi.fn(),linearRampToValueAtTime:vi.fn(),exponentialRampToValueAtTime:vi.fn()},connect:vi.fn(),disconnect:vi.fn()}}
 }
 vi.stubGlobal('AudioContext',Audio)
 const audio=crearSonidoPedidos();expect(audio.sonar()).toBe(false);expect(start).not.toHaveBeenCalled()
 await audio.activar();expect(resume).toHaveBeenCalledOnce();expect(start).toHaveBeenCalledTimes(2)
 expect(audio.sonar()).toBe(true);expect(start).toHaveBeenCalledTimes(4)
 audio.silenciar();expect(audio.sonar()).toBe(false);audio.cerrar();expect(close).toHaveBeenCalledOnce()
})

test('cancelar requiere motivo, conserva historial y bloquea acciones posteriores',async()=>{
 const repo=base();repo.cancelar=vi.fn().mockImplementation(async(id,anterior,motivo)=>{
  const actualizado={...pedido,estado:'Cancelado',motivo_cancelacion:motivo,fecha_estado:'2026-10-09T12:00:00Z',historial_estados_pedido:[{id:2,estado_anterior:'Pendiente',estado_nuevo:'Cancelado',fecha:'2026-10-09T12:00:00Z'}]}
  repo.detalle.mockResolvedValue(actualizado);return actualizado
 })
 montar(repo);await userEvent.click(await screen.findByRole('button',{name:'Ver pedido #10'}))
 await userEvent.click(await screen.findByRole('button',{name:'Cancelar pedido',exact:true}))
 expect(screen.getByRole('button',{name:'Confirmar cancelación'})).toBeDisabled()
 await userEvent.type(screen.getByLabelText('Motivo de cancelación'),'El cliente desistió')
 await userEvent.click(screen.getByRole('button',{name:'Confirmar cancelación'}))
 expect(repo.cancelar).toHaveBeenCalledWith(10,'Pendiente','El cliente desistió')
 await userEvent.click(screen.getByText('Historial de estados',{exact:true}))
 expect(await screen.findByText('Pendiente → Cancelado')).toBeVisible()
 expect(screen.getByText('El cliente desistió')).toBeVisible()
 expect(screen.queryByRole('button',{name:'Cancelar pedido',exact:true})).not.toBeInTheDocument()
 expect(screen.queryByRole('button',{name:/Pasar a/})).not.toBeInTheDocument()
})
test('volver sin cancelar no escribe y lector no puede cancelar',async()=>{
 const repo=base();repo.cancelar=vi.fn();const vista=montar(repo)
 await userEvent.click(await screen.findByRole('button',{name:'Ver pedido #10'}))
 await userEvent.click(await screen.findByRole('button',{name:'Cancelar pedido',exact:true}))
 await userEvent.type(screen.getByLabelText('Motivo de cancelación'),'Prueba')
 await userEvent.click(screen.getByRole('button',{name:'Volver sin cancelar'}))
 expect(repo.cancelar).not.toHaveBeenCalled()
 vista.unmount();montar(repo,['pedidos.ver'])
 await userEvent.click(await screen.findByRole('button',{name:'Ver pedido #10'}))
 expect(screen.queryByRole('button',{name:'Cancelar pedido',exact:true})).not.toBeInTheDocument()
})
test('cancelación en conflicto muestra error y recupera pedido entregado',async()=>{
 const repo=base();repo.cancelar=vi.fn().mockImplementation(async()=>{repo.detalle.mockResolvedValue({...pedido,estado:'Entregado'});throw Error('Otra persona ya actualizó este pedido.')})
 montar(repo);await userEvent.click(await screen.findByRole('button',{name:'Ver pedido #10'}))
 await userEvent.click(await screen.findByRole('button',{name:'Cancelar pedido',exact:true}))
 await userEvent.type(screen.getByLabelText('Motivo de cancelación'),'Prueba')
 await userEvent.click(screen.getByRole('button',{name:'Confirmar cancelación'}))
 expect(await screen.findByRole('alert')).toHaveTextContent('Otra persona')
 expect(await screen.findByText('Pedido entregado')).toBeVisible()
 expect(screen.queryByRole('button',{name:'Confirmar cancelación'})).not.toBeInTheDocument()
})
