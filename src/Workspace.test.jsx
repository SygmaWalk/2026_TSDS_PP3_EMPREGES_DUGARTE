import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import Workspace from './Workspace.jsx'

const producto = { id: 71, emprendimientoId: 2, nombre: 'Tequeños', precio: 1000, visible: false }
const negocio = { id: 2, nombre: 'Mi negocio' }

async function completar(user) {
  await user.type(screen.getByLabelText(/^Nombre/), 'Tequeños')
  await user.type(screen.getByLabelText(/^Precio/), '1000')
}

test('CP-PERSIST-01: espera al servidor, bloquea el doble envío y utiliza el producto confirmado', async () => {
  const user = userEvent.setup()
  let confirmar
  const repository = { crear: vi.fn(() => new Promise(resolve => { confirmar = resolve })) }
  render(<Workspace repository={repository} negocio={negocio} />)
  await completar(user)
  await user.click(screen.getByRole('button', { name: 'Crear producto' }))
  expect(screen.getByRole('button', { name: 'Guardando…' })).toBeDisabled()
  expect(screen.getByText('Todavía no hay productos')).toBeVisible()
  expect(screen.getByLabelText(/^Nombre/)).toHaveValue('Tequeños')
  await act(async () => confirmar({ ...producto, nombre: 'Tequeños confirmado' }))
  expect(screen.getByRole('heading', { name: 'Tequeños confirmado' })).toBeVisible()
  expect(screen.getByLabelText(/^Nombre/)).toHaveValue('')
  expect(repository.crear).toHaveBeenCalledTimes(1)
})

test('CP-PERSIST-02: un error de guardado conserva el formulario y permite reintentar', async () => {
  const user = userEvent.setup()
  const repository = { crear: vi.fn().mockRejectedValueOnce(new Error('Sin conexión')).mockResolvedValueOnce(producto) }
  render(<Workspace repository={repository} negocio={negocio} />)
  await completar(user)
  await user.click(screen.getByRole('button', { name: 'Crear producto' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Sin conexión')
  expect(screen.getByLabelText(/^Nombre/)).toHaveValue('Tequeños')
  expect(screen.getByText('Todavía no hay productos')).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Crear producto' }))
  expect(await screen.findByRole('heading', { name: 'Tequeños' })).toBeVisible()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

test('CP-PERSIST-03: una actualización denegada no cambia la visibilidad local', async () => {
  const user = userEvent.setup()
  const repository = { visibilidad: vi.fn().mockRejectedValue(new Error('Sin permiso')) }
  render(<Workspace repository={repository} negocio={negocio} productosIniciales={[producto]} />)
  await user.click(screen.getByRole('button', { name: 'Mostrar Tequeños en el catálogo público' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Sin permiso')
  expect(screen.getByText('Oculto')).toBeVisible()
  expect(screen.getByText('No hay productos visibles por el momento.')).toBeVisible()
})

test('CP-PERSIST-04: editar conserva los campos ante error y espera confirmación para actualizar el listado', async () => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  const user = userEvent.setup()
  const repository = { editar: vi.fn().mockRejectedValueOnce(new Error('Sin conexión')).mockResolvedValueOnce({ ...producto, precio: 1500 }) }
  render(<Workspace repository={repository} negocio={negocio} productosIniciales={[producto]} />)
  await user.click(screen.getByRole('button', { name: 'Editar Tequeños' }))
  await user.clear(screen.getByLabelText(/^Precio/))
  await user.type(screen.getByLabelText(/^Precio/), '1500')
  await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Sin conexión')
  expect(screen.getByLabelText(/^Precio/)).toHaveValue('1500')
  expect(screen.getByText(/1.000,00/)).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))
  expect(await screen.findByText(/1.500,00/)).toBeVisible()
  expect(repository.editar).toHaveBeenLastCalledWith(71, expect.objectContaining({ precio: 1500 }))
})
