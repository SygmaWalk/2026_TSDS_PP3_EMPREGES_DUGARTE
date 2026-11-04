import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import TiendaPublica from './TiendaPublica.jsx'
import { cargarTienda } from './catalogoRepository.js'
import { claveCarritoInvitado } from '../carrito/carritoStorage.js'
vi.mock('./catalogoRepository.js', () => ({ cargarTienda: vi.fn() }))
const tienda = { negocio:{ id:71, nombre:'Tienda A', slug:'tienda-a', activo:true }, productos:[{id:1, emprendimientoId:71, nombre:'Pan de campo', precio:1000, visible:true, imagenPath:null}] }
beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear(); cargarTienda.mockResolvedValue(tienda) })
test('invitado arma el carrito sin autenticación y lo recupera con precio vigente al recargar', async () => {
  const user = userEvent.setup()
  let vista = render(<TiendaPublica client={{}} slug="tienda-a" />)
  await user.click(await screen.findByRole('button', {name:'Agregar Pan de campo al carrito'}))
  await user.click(screen.getByRole('button', {name:'Carrito (1)'}))
  await user.clear(screen.getByLabelText('Cantidad de Pan de campo'))
  await user.type(screen.getByLabelText('Cantidad de Pan de campo'), '3')
  await user.click(screen.getByRole('button', {name:'Actualizar cantidad de Pan de campo'}))
  vista.unmount()
  cargarTienda.mockResolvedValue({...tienda, productos:[{...tienda.productos[0],precio:1500}]})
  vista = render(<TiendaPublica client={{}} slug="tienda-a" />)
  await user.click(await screen.findByRole('button', {name:'Carrito (3)'}))
  expect(screen.getByTestId('subtotal')).toHaveTextContent('4.500,00')
  await user.click(screen.getByRole('button', {name:'Quitar Pan de campo'}))
  expect(localStorage.getItem(claveCarritoInvitado(71))).toBeNull()
  vista.unmount()
})
test('el carrito de una tienda no aparece en otra y no utiliza la cuenta interna', async () => {
  localStorage.setItem(claveCarritoInvitado(71),JSON.stringify({version:1,items:[{id:1,cantidad:2}]}))
  cargarTienda.mockResolvedValue({negocio:{id:72,nombre:'Tienda B',slug:'tienda-b'},productos:[]})
  render(<TiendaPublica client={{}} slug="tienda-b" />)
  expect(await screen.findByRole('button',{name:'Carrito (0)'})).toBeVisible()
  expect(localStorage.getItem(claveCarritoInvitado(71))).not.toBeNull()
})
test('un producto retirado del catálogo no se recupera en el carrito', async () => {
  localStorage.setItem(claveCarritoInvitado(71),JSON.stringify({version:1,items:[{id:1,cantidad:2}]}))
  cargarTienda.mockResolvedValue({...tienda,productos:[]})
  render(<TiendaPublica client={{}} slug="tienda-a" />)
  expect(await screen.findByRole('button',{name:'Carrito (0)'})).toBeVisible()
  expect(screen.getByText('No hay productos visibles por el momento.')).toBeVisible()
  expect(localStorage.getItem(claveCarritoInvitado(71))).toBeNull()
})
test('error de red permite reintentar y no se confunde con catálogo vacío', async () => {
  cargarTienda.mockRejectedValueOnce(new Error('No se pudo cargar la tienda')).mockResolvedValueOnce(tienda)
  render(<TiendaPublica client={{}} slug="tienda-a" />)
  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo cargar')
  expect(screen.queryByText('No hay productos visibles por el momento.')).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button',{name:'Reintentar'}))
  expect(await screen.findByRole('heading',{name:'Tienda A'})).toBeVisible()
})
test('una tienda inexistente o inactiva no muestra productos ni carrito', async () => {
  cargarTienda.mockResolvedValue(null)
  render(<TiendaPublica client={{}} slug="no-existe" />)
  expect(await screen.findByRole('heading',{name:'No encontramos esta tienda'})).toBeVisible()
  expect(screen.queryByRole('button',{name:'Ver carrito'})).not.toBeInTheDocument()
})

test('un comprobante ya atendido no borra un carrito nuevo de otra pestaña', async () => {
  const clave = 'empregest:pedido:v1:tienda-a:invitado'
  sessionStorage.setItem(clave,JSON.stringify({estado:'confirmado',carritoVaciado:true,negocio:tienda.negocio,
    recibo:{id:12,estado:'Pendiente',fecha:'2026-10-01T13:00:00Z',subtotal_centavos:100000,
      items:[{producto_id:1,nombre:'Pan de campo',precio_centavos:100000,cantidad:1}]}}))
  const nuevo = JSON.stringify({version:1,items:[{id:1,cantidad:4}]})
  localStorage.setItem(claveCarritoInvitado(71),nuevo)
  render(<TiendaPublica client={{}} slug="tienda-a" />)
  expect(await screen.findByRole('heading',{name:'Tu pedido quedó registrado'})).toBeVisible()
  fireEvent(window,new Event('focus'))
  expect(localStorage.getItem(claveCarritoInvitado(71))).toBe(nuevo)
})

test('exige iniciar sesión al confirmar y conserva el carrito del invitado',async()=>{
 const user=userEvent.setup()
 render(<TiendaPublica client={{}} slug="tienda-a"/>)
 await user.click(await screen.findByRole('button',{name:'Agregar Pan de campo al carrito'}))
 await user.click(screen.getByRole('button',{name:'Carrito (1)'}))
 await user.click(screen.getByRole('button',{name:'Continuar con el pedido'}))
 expect(await screen.findByRole('heading',{name:'Ingresá para confirmar tu pedido'})).toBeVisible()
 expect(screen.queryByLabelText('Nombre de contacto')).not.toBeInTheDocument()
 expect(localStorage.getItem(claveCarritoInvitado(71))).not.toBeNull()
 await user.click(screen.getByRole('link',{name:'Iniciar sesión',exact:true}))
 expect(sessionStorage.getItem('empreges:retorno-compra')).toBe('#/tienda/tienda-a')
})
