import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import Emprendimientos from './Emprendimientos.jsx'
import { obtenerAcceso } from './accesoRepository.js'

vi.mock('./accesoRepository.js', () => ({ obtenerAcceso: vi.fn() }))
const producto = { id: 1, emprendimiento_id: 10, nombre: 'Producto de prueba', precio: 100, visible: false }
const negocio = { id: 10, nombre: 'Negocio de prueba', activo: true, permisos: ['productos.ver'] }
const usuario = { id: 'persona', email: 'persona@example.test' }
let client
beforeEach(() => {
  vi.clearAllMocks()
  history.replaceState(null,'','#/cuenta')
  const query = { select: () => query, eq: () => query, order: () => query, range: async () => ({ data: [producto], error: null }) }
  client = { from: () => query, auth: { signOut: vi.fn().mockResolvedValue({ error: null }) } }
})
test('cliente no recibe panel interno ni alta de emprendimiento', async () => {
  obtenerAcceso.mockResolvedValue({ rol: 'cliente', habilitada: true, negocios: [] })
  render(<Emprendimientos client={client} usuario={usuario} />)
  expect(await screen.findByRole('heading', { name: 'Mi cuenta de cliente' })).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Crear emprendimiento' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Productos' })).not.toBeInTheDocument()
})
test('lector consulta productos sin controles de escritura', async () => {
  obtenerAcceso.mockResolvedValue({ rol: 'emprendimiento', habilitada: true, negocios: [negocio] })
  render(<Emprendimientos client={client} usuario={usuario} />)
  await screen.findByRole('heading',{name:'Productos',exact:true})
  expect(await screen.findByRole('heading', { name: producto.nombre })).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Crear producto' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Editar Producto/ })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Mostrar Producto/ })).not.toBeInTheDocument()
})
test('revocar acceso retira el panel al volver a la ventana', async () => {
  obtenerAcceso.mockResolvedValue({ rol: 'emprendimiento', habilitada: true, negocios: [negocio] })
  render(<Emprendimientos client={client} usuario={usuario} />)
  await screen.findByRole('heading',{name:'Productos',exact:true})
  await screen.findByRole('heading', { name: producto.nombre })
  obtenerAcceso.mockResolvedValue({ rol: 'emprendimiento', habilitada: false, negocios: [] })
  fireEvent(window, new Event('focus'))
  expect(await screen.findByRole('alert')).toHaveTextContent('no está habilitada')
  expect(screen.queryByRole('heading', { name: producto.nombre })).not.toBeInTheDocument()
})
test('error al comprobar permisos no conserva el panel anterior', async () => {
  obtenerAcceso.mockResolvedValue({ rol: 'emprendimiento', habilitada: true, negocios: [negocio] })
  render(<Emprendimientos client={client} usuario={usuario} />)
  await screen.findByRole('heading',{name:'Productos',exact:true})
  await screen.findByRole('heading', { name: producto.nombre })
  obtenerAcceso.mockRejectedValue(new Error('No se pudieron comprobar tus permisos'))
  fireEvent(window, new Event('focus'))
  await waitFor(() => expect(screen.queryByRole('heading', { name: producto.nombre })).not.toBeInTheDocument())
  expect(screen.getByRole('alert')).toHaveTextContent('comprobar tus permisos')
})
test('publicador recibe visibilidad pero no edición ni alta', async () => {
  obtenerAcceso.mockResolvedValue({ rol: 'emprendimiento', habilitada: true, negocios: [{ ...negocio, permisos: ['productos.ver','productos.publicar'] }] })
  render(<Emprendimientos client={client} usuario={usuario} />)
  await screen.findByRole('heading',{name:'Productos',exact:true})
  expect(await screen.findByRole('button', { name: /Mostrar Producto/ })).toBeVisible()
  expect(screen.queryByRole('button', { name: /Editar Producto/ })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Crear producto' })).not.toBeInTheDocument()
})
