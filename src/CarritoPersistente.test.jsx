import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test } from 'vitest'
import Workspace from './Workspace.jsx'

beforeEach(() => localStorage.clear())

test('CP-CAR-P07: conserva cantidades al montar nuevamente la pantalla y usa el precio actual', async () => {
  const user = userEvent.setup()
  const producto = { id: 71, emprendimientoId: 2, nombre: 'Tequeños', precio: 1000, visible: true }
  const props = { repository: {}, usuarioId: 'cuenta-qa', negocio: { id: 2, nombre: 'QA' }, productosIniciales: [producto] }
  let vista = render(<Workspace {...props} />)
  await user.click(screen.getByRole('button', { name: 'Catálogo', exact: true }))
  await user.click(screen.getByRole('button', { name: 'Agregar Tequeños al carrito' }))
  await user.click(screen.getByRole('button', { name: 'Carrito (1)', exact: true }))
  await user.clear(screen.getByLabelText('Cantidad de Tequeños'))
  await user.type(screen.getByLabelText('Cantidad de Tequeños'), '3')
  await user.click(screen.getByRole('button', { name: 'Actualizar cantidad de Tequeños' }))
  vista.unmount()
  vista = render(<Workspace {...props} productosIniciales={[{ ...producto, precio: 1500 }]} />)
  await user.click(screen.getByRole('button', { name: 'Carrito (3)', exact: true }))
  expect(screen.getByLabelText('Cantidad de Tequeños')).toHaveValue('3')
  expect(screen.getByTestId('subtotal')).toHaveTextContent('4.500,00')
  await user.click(screen.getByRole('button', { name: 'Quitar Tequeños' }))
  vista.unmount()
  render(<Workspace {...props} />)
  await user.click(screen.getByRole('button', { name: 'Carrito (0)', exact: true }))
  expect(screen.getByText(/Tu carrito está vacío/)).toBeVisible()
})
